'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { notifyUsers } from '@/lib/notifications'
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
    redirect('/?error=account_inactive')
  }

  return { supabase, userId: user.id }
}

async function notifyManagersOfPreliminaryRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: 'claim_open_shift' | 'request_change'
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
    title: 'Preliminary request waiting',
    message:
      type === 'claim_open_shift'
        ? 'A therapist claimed an open preliminary shift and needs approval.'
        : 'A therapist requested a preliminary schedule change and needs approval.',
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

export async function claimPreliminaryShiftAction(formData: FormData) {
  const { supabase, userId } = await getCurrentActiveUser()
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

  await notifyManagersOfPreliminaryRequest(supabase, userId, 'claim_open_shift')

  revalidatePath('/preliminary')
  revalidatePath('/approvals')

  await redirectWithResult('preliminary_claim_requested')
}

export async function requestPreliminaryChangeAction(formData: FormData) {
  const { supabase, userId } = await getCurrentActiveUser()
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

  await notifyManagersOfPreliminaryRequest(supabase, userId, 'request_change')

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
