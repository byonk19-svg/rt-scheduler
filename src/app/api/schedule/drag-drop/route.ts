import { NextResponse } from 'next/server'

import {
  notifyPreliminaryShiftAdded,
  notifyPreliminaryShiftMoved,
  notifyPreliminaryShiftRemoved,
} from '@/lib/preliminary-schedule-notifications'
import {
  notifyPublishedShiftAdded,
  notifyPublishedShiftMoved,
  notifyPublishedShiftRemoved,
} from '@/lib/published-schedule-notifications'
import { createClient } from '@/lib/supabase/server'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { exceedsCoverageLimit, exceedsWeeklyLimit } from '@/lib/schedule-rule-validation'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { writeAuditLog } from '@/lib/audit-log'
import {
  MAX_WORK_DAYS_PER_WEEK,
  MAX_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import { toIsoDate } from '@/lib/calendar-utils'
import {
  countsTowardWeeklyLimit,
  getWeekBoundsForDate,
  isDateWithinRange,
} from '@/lib/schedule-helpers'
import { formatEligibilityReason, resolveEligibility } from '@/lib/coverage/resolve-availability'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'
import type { AvailabilityOverrideRow as CycleAvailabilityOverrideRow } from '@/lib/coverage/types'
import {
  SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES,
  type ScheduleMutationErrorCode,
} from '@/lib/schedule-mutations/errors'
import { authorizeScheduleMutationManager } from '@/lib/schedule-mutations/authorize-manager'
import { loadScheduleMutationCycle } from '@/lib/schedule-mutations/load-cycle'
import { parseActionBody, type DragAction } from '@/lib/schedule-mutations/parse-action-body'
import { buildAvailabilityOverrideMutationFields } from '@/lib/schedule-mutations/availability-override'
import {
  validateAssignableTherapist,
  validateLeadEligibleTherapist,
} from '@/lib/schedule-mutations/validate-therapist'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import {
  ShiftPostCleanupError,
  closePendingShiftPostsForShiftIds,
  preserveShiftPostHistoryBeforeShiftDeletion,
} from '@/lib/shift-post-cleanup'
import type { ShiftStatus, ShiftRole, EmploymentType } from '@/app/schedule/types'
type RemovableShift = {
  id: string
  cycle_id: string
  site_id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
}

type TherapistAvailabilityState = {
  therapistName: string
  blockedByConstraints: boolean
  unavailableReason: string | null
  forceOff: boolean
  forceOn: boolean
  inactiveOrFmla: boolean
  prnNotOffered: boolean
  error?: string
}
type ShiftSlotRow = {
  id: string
}

function scheduleMutationErrorResponse(
  error: string,
  code: ScheduleMutationErrorCode,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error, code, ...extra }, { status })
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

function ignorePostMutationCleanupError(error: unknown) {
  if (error instanceof ShiftPostCleanupError) return
  throw error
}

async function getCoverageCountForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night',
  excludeShiftId?: string
): Promise<{ count: number; error?: string }> {
  let query = supabase
    .from('shifts')
    .select('id, status')
    .eq('cycle_id', cycleId)
    .eq('date', date)
    .eq('shift_type', shiftType)

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId)
  }

  const { data, error } = await query
  if (error) return { count: 0, error: error.message }

  const slotRows = (data ?? []) as Array<{ id: string }>
  const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    slotRows.map((shift) => shift.id)
  )
  const count = slotRows.filter((shift) => !activeOperationalCodesByShiftId.has(shift.id)).length
  return { count }
}

async function getWorkedDatesInWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetDate: string,
  excludeShiftId?: string
): Promise<{ dates: Set<string>; error?: string }> {
  const bounds = getWeekBoundsForDate(targetDate)
  if (!bounds) return { dates: new Set<string>(), error: 'Invalid target date' }

  let query = supabase
    .from('shifts')
    .select('id, date, status')
    .eq('user_id', userId)
    .gte('date', bounds.weekStart)
    .lte('date', bounds.weekEnd)

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId)
  }

  const { data, error } = await query
  if (error) return { dates: new Set<string>(), error: error.message }

  const workedDates = new Set<string>()
  for (const shift of data ?? []) {
    if (!countsTowardWeeklyLimit(shift.status as ShiftStatus)) continue
    workedDates.add(shift.date as string)
  }
  return { dates: workedDates }
}

async function getTherapistWeeklyLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  therapistId: string,
  siteId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) return MAX_WORK_DAYS_PER_WEEK

  const profile = data as {
    max_work_days_per_week: number | null
    employment_type: EmploymentType | null
  } | null
  const fallback = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, fallback)
}

async function getTherapistAvailabilityState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  therapistId: string,
  siteId: string,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night'
): Promise<TherapistAvailabilityState> {
  const [profileResult, availabilityResult, patternResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, is_active, archived_at, on_fmla, employment_type')
      .eq('id', therapistId)
      .eq('site_id', siteId)
      .maybeSingle(),
    supabase
      .from('availability_overrides')
      .select('cycle_id, therapist_id, date, shift_type, override_type, note')
      .eq('therapist_id', therapistId)
      .eq('cycle_id', cycleId)
      .eq('date', date),
    supabase
      .from('work_patterns')
      .select(
        'therapist_id, pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference'
      )
      .eq('therapist_id', therapistId)
      .maybeSingle(),
  ])

  if (
    profileResult.error ||
    availabilityResult.error ||
    patternResult.error ||
    !profileResult.data
  ) {
    return {
      therapistName: 'Therapist',
      blockedByConstraints: false,
      unavailableReason: null,
      forceOff: false,
      forceOn: false,
      inactiveOrFmla: false,
      prnNotOffered: false,
      error: 'Failed to validate availability constraints.',
    }
  }

  const therapistName = String(profileResult.data?.full_name ?? 'Therapist')
  const pattern = patternResult.data
    ? normalizeWorkPattern({
        therapist_id: therapistId,
        pattern_type:
          (patternResult.data as { pattern_type?: WorkPattern['pattern_type'] | null } | null)
            ?.pattern_type ?? undefined,
        works_dow: patternResult.data.works_dow,
        offs_dow: patternResult.data.offs_dow,
        weekend_rotation:
          patternResult.data.weekend_rotation === 'every_other' ? 'every_other' : undefined,
        weekend_anchor_date: patternResult.data.weekend_anchor_date,
        works_dow_mode: patternResult.data.works_dow_mode === 'soft' ? 'soft' : undefined,
        weekly_weekdays:
          (patternResult.data as { weekly_weekdays?: number[] | null } | null)?.weekly_weekdays ??
          patternResult.data.works_dow ??
          [],
        weekend_rule:
          (patternResult.data as { weekend_rule?: WorkPattern['weekend_rule'] | null } | null)
            ?.weekend_rule ?? undefined,
        cycle_anchor_date:
          (patternResult.data as { cycle_anchor_date?: string | null } | null)?.cycle_anchor_date ??
          null,
        cycle_segments:
          (patternResult.data as { cycle_segments?: WorkPattern['cycle_segments'] | null } | null)
            ?.cycle_segments ?? [],
        shift_preference: patternResult.data.shift_preference as WorkPattern['shift_preference'],
      })
    : normalizeWorkPattern({
        therapist_id: therapistId,
        works_dow: [],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
        shift_preference: 'either',
      })

  const overrides = (availabilityResult.data ?? []) as CycleAvailabilityOverrideRow[]
  const resolution = resolveEligibility({
    therapist: {
      id: therapistId,
      is_active: profileResult.data.is_active !== false,
      on_fmla: Boolean(profileResult.data.archived_at) || profileResult.data.on_fmla === true,
      employment_type:
        profileResult.data.employment_type === 'prn'
          ? 'prn'
          : profileResult.data.employment_type === 'part_time'
            ? 'part_time'
            : 'full_time',
      pattern,
    },
    cycleId,
    date,
    shiftType,
    overrides,
  })
  const reasonLabel = formatEligibilityReason(resolution.reason)

  return {
    therapistName,
    blockedByConstraints: !resolution.allowed,
    unavailableReason: reasonLabel,
    forceOff: resolution.reason === 'override_force_off',
    forceOn: resolution.offeredByOverride,
    inactiveOrFmla: resolution.reason === 'inactive' || resolution.reason === 'on_fmla',
    prnNotOffered: resolution.prnNotOffered,
  }
}

async function slotHasActiveOperationalEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night'
): Promise<boolean> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('date', date)
    .eq('shift_type', shiftType)

  if (error) {
    console.error('Could not load slot shifts for post-publish audit:', error)
    return false
  }

  const shiftIds = ((data ?? []) as ShiftSlotRow[]).map((shift) => shift.id).filter(Boolean)
  if (shiftIds.length === 0) return false

  const activeOperationalEntries = await fetchActiveOperationalCodeMap(supabase, shiftIds)
  return activeOperationalEntries.size > 0
}

async function shouldLogPostPublishModificationForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  date: string,
  shiftType: 'day' | 'night',
  cyclePublished: boolean
): Promise<boolean> {
  if (cyclePublished) {
    return true
  }

  if (date < toIsoDate(new Date())) {
    return true
  }

  return await slotHasActiveOperationalEntries(supabase, cycleId, date, shiftType)
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return scheduleMutationErrorResponse('Invalid request origin.', ERROR_CODES.forbidden, 403)
  }

  const supabase = await createClient()
  const authorization = await authorizeScheduleMutationManager(supabase)
  if (!authorization.ok) {
    return scheduleMutationErrorResponse(
      authorization.error,
      authorization.code,
      authorization.status
    )
  }
  const { managerSiteId, userId } = authorization

  const payload = parseActionBody(await request.json().catch(() => null))

  if (!payload) {
    return scheduleMutationErrorResponse('Invalid request body', ERROR_CODES.invalidBody, 400)
  }

  const cycleLoad = await loadScheduleMutationCycle(supabase, payload.cycleId, managerSiteId)
  if (!cycleLoad.ok) {
    return scheduleMutationErrorResponse(cycleLoad.error, cycleLoad.code, cycleLoad.status)
  }
  const { cycle } = cycleLoad

  const { data: activePreliminarySnapshot } = await supabase
    .from('preliminary_snapshots')
    .select('id')
    .eq('cycle_id', payload.cycleId)
    .eq('status', 'active')
    .maybeSingle()
  const preliminaryActive = Boolean(activePreliminarySnapshot) && !Boolean(cycle.published)

  if (payload.action === 'assign') {
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

    const availabilityState = await getTherapistAvailabilityState(
      supabase,
      payload.userId,
      managerSiteId,
      payload.cycleId,
      payload.date,
      payload.shiftType
    )
    if (availabilityState.error) {
      return scheduleMutationErrorResponse(availabilityState.error, ERROR_CODES.internalError, 500)
    }
    if (
      availabilityState.blockedByConstraints &&
      (availabilityState.inactiveOrFmla || availabilityState.prnNotOffered)
    ) {
      return scheduleMutationErrorResponse(
        availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
        ERROR_CODES.therapistUnassignable,
        409
      )
    }
    if (availabilityState.blockedByConstraints && payload.availabilityOverride !== true) {
      return scheduleMutationErrorResponse(
        'Conflicts with scheduling constraints.',
        ERROR_CODES.availabilityConflict,
        409,
        {
          availability: {
            therapistId: payload.userId,
            therapistName: availabilityState.therapistName,
            date: payload.date,
            shiftType: payload.shiftType,
            reason: availabilityState.unavailableReason,
          },
        }
      )
    }

    if (!payload.overrideWeeklyRules) {
      const coverage = await getCoverageCountForSlot(
        supabase,
        payload.cycleId,
        payload.date,
        payload.shiftType
      )
      if (coverage.error) {
        return scheduleMutationErrorResponse(
          'Failed to validate daily coverage limit.',
          ERROR_CODES.internalError,
          500
        )
      }
      if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
        return scheduleMutationErrorResponse(
          `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.`,
          ERROR_CODES.coverageLimitExceeded,
          409
        )
      }

      const weekly = await getWorkedDatesInWeek(supabase, payload.userId, payload.date)
      if (weekly.error) {
        return scheduleMutationErrorResponse(
          'Failed to validate weekly rule',
          ERROR_CODES.internalError,
          500
        )
      }
      const weeklyLimit = await getTherapistWeeklyLimit(supabase, payload.userId, managerSiteId)
      if (exceedsWeeklyLimit(weekly.dates, payload.date, weeklyLimit)) {
        return scheduleMutationErrorResponse(
          `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.`,
          ERROR_CODES.weeklyLimitExceeded,
          409
        )
      }
    }

    const availabilityOverrideFields = buildAvailabilityOverrideMutationFields({
      blockedByConstraints: availabilityState.blockedByConstraints,
      inactiveOrFmla: availabilityState.inactiveOrFmla,
      availabilityOverride: payload.availabilityOverride,
      availabilityOverrideReason: payload.availabilityOverrideReason,
      actorId: userId,
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
        userId: userId,
        action: 'shift_added',
        targetType: 'shift',
        targetId: insertedShift.id,
      })
    }

    const shouldLogPostPublishModification = await shouldLogPostPublishModificationForSlot(
      supabase,
      payload.cycleId,
      payload.date,
      payload.shiftType,
      Boolean(cycle.published)
    )

    if (shouldLogPostPublishModification && insertedShift?.id) {
      await writeAuditLog(supabase, {
        userId: userId,
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

  if (payload.action === 'move') {
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

    if (shift.date === payload.targetDate && shift.shift_type === payload.targetShiftType) {
      return NextResponse.json({ message: 'Shift already on that date.' })
    }

    const assignedUserId = shift.user_id
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

    const availabilityState = await getTherapistAvailabilityState(
      supabase,
      assignedUserId,
      managerSiteId,
      payload.cycleId,
      payload.targetDate,
      payload.targetShiftType
    )
    if (availabilityState.error) {
      return scheduleMutationErrorResponse(availabilityState.error, ERROR_CODES.internalError, 500)
    }
    if (
      availabilityState.blockedByConstraints &&
      (availabilityState.inactiveOrFmla || availabilityState.prnNotOffered)
    ) {
      return scheduleMutationErrorResponse(
        availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
        ERROR_CODES.therapistUnassignable,
        409
      )
    }
    if (availabilityState.blockedByConstraints && payload.availabilityOverride !== true) {
      return scheduleMutationErrorResponse(
        'Conflicts with scheduling constraints.',
        ERROR_CODES.availabilityConflict,
        409,
        {
          availability: {
            therapistId: assignedUserId,
            therapistName: availabilityState.therapistName,
            date: payload.targetDate,
            shiftType: payload.targetShiftType,
            reason: availabilityState.unavailableReason,
          },
        }
      )
    }

    if (!payload.overrideWeeklyRules && countsTowardWeeklyLimit(shift.status as ShiftStatus)) {
      const coverage = await getCoverageCountForSlot(
        supabase,
        payload.cycleId,
        payload.targetDate,
        payload.targetShiftType,
        shift.id
      )
      if (coverage.error) {
        return scheduleMutationErrorResponse(
          'Failed to validate daily coverage limit.',
          ERROR_CODES.internalError,
          500
        )
      }
      if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
        return scheduleMutationErrorResponse(
          `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.`,
          ERROR_CODES.coverageLimitExceeded,
          409
        )
      }

      const weekly = await getWorkedDatesInWeek(
        supabase,
        assignedUserId,
        payload.targetDate,
        shift.id
      )
      if (weekly.error) {
        return scheduleMutationErrorResponse(
          'Failed to validate weekly rule',
          ERROR_CODES.internalError,
          500
        )
      }
      const weeklyLimit = await getTherapistWeeklyLimit(supabase, assignedUserId, managerSiteId)
      if (exceedsWeeklyLimit(weekly.dates, payload.targetDate, weeklyLimit)) {
        return scheduleMutationErrorResponse(
          `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.`,
          ERROR_CODES.weeklyLimitExceeded,
          409
        )
      }
    }

    const availabilityOverrideFields = buildAvailabilityOverrideMutationFields({
      blockedByConstraints: availabilityState.blockedByConstraints,
      inactiveOrFmla: availabilityState.inactiveOrFmla,
      availabilityOverride: payload.availabilityOverride,
      availabilityOverrideReason: payload.availabilityOverrideReason,
      actorId: userId,
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

    if (!shift.date || !shift.shift_type) {
      return scheduleMutationErrorResponse('Incomplete shift data', ERROR_CODES.internalError, 422)
    }

    if (cycle.published || preliminaryActive) {
      try {
        await closePendingShiftPostsForShiftIds(
          supabase,
          [shift.id],
          'Schedule changed after this request was posted.'
        )
      } catch (error) {
        ignorePostMutationCleanupError(error)
      }
    }

    await notifyPublishedShiftMoved(supabase, {
      cyclePublished: Boolean(cycle.published),
      userId: shift.user_id,
      fromDate: shift.date,
      fromShiftType: shift.shift_type as 'day' | 'night',
      toDate: payload.targetDate,
      toShiftType: payload.targetShiftType,
      targetId: shift.id,
    })
    await notifyPreliminaryShiftMoved(supabase, {
      preliminaryActive,
      userId: shift.user_id,
      fromDate: shift.date,
      fromShiftType: shift.shift_type as 'day' | 'night',
      toDate: payload.targetDate,
      toShiftType: payload.targetShiftType,
      targetId: shift.id,
    })

    const undoAction: DragAction = {
      action: 'move',
      cycleId: payload.cycleId,
      shiftId: payload.shiftId,
      targetDate: shift.date,
      targetShiftType: shift.shift_type as 'day' | 'night',
      overrideWeeklyRules: true,
    }

    const sourceNeedsAudit = await shouldLogPostPublishModificationForSlot(
      supabase,
      payload.cycleId,
      shift.date,
      shift.shift_type as 'day' | 'night',
      Boolean(cycle.published)
    )
    const targetNeedsAudit = await shouldLogPostPublishModificationForSlot(
      supabase,
      payload.cycleId,
      payload.targetDate,
      payload.targetShiftType,
      Boolean(cycle.published)
    )

    if (sourceNeedsAudit || targetNeedsAudit) {
      await writeAuditLog(supabase, {
        userId: userId,
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: payload.shiftId,
      })
    }

    return NextResponse.json({ message: 'Shift moved.', undoAction })
  }

  if (payload.action === 'remove') {
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
      userId: userId,
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
      userId: shift.user_id as string,
      shiftType: shift.shift_type as 'day' | 'night',
      date: shift.date as string,
      overrideWeeklyRules: true,
    }

    const shouldLogPostPublishModification = await shouldLogPostPublishModificationForSlot(
      supabase,
      payload.cycleId,
      shift.date,
      shift.shift_type,
      Boolean(cycle.published)
    )

    if (shouldLogPostPublishModification) {
      const targetId = 'shiftId' in payload ? payload.shiftId : `${payload.userId}:${payload.date}`
      await writeAuditLog(supabase, {
        userId: userId,
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId,
      })
    }

    return NextResponse.json({ message: 'Shift removed from schedule.', undoAction })
  }

  if (payload.action === 'set_lead') {
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

    const availabilityState = await getTherapistAvailabilityState(
      supabase,
      payload.therapistId,
      managerSiteId,
      payload.cycleId,
      payload.date,
      payload.shiftType
    )
    if (availabilityState.error) {
      return scheduleMutationErrorResponse(availabilityState.error, ERROR_CODES.internalError, 500)
    }
    if (
      availabilityState.blockedByConstraints &&
      (availabilityState.inactiveOrFmla || availabilityState.prnNotOffered)
    ) {
      return scheduleMutationErrorResponse(
        availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
        ERROR_CODES.therapistUnassignable,
        409
      )
    }
    if (availabilityState.blockedByConstraints && payload.availabilityOverride !== true) {
      return scheduleMutationErrorResponse(
        'Conflicts with scheduling constraints.',
        ERROR_CODES.availabilityConflict,
        409,
        {
          availability: {
            therapistId: payload.therapistId,
            therapistName: availabilityState.therapistName,
            date: payload.date,
            shiftType: payload.shiftType,
            reason: availabilityState.unavailableReason,
          },
        }
      )
    }

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

    if (!existingShift) {
      if (!payload.overrideWeeklyRules) {
        const coverage = await getCoverageCountForSlot(
          supabase,
          payload.cycleId,
          payload.date,
          payload.shiftType
        )
        if (coverage.error) {
          return scheduleMutationErrorResponse(
            'Failed to validate daily coverage limit.',
            ERROR_CODES.internalError,
            500
          )
        }
        if (exceedsCoverageLimit(coverage.count, MAX_SHIFT_COVERAGE_PER_DAY)) {
          return scheduleMutationErrorResponse(
            `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members.`,
            ERROR_CODES.coverageLimitExceeded,
            409
          )
        }

        const weekly = await getWorkedDatesInWeek(supabase, payload.therapistId, payload.date)
        if (weekly.error) {
          return scheduleMutationErrorResponse(
            'Failed to validate weekly rule',
            ERROR_CODES.internalError,
            500
          )
        }
        const weeklyLimit = await getTherapistWeeklyLimit(
          supabase,
          payload.therapistId,
          managerSiteId
        )
        if (exceedsWeeklyLimit(weekly.dates, payload.date, weeklyLimit)) {
          return scheduleMutationErrorResponse(
            `Therapists are limited to ${weeklyLimit} day(s) per week unless override is enabled.`,
            ERROR_CODES.weeklyLimitExceeded,
            409
          )
        }
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
      userId: userId,
      action: 'designated_lead_assigned',
      targetType: 'shift_slot',
      targetId: `${payload.cycleId}:${payload.date}:${payload.shiftType}`,
    })

    const availabilityOverrideFields = buildAvailabilityOverrideMutationFields({
      blockedByConstraints: availabilityState.blockedByConstraints,
      inactiveOrFmla: availabilityState.inactiveOrFmla,
      availabilityOverride: payload.availabilityOverride,
      availabilityOverrideReason: payload.availabilityOverrideReason,
      actorId: userId,
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

    if (!existingShift) {
      await notifyPublishedShiftAdded(supabase, {
        cyclePublished: Boolean(cycle.published),
        userId: payload.therapistId,
        date: payload.date,
        shiftType: payload.shiftType,
        targetId: `${payload.cycleId}:${payload.therapistId}:${payload.date}:${payload.shiftType}`,
      })
    }

    const leadShiftId =
      existingShift?.id ??
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

    const shouldLogPostPublishModification = await shouldLogPostPublishModificationForSlot(
      supabase,
      payload.cycleId,
      payload.date,
      payload.shiftType,
      Boolean(cycle.published)
    )

    if (shouldLogPostPublishModification) {
      await writeAuditLog(supabase, {
        userId: userId,
        action: 'post_publish_modification',
        targetType: 'shift',
        targetId: leadShiftId,
      })
    }

    return NextResponse.json({ message: 'Designated lead updated.' })
  }

  return scheduleMutationErrorResponse('Unsupported action', ERROR_CODES.unsupportedAction, 400)
}
