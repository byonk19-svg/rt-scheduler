import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MIN_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import type {
  ScheduleSearchParams,
  Therapist,
  ToastVariant,
  ViewMode,
} from '@/app/schedule/types'

export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDayNumber(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return String(parsed.getDate())
}

export function formatWeekdayShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
}

export function getWeekBoundsForDate(value: string): { weekStart: string; weekEnd: string } | null {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null

  const weekStartDate = new Date(parsed)
  weekStartDate.setDate(parsed.getDate() - parsed.getDay())

  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)

  return {
    weekStart: dateKeyFromDate(weekStartDate),
    weekEnd: dateKeyFromDate(weekEndDate),
  }
}

export function getWeekdayIndex(value: string): number | null {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getDay()
}

export function weeklyCountKey(userId: string, weekStart: string): string {
  return `${userId}:${weekStart}`
}

export function countsTowardWeeklyLimit(status: string): boolean {
  return status === 'scheduled' || status === 'on_call'
}

export function coverageSlotKey(date: string, shiftType: 'day' | 'night'): string {
  return `${date}:${shiftType}`
}

export function getPrintShiftCode(status: string): string {
  if (status === 'on_call') return 'OC'
  if (status === 'sick') return 'S'
  if (status === 'called_off') return 'OFF'
  return '1'
}

export function isDateWithinRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate
}

export function buildDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }

  const dates: string[] = []
  const current = new Date(start)

  while (current <= end) {
    dates.push(dateKeyFromDate(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

export function normalizeViewMode(value: string | undefined): ViewMode {
  if (value === 'list') return 'list'
  if (value === 'calendar') return 'calendar'
  return 'grid'
}

export function buildScheduleUrl(
  cycleId?: string,
  view?: string,
  extraParams?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams()
  if (cycleId) params.set('cycle', cycleId)
  const normalizedView = normalizeViewMode(view)
  params.set('view', normalizedView)
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value)
    }
  }
  return `/schedule?${params.toString()}`
}

export function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function parseCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function getScheduleFeedback(params?: ScheduleSearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const auto = getSearchParam(params?.auto)
  const draft = getSearchParam(params?.draft)
  const success = getSearchParam(params?.success)

  if (success === 'cycle_created') {
    const copied = parseCount(getSearchParam(params?.copied))
    const skipped = parseCount(getSearchParam(params?.skipped))
    if (copied > 0 || skipped > 0 || getSearchParam(params?.copied) === '0') {
      return {
        message:
          skipped > 0
            ? `Schedule cycle created. Copied ${copied} shift assignments from the previous cycle and skipped ${skipped} inactive or FMLA assignments.`
            : `Schedule cycle created. Copied ${copied} shift assignments from the previous cycle.`,
        variant: 'success',
      }
    }
    return { message: 'Schedule cycle created.', variant: 'success' }
  }
  if (success === 'cycle_published') {
    return { message: 'Schedule cycle published.', variant: 'success' }
  }
  if (success === 'cycle_unpublished') {
    return { message: 'Schedule cycle moved to draft.', variant: 'success' }
  }
  if (success === 'shift_added') {
    return { message: 'Shift added to schedule.', variant: 'success' }
  }
  if (success === 'shift_deleted') {
    return { message: 'Shift removed from schedule.', variant: 'success' }
  }
  if (success === 'lead_updated') {
    return { message: 'Designated lead updated.', variant: 'success' }
  }

  if (error === 'auto_generate_failed') {
    return { message: 'Could not auto-generate draft schedule. Please try again.', variant: 'error' }
  }
  if (error === 'create_cycle_failed') {
    return { message: 'Could not create schedule cycle. Please check inputs and try again.', variant: 'error' }
  }
  if (error === 'copy_from_last_cycle_failed') {
    return {
      message: 'Cycle created, but we could not copy shifts from the previous cycle. Please try again.',
      variant: 'error',
    }
  }
  if (error === 'delete_shift_failed') {
    return { message: 'Could not delete shift. Please try again.', variant: 'error' }
  }
  if (error === 'auto_generate_db_error') {
    return { message: 'Database error while saving auto-generated shifts. Please try again.', variant: 'error' }
  }
  if (error === 'auto_generate_coverage_incomplete') {
    const dropped = parseCount(getSearchParam(params?.dropped))
    const detail = dropped > 0 ? ` (${dropped} shift${dropped !== 1 ? 's' : ''} skipped due to conflicts)` : ''
    return {
      message: `Auto-generate completed but coverage may be incomplete${detail}. Verify shifts and retry if needed.`,
      variant: 'error',
    }
  }
  if (error === 'auto_generate_lead_assignment_failed') {
    return {
      message:
        'Auto-generate could not finalize designated leads for one or more shifts. Please review leads and retry.',
      variant: 'error',
    }
  }
  if (error === 'auto_missing_cycle') {
    return { message: 'Select a schedule cycle first.', variant: 'error' }
  }
  if (error === 'auto_cycle_published') {
    return { message: 'Move this cycle to draft before auto-generating.', variant: 'error' }
  }
  if (error === 'auto_no_therapists') {
    return { message: 'No therapists found to schedule.', variant: 'error' }
  }
  if (error === 'reset_missing_cycle') {
    return { message: 'Select a schedule cycle first.', variant: 'error' }
  }
  if (error === 'reset_cycle_published') {
    return { message: 'Only draft cycles can be reset.', variant: 'error' }
  }
  if (error === 'reset_failed') {
    return { message: 'Could not clear the draft schedule. Please try again.', variant: 'error' }
  }
  if (error === 'weekly_limit_exceeded') {
    const weekStart = getSearchParam(params?.week_start)
    const weekEnd = getSearchParam(params?.week_end)
    const weekLabel =
      weekStart && weekEnd ? ` (${formatDate(weekStart)} to ${formatDate(weekEnd)})` : ''
    return {
      message: `This assignment exceeds that therapist's weekly limit (Sun-Sat)${weekLabel}.`,
      variant: 'error',
    }
  }
  if (error === 'duplicate_shift') {
    return { message: 'That therapist is already assigned on that date in this cycle.', variant: 'error' }
  }
  if (error === 'add_shift_failed') {
    return { message: 'Could not add shift. Please try again.', variant: 'error' }
  }
  if (error === 'coverage_max_exceeded') {
    return {
      message: `Each shift can have at most ${MAX_SHIFT_COVERAGE_PER_DAY} scheduled team members per day.`,
      variant: 'error',
    }
  }
  if (error === 'publish_weekly_rule_violation') {
    const violations = parseCount(getSearchParam(params?.violations))
    const under = parseCount(getSearchParam(params?.under))
    const over = parseCount(getSearchParam(params?.over))
    return {
      message: `Weekly workload rule failed (${violations} therapist-weeks: ${under} under, ${over} over). Use Publish with Override if needed.`,
      variant: 'error',
    }
  }
  if (error === 'publish_validation_failed') {
    return { message: 'Could not validate weekly rules before publishing.', variant: 'error' }
  }
  if (error === 'publish_coverage_rule_violation') {
    const underCoverage = parseCount(getSearchParam(params?.under_coverage))
    const overCoverage = parseCount(getSearchParam(params?.over_coverage))
    const violations = underCoverage + overCoverage
    return {
      message: `Daily coverage rule failed (${violations} day/shift slots: ${underCoverage} under, ${overCoverage} over). Target is ${MIN_SHIFT_COVERAGE_PER_DAY}-${MAX_SHIFT_COVERAGE_PER_DAY}.`,
      variant: 'error',
    }
  }
  if (error === 'publish_shift_rule_violation') {
    const underCoverage = parseCount(getSearchParam(params?.under_coverage))
    const overCoverage = parseCount(getSearchParam(params?.over_coverage))
    const missingLead = parseCount(getSearchParam(params?.lead_missing))
    const multipleLeads = parseCount(getSearchParam(params?.lead_multiple))
    const ineligibleLead = parseCount(getSearchParam(params?.lead_ineligible))
    return {
      message: `Publish blocked. Coverage under: ${underCoverage}, coverage over: ${overCoverage}, missing lead: ${missingLead}, multiple leads: ${multipleLeads}, ineligible lead: ${ineligibleLead}.`,
      variant: 'error',
    }
  }
  if (error === 'set_lead_not_eligible') {
    return { message: 'Only lead-eligible therapists can be designated as lead.', variant: 'error' }
  }
  if (error === 'set_lead_weekly_limit') {
    return { message: "Designated lead would exceed that therapist's weekly limit.", variant: 'error' }
  }
  if (error === 'set_lead_coverage_max') {
    return {
      message: `Designated lead would exceed max coverage (${MAX_SHIFT_COVERAGE_PER_DAY}) for that shift.`,
      variant: 'error',
    }
  }
  if (error === 'set_lead_failed') {
    return { message: 'Could not set designated lead for that shift. Please try again.', variant: 'error' }
  }
  if (error === 'set_lead_multiple') {
    return { message: 'A designated lead already exists for that shift. Refresh and try again.', variant: 'error' }
  }

  if (auto === 'generated') {
    const added = parseCount(getSearchParam(params?.added))
    const unfilled = parseCount(getSearchParam(params?.unfilled))
    const leadMissing = parseCount(getSearchParam(params?.lead_missing))

    if (added === 0 && unfilled === 0 && leadMissing === 0) {
      return {
        message:
          'Auto-generate made no changes because this draft already has assignment coverage. Use "Clear draft and start over" to rebuild it.',
        variant: 'success',
      }
    }
    if (unfilled > 0 || leadMissing > 0) {
      const unfilledText =
        unfilled > 0 ? `${unfilled} slot${unfilled !== 1 ? 's' : ''} still need manual fill.` : ''
      const leadText =
        leadMissing > 0
          ? `${leadMissing} shift${leadMissing !== 1 ? 's' : ''} still need a designated lead.`
          : ''
      return {
        message: `Draft generated with ${added} new shifts. ${unfilledText} ${leadText}`.trim(),
        variant: 'error',
      }
    }
    return { message: `Draft generated with ${added} new shifts.`, variant: 'success' }
  }

  if (draft === 'reset') {
    const removed = parseCount(getSearchParam(params?.removed))
    if (removed === 0) {
      return { message: 'Draft cleared. There were no assigned shifts to remove.', variant: 'success' }
    }
    return { message: `Draft cleared. Removed ${removed} shift assignments.`, variant: 'success' }
  }

  return null
}

export function pickTherapistForDate(
  therapists: Therapist[],
  cursor: number,
  date: string,
  unavailableDatesByUser: Map<string, Set<string>>,
  assignedUserIdsForDate: Set<string>,
  weeklyWorkedDatesByUserWeek: Map<string, Set<string>>,
  weeklyLimitByTherapist: Map<string, number>
): { therapist: Therapist | null; nextCursor: number } {
  if (therapists.length === 0) {
    return { therapist: null, nextCursor: cursor }
  }

  const bounds = getWeekBoundsForDate(date)
  const weekday = getWeekdayIndex(date)
  if (!bounds) {
    return { therapist: null, nextCursor: cursor }
  }

  let best: {
    therapist: Therapist
    index: number
    weeklyCount: number
    offset: number
    prefersDay: boolean
  } | null = null

  for (let i = 0; i < therapists.length; i += 1) {
    const index = (cursor + i) % therapists.length
    const therapist = therapists[index]
    if (assignedUserIdsForDate.has(therapist.id)) continue
    const unavailableDates = unavailableDatesByUser.get(therapist.id)
    if (unavailableDates?.has(date)) continue

    const preferredDays = Array.isArray(therapist.preferred_work_days)
      ? therapist.preferred_work_days
      : []
    if (therapist.employment_type === 'prn') {
      if (weekday === null) continue
      if (preferredDays.length === 0) continue
      if (!preferredDays.includes(weekday)) continue
    }

    const weeklyDates =
      weeklyWorkedDatesByUserWeek.get(weeklyCountKey(therapist.id, bounds.weekStart)) ?? new Set<string>()
    const weeklyLimit = sanitizeWeeklyLimit(
      weeklyLimitByTherapist.get(therapist.id),
      getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
    )
    if (!weeklyDates.has(date) && weeklyDates.size >= weeklyLimit) continue

    const prefersDay =
      weekday === null || preferredDays.length === 0 || preferredDays.includes(weekday)

    const weeklyCount = weeklyDates.size
    if (
      !best ||
      (prefersDay && !best.prefersDay) ||
      (prefersDay === best.prefersDay && weeklyCount < best.weeklyCount) ||
      (prefersDay === best.prefersDay &&
        weeklyCount === best.weeklyCount &&
        i < best.offset)
    ) {
      best = { therapist, index, weeklyCount, offset: i, prefersDay }
    }
  }

  if (!best) {
    return { therapist: null, nextCursor: cursor }
  }

  return { therapist: best.therapist, nextCursor: (best.index + 1) % therapists.length }
}
