import { NextResponse } from 'next/server'

import { writeAuditLog } from '@/lib/audit-log'
import { notifyPreliminaryShiftMoved } from '@/lib/preliminary-schedule-notifications'
import { notifyPublishedShiftMoved } from '@/lib/published-schedule-notifications'
import { isDateWithinRange } from '@/lib/schedule-helpers'
import { buildAvailabilityOverrideMutationFields } from '@/lib/schedule-mutations/availability-override'
import { SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES } from '@/lib/schedule-mutations/errors'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { scheduleMutationErrorResponse } from '@/lib/schedule-mutations/mutation-response'
import type { DragAction } from '@/lib/schedule-mutations/parse-action-body'
import { validateScheduleMutationAvailability } from '@/lib/schedule-mutations/validate-availability'
import { validateScheduleMutationLimits } from '@/lib/schedule-mutations/validate-limits'
import { validateAssignableTherapist } from '@/lib/schedule-mutations/validate-therapist'
import { ShiftPostCleanupError, closePendingShiftPostsForShiftIds } from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'
import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type MoveDragAction = Extract<DragAction, { action: 'move' }>

type MovableShift = {
  id: string
  cycle_id: string
  site_id: string
  user_id: string | null
  date: string | null
  shift_type: 'day' | 'night' | null
  status: ShiftStatus
  role: ShiftRole
}

type MoveScheduleShiftParams = {
  payload: MoveDragAction
  cycle: ScheduleMutationCycle
  managerSiteId: string
  actorId: string
  preliminaryActive: boolean
  shouldLogPostPublishModification: (params: {
    cycleId: string
    date: string
    shiftType: 'day' | 'night'
    cyclePublished: boolean
  }) => Promise<boolean>
}

export async function moveScheduleShift(
  supabase: ScheduleMutationSupabaseClient,
  params: MoveScheduleShiftParams
) {
  const { payload, cycle, managerSiteId, actorId, preliminaryActive } = params

  if (!payload.shiftId || !payload.targetDate || !payload.targetShiftType) {
    return scheduleMutationErrorResponse('Missing move data', ERROR_CODES.invalidBody, 400)
  }
  if (!isDateWithinRange(payload.targetDate, cycle.start_date, cycle.end_date)) {
    return scheduleMutationErrorResponse(
      'Date is outside this Schedule Block',
      ERROR_CODES.dateOutsideCycle,
      400
    )
  }

  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('id, cycle_id, site_id, user_id, date, shift_type, status, role')
    .eq('id', payload.shiftId)
    .maybeSingle()

  const existingShift = shift as MovableShift | null

  if (shiftError || !existingShift || existingShift.cycle_id !== payload.cycleId) {
    return scheduleMutationErrorResponse(
      'Shift not found in this Schedule Block',
      ERROR_CODES.shiftNotFound,
      404
    )
  }
  if (existingShift.site_id !== managerSiteId) {
    return scheduleMutationErrorResponse(
      'Shift is outside your site scope.',
      ERROR_CODES.outsideSiteScope,
      403
    )
  }

  if (
    existingShift.date === payload.targetDate &&
    existingShift.shift_type === payload.targetShiftType
  ) {
    return NextResponse.json({ message: 'Shift already on that date.' })
  }

  const assignedUserId = existingShift.user_id
  if (!assignedUserId) {
    return scheduleMutationErrorResponse(
      'Only assigned shifts can be moved.',
      ERROR_CODES.invalidBody,
      400
    )
  }
  const assignedTherapist = await validateAssignableTherapist(
    supabase,
    assignedUserId,
    managerSiteId,
    payload.targetShiftType
  )
  if (!assignedTherapist.ok) {
    return scheduleMutationErrorResponse(
      assignedTherapist.error,
      assignedTherapist.code,
      assignedTherapist.status
    )
  }

  const availabilityValidation = await validateScheduleMutationAvailability(supabase, {
    therapistId: assignedUserId,
    managerSiteId,
    cycleId: payload.cycleId,
    date: payload.targetDate,
    shiftType: payload.targetShiftType,
    availabilityOverride: payload.availabilityOverride === true,
  })
  if (!availabilityValidation.ok) {
    return scheduleMutationErrorResponse(
      availabilityValidation.error,
      availabilityValidation.code,
      availabilityValidation.status,
      availabilityValidation.details
    )
  }
  const { availabilityState } = availabilityValidation

  const limitValidation = await validateScheduleMutationLimits(supabase, {
    therapistId: assignedUserId,
    managerSiteId,
    cycleId: payload.cycleId,
    date: payload.targetDate,
    shiftType: payload.targetShiftType,
    overrideWeeklyRules: payload.overrideWeeklyRules === true,
    excludeShiftId: existingShift.id,
    shiftStatus: existingShift.status,
  })
  if (!limitValidation.ok) {
    return scheduleMutationErrorResponse(
      limitValidation.error,
      limitValidation.code,
      limitValidation.status
    )
  }

  const availabilityOverrideFields = buildAvailabilityOverrideMutationFields({
    blockedByConstraints: availabilityState.blockedByConstraints,
    inactiveOrFmla: availabilityState.inactiveOrFmla,
    availabilityOverride: payload.availabilityOverride,
    availabilityOverrideReason: payload.availabilityOverrideReason,
    actorId,
  })

  const { error } = await supabase
    .from('shifts')
    .update({
      date: payload.targetDate,
      shift_type: payload.targetShiftType,
      ...availabilityOverrideFields,
    })
    .eq('id', payload.shiftId)
    .eq('cycle_id', payload.cycleId)
    .eq('site_id', managerSiteId)

  if (error) {
    if (error.code === '23505') {
      return scheduleMutationErrorResponse(
        'Therapist already has a shift on that date.',
        ERROR_CODES.duplicateShift,
        409
      )
    }
    return scheduleMutationErrorResponse('Could not move shift', ERROR_CODES.internalError, 500)
  }

  if (!existingShift.date || !existingShift.shift_type) {
    return scheduleMutationErrorResponse('Incomplete shift data', ERROR_CODES.internalError, 422)
  }

  if (cycle.published || preliminaryActive) {
    try {
      await closePendingShiftPostsForShiftIds(
        supabase,
        [existingShift.id],
        'Schedule changed after this request was posted.'
      )
    } catch (error) {
      ignorePostMutationCleanupError(error)
    }
  }

  await notifyPublishedShiftMoved(supabase, {
    cyclePublished: Boolean(cycle.published),
    userId: existingShift.user_id,
    fromDate: existingShift.date,
    fromShiftType: existingShift.shift_type,
    toDate: payload.targetDate,
    toShiftType: payload.targetShiftType,
    targetId: existingShift.id,
  })
  await notifyPreliminaryShiftMoved(supabase, {
    preliminaryActive,
    userId: existingShift.user_id,
    fromDate: existingShift.date,
    fromShiftType: existingShift.shift_type,
    toDate: payload.targetDate,
    toShiftType: payload.targetShiftType,
    targetId: existingShift.id,
  })

  const undoAction: DragAction = {
    action: 'move',
    cycleId: payload.cycleId,
    shiftId: payload.shiftId,
    targetDate: existingShift.date,
    targetShiftType: existingShift.shift_type,
    overrideWeeklyRules: true,
  }

  const sourceNeedsAudit = await params.shouldLogPostPublishModification({
    cycleId: payload.cycleId,
    date: existingShift.date,
    shiftType: existingShift.shift_type,
    cyclePublished: Boolean(cycle.published),
  })
  const targetNeedsAudit = await params.shouldLogPostPublishModification({
    cycleId: payload.cycleId,
    date: payload.targetDate,
    shiftType: payload.targetShiftType,
    cyclePublished: Boolean(cycle.published),
  })

  if (sourceNeedsAudit || targetNeedsAudit) {
    await writeAuditLog(supabase, {
      userId: actorId,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId: payload.shiftId,
    })
  }

  return NextResponse.json({ message: 'Shift moved.', undoAction })
}

function ignorePostMutationCleanupError(error: unknown) {
  if (error instanceof ShiftPostCleanupError) return
  throw error
}
