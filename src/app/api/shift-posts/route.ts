import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { writeAuditLog } from '@/lib/audit-log'
import {
  isShiftPostCommand,
  shiftPostCommandRequiresManager,
} from '@/lib/shift-post-transition-model'
import { buildShiftPostReviewRpcCall } from '@/lib/shift-board/review-classifier'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type CreateRequestBody = {
  action: 'create_request'
  shiftId?: string
  requestType?: 'swap' | 'pickup'
  visibility?: 'team' | 'direct'
  teammateId?: string | null
  message?: string
}

type RespondDirectRequestBody = {
  action: 'respond_direct_request'
  requestId?: string
  decision?: 'accepted' | 'declined'
}

type WithdrawRequestBody = {
  action: 'withdraw_request'
  requestId?: string
}

type WithdrawInterestBody = {
  action: 'withdraw_interest'
  interestId?: string
}

type ExpressInterestBody = {
  action: 'express_interest'
  requestId?: string
}

type ReviewRequestBody = {
  action: 'review_request'
  requestId?: string
  decision?: 'approve' | 'deny'
  selectedInterestId?: string | null
  swapPartnerId?: string | null
  override?: boolean
  overrideReason?: string | null
}

type DenyClaimantBody = {
  action: 'deny_claimant'
  requestId?: string
  interestId?: string
}

type ShiftPostMutationBody =
  | CreateRequestBody
  | RespondDirectRequestBody
  | WithdrawRequestBody
  | WithdrawInterestBody
  | ExpressInterestBody
  | ReviewRequestBody
  | DenyClaimantBody

type ProfileRow = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
}

type ShiftSelectionRow = {
  cycle_id: string | null
  date: string | null
  shift_type: 'day' | 'night' | null
}

type ShiftPostReviewRow = {
  id: string
  status: string
  shift_id: string | null
  swap_shift_id: string | null
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toErrorResponse(message: string): NextResponse {
  const lowered = message.toLowerCase()

  if (
    lowered.includes('not found') ||
    lowered.includes('was not found') ||
    lowered.includes('is no longer active')
  ) {
    return NextResponse.json({ error: message }, { status: 404 })
  }

  if (
    lowered.includes('only active managers') ||
    lowered.includes('cannot be withdrawn by this user') ||
    lowered.includes('not available for this recipient response')
  ) {
    return NextResponse.json({ error: message }, { status: 403 })
  }

  if (
    lowered.includes('unsupported') ||
    lowered.includes('only pending') ||
    lowered.includes('require') ||
    lowered.includes('cannot') ||
    lowered.includes('lead coverage gap') ||
    lowered.includes('double booking') ||
    lowered.includes('no pickup interest') ||
    lowered.includes('pickup claimant') ||
    lowered.includes('already has a scheduled shift') ||
    lowered.includes('requests can only') ||
    lowered.includes('recipient is not available') ||
    lowered.includes('same shift type') ||
    lowered.includes('no longer pending') ||
    lowered.includes('cannot be created')
  ) {
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ error: 'request_mutation_failed' }, { status: 500 })
}

async function getActorProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', userId)
    .maybeSingle()

  return (data ?? null) as ProfileRow | null
}

async function resolveSameCycleSwapShiftId(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
  actorId: string
  partnerId: string
  shiftId: string
}): Promise<string | null> {
  const { admin, actorId, partnerId, shiftId } = params
  const todayKey = new Date().toISOString().slice(0, 10)
  const { data: requesterShift, error: requesterShiftError } = await admin
    .from('shifts')
    .select('cycle_id, date, shift_type')
    .eq('id', shiftId)
    .eq('user_id', actorId)
    .maybeSingle()

  if (requesterShiftError || !requesterShift) {
    return null
  }

  const shift = requesterShift as ShiftSelectionRow
  if (!shift.cycle_id || !shift.date || !shift.shift_type) {
    return null
  }

  const { data: partnerShift, error: partnerShiftError } = await admin
    .from('shifts')
    .select('id, schedule_cycles!inner(published)')
    .eq('cycle_id', shift.cycle_id)
    .eq('user_id', partnerId)
    .gte('date', todayKey)
    .neq('date', shift.date)
    .eq('shift_type', shift.shift_type)
    .eq('status', 'scheduled')
    .eq('schedule_cycles.published', true)
    .order('date', { ascending: true })
    .order('id', { ascending: true })
    .limit(10)

  if (partnerShiftError || !partnerShift) {
    return null
  }

  const partnerRows = Array.isArray(partnerShift)
    ? (partnerShift as Array<{ id: string }>)
    : [partnerShift as { id: string }]
  const activeOperationalCodes = await fetchActiveOperationalCodeMap(
    admin,
    partnerRows.map((row) => row.id)
  )

  return partnerRows.find((row) => !activeOperationalCodes.has(row.id))?.id ?? null
}

async function writeShiftPostApprovalPostPublishAuditLogs(params: {
  admin: ReturnType<typeof createAdminClient>
  actorId: string
  post: ShiftPostReviewRow
}): Promise<void> {
  if (params.post.status !== 'approved') return

  const targetShiftIds = [
    ...new Set([params.post.shift_id, params.post.swap_shift_id].filter(Boolean)),
  ]

  for (const shiftId of targetShiftIds) {
    await writeAuditLog(params.admin as never, {
      userId: params.actorId,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId: shiftId as string,
    })
  }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as ShiftPostMutationBody | null
  if (!payload || !isShiftPostCommand(payload.action)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const action = payload.action

  const admin = createAdminClient()

  try {
    if (action === 'create_request') {
      const shiftId = asTrimmedString(payload.shiftId)
      const requestType = payload.requestType
      const visibility = payload.visibility
      const teammateId = asTrimmedString(payload.teammateId)
      const message = typeof payload.message === 'string' ? payload.message : ''

      if (!shiftId || (requestType !== 'swap' && requestType !== 'pickup')) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const swapShiftId =
        requestType === 'swap' && teammateId
          ? await resolveSameCycleSwapShiftId({
              admin,
              actorId: user.id,
              partnerId: teammateId,
              shiftId,
            })
          : null

      if (requestType === 'swap' && teammateId && !swapShiftId) {
        return NextResponse.json(
          {
            error:
              'Swap partner must already have a different scheduled shift in this schedule cycle.',
          },
          { status: 400 }
        )
      }

      const { data, error } = await admin.rpc('app_create_shift_post_request', {
        p_actor_id: user.id,
        p_shift_id: shiftId,
        p_type: requestType,
        p_visibility: visibility ?? 'team',
        p_claimed_by: teammateId || null,
        p_message: message,
      })

      if (error || !data) {
        return toErrorResponse(error?.message ?? 'Could not save interest.')
      }

      let post = data
      if (
        requestType === 'swap' &&
        swapShiftId &&
        (data as { swap_shift_id?: string }).swap_shift_id !== swapShiftId
      ) {
        const { data: updatedPost, error: swapShiftUpdateError } = await admin
          .from('shift_posts')
          .update({ swap_shift_id: swapShiftId })
          .eq('id', (data as { id: string }).id)
          .eq('posted_by', user.id)
          .eq('status', 'pending')
          .select()
          .maybeSingle()

        if (swapShiftUpdateError || !updatedPost) {
          await admin
            .from('shift_posts')
            .delete()
            .eq('id', (data as { id: string }).id)
          return toErrorResponse(
            swapShiftUpdateError?.message ?? 'Could not save selected swap shift.'
          )
        }

        post = updatedPost
      }

      return NextResponse.json({ success: true, post })
    }

    if (action === 'respond_direct_request') {
      const requestId = asTrimmedString(payload.requestId)
      const decision = payload.decision
      if (!requestId || (decision !== 'accepted' && decision !== 'declined')) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const { data, error } = await admin.rpc('app_respond_direct_shift_post', {
        p_actor_id: user.id,
        p_post_id: requestId,
        p_response: decision,
      })

      if (error || !data) {
        return toErrorResponse(error?.message ?? 'Could not save interest.')
      }

      return NextResponse.json({ success: true, post: data })
    }

    if (action === 'withdraw_request') {
      const requestId = asTrimmedString(payload.requestId)
      if (!requestId) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const { data, error } = await admin.rpc('app_withdraw_shift_post', {
        p_actor_id: user.id,
        p_post_id: requestId,
      })

      if (error) {
        return toErrorResponse(error.message)
      }

      return NextResponse.json({ success: true, post: data })
    }

    if (action === 'withdraw_interest') {
      const interestId = asTrimmedString(payload.interestId)
      if (!interestId) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const { data, error } = await admin.rpc('app_withdraw_shift_post_interest', {
        p_actor_id: user.id,
        p_interest_id: interestId,
      })

      if (error) {
        return toErrorResponse(error.message)
      }

      return NextResponse.json({ success: true, result: data })
    }

    if (action === 'express_interest') {
      const requestId = asTrimmedString(payload.requestId)
      if (!requestId) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const { data, error } = await admin.rpc('app_express_shift_post_interest', {
        p_actor_id: user.id,
        p_post_id: requestId,
      })

      if (error || !data) {
        return toErrorResponse(error?.message ?? 'Could not save interest.')
      }

      return NextResponse.json({
        success: true,
        result: data,
      })
    }

    if (shiftPostCommandRequiresManager(action)) {
      const actorProfile = await getActorProfile(user.id)
      if (
        !can(parseRole(actorProfile?.role), 'review_shift_posts', {
          isActive: actorProfile?.is_active !== false,
          archivedAt: actorProfile?.archived_at ?? null,
        })
      ) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    if (action === 'review_request') {
      const requestId = asTrimmedString(payload.requestId)
      const decision = payload.decision
      const selectedInterestId = asTrimmedString(payload.selectedInterestId)
      const swapPartnerId = asTrimmedString(payload.swapPartnerId)
      const override = payload.override === true
      const overrideReason =
        typeof payload.overrideReason === 'string' ? payload.overrideReason.trim() : null

      if (!requestId || (decision !== 'approve' && decision !== 'deny')) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const review = buildShiftPostReviewRpcCall({
        actorId: user.id,
        requestId,
        decision,
        selectedInterestId,
        swapPartnerId,
        override,
        overrideReason,
      })
      const { data, error } = await admin.rpc(review.rpcName, review.rpcParams)

      if (error) {
        return toErrorResponse(error.message)
      }

      if (decision === 'approve' && data) {
        await writeShiftPostApprovalPostPublishAuditLogs({
          admin,
          actorId: user.id,
          post: data as ShiftPostReviewRow,
        })
      }

      return NextResponse.json({ success: true, post: data })
    }

    if (action === 'deny_claimant') {
      const requestId = asTrimmedString(payload.requestId)
      const interestId = asTrimmedString(payload.interestId)
      if (!requestId || !interestId) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
      }

      const { data, error } = await admin.rpc('app_deny_pickup_claimant', {
        p_actor_id: user.id,
        p_post_id: requestId,
        p_interest_id: interestId,
      })

      if (error) {
        return toErrorResponse(error.message)
      }

      return NextResponse.json({ success: true, result: data })
    }

    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  } catch (error) {
    console.error('Failed to mutate shift post:', error)
    return NextResponse.json({ error: 'request_mutation_failed' }, { status: 500 })
  }
}
