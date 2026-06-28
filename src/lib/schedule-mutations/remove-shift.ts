import { NextResponse } from 'next/server'

import { writeAuditLog } from '@/lib/audit-log'
import { notifyPreliminaryShiftRemoved } from '@/lib/preliminary-schedule-notifications'
import { notifyPublishedShiftRemoved } from '@/lib/published-schedule-notifications'
import { SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES } from '@/lib/schedule-mutations/errors'
import type { ScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { scheduleMutationErrorResponse } from '@/lib/schedule-mutations/mutation-response'
import type { DragAction } from '@/lib/schedule-mutations/parse-action-body'
import {
  ShiftPostCleanupError,
  preserveShiftPostHistoryBeforeShiftDeletion,
} from '@/lib/shift-post-cleanup'
import type { createClient } from '@/lib/supabase/server'
import type { ShiftRole } from '@/app/schedule/types'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type RemoveDragAction = Extract<DragAction, { action: 'remove' }>

type RemovableShift = {
  id: string
  cycle_id: string
  site_id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
}

type RemoveScheduleShiftParams = {
  payload: RemoveDragAction
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

export async function removeScheduleShift(
  supabase: ScheduleMutationSupabaseClient,
  params: RemoveScheduleShiftParams
) {
  const { payload, cycle, managerSiteId, actorId, preliminaryActive } = params
  let shift: RemovableShift | null = null
  let shiftError: string | null = null

  if ('shiftId' in payload) {
    const result = await supabase
      .from('shifts')
      .select('id, cycle_id, site_id, user_id, date, shift_type, role')
      .eq('id', payload.shiftId)
      .maybeSingle()
    shift = (result.data as RemovableShift | null) ?? null
    shiftError = result.error?.message ?? null
  } else {
    const result = await supabase
      .from('shifts')
      .select('id, cycle_id, site_id, user_id, date, shift_type, role')
      .eq('cycle_id', payload.cycleId)
      .eq('user_id', payload.userId)
      .eq('date', payload.date)
      .eq('shift_type', payload.shiftType)
      .maybeSingle()
    shift = (result.data as RemovableShift | null) ?? null
    shiftError = result.error?.message ?? null
  }

  if (shiftError || !shift || shift.cycle_id !== payload.cycleId) {
    return scheduleMutationErrorResponse(
      'Shift not found in this Schedule Block',
      ERROR_CODES.shiftNotFound,
      404
    )
  }
  if (shift.site_id !== managerSiteId) {
    return scheduleMutationErrorResponse(
      'Shift is outside your site scope.',
      ERROR_CODES.outsideSiteScope,
      403
    )
  }

  try {
    await preserveShiftPostHistoryBeforeShiftDeletion(
      supabase,
      [shift.id],
      'Schedule changed after this request was posted.'
    )
  } catch (error) {
    return scheduleCleanupErrorResponse(error)
  }

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', shift.id)
    .eq('cycle_id', payload.cycleId)
    .eq('site_id', managerSiteId)
  if (error) {
    return scheduleMutationErrorResponse('Could not remove shift', ERROR_CODES.internalError, 500)
  }

  await writeAuditLog(supabase, {
    userId: actorId,
    action: 'shift_removed',
    targetType: 'shift',
    targetId: shift.id,
  })

  await notifyPublishedShiftRemoved(supabase, {
    cyclePublished: Boolean(cycle.published),
    userId: shift.user_id,
    date: shift.date,
    shiftType: shift.shift_type,
    targetId: shift.id,
  })
  await notifyPreliminaryShiftRemoved(supabase, {
    preliminaryActive,
    userId: shift.user_id,
    date: shift.date,
    shiftType: shift.shift_type,
    targetId: shift.id,
  })

  const undoAction: DragAction = {
    action: 'assign',
    cycleId: payload.cycleId,
    userId: shift.user_id,
    shiftType: shift.shift_type,
    date: shift.date,
    overrideWeeklyRules: true,
  }

  const shouldLogPostPublishModification = await params.shouldLogPostPublishModification({
    cycleId: payload.cycleId,
    date: shift.date,
    shiftType: shift.shift_type,
    cyclePublished: Boolean(cycle.published),
  })

  if (shouldLogPostPublishModification) {
    const targetId = 'shiftId' in payload ? payload.shiftId : `${payload.userId}:${payload.date}`
    await writeAuditLog(supabase, {
      userId: actorId,
      action: 'post_publish_modification',
      targetType: 'shift',
      targetId,
    })
  }

  return NextResponse.json({ message: 'Shift removed from schedule.', undoAction })
}

function scheduleCleanupErrorResponse(error: unknown) {
  if (error instanceof ShiftPostCleanupError) {
    return scheduleMutationErrorResponse(
      'Could not preserve linked Shift Board requests. Try again before changing this schedule.',
      ERROR_CODES.internalError,
      500
    )
  }
  throw error
}
