import { NextResponse } from 'next/server'

import { writeAuditLog } from '@/lib/audit-log'
import { notifyPublishedShiftAdded } from '@/lib/published-schedule-notifications'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { isDateWithinRange } from '@/lib/schedule-helpers'
import { buildAvailabilityOverrideMutationFields } from '@/lib/schedule-mutations/availability-override'
import { SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES } from '@/lib/schedule-mutations/errors'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { scheduleMutationErrorResponse } from '@/lib/schedule-mutations/mutation-response'
import type { DragAction } from '@/lib/schedule-mutations/parse-action-body'
import { validateScheduleMutationAvailability } from '@/lib/schedule-mutations/validate-availability'
import { validateScheduleMutationLimits } from '@/lib/schedule-mutations/validate-limits'
import { validateLeadEligibleTherapist } from '@/lib/schedule-mutations/validate-therapist'
import { ShiftPostCleanupError, closePendingShiftPostsForShiftIds } from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type SetLeadDragAction = Extract<DragAction, { action: 'set_lead' }>

type ExistingLeadShift = {
  id: string
  status: string
}

type SetScheduleMutationLeadParams = {
  payload: SetLeadDragAction
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

export async function setScheduleMutationLead(
  supabase: ScheduleMutationSupabaseClient,
  params: SetScheduleMutationLeadParams
) {
  const { payload, cycle, managerSiteId, actorId, preliminaryActive } = params

  if (!payload.therapistId || !payload.shiftType || !payload.date) {
    return scheduleMutationErrorResponse(
      'Missing designated lead data',
      ERROR_CODES.invalidBody,
      400
    )
  }
  if (!isDateWithinRange(payload.date, cycle.start_date, cycle.end_date)) {
    return scheduleMutationErrorResponse(
      'Date is outside this Schedule Block',
      ERROR_CODES.dateOutsideCycle,
      400
    )
  }

  const leadTherapist = await validateLeadEligibleTherapist(
    supabase,
    payload.therapistId,
    managerSiteId,
    payload.shiftType
  )
  if (!leadTherapist.ok) {
    return scheduleMutationErrorResponse(
      leadTherapist.error,
      leadTherapist.code,
      leadTherapist.status
    )
  }

  const availabilityValidation = await validateScheduleMutationAvailability(supabase, {
    therapistId: payload.therapistId,
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

  const { data: existingShift, error: existingShiftError } = await supabase
    .from('shifts')
    .select('id, status')
    .eq('cycle_id', payload.cycleId)
    .eq('user_id', payload.therapistId)
    .eq('date', payload.date)
    .eq('shift_type', payload.shiftType)
    .maybeSingle()

  if (existingShiftError) {
    return scheduleMutationErrorResponse(
      'Failed to load existing shift for lead validation.',
      ERROR_CODES.internalError,
      500
    )
  }

  const existingLeadShift = (existingShift as ExistingLeadShift | null) ?? null

  if (!existingLeadShift) {
    const limitValidation = await validateScheduleMutationLimits(supabase, {
      therapistId: payload.therapistId,
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
  }

  const mutationResult = await setDesignatedLeadMutation(supabase, {
    cycleId: payload.cycleId,
    therapistId: payload.therapistId,
    date: payload.date,
    shiftType: payload.shiftType,
  })

  if (!mutationResult.ok) {
    if (mutationResult.reason === 'lead_not_eligible') {
      return scheduleMutationErrorResponse(
        'Only lead-eligible therapists can be designated as lead.',
        ERROR_CODES.leadNotEligible,
        409
      )
    }
    if (mutationResult.reason === 'multiple_leads_prevented') {
      return scheduleMutationErrorResponse(
        'A designated lead already exists for that shift.',
        ERROR_CODES.duplicateDesignatedLead,
        409
      )
    }
    return scheduleMutationErrorResponse(
      'Could not set designated lead.',
      ERROR_CODES.internalError,
      500
    )
  }

  await writeAuditLog(supabase, {
    userId: actorId,
    action: 'designated_lead_assigned',
    targetType: 'shift_slot',
    targetId: `${payload.cycleId}:${payload.date}:${payload.shiftType}`,
  })

  const availabilityOverrideFields = buildAvailabilityOverrideMutationFields({
    blockedByConstraints: availabilityState.blockedByConstraints,
    inactiveOrFmla: availabilityState.inactiveOrFmla,
    availabilityOverride: payload.availabilityOverride,
    availabilityOverrideReason: payload.availabilityOverrideReason,
    actorId,
  })
  const { error: overrideUpdateError } = await supabase
    .from('shifts')
    .update({
      ...availabilityOverrideFields,
    })
    .eq('cycle_id', payload.cycleId)
    .eq('user_id', payload.therapistId)
    .eq('date', payload.date)
    .eq('shift_type', payload.shiftType)
    .eq('site_id', managerSiteId)

  if (overrideUpdateError) {
    return scheduleMutationErrorResponse(
      'Could not record availability override metadata.',
      ERROR_CODES.internalError,
      500
    )
  }

  if (!existingLeadShift) {
    await notifyPublishedShiftAdded(supabase, {
      cyclePublished: Boolean(cycle.published),
      userId: payload.therapistId,
      date: payload.date,
      shiftType: payload.shiftType,
      targetId: `${payload.cycleId}:${payload.therapistId}:${payload.date}:${payload.shiftType}`,
    })
  }

  const leadShiftId =
    existingLeadShift?.id ??
    (
      await supabase
        .from('shifts')
        .select('id')
        .eq('cycle_id', payload.cycleId)
        .eq('user_id', payload.therapistId)
        .eq('date', payload.date)
        .eq('shift_type', payload.shiftType)
        .eq('site_id', managerSiteId)
        .maybeSingle()
    ).data?.id ??
    `${payload.cycleId}:${payload.therapistId}:${payload.date}:${payload.shiftType}`

  if (cycle.published || preliminaryActive) {
    try {
      await closePendingShiftPostsForShiftIds(
        supabase,
        [leadShiftId],
        'Schedule changed after this request was posted.'
      )
    } catch (error) {
      ignorePostMutationCleanupError(error)
    }
  }

  const shouldLogPostPublishModification = await params.shouldLogPostPublishModification({
    cycleId: payload.cycleId,
    date: payload.date,
    shiftType: payload.shiftType,
    cyclePublished: Boolean(cycle.published),
  })

  if (shouldLogPostPublishModification) {
    await writeAuditLog(supabase, {
      userId: actorId,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId: leadShiftId,
    })
  }

  return NextResponse.json({ message: 'Designated lead updated.' })
}

function ignorePostMutationCleanupError(error: unknown) {
  if (error instanceof ShiftPostCleanupError) return
  throw error
}
