import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
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
    lowered.includes('no pickup interest') ||
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
  const action = payload?.action
  if (!action) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

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

      const { data, error } = await admin.rpc('app_create_shift_post_request', {
        p_actor_id: user.id,
        p_shift_id: shiftId,
        p_type: requestType,
        p_visibility: visibility ?? 'team',
        p_claimed_by: teammateId || null,
        p_message: message,
      })

      if (error) {
        return toErrorResponse(error.message)
      }

      return NextResponse.json({ success: true, post: data })
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

      if (error) {
        return toErrorResponse(error.message)
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

      const { data: post, error: postError } = await admin
        .from('shift_posts')
        .select('id, posted_by, status, type, visibility')
        .eq('id', requestId)
        .maybeSingle()

      const requestPost = (post ?? null) as {
        id: string
        posted_by: string | null
        status: string | null
        type: string | null
        visibility: 'team' | 'direct' | null
      } | null

      if (postError || !requestPost) {
        return NextResponse.json({ error: 'Shift post was not found.' }, { status: 404 })
      }

      if (
        requestPost.type !== 'pickup' ||
        requestPost.status !== 'pending' ||
        (requestPost.visibility ?? 'team') !== 'team'
      ) {
        return NextResponse.json(
          { error: 'This pickup request is no longer accepting interests.' },
          { status: 400 }
        )
      }

      if (requestPost.posted_by === user.id) {
        return NextResponse.json(
          { error: 'You cannot express interest in your own pickup request.' },
          { status: 400 }
        )
      }

      const insertedAt = new Date().toISOString()
      let nextStatus: 'pending' | 'selected' = 'selected'
      const { data: selectedInterest } = await admin
        .from('shift_post_interests')
        .select('id')
        .eq('shift_post_id', requestId)
        .eq('status', 'selected')
        .maybeSingle()

      if (selectedInterest?.id) {
        nextStatus = 'pending'
      }

      let { data, error } = await admin
        .from('shift_post_interests')
        .insert({
          shift_post_id: requestId,
          therapist_id: user.id,
          status: nextStatus,
          created_at: insertedAt,
        })
        .select('id')
        .single()

      if (error && nextStatus === 'selected' && error.code === '23505') {
        const retryResult = await admin
          .from('shift_post_interests')
          .insert({
            shift_post_id: requestId,
            therapist_id: user.id,
            status: 'pending',
            created_at: insertedAt,
          })
          .select('id')
          .single()

        data = retryResult.data
        error = retryResult.error
        nextStatus = 'pending'
      }

      if (error) {
        return toErrorResponse(error.message)
      }

      return NextResponse.json({
        success: true,
        result: {
          id: (data as { id: string }).id,
          status: nextStatus,
        },
      })
    }

    const actorProfile = await getActorProfile(user.id)
    if (
      !can(parseRole(actorProfile?.role), 'review_shift_posts', {
        isActive: actorProfile?.is_active !== false,
        archivedAt: actorProfile?.archived_at ?? null,
      })
    ) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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

      const { data, error } = await admin.rpc('app_review_shift_post', {
        p_actor_id: user.id,
        p_post_id: requestId,
        p_decision: decision,
        p_selected_interest_id: selectedInterestId || null,
        p_swap_partner_id: swapPartnerId || null,
        p_manager_override: override,
        p_override_reason: overrideReason,
      })

      if (error) {
        return toErrorResponse(error.message)
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
