import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { updateAssignmentStatusWithLottery } from '@/lib/lottery/service'
import { parseRole } from '@/lib/auth/roles'
import { buildCallInAlertMessage, shouldCreateCallInAlert } from '@/lib/call-in-alerts'
import { notifyUsers } from '@/lib/notifications'
import { notifyPublishedShiftStatusChanged } from '@/lib/published-schedule-notifications'
import {
  isScheduleGridAssignmentStatus,
  type ScheduleGridAssignmentStatus,
} from '@/lib/schedule/schedule-status-model'
import {
  isPublishedScheduleBlock,
  isReadOnlyScheduleBlock,
  type ScheduleBlockStatus,
} from '@/lib/schedule-block-state'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { captureSafeException, logStructuredEvent } from '@/lib/observability'
import { writeAuditLog } from '@/lib/audit-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type AssignmentStatus = ScheduleGridAssignmentStatus

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
  full_name: string | null
  site_id: string | null
  shift_type: 'day' | 'night' | null
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
  site_id: string | null
  cycle_id: string
  date: string
  shift_type: 'day' | 'night'
  user_id: string | null
  schedule_cycles:
    | {
        published: boolean
        status: ScheduleBlockStatus | null
        archived_at: string | null
      }
    | {
        published: boolean
        status: ScheduleBlockStatus | null
        archived_at: string | null
      }[]
    | null
}

type ProfileNotificationRow = {
  id: string
  role: string | null
  shift_type: 'day' | 'night' | null
  site_id: string | null
  archived_at: string | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function isIncidentAssignmentStatus(value: AssignmentStatus) {
  return value === 'call_in' || value === 'cancelled' || value === 'left_early'
}

function shouldNotifyAffectedTherapist(nextStatus: AssignmentStatus) {
  return nextStatus !== 'left_early'
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
  const note = typeof payload?.note === 'string' ? payload.note.trim() || null : null
  const leftEarlyTimeRaw =
    typeof payload?.leftEarlyTime === 'string' ? payload.leftEarlyTime.trim() || null : null

  if (!assignmentId || !status || !isScheduleGridAssignmentStatus(status)) {
    return NextResponse.json({ error: 'Invalid status update payload.' }, { status: 400 })
  }

  if (status === 'left_early' && !leftEarlyTimeRaw) {
    return NextResponse.json(
      { error: 'Left early status requires the time the shift ended.' },
      { status: 400 }
    )
  }

  if (status !== 'left_early' && leftEarlyTimeRaw) {
    return NextResponse.json(
      { error: 'Left early time can only be set with left early status.' },
      { status: 400 }
    )
  }

  if (leftEarlyTimeRaw && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(leftEarlyTimeRaw)) {
    return NextResponse.json(
      { error: 'Left early time must be HH:MM or HH:MM:SS.' },
      { status: 400 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, full_name, site_id, shift_type')
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

  if (!actorProfile?.site_id) {
    return NextResponse.json({ error: 'Actor site is missing.' }, { status: 403 })
  }

  const { data: preflightShiftLookup, error: preflightShiftError } = await supabase
    .from('shifts')
    .select('id, site_id, user_id, schedule_cycles(published, status, archived_at)')
    .eq('id', assignmentId)
    .maybeSingle()

  if (preflightShiftError || !preflightShiftLookup) {
    return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  }

  const preflightCycle = getOne(
    (
      preflightShiftLookup as {
        schedule_cycles:
          | {
              published: boolean
              status: ScheduleBlockStatus | null
              archived_at: string | null
            }
          | {
              published: boolean
              status: ScheduleBlockStatus | null
              archived_at: string | null
            }[]
          | null
      }
    ).schedule_cycles
  )

  if (preflightCycle && isReadOnlyScheduleBlock(preflightCycle)) {
    return NextResponse.json(
      { error: 'This Schedule Block is read-only until it is republished.' },
      { status: 409 }
    )
  }

  const preflightShift = preflightShiftLookup as {
    site_id?: string | null
    user_id?: string | null
  }
  if (preflightShift.site_id !== actorProfile.site_id) {
    return NextResponse.json({ error: 'Assignment is outside your site scope.' }, { status: 403 })
  }

  if (isIncidentAssignmentStatus(status) && !isPublishedScheduleBlock(preflightCycle ?? {})) {
    return NextResponse.json(
      { error: 'Operational statuses can only be applied after the Schedule Block is published.' },
      { status: 409 }
    )
  }

  if (isIncidentAssignmentStatus(status) && !preflightShift.user_id) {
    return NextResponse.json(
      { error: 'Operational statuses require an assigned therapist.' },
      { status: 409 }
    )
  }

  const admin = createAdminClient()
  const mutation = await updateAssignmentStatusWithLottery({
    authClient: {
      rpc: admin.rpc.bind(admin),
    },
    actor: {
      userId: user.id,
      fullName: actorProfile.full_name?.trim() || 'Team member',
      role:
        parseRole(actorProfile.role) === 'manager'
          ? 'manager'
          : parseRole(actorProfile.role) === 'lead'
            ? 'lead'
            : 'therapist',
      siteId: actorProfile.site_id,
      shiftType: actorProfile.shift_type ?? null,
    },
    shiftId: assignmentId,
    nextStatus: status,
    note,
    leftEarlyTime: status === 'left_early' ? leftEarlyTimeRaw : null,
  })

  if (!mutation.ok) {
    if (mutation.code === '42501') {
      console.warn('Assignment status RPC authorization denied:', mutation.error)
      return NextResponse.json(
        { error: 'Not authorized to update this assignment status.' },
        { status: 403 }
      )
    }
    if (mutation.code === 'P0002') {
      return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
    }
    const context = {
      assignment_id: assignmentId,
      user_id: user.id,
      site_id: actorProfile.site_id,
      status,
      code: mutation.code ?? null,
    }
    logStructuredEvent('error', 'assignment_status.update.failed', context)
    captureSafeException('assignment_status.update.failed', context)
    return NextResponse.json({ error: 'Could not update assignment status.' }, { status: 500 })
  }

  const row = {
    id: assignmentId,
    assignment_status: status,
    status_note: note,
    left_early_time: status === 'left_early' ? leftEarlyTimeRaw : null,
    status_updated_at: new Date().toISOString(),
    status_updated_by: user.id,
    status_updated_by_name: actorProfile.full_name?.trim() || 'Team member',
  } satisfies RpcAssignmentStatusRow

  const { data: shiftLookup } = await supabase
    .from('shifts')
    .select(
      'id, site_id, cycle_id, date, shift_type, user_id, schedule_cycles(published, status, archived_at)'
    )
    .eq('id', row.id)
    .maybeSingle()

  const shift = (shiftLookup ?? null) as ShiftNotificationLookupRow | null
  const cycle = getOne(shift?.schedule_cycles)
  const shiftInActorSite = shift?.site_id === actorProfile.site_id
  const shiftCyclePublished = cycle ? isPublishedScheduleBlock(cycle) : false

  if (shift && shiftInActorSite && shiftCyclePublished) {
    await writeAuditLog(admin as never, {
      userId: user.id,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId: shift.id,
    })
  }

  if (shift?.user_id && shiftInActorSite && shiftCyclePublished) {
    if (shouldNotifyAffectedTherapist(row.assignment_status)) {
      await notifyPublishedShiftStatusChanged(admin as never, {
        cyclePublished: true,
        userId: shift.user_id,
        date: shift.date,
        shiftType: shift.shift_type,
        nextStatus: row.assignment_status,
        targetId: shift.id,
      })
    }

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
        const { data: insertedCallInPost, error: callInPostError } = await admin
          .from('shift_posts')
          .insert(callInPayload)
          .select('id')
          .maybeSingle()
        if (callInPostError || !insertedCallInPost) {
          console.warn(
            'Failed to create call-in shift post:',
            callInPostError?.message ?? 'no row returned'
          )
        }
        callInPostId = insertedCallInPost?.id ?? null
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, role, shift_type, site_id, archived_at')
        .in('role', ['therapist', 'lead', 'manager'])
        .eq('site_id', actorProfile.site_id)
        .eq('is_active', true)

      const { data: scheduledRows } = await supabase
        .from('shifts')
        .select('user_id')
        .eq('cycle_id', shift.cycle_id)
        .eq('date', shift.date)
        .eq('shift_type', shift.shift_type)

      const scheduledUserIds = new Set(
        ((scheduledRows ?? []) as Array<{ user_id: string | null }>)
          .map((entry) => entry.user_id)
          .filter((value): value is string => Boolean(value))
      )

      const sameSiteActiveProfiles = ((profilesData ?? []) as ProfileNotificationRow[]).filter(
        (profile) => profile.site_id === actorProfile.site_id && !profile.archived_at
      )

      const operationalAttentionUserIds = sameSiteActiveProfiles
        .filter((profile) => profile.id !== user.id)
        .filter((profile) => profile.role === 'manager' || profile.role === 'lead')
        .map((profile) => profile.id)

      const operationalAttentionSet = new Set(operationalAttentionUserIds)
      const eligibleUserIds = sameSiteActiveProfiles
        .filter((profile) => profile.role === 'therapist' || profile.role === 'lead')
        .filter((profile) => profile.id !== shift.user_id)
        .filter((profile) => !operationalAttentionSet.has(profile.id))
        .filter((profile) => !scheduledUserIds.has(profile.id))
        .filter((profile) => profile.shift_type === null || profile.shift_type === shift.shift_type)
        .map((profile) => profile.id)

      await notifyUsers(admin as never, {
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

      await notifyUsers(admin as never, {
        userIds: operationalAttentionUserIds,
        eventType: 'operational_status_attention',
        title: 'Call-in coverage attention',
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
