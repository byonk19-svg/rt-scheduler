import { NextResponse } from 'next/server'

import { writeAuditLog } from '@/lib/audit-log'
import { notifyPreliminaryShiftAdded } from '@/lib/preliminary-schedule-notifications'
import { notifyPublishedShiftAdded } from '@/lib/published-schedule-notifications'
import { isDateWithinRange } from '@/lib/schedule-helpers'
import { buildAvailabilityOverrideMutationFields } from '@/lib/schedule-mutations/availability-override'
import { SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES } from '@/lib/schedule-mutations/errors'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { scheduleMutationErrorResponse } from '@/lib/schedule-mutations/mutation-response'
import type { DragAction } from '@/lib/schedule-mutations/parse-action-body'
import { validateScheduleMutationAvailability } from '@/lib/schedule-mutations/validate-availability'
import { validateScheduleMutationLimits } from '@/lib/schedule-mutations/validate-limits'
import { validateAssignableTherapist } from '@/lib/schedule-mutations/validate-therapist'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type AssignDragAction = Extract<DragAction, { action: 'assign' }>

type AssignScheduleShiftParams = {
  payload: AssignDragAction
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

export async function assignScheduleShift(
  supabase: ScheduleMutationSupabaseClient,
  params: AssignScheduleShiftParams
) {
  const { payload, cycle, managerSiteId, actorId, preliminaryActive } = params

  if (!payload.userId || !payload.shiftType || !payload.date) {
    return scheduleMutationErrorResponse('Missing assignment data', ERROR_CODES.invalidBody, 400)
  }
  if (!isDateWithinRange(payload.date, cycle.start_date, cycle.end_date)) {
    return scheduleMutationErrorResponse(
      'Date is outside this Schedule Block',
      ERROR_CODES.dateOutsideCycle,
      400
    )
  }

  const targetTherapist = await validateAssignableTherapist(
    supabase,
    payload.userId,
    managerSiteId,
    payload.shiftType
  )
  if (!targetTherapist.ok) {
    return scheduleMutationErrorResponse(
      targetTherapist.error,
      targetTherapist.code,
      targetTherapist.status
    )
  }

  const availabilityValidation = await validateScheduleMutationAvailability(supabase, {
    therapistId: payload.userId,
    managerSiteId,
    cycleId: payload.cycleId,
    date: payload.date,
    shiftType: payload.shiftType,
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
    therapistId: payload.userId,
    managerSiteId,
    cycleId: payload.cycleId,
    date: payload.date,
    shiftType: payload.shiftType,
    overrideWeeklyRules: payload.overrideWeeklyRules === true,
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

  const { data: insertedShift, error } = await supabase
    .from('shifts')
    .insert({
      cycle_id: payload.cycleId,
      site_id: managerSiteId,
      user_id: payload.userId,
      date: payload.date,
      shift_type: payload.shiftType,
      status: 'scheduled',
      role: payload.role ?? 'staff',
      ...availabilityOverrideFields,
    })
    .select('id')
    .maybeSingle()

  if (error || !insertedShift) {
    if (error?.code === '23505') {
      return scheduleMutationErrorResponse(
        'That therapist already has a shift on this date.',
        ERROR_CODES.duplicateShift,
        409
      )
    }
    return scheduleMutationErrorResponse('Could not create shift', ERROR_CODES.internalError, 500)
  }

  if (insertedShift?.id) {
    await writeAuditLog(supabase, {
      userId: actorId,
      action: 'shift_added',
      targetType: 'shift',
      targetId: insertedShift.id,
    })
  }

  const shouldLogPostPublishModification = await params.shouldLogPostPublishModification({
    cycleId: payload.cycleId,
    date: payload.date,
    shiftType: payload.shiftType,
    cyclePublished: Boolean(cycle.published),
  })

  if (shouldLogPostPublishModification && insertedShift?.id) {
    await writeAuditLog(supabase, {
      userId: actorId,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId: insertedShift.id,
    })
  }

  await notifyPublishedShiftAdded(supabase, {
    cyclePublished: Boolean(cycle.published),
    userId: payload.userId,
    date: payload.date,
    shiftType: payload.shiftType,
    targetId: insertedShift?.id ?? `${payload.cycleId}:${payload.userId}:${payload.date}`,
  })
  await notifyPreliminaryShiftAdded(supabase, {
    preliminaryActive,
    userId: payload.userId,
    date: payload.date,
    shiftType: payload.shiftType,
    targetId: insertedShift?.id ?? `${payload.cycleId}:${payload.userId}:${payload.date}`,
  })

  const undoAction: DragAction = {
    action: 'remove',
    cycleId: payload.cycleId,
    userId: payload.userId,
    date: payload.date,
    shiftType: payload.shiftType,
  }

  return NextResponse.json({
    message: 'Shift assigned.',
    undoAction,
    shift: {
      id: insertedShift?.id ?? `${payload.cycleId}:${payload.userId}:${payload.date}`,
      user_id: payload.userId,
      date: payload.date,
      shift_type: payload.shiftType,
      status: 'scheduled',
      assignment_status: null,
    },
  })
}
