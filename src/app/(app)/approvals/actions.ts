'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { notifyUsers } from '@/lib/notifications'
import {
  approvePreliminaryRequest,
  denyPreliminaryRequest,
} from '@/lib/preliminary-schedule/mutations'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

async function getManagerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_schedule')) {
    redirect('/dashboard')
  }

  return { supabase, userId: user.id }
}

async function syncApprovedPreliminaryRequestToDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: {
    shift_id: string
    requester_id: string
    type: 'claim_open_shift' | 'request_change'
  }
) {
  const payload =
    request.type === 'claim_open_shift' ? { user_id: request.requester_id } : { user_id: null }

  const { error } = await supabase.from('shifts').update(payload).eq('id', request.shift_id)
  return error
}

async function reviewPreliminaryRequestAction(formData: FormData, mode: 'approve' | 'deny') {
  const { supabase, userId } = await getManagerContext()
  const requestId = String(formData.get('request_id') ?? '').trim()

  if (!requestId) {
    redirect('/approvals?error=preliminary_review_failed')
  }

  const review =
    mode === 'approve'
      ? await approvePreliminaryRequest(supabase as never, {
          requestId,
          actorId: userId,
        })
      : await denyPreliminaryRequest(supabase as never, {
          requestId,
          actorId: userId,
        })

  if (review.error || !review.data) {
    redirect('/approvals?error=preliminary_review_failed')
  }

  if (mode === 'approve') {
    const draftSyncError = await syncApprovedPreliminaryRequestToDraft(supabase, {
      shift_id: review.data.shift_id,
      requester_id: review.data.requester_id,
      type: review.data.type,
    })

    if (draftSyncError) {
      console.error(
        'Failed to sync approved preliminary request to draft schedule:',
        draftSyncError
      )
      redirect('/approvals?error=preliminary_review_failed')
    }
  }

  await notifyUsers(supabase, {
    userIds: [review.data.requester_id],
    eventType: mode === 'approve' ? 'preliminary_request_approved' : 'preliminary_request_denied',
    title: mode === 'approve' ? 'Preliminary request approved' : 'Preliminary request denied',
    message:
      mode === 'approve'
        ? 'Your preliminary schedule request was approved.'
        : 'Your preliminary schedule request was denied.',
    targetType: 'system',
    targetId: review.data.id,
  })

  revalidatePath('/approvals')
  revalidatePath('/preliminary')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  redirect(
    `/approvals?success=${
      mode === 'approve' ? 'preliminary_request_approved' : 'preliminary_request_denied'
    }`
  )
}

export async function approvePreliminaryRequestAction(formData: FormData) {
  return reviewPreliminaryRequestAction(formData, 'approve')
}

export async function denyPreliminaryRequestAction(formData: FormData) {
  return reviewPreliminaryRequestAction(formData, 'deny')
}
