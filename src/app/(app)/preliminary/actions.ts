'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { notifyUsers } from '@/lib/notifications'
import {
  cancelPreliminaryCellMark,
  createPreliminaryCellMark,
  createPreliminaryMarkGroup,
  reviewPreliminaryCellMark,
} from '@/lib/preliminary-schedule/cell-marks'
import {
  cancelPreliminaryRequest,
  submitPreliminaryChangeRequest,
  submitPreliminaryClaimRequest,
} from '@/lib/preliminary-schedule/mutations'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function getCurrentActiveUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_active || profile.archived_at) {
    redirect('/login?error=account_inactive')
  }

  return { supabase, userId: user.id }
}

async function notifyManagersOfPreliminaryRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: 'claim_open_shift' | 'request_change' | 'pencil_mark'
) {
  const { data: managersData, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'manager')
    .eq('is_active', true)

  if (error) {
    console.error('Failed to load managers for preliminary request notification:', error)
    return
  }

  await notifyUsers(supabase, {
    userIds: (managersData ?? []).map((row) => row.id as string).filter((id) => id !== userId),
    eventType: 'preliminary_request_submitted',
    title:
      type === 'pencil_mark' ? 'Preliminary pencil mark waiting' : 'Preliminary request waiting',
    message:
      type === 'claim_open_shift'
        ? 'A therapist claimed an open preliminary shift and needs approval.'
        : type === 'request_change'
          ? 'A therapist requested a preliminary schedule change and needs approval.'
          : 'A therapist added a preliminary pencil mark for manager review.',
    targetType: 'system',
    targetId: userId,
  })
}

async function redirectWithResult(success?: string, error?: string) {
  const params = new URLSearchParams()
  if (success) params.set('success', success)
  if (error) params.set('error', error)
  const query = params.toString()
  redirect(query ? `/preliminary?${query}` : '/preliminary')
}

function preliminaryMarkErrorCode(message: string | null | undefined): string {
  const lowered = (message ?? '').toLowerCase()
  if (lowered.includes('manager already resolved this preliminary mark')) {
    return 'preliminary_mark_already_resolved'
  }
  return 'preliminary_mark_failed'
}

export async function claimPreliminaryShiftAction(formData: FormData) {
  const { userId } = await getCurrentActiveUser()
  const admin = createAdminClient()
  const snapshotId = String(formData.get('snapshot_id') ?? '').trim()
  const shiftId = String(formData.get('shift_id') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  const result = await submitPreliminaryClaimRequest(admin as never, {
    snapshotId,
    shiftId,
    requesterId: userId,
    note,
  })

  if (result.error) {
    await redirectWithResult(undefined, result.error.code)
  }

  await notifyManagersOfPreliminaryRequest(admin as never, userId, 'claim_open_shift')

  revalidatePath('/preliminary')
  revalidatePath('/approvals')

  await redirectWithResult('preliminary_claim_requested')
}

export async function requestPreliminaryChangeAction(formData: FormData) {
  const { userId } = await getCurrentActiveUser()
  const admin = createAdminClient()
  const snapshotId = String(formData.get('snapshot_id') ?? '').trim()
  const shiftId = String(formData.get('shift_id') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  const result = await submitPreliminaryChangeRequest(admin as never, {
    snapshotId,
    shiftId,
    requesterId: userId,
    note,
  })

  if (result.error) {
    await redirectWithResult(undefined, result.error.code)
  }

  await notifyManagersOfPreliminaryRequest(admin as never, userId, 'request_change')

  revalidatePath('/preliminary')
  revalidatePath('/approvals')

  await redirectWithResult('preliminary_change_requested')
}

export async function cancelPreliminaryRequestAction(formData: FormData) {
  const { userId } = await getCurrentActiveUser()
  const admin = createAdminClient()
  const requestId = String(formData.get('request_id') ?? '').trim()

  const result = await cancelPreliminaryRequest(admin as never, {
    requestId,
    requesterId: userId,
  })

  if (result.error) {
    await redirectWithResult(undefined, result.error.code)
  }

  revalidatePath('/preliminary')
  revalidatePath('/approvals')

  await redirectWithResult('preliminary_request_cancelled')
}

export async function createPreliminaryCellMarkAction(formData: FormData) {
  const { userId } = await getCurrentActiveUser()
  const admin = createAdminClient()
  const snapshotId = String(formData.get('snapshot_id') ?? '').trim()
  const markType = String(formData.get('mark_type') ?? '').trim()
  const shiftId = String(formData.get('shift_id') ?? '').trim() || null
  const date = String(formData.get('date') ?? '').trim()
  const replacementDate = String(formData.get('replacement_date') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null

  if ((markType !== 'mark_off' && markType !== 'add_work') || !date) {
    await redirectWithResult(undefined, 'request_not_pending')
    return
  }

  if (shiftType !== 'day' && shiftType !== 'night') {
    await redirectWithResult(undefined, 'request_not_pending')
    return
  }

  const validatedMarkType = markType
  const validatedShiftType = shiftType

  if (markType === 'mark_off' && replacementDate) {
    const group = await createPreliminaryMarkGroup(admin as never, {
      actorId: userId,
      snapshotId,
      note,
    })

    if (group.error || !group.data) {
      console.error('Failed to create preliminary mark group:', group.error)
      await redirectWithResult(undefined, preliminaryMarkErrorCode(group.error?.message))
      return
    }

    const groupId = group.data.id
    const markOff = await createPreliminaryCellMark(admin as never, {
      actorId: userId,
      snapshotId,
      markType: 'mark_off',
      date,
      shiftType: validatedShiftType,
      shiftId,
      groupId,
      note,
    })

    if (markOff.error || !markOff.data) {
      console.error('Failed to create preliminary mark-off:', markOff.error)
      await redirectWithResult(undefined, preliminaryMarkErrorCode(markOff.error?.message))
      return
    }

    const markOffId = markOff.data.id
    const addWork = await createPreliminaryCellMark(admin as never, {
      actorId: userId,
      snapshotId,
      markType: 'add_work',
      date: replacementDate,
      shiftType: validatedShiftType,
      shiftId: null,
      groupId,
      note,
    })

    if (addWork.error) {
      console.error('Failed to create linked preliminary add-work mark:', addWork.error)
      await cancelPreliminaryCellMark(admin as never, {
        actorId: userId,
        markId: markOffId,
      })
      await redirectWithResult(undefined, preliminaryMarkErrorCode(addWork.error.message))
      return
    }

    await notifyManagersOfPreliminaryRequest(admin as never, userId, 'pencil_mark')

    revalidatePath('/preliminary')
    revalidatePath('/schedule')
    await redirectWithResult('preliminary_mark_saved')
  }

  const result = await createPreliminaryCellMark(admin as never, {
    actorId: userId,
    snapshotId,
    markType: validatedMarkType,
    date,
    shiftType: validatedShiftType,
    shiftId,
    note,
  })

  if (result.error) {
    console.error('Failed to create preliminary cell mark:', result.error)
    await redirectWithResult(undefined, preliminaryMarkErrorCode(result.error.message))
  }

  await notifyManagersOfPreliminaryRequest(admin as never, userId, 'pencil_mark')

  revalidatePath('/preliminary')
  revalidatePath('/schedule')
  await redirectWithResult('preliminary_mark_saved')
}

export async function cancelPreliminaryCellMarkAction(formData: FormData) {
  const { userId } = await getCurrentActiveUser()
  const admin = createAdminClient()
  const markId = String(formData.get('mark_id') ?? '').trim()

  const result = await cancelPreliminaryCellMark(admin as never, {
    actorId: userId,
    markId,
  })

  if (result.error) {
    console.error('Failed to cancel preliminary cell mark:', result.error)
    await redirectWithResult(undefined, 'preliminary_mark_failed')
  }

  revalidatePath('/preliminary')
  revalidatePath('/schedule')
  await redirectWithResult('preliminary_mark_cancelled')
}

export async function reviewPreliminaryCellMarkAction(formData: FormData) {
  const { userId } = await getCurrentActiveUser()
  const admin = createAdminClient()
  const markId = String(formData.get('mark_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? '').trim()
  const decisionNote = String(formData.get('decision_note') ?? '').trim() || null

  if (decision !== 'approved' && decision !== 'denied' && decision !== 'dismissed') {
    await redirectWithResult(undefined, 'preliminary_mark_failed')
    return
  }

  const validatedDecision = decision
  const result = await reviewPreliminaryCellMark(admin as never, {
    actorId: userId,
    markId,
    decision: validatedDecision,
    decisionNote,
  })

  if (result.error) {
    console.error('Failed to review preliminary cell mark:', result.error)
    await redirectWithResult(undefined, 'preliminary_mark_failed')
  }

  revalidatePath('/preliminary')
  revalidatePath('/schedule')
  await redirectWithResult('preliminary_mark_reviewed')
}
