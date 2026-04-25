import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildCallInAlertMessage, shouldCreateCallInAlert } from '@/lib/call-in-alerts'
import { notifyUsers } from '@/lib/notifications'
import { notifyPublishedShiftStatusChanged } from '@/lib/published-schedule-notifications'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ASSIGNMENT_STATUS_VALUES = [
  'scheduled',
  'call_in',
  'cancelled',
  'on_call',
  'left_early',
] as const

type AssignmentStatus = (typeof ASSIGNMENT_STATUS_VALUES)[number]

type UpdateAssignmentStatusRequest = {
  assignmentId?: string
  status?: AssignmentStatus
  note?: string | null
  leftEarlyTime?: string | null
}

type ActorProfile = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
}

type RpcAssignmentStatusRow = {
  id: string
  assignment_status: AssignmentStatus
  status_note: string | null
  left_early_time: string | null
  status_updated_at: string | null
  status_updated_by: string | null
  status_updated_by_name: string | null
}

type ShiftNotificationLookupRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  user_id: string | null
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
}

type ProfileNotificationRow = {
  id: string
  shift_type: 'day' | 'night' | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function isAllowedAssignmentStatus(value: string): value is AssignmentStatus {
  return ASSIGNMENT_STATUS_VALUES.includes(value as AssignmentStatus)
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as UpdateAssignmentStatusRequest | null
  const assignmentId = String(payload?.assignmentId ?? '').trim()
  const status = String(payload?.status ?? '').trim()
  const note = typeof payload?.note === 'string' ? payload.note : null
  const leftEarlyTimeRaw = typeof payload?.leftEarlyTime === 'string' ? payload.leftEarlyTime : null

  if (!assignmentId || !status || !isAllowedAssignmentStatus(status)) {
    return NextResponse.json({ error: 'Invalid status update payload.' }, { status: 400 })
  }

  if (leftEarlyTimeRaw && !/^\d{2}:\d{2}(:\d{2})?$/.test(leftEarlyTimeRaw)) {
    return NextResponse.json(
      { error: 'Left early time must be HH:MM or HH:MM:SS.' },
      { status: 400 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  const actorProfile = (profile ?? null) as ActorProfile | null
  if (
    !can(parseRole(actorProfile?.role), 'update_assignment_status', {
      isActive: actorProfile?.is_active !== false,
      archivedAt: actorProfile?.archived_at ?? null,
    })
  ) {
    return NextResponse.json(
      { error: 'Only leads or managers can update assignment statuses.' },
      { status: 403 }
    )
  }

  const { data, error } = await supabase.rpc('update_assignment_status', {
    p_assignment_id: assignmentId,
    p_status: status,
    p_note: note,
    p_left_early_time: status === 'left_early' ? leftEarlyTimeRaw : null,
  })

  if (error) {
    if (error.code === '42501') {
      console.warn('Assignment status RPC authorization denied:', error.message || error)
      return NextResponse.json(
        { error: 'Not authorized to update this assignment status.' },
        { status: 403 }
      )
    }
    if (error.code === 'P0002') {
      return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
    }
    console.error('Failed to update assignment status via RPC:', error)
    return NextResponse.json({ error: 'Could not update assignment status.' }, { status: 500 })
  }

  const row = Array.isArray(data) ? ((data[0] ?? null) as RpcAssignmentStatusRow | null) : null
  if (!row) {
    return NextResponse.json({ error: 'Assignment status response was empty.' }, { status: 500 })
  }

  const { data: shiftLookup } = await supabase
    .from('shifts')
    .select('id, date, shift_type, user_id, schedule_cycles(published)')
    .eq('id', row.id)
    .maybeSingle()

  const shift = (shiftLookup ?? null) as ShiftNotificationLookupRow | null
  const cycle = getOne(shift?.schedule_cycles)

  if (shift?.user_id && cycle?.published) {
    const admin = createAdminClient()
    await notifyPublishedShiftStatusChanged(admin as never, {
      cyclePublished: true,
      userId: shift.user_id,
      date: shift.date,
      shiftType: shift.shift_type,
      nextStatus: row.assignment_status,
      targetId: shift.id,
    })

    const { data: existingCallInPost } = await admin
      .from('shift_posts')
      .select('id')
      .eq('shift_id', shift.id)
      .eq('request_kind', 'call_in')
      .eq('status', 'pending')
      .maybeSingle()

    if (shouldCreateCallInAlert({ published: true, nextStatus: row.assignment_status })) {
      let callInPostId = existingCallInPost?.id ?? null

      const callInPayload = {
        shift_id: shift.id,
        posted_by: shift.user_id,
        claimed_by: null,
        type: 'pickup',
        request_kind: 'call_in',
        visibility: 'team',
        recipient_response: null,
        status: 'pending',
        message: buildCallInAlertMessage({
          date: shift.date,
          shiftType: shift.shift_type,
        }),
      }

      if (existingCallInPost?.id) {
        await admin.from('shift_posts').update(callInPayload).eq('id', existingCallInPost.id)
      } else {
        const { data: insertedCallInPost } = await admin
          .from('shift_posts')
          .insert(callInPayload)
          .select('id')
          .single()
        callInPostId = insertedCallInPost?.id ?? null
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, shift_type')
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true)

      const { data: scheduledRows } = await supabase
        .from('shifts')
        .select('user_id')
        .eq('date', shift.date)
        .eq('shift_type', shift.shift_type)

      const scheduledUserIds = new Set(
        ((scheduledRows ?? []) as Array<{ user_id: string | null }>)
          .map((entry) => entry.user_id)
          .filter((value): value is string => Boolean(value))
      )

      const eligibleUserIds = ((profilesData ?? []) as ProfileNotificationRow[])
        .filter((profile) => profile.id !== shift.user_id)
        .filter((profile) => !scheduledUserIds.has(profile.id))
        .map((profile) => profile.id)

      await notifyUsers(supabase, {
        userIds: eligibleUserIds,
        eventType: 'call_in_help_available',
        title: 'Call-in help needed',
        message: buildCallInAlertMessage({
          date: shift.date,
          shiftType: shift.shift_type,
        }),
        targetType: callInPostId ? 'shift_post' : 'shift',
        targetId: callInPostId ?? shift.id,
      })
    } else if (existingCallInPost?.id) {
      await admin
        .from('shift_posts')
        .update({
          status: 'expired',
          override_reason: 'Call-in help alert cleared after assignment status changed.',
        })
        .eq('id', existingCallInPost.id)
    }
  }

  return NextResponse.json({ assignment: row })
}
