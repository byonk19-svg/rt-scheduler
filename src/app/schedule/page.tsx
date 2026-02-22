import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerMonthCalendar } from '@/components/manager-month-calendar'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { PrintButton } from '@/components/print-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { MAX_WORK_DAYS_PER_WEEK, MIN_SHIFT_COVERAGE_PER_DAY, MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'

type Role = 'manager' | 'therapist'
type ViewMode = 'grid' | 'list' | 'calendar'
type ToastVariant = 'success' | 'error'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type Therapist = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
}

type ShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  user_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
}

type ScheduleSearchParams = {
  cycle?: string
  view?: string
  auto?: string
  added?: string
  unfilled?: string
  error?: string
  week_start?: string
  week_end?: string
  violations?: string
  under?: string
  over?: string
  under_coverage?: string
  over_coverage?: string
}

type AutoScheduleShiftRow = {
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftRow['status']
}

type ShiftLimitRow = {
  user_id: string
  date: string
  status: ShiftRow['status']
}

type AvailabilityDateRow = {
  user_id: string
  date: string
}

type CalendarShift = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftRow['status']
  user_id: string
  full_name: string
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDayNumber(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return String(parsed.getDate())
}

function formatWeekdayShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
}

function getWeekBoundsForDate(value: string): { weekStart: string; weekEnd: string } | null {
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

function weeklyCountKey(userId: string, weekStart: string): string {
  return `${userId}:${weekStart}`
}

function countsTowardWeeklyLimit(status: string): boolean {
  return status === 'scheduled' || status === 'on_call'
}

function coverageSlotKey(date: string, shiftType: 'day' | 'night'): string {
  return `${date}:${shiftType}`
}

function getPrintShiftCode(status: ShiftRow['status']): string {
  if (status === 'on_call') return 'OC'
  if (status === 'sick') return 'S'
  if (status === 'called_off') return 'OFF'
  return '1'
}

function buildDateRange(startDate: string, endDate: string): string[] {
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

function normalizeViewMode(value: string | undefined): ViewMode {
  if (value === 'list') return 'list'
  if (value === 'calendar') return 'calendar'
  return 'grid'
}

function buildScheduleUrl(
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

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function parseCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function getScheduleFeedback(params?: ScheduleSearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const auto = getSearchParam(params?.auto)

  if (error === 'auto_generate_failed') {
    return { message: 'Could not auto-generate draft schedule. Please try again.', variant: 'error' }
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
  if (error === 'weekly_limit_exceeded') {
    const weekStart = getSearchParam(params?.week_start)
    const weekEnd = getSearchParam(params?.week_end)
    const weekLabel =
      weekStart && weekEnd ? ` (${formatDate(weekStart)} to ${formatDate(weekEnd)})` : ''
    return {
      message: `Therapists can only work ${MAX_WORK_DAYS_PER_WEEK} days per week (Sun-Sat)${weekLabel}.`,
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
      message: `Weekly 3-day rule failed (${violations} therapist-weeks: ${under} under, ${over} over). Use Publish with Override if needed.`,
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

  if (auto === 'generated') {
    const added = parseCount(getSearchParam(params?.added))
    const unfilled = parseCount(getSearchParam(params?.unfilled))

    if (added === 0 && unfilled === 0) {
      return { message: 'Draft schedule was already filled. No changes made.', variant: 'success' }
    }
    if (unfilled > 0) {
      return {
        message: `Draft generated with ${added} new shifts. ${unfilled} slots still need manual fill.`,
        variant: 'error',
      }
    }
    return { message: `Draft generated with ${added} new shifts.`, variant: 'success' }
  }

  return null
}

function pickTherapistForDate(
  therapists: Therapist[],
  cursor: number,
  date: string,
  unavailableDatesByUser: Map<string, Set<string>>,
  assignedUserIdsForDate: Set<string>,
  weeklyWorkedDatesByUserWeek: Map<string, Set<string>>
): { therapist: Therapist | null; nextCursor: number } {
  if (therapists.length === 0) {
    return { therapist: null, nextCursor: cursor }
  }

  const bounds = getWeekBoundsForDate(date)
  if (!bounds) {
    return { therapist: null, nextCursor: cursor }
  }

  let best: { therapist: Therapist; index: number; weeklyCount: number; offset: number } | null = null

  for (let i = 0; i < therapists.length; i += 1) {
    const index = (cursor + i) % therapists.length
    const therapist = therapists[index]
    if (assignedUserIdsForDate.has(therapist.id)) continue
    const unavailableDates = unavailableDatesByUser.get(therapist.id)
    if (unavailableDates?.has(date)) continue
    const weeklyDates =
      weeklyWorkedDatesByUserWeek.get(weeklyCountKey(therapist.id, bounds.weekStart)) ?? new Set<string>()
    if (!weeklyDates.has(date) && weeklyDates.size >= MAX_WORK_DAYS_PER_WEEK) continue

    const weeklyCount = weeklyDates.size
    if (
      !best ||
      weeklyCount < best.weeklyCount ||
      (weeklyCount === best.weeklyCount && i < best.offset)
    ) {
      best = { therapist, index, weeklyCount, offset: i }
    }
  }

  if (!best) {
    return { therapist: null, nextCursor: cursor }
  }

  return { therapist: best.therapist, nextCursor: (best.index + 1) % therapists.length }
}

async function getRoleForUser(userId: string): Promise<Role> {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return profile?.role === 'manager' ? 'manager' : 'therapist'
}

async function createCycleAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const label = String(formData.get('label') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const published = String(formData.get('published') ?? '') === 'on'
  const view = String(formData.get('view') ?? '').trim()

  if (!label || !startDate || !endDate) {
    redirect('/schedule')
  }

  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: startDate,
      end_date: endDate,
      published,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create schedule cycle:', error)
    redirect('/schedule')
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(data.id, view))
}

async function toggleCyclePublishedAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const currentlyPublished = String(formData.get('currently_published') ?? '').trim() === 'true'
  const view = String(formData.get('view') ?? '').trim()
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'true'

  if (!cycleId) {
    redirect('/schedule')
  }

  if (!currentlyPublished && !overrideWeeklyRules) {
    const { data: cycle, error: cycleError } = await supabase
      .from('schedule_cycles')
      .select('start_date, end_date')
      .eq('id', cycleId)
      .maybeSingle()

    if (cycleError || !cycle) {
      console.error('Failed to load cycle for publish validation:', cycleError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
    }

    const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
    const cycleWeekDates = new Map<string, Set<string>>()
    const cycleWeekEnds = new Map<string, string>()
    for (const date of cycleDates) {
      const bounds = getWeekBoundsForDate(date)
      if (!bounds) continue
      const dates = cycleWeekDates.get(bounds.weekStart) ?? new Set<string>()
      dates.add(date)
      cycleWeekDates.set(bounds.weekStart, dates)
      cycleWeekEnds.set(bounds.weekStart, bounds.weekEnd)
    }

    const { data: therapistsData, error: therapistsError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'therapist')

    if (therapistsError) {
      console.error('Failed to load therapists for publish validation:', therapistsError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
    }

    const therapistIds = (therapistsData ?? []).map((row) => row.id)
    if (therapistIds.length > 0 && cycleWeekDates.size > 0) {
      const weekStarts = Array.from(cycleWeekDates.keys()).sort()
      const minWeekStart = weekStarts[0]
      const maxWeekEnd = cycleWeekEnds.get(weekStarts[weekStarts.length - 1]) ?? minWeekStart

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('user_id, date, status')
        .in('user_id', therapistIds)
        .gte('date', minWeekStart)
        .lte('date', maxWeekEnd)

      if (shiftsError) {
        console.error('Failed to load shifts for publish validation:', shiftsError)
        redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
      }

      const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
      for (const row of (shiftsData ?? []) as ShiftLimitRow[]) {
        if (!countsTowardWeeklyLimit(row.status)) continue
        const bounds = getWeekBoundsForDate(row.date)
        if (!bounds) continue
        const key = weeklyCountKey(row.user_id, bounds.weekStart)
        const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
        workedDates.add(row.date)
        weeklyWorkedDatesByUserWeek.set(key, workedDates)
      }

      let underCount = 0
      let overCount = 0
      for (const therapistId of therapistIds) {
        for (const [weekStart, weekDatesInCycle] of cycleWeekDates) {
          const requiredDays = Math.min(MAX_WORK_DAYS_PER_WEEK, weekDatesInCycle.size)
          const workedDates =
            weeklyWorkedDatesByUserWeek.get(weeklyCountKey(therapistId, weekStart)) ?? new Set<string>()
          const workedCount = workedDates.size

          if (workedCount < requiredDays) underCount += 1
          if (workedCount > requiredDays) overCount += 1
        }
      }

      const violations = underCount + overCount
      if (violations > 0) {
        redirect(
          buildScheduleUrl(cycleId, view, {
            error: 'publish_weekly_rule_violation',
            violations: String(violations),
            under: String(underCount),
            over: String(overCount),
          })
        )
      }
    }

    const { data: shiftCoverageData, error: shiftCoverageError } = await supabase
      .from('shifts')
      .select('date, shift_type, status')
      .eq('cycle_id', cycleId)
      .gte('date', cycle.start_date)
      .lte('date', cycle.end_date)

    if (shiftCoverageError) {
      console.error('Failed to load shifts for coverage validation:', shiftCoverageError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'publish_validation_failed' }))
    }

    const coverageBySlot = new Map<string, number>()
    for (const row of shiftCoverageData ?? []) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      const key = coverageSlotKey(row.date, row.shift_type as 'day' | 'night')
      const count = coverageBySlot.get(key) ?? 0
      coverageBySlot.set(key, count + 1)
    }

    let underCoverage = 0
    let overCoverage = 0
    for (const date of cycleDates) {
      for (const shiftType of ['day', 'night'] as const) {
        const count = coverageBySlot.get(coverageSlotKey(date, shiftType)) ?? 0
        if (count < MIN_SHIFT_COVERAGE_PER_DAY) underCoverage += 1
        if (count > MAX_SHIFT_COVERAGE_PER_DAY) overCoverage += 1
      }
    }

    if (underCoverage > 0 || overCoverage > 0) {
      redirect(
        buildScheduleUrl(cycleId, view, {
          error: 'publish_coverage_rule_violation',
          under_coverage: String(underCoverage),
          over_coverage: String(overCoverage),
        })
      )
    }
  }

  const { error } = await supabase
    .from('schedule_cycles')
    .update({ published: !currentlyPublished })
    .eq('id', cycleId)

  if (error) {
    console.error('Failed to toggle schedule publication state:', error)
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
}

async function addShiftAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const userId = String(formData.get('user_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'on'

  if (!cycleId || !userId || !date || !shiftType || !status) {
    redirect('/schedule')
  }

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const { data: sameSlotShifts, error: sameSlotError } = await supabase
      .from('shifts')
      .select('status')
      .eq('cycle_id', cycleId)
      .eq('date', date)
      .eq('shift_type', shiftType)

    if (sameSlotError) {
      console.error('Failed to load slot coverage for limit check:', sameSlotError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
    }

    const activeCoverage = (sameSlotShifts ?? []).filter((row) => countsTowardWeeklyLimit(row.status)).length
    if (activeCoverage >= MAX_SHIFT_COVERAGE_PER_DAY) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'coverage_max_exceeded' }))
    }
  }

  if (countsTowardWeeklyLimit(status) && !overrideWeeklyRules) {
    const bounds = getWeekBoundsForDate(date)
    if (!bounds) {
      redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
    }

    const { data: weeklyShiftsData, error: weeklyShiftsError } = await supabase
      .from('shifts')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', bounds.weekStart)
      .lte('date', bounds.weekEnd)

    if (weeklyShiftsError) {
      console.error('Failed to load weekly shifts for limit check:', weeklyShiftsError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
    }

    const workedDates = new Set<string>()
    for (const row of (weeklyShiftsData ?? []) as Array<{ date: string; status: ShiftRow['status'] }>) {
      if (!countsTowardWeeklyLimit(row.status)) continue
      workedDates.add(row.date)
    }

    if (!workedDates.has(date) && workedDates.size >= MAX_WORK_DAYS_PER_WEEK) {
      redirect(
        buildScheduleUrl(cycleId, view, {
          error: 'weekly_limit_exceeded',
          week_start: bounds.weekStart,
          week_end: bounds.weekEnd,
        })
      )
    }
  }

  const { error } = await supabase.from('shifts').insert({
    cycle_id: cycleId,
    user_id: userId,
    date,
    shift_type: shiftType,
    status,
  })

  if (error) {
    console.error('Failed to insert shift:', error)
    if (error.code === '23505') {
      redirect(buildScheduleUrl(cycleId, view, { error: 'duplicate_shift' }))
    }
    redirect(buildScheduleUrl(cycleId, view, { error: 'add_shift_failed' }))
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
}

async function generateDraftScheduleAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()

  if (!cycleId) {
    redirect(buildScheduleUrl(undefined, view, { error: 'auto_missing_cycle' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for auto-generation:', cycleError)
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  if (cycle.published) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_cycle_published' }))
  }

  const { data: therapistsData, error: therapistsError } = await supabase
    .from('profiles')
    .select('id, full_name, shift_type')
    .eq('role', 'therapist')
    .order('full_name', { ascending: true })

  if (therapistsError) {
    console.error('Failed to load therapists for auto-generation:', therapistsError)
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  const therapists = (therapistsData ?? []) as Therapist[]
  if (therapists.length === 0) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_no_therapists' }))
  }

  const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
  if (cycleDates.length === 0) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  const firstWeekBounds = getWeekBoundsForDate(cycle.start_date)
  const lastWeekBounds = getWeekBoundsForDate(cycle.end_date)
  if (!firstWeekBounds || !lastWeekBounds) {
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  const therapistIds = therapists.map((therapist) => therapist.id)

  const [existingShiftsResult, cycleAvailabilityResult, globalAvailabilityResult, weeklyShiftsResult] =
    await Promise.all([
      supabase
        .from('shifts')
        .select('user_id, date, shift_type, status')
        .eq('cycle_id', cycleId),
      supabase
        .from('availability_requests')
        .select('user_id, date')
        .eq('cycle_id', cycleId)
        .gte('date', cycle.start_date)
        .lte('date', cycle.end_date),
      supabase
        .from('availability_requests')
        .select('user_id, date')
        .is('cycle_id', null)
        .gte('date', cycle.start_date)
        .lte('date', cycle.end_date),
      supabase
        .from('shifts')
        .select('user_id, date, status')
        .in('user_id', therapistIds)
        .gte('date', firstWeekBounds.weekStart)
        .lte('date', lastWeekBounds.weekEnd),
    ])

  if (
    existingShiftsResult.error ||
    cycleAvailabilityResult.error ||
    globalAvailabilityResult.error ||
    weeklyShiftsResult.error
  ) {
    console.error('Failed to load scheduling data for auto-generation:', {
      existingShiftsError: existingShiftsResult.error,
      cycleAvailabilityError: cycleAvailabilityResult.error,
      globalAvailabilityError: globalAvailabilityResult.error,
      weeklyShiftsError: weeklyShiftsResult.error,
    })
    redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
  }

  const existingShifts = (existingShiftsResult.data ?? []) as AutoScheduleShiftRow[]
  const blockedRows = [
    ...((cycleAvailabilityResult.data ?? []) as AvailabilityDateRow[]),
    ...((globalAvailabilityResult.data ?? []) as AvailabilityDateRow[]),
  ]

  const unavailableDatesByUser = new Map<string, Set<string>>()
  for (const row of blockedRows) {
    const unavailableDates = unavailableDatesByUser.get(row.user_id) ?? new Set<string>()
    unavailableDates.add(row.date)
    unavailableDatesByUser.set(row.user_id, unavailableDates)
  }

  const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
  for (const row of (weeklyShiftsResult.data ?? []) as ShiftLimitRow[]) {
    if (!countsTowardWeeklyLimit(row.status)) continue
    const bounds = getWeekBoundsForDate(row.date)
    if (!bounds) continue

    const key = weeklyCountKey(row.user_id, bounds.weekStart)
    const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
    workedDates.add(row.date)
    weeklyWorkedDatesByUserWeek.set(key, workedDates)
  }

  const coverageBySlot = new Map<string, number>()
  const assignedUserIdsByDate = new Map<string, Set<string>>()
  for (const shift of existingShifts) {
    if (countsTowardWeeklyLimit(shift.status)) {
      const slotKey = coverageSlotKey(shift.date, shift.shift_type)
      const coverage = coverageBySlot.get(slotKey) ?? 0
      coverageBySlot.set(slotKey, coverage + 1)
    }
    const assignedForDate = assignedUserIdsByDate.get(shift.date) ?? new Set<string>()
    assignedForDate.add(shift.user_id)
    assignedUserIdsByDate.set(shift.date, assignedForDate)
  }

  const dayTherapists = therapists.filter((therapist) => therapist.shift_type === 'day')
  const nightTherapists = therapists.filter((therapist) => therapist.shift_type === 'night')

  let dayCursor = 0
  let nightCursor = 0
  let unfilledSlots = 0

  const draftShiftsToInsert: Array<{
    cycle_id: string
    user_id: string
    date: string
    shift_type: 'day' | 'night'
    status: 'scheduled'
  }> = []

  for (const date of cycleDates) {
    const assignedForDate = assignedUserIdsByDate.get(date) ?? new Set<string>()
    assignedUserIdsByDate.set(date, assignedForDate)

    let dayCoverage = coverageBySlot.get(coverageSlotKey(date, 'day')) ?? 0
    while (dayCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
      const dayPick = pickTherapistForDate(
        dayTherapists,
        dayCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek
      )
      dayCursor = dayPick.nextCursor

      if (dayPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: dayPick.therapist.id,
          date,
          shift_type: 'day',
          status: 'scheduled',
        })
        assignedForDate.add(dayPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(dayPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        dayCoverage += 1
        coverageBySlot.set(coverageSlotKey(date, 'day'), dayCoverage)
      } else {
        unfilledSlots += MIN_SHIFT_COVERAGE_PER_DAY - dayCoverage
        break
      }
    }

    let nightCoverage = coverageBySlot.get(coverageSlotKey(date, 'night')) ?? 0
    while (nightCoverage < MIN_SHIFT_COVERAGE_PER_DAY) {
      const nightPick = pickTherapistForDate(
        nightTherapists,
        nightCursor,
        date,
        unavailableDatesByUser,
        assignedForDate,
        weeklyWorkedDatesByUserWeek
      )
      nightCursor = nightPick.nextCursor

      if (nightPick.therapist) {
        draftShiftsToInsert.push({
          cycle_id: cycleId,
          user_id: nightPick.therapist.id,
          date,
          shift_type: 'night',
          status: 'scheduled',
        })
        assignedForDate.add(nightPick.therapist.id)
        const weekBounds = getWeekBoundsForDate(date)
        if (weekBounds) {
          const key = weeklyCountKey(nightPick.therapist.id, weekBounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }
        nightCoverage += 1
        coverageBySlot.set(coverageSlotKey(date, 'night'), nightCoverage)
      } else {
        unfilledSlots += MIN_SHIFT_COVERAGE_PER_DAY - nightCoverage
        break
      }
    }
  }

  if (draftShiftsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('shifts')
      .upsert(draftShiftsToInsert, { onConflict: 'cycle_id,user_id,date', ignoreDuplicates: true })

    if (insertError) {
      console.error('Failed to insert auto-generated shifts:', insertError)
      redirect(buildScheduleUrl(cycleId, view, { error: 'auto_generate_failed' }))
    }
  }

  revalidatePath('/schedule')
  redirect(
    buildScheduleUrl(cycleId, view, {
      auto: 'generated',
      added: String(draftShiftsToInsert.length),
      unfilled: String(unfilledSlots),
    })
  )
}

async function deleteShiftAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (role !== 'manager') {
    redirect('/schedule')
  }

  const shiftId = String(formData.get('shift_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const view = String(formData.get('view') ?? '').trim()

  if (!shiftId || !cycleId) {
    redirect('/schedule')
  }

  const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
  if (error) {
    console.error('Failed to delete shift:', error)
  }

  revalidatePath('/schedule')
  redirect(buildScheduleUrl(cycleId, view))
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<ScheduleSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  const selectedCycleId = params?.cycle
  let viewMode: ViewMode = normalizeViewMode(params?.view)
  const feedback = getScheduleFeedback(params)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, shift_type')
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'
  if (role !== 'manager' && viewMode === 'calendar') {
    viewMode = 'grid'
  }

  let cyclesQuery = supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .order('start_date', { ascending: false })

  if (role !== 'manager') {
    cyclesQuery = cyclesQuery.eq('published', true)
  }

  const { data: cyclesData } = await cyclesQuery
  const cycles = (cyclesData ?? []) as Cycle[]
  const activeCycle =
    cycles.find((cycle) => cycle.id === selectedCycleId) ??
    cycles[0] ??
    null
  const activeCycleId = activeCycle?.id

  let shifts: ShiftRow[] = []

  if (activeCycle) {
    let shiftsQuery = supabase
      .from('shifts')
      .select('id, date, shift_type, status, user_id, profiles(full_name)')
      .eq('cycle_id', activeCycle.id)
      .order('date', { ascending: true })
      .order('shift_type', { ascending: true })

    if (role !== 'manager') {
      shiftsQuery = shiftsQuery.eq('user_id', user.id)
    }

    const { data: shiftsData } = await shiftsQuery
    shifts = (shiftsData ?? []) as ShiftRow[]
  }

  let assignableTherapists: Therapist[] = []
  if (role === 'manager') {
    const { data: therapistData } = await supabase
      .from('profiles')
      .select('id, full_name, shift_type')
      .eq('role', 'therapist')
      .order('full_name', { ascending: true })
    assignableTherapists = (therapistData ?? []) as Therapist[]
  }

  const cycleDates = activeCycle ? buildDateRange(activeCycle.start_date, activeCycle.end_date) : []
  const shiftsByDate = new Map<string, { day: ShiftRow[]; night: ShiftRow[] }>()
  for (const date of cycleDates) {
    shiftsByDate.set(date, { day: [], night: [] })
  }

  for (const shift of shifts) {
    const row = shiftsByDate.get(shift.date) ?? { day: [], night: [] }
    if (shift.shift_type === 'night') {
      row.night.push(shift)
    } else {
      row.day.push(shift)
    }
    shiftsByDate.set(shift.date, row)
  }

  const shiftByUserDate = new Map<string, ShiftRow>()
  for (const shift of shifts) {
    shiftByUserDate.set(`${shift.user_id}:${shift.date}`, shift)
  }

  const calendarShifts: CalendarShift[] = shifts.map((shift) => ({
    id: shift.id,
    date: shift.date,
    shift_type: shift.shift_type,
    status: shift.status,
    user_id: shift.user_id,
    full_name: getOne(shift.profiles)?.full_name ?? 'Unknown',
  }))

  const namesFromShiftRows = new Map<string, string>()
  for (const shift of shifts) {
    namesFromShiftRows.set(shift.user_id, getOne(shift.profiles)?.full_name ?? 'Unknown')
  }

  const therapistById = new Map(assignableTherapists.map((therapist) => [therapist.id, therapist]))
  const printUsers: Therapist[] =
    role === 'manager'
      ? Array.from(
          new Set([
            ...assignableTherapists.map((therapist) => therapist.id),
            ...shifts.map((shift) => shift.user_id),
          ])
        )
          .map((id) => {
            const existing = therapistById.get(id)
            if (existing) return existing
            return {
              id,
              full_name: namesFromShiftRows.get(id) ?? 'Unknown',
              shift_type: 'day',
            } satisfies Therapist
          })
          .sort((a, b) => {
            if (a.shift_type === b.shift_type) return a.full_name.localeCompare(b.full_name)
            return a.shift_type === 'day' ? -1 : 1
          })
      : [
          {
            id: user.id,
            full_name: profile?.full_name ?? 'You',
            shift_type: profile?.shift_type === 'night' ? 'night' : 'day',
          },
        ]

  const dayTeam = printUsers.filter((member) => member.shift_type === 'day')
  const nightTeam = printUsers.filter((member) => member.shift_type === 'night')

  const coverageTotalsByDate = new Map<string, number>()
  if (role === 'manager') {
    for (const date of cycleDates) {
      const total = shifts.filter(
        (shift) => shift.date === date && (shift.status === 'scheduled' || shift.status === 'on_call')
      ).length
      coverageTotalsByDate.set(date, total)
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

        <div className="no-print flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <TeamwiseLogo size="small" className="mb-2" />
            <h1 className="text-3xl font-bold text-foreground">
              {viewMode === 'calendar'
                ? 'Month Calendar'
                : viewMode === 'grid'
                  ? 'Schedule Grid'
                  : 'Schedule List'}
            </h1>
            <p className="text-muted-foreground">
              {role === 'manager'
                ? 'Auto-generate draft schedules first, then use day/night calendars to fill holes. Target coverage is 3-5 per shift per day.'
                : 'View your shifts in published schedule cycles using grid or list format.'}
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <PrintButton />
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Cycle Selection</CardTitle>
            <CardDescription>Pick a cycle to view the schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
              >
                <Link href={buildScheduleUrl(activeCycleId, 'grid')}>Grid View</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'outline'}
              >
                <Link href={buildScheduleUrl(activeCycleId, 'list')}>List View</Link>
              </Button>
              {role === 'manager' && (
                <Button
                  asChild
                  size="sm"
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                >
                  <Link href={buildScheduleUrl(activeCycleId, 'calendar')}>Month Calendar</Link>
                </Button>
              )}
            </div>

            {cycles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {role === 'manager'
                  ? 'No schedule cycles yet. Create one below to start building the grid.'
                  : 'No published schedule cycles are available yet.'}
              </p>
            )}

            {cycles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {cycles.map((cycle) => (
                  <Button
                    asChild
                    key={cycle.id}
                    variant={activeCycle?.id === cycle.id ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Link href={buildScheduleUrl(cycle.id, viewMode)}>
                      {cycle.label} ({cycle.start_date} to {cycle.end_date})
                    </Link>
                  </Button>
                ))}
              </div>
            )}

            {activeCycle && (
              <div className="flex items-center gap-2">
                <Badge variant={activeCycle.published ? 'default' : 'outline'}>
                  {activeCycle.published ? 'Published' : 'Draft'}
                </Badge>
                {role === 'manager' && (
                  <>
                    {activeCycle.published ? (
                      <form action={toggleCyclePublishedAction}>
                        <input type="hidden" name="cycle_id" value={activeCycle.id} />
                        <input type="hidden" name="view" value={viewMode} />
                        <input type="hidden" name="currently_published" value="true" />
                        <input type="hidden" name="override_weekly_rules" value="false" />
                        <Button type="submit" size="sm" variant="outline">
                          Move to Draft
                        </Button>
                      </form>
                    ) : (
                      <>
                        <form action={toggleCyclePublishedAction}>
                          <input type="hidden" name="cycle_id" value={activeCycle.id} />
                          <input type="hidden" name="view" value={viewMode} />
                          <input type="hidden" name="currently_published" value="false" />
                          <input type="hidden" name="override_weekly_rules" value="false" />
                          <Button type="submit" size="sm" variant="outline">
                            Publish Cycle
                          </Button>
                        </form>

                        <form action={toggleCyclePublishedAction}>
                          <input type="hidden" name="cycle_id" value={activeCycle.id} />
                          <input type="hidden" name="view" value={viewMode} />
                          <input type="hidden" name="currently_published" value="false" />
                          <input type="hidden" name="override_weekly_rules" value="true" />
                          <Button type="submit" size="sm">
                            Publish with Override
                          </Button>
                        </form>
                      </>
                    )}

                    <form action={generateDraftScheduleAction}>
                      <input type="hidden" name="cycle_id" value={activeCycle.id} />
                      <input type="hidden" name="view" value={viewMode} />
                      <Button type="submit" size="sm" disabled={activeCycle.published}>
                        Auto-Generate Draft
                      </Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {role === 'manager' && (
          <div className="no-print grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create Schedule Cycle</CardTitle>
                <CardDescription>Set up a new 6-week scheduling period.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createCycleAction} className="space-y-4">
                  <input type="hidden" name="view" value={viewMode} />
                  <div className="space-y-2">
                    <Label htmlFor="label">Label</Label>
                    <Input id="label" name="label" placeholder="Mar 1 - Apr 12" required />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input id="start_date" name="start_date" type="date" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input id="end_date" name="end_date" type="date" required />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="published" />
                    Publish immediately
                  </label>
                  <Button type="submit">Create Cycle</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Shift</CardTitle>
                <CardDescription>
                  Assign therapists to day or night coverage. Coverage target is 3-5 per shift/day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!activeCycle ? (
                  <p className="text-sm text-muted-foreground">Create or select a cycle first.</p>
                ) : (
                  <form action={addShiftAction} className="space-y-4">
                    <input type="hidden" name="cycle_id" value={activeCycle.id} />
                    <input type="hidden" name="view" value={viewMode} />

                    <div className="space-y-2">
                      <Label htmlFor="user_id">Therapist</Label>
                      <select
                        id="user_id"
                        name="user_id"
                        className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select therapist
                        </option>
                        {assignableTherapists.map((therapist) => (
                          <option key={therapist.id} value={therapist.id}>
                            {therapist.full_name} ({therapist.shift_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shift_type">Shift Type</Label>
                        <select
                          id="shift_type"
                          name="shift_type"
                          className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                          defaultValue="day"
                        >
                          <option value="day">Day</option>
                          <option value="night">Night</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                          id="status"
                          name="status"
                          className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                          defaultValue="scheduled"
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="on_call">On Call</option>
                          <option value="sick">Sick</option>
                          <option value="called_off">Called Off</option>
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" name="override_weekly_rules" />
                      Override weekly 3-day rule for this shift
                    </label>
                    <Button type="submit">Add Shift</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="no-print">
          <CardHeader>
            <CardTitle>
              {viewMode === 'calendar' && role === 'manager'
                ? 'Month Calendar'
                : viewMode === 'grid'
                ? role === 'manager'
                  ? 'Cycle Grid'
                  : 'My Shift Calendar'
                : role === 'manager'
                  ? 'Shift List'
                  : 'My Shift List'}
            </CardTitle>
            <CardDescription>
              {activeCycle
                ? `${activeCycle.label} (${activeCycle.start_date} to ${activeCycle.end_date})`
                : 'Select a cycle to view schedule details.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!activeCycle && (
              <p className="text-sm text-muted-foreground">
                {role === 'manager'
                  ? 'Create a cycle or select one above to start building the schedule.'
                  : 'No published cycle selected.'}
              </p>
            )}

            {activeCycle && viewMode === 'calendar' && role === 'manager' && (
              <ManagerMonthCalendar
                cycleId={activeCycle.id}
                startDate={activeCycle.start_date}
                endDate={activeCycle.end_date}
                therapists={assignableTherapists}
                shifts={calendarShifts}
              />
            )}

            {activeCycle && viewMode === 'grid' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {role === 'manager' ? (
                      <>
                        <TableHead>Day Coverage</TableHead>
                        <TableHead>Night Coverage</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>My Shift</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycleDates.map((date) => {
                    const row = shiftsByDate.get(date) ?? { day: [], night: [] }

                    if (role === 'manager') {
                      return (
                        <TableRow key={date}>
                          <TableCell>{formatDate(date)}</TableCell>
                          <TableCell>
                            {row.day.length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <div className="space-y-1">
                                {row.day.map((shift) => (
                                  <div key={shift.id} className="text-sm">
                                    {getOne(shift.profiles)?.full_name ?? 'Unknown'} ({shift.status})
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.night.length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <div className="space-y-1">
                                {row.night.map((shift) => (
                                  <div key={shift.id} className="text-sm">
                                    {getOne(shift.profiles)?.full_name ?? 'Unknown'} ({shift.status})
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    }

                    const myShifts = [...row.day, ...row.night]
                    const firstShift = myShifts[0]

                    return (
                      <TableRow key={date}>
                        <TableCell>{formatDate(date)}</TableCell>
                        <TableCell>{firstShift ? firstShift.shift_type : '-'}</TableCell>
                        <TableCell>{firstShift ? firstShift.status : '-'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {activeCycle && viewMode === 'list' && role === 'manager' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Therapist</TableHead>
                    <TableHead>Shift Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No shifts in this cycle yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{formatDate(shift.date)}</TableCell>
                      <TableCell>{getOne(shift.profiles)?.full_name ?? 'Unknown'}</TableCell>
                      <TableCell className="capitalize">{shift.shift_type}</TableCell>
                      <TableCell>{shift.status}</TableCell>
                      <TableCell>
                        <form action={deleteShiftAction}>
                          <input type="hidden" name="shift_id" value={shift.id} />
                          <input type="hidden" name="cycle_id" value={activeCycle.id} />
                          <input type="hidden" name="view" value={viewMode} />
                          <Button type="submit" variant="outline" size="sm">
                            Delete
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {activeCycle && viewMode === 'list' && role !== 'manager' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        No assigned shifts in this cycle yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{formatDate(shift.date)}</TableCell>
                      <TableCell className="capitalize">{shift.shift_type}</TableCell>
                      <TableCell>{shift.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {role === 'manager' && activeCycle && viewMode === 'grid' && (
          <Card className="no-print">
            <CardHeader>
              <CardTitle>Shift Entries</CardTitle>
              <CardDescription>Detailed entries for {activeCycle.label}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Therapist</TableHead>
                    <TableHead>Shift Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No shifts in this cycle yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{formatDate(shift.date)}</TableCell>
                      <TableCell>{getOne(shift.profiles)?.full_name ?? 'Unknown'}</TableCell>
                      <TableCell className="capitalize">{shift.shift_type}</TableCell>
                      <TableCell>{shift.status}</TableCell>
                      <TableCell>
                        <form action={deleteShiftAction}>
                          <input type="hidden" name="shift_id" value={shift.id} />
                          <input type="hidden" name="cycle_id" value={activeCycle.id} />
                          <input type="hidden" name="view" value={viewMode} />
                          <Button type="submit" variant="outline" size="sm">
                            Delete
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="print-only print-page">
          {activeCycle ? (
            <div className="space-y-2">
              <div className="text-center">
                <h1 className="text-xl font-bold">Teamwise Scheduling</h1>
                <p className="text-sm">
                  Final Schedule: {activeCycle.label} ({activeCycle.start_date} to {activeCycle.end_date})
                </p>
              </div>

              <table className="print-matrix">
                <thead>
                  <tr>
                    <th>Name</th>
                    {cycleDates.map((date) => (
                      <th key={`day-number-${date}`}>{formatDayNumber(date)}</th>
                    ))}
                  </tr>
                  <tr>
                    <th>Shift</th>
                    {cycleDates.map((date) => (
                      <th key={`day-week-${date}`}>{formatWeekdayShort(date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {role === 'manager' && dayTeam.length > 0 && (
                    <tr className="print-shift-header">
                      <td colSpan={cycleDates.length + 1}>Day Shift Team</td>
                    </tr>
                  )}
                  {(role === 'manager' ? dayTeam : printUsers).map((member) => (
                    <tr key={`day-${member.id}`}>
                      <td>{member.full_name}</td>
                      {cycleDates.map((date) => {
                        const shift = shiftByUserDate.get(`${member.id}:${date}`)
                        return <td key={`${member.id}-${date}`}>{shift ? getPrintShiftCode(shift.status) : ''}</td>
                      })}
                    </tr>
                  ))}

                  {role === 'manager' && nightTeam.length > 0 && (
                    <tr className="print-shift-header">
                      <td colSpan={cycleDates.length + 1}>Night Shift Team</td>
                    </tr>
                  )}
                  {role === 'manager' &&
                    nightTeam.map((member) => (
                      <tr key={`night-${member.id}`}>
                        <td>{member.full_name}</td>
                        {cycleDates.map((date) => {
                          const shift = shiftByUserDate.get(`${member.id}:${date}`)
                          return <td key={`${member.id}-${date}`}>{shift ? getPrintShiftCode(shift.status) : ''}</td>
                        })}
                      </tr>
                    ))}

                  {role === 'manager' && (
                    <tr>
                      <td>Total Coverage</td>
                      {cycleDates.map((date) => (
                        <td key={`total-${date}`}>{coverageTotalsByDate.get(date) ?? 0}</td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>

              <p className="text-xs text-center">Codes: 1 = scheduled, OC = on call, S = sick, OFF = called off</p>
            </div>
          ) : (
            <p>No schedule cycle selected for printing.</p>
          )}
        </div>
      </div>
    </main>
  )
}
