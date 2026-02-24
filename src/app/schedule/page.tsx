import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ScheduleDrawerControls } from '@/app/schedule/schedule-drawer-controls'
import { AffectedShiftsDrawer } from '@/app/schedule/affected-shifts-drawer'
import { AttentionBar } from '@/components/AttentionBar'
import { EmptyState } from '@/components/EmptyState'
import { ScheduleHeader } from '@/components/ScheduleHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerMonthCalendar } from '@/components/manager-month-calendar'
import { ManagerWeekCalendar } from '@/components/manager-week-calendar'
import { PrintSchedule } from '@/components/print-schedule'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { summarizeShiftSlotViolations } from '@/lib/schedule-rule-validation'
import { MIN_SHIFT_COVERAGE_PER_DAY, MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/server'
import { getSchedulingEligibleEmployees } from '@/lib/employee-directory'
import {
  createCycleAction,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  toggleCyclePublishedAction,
} from './actions'
import type { CalendarShift, Cycle, Role, ScheduleSearchParams, ShiftRow, Therapist, ViewMode } from './types'
import { buildDateRange, buildScheduleUrl, getOne, getScheduleFeedback, getSearchParam, normalizeViewMode } from '@/lib/schedule-helpers'
import type { AssignmentStatus, ShiftStatus } from './types'

type IssueFilter =
  | 'all'
  | 'missing_lead'
  | 'under_coverage'
  | 'over_coverage'
  | 'ineligible_lead'
  | 'multiple_leads'

type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string
  created_at: string
  user_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
}

function formatAuditAction(value: string): string {
  if (value === 'shift_added') return 'added a shift'
  if (value === 'shift_removed') return 'removed a shift'
  if (value === 'designated_lead_assigned') return 'assigned a designated lead'
  if (value === 'cycle_published') return 'published the cycle'
  return value.replaceAll('_', ' ')
}

type RawShiftRow = Omit<
  ShiftRow,
  'assignment_status' | 'status_note' | 'left_early_time' | 'status_updated_at' | 'status_updated_by' | 'profiles'
> & {
  profiles?:
    | { full_name: string; is_lead_eligible: boolean }
    | { full_name: string; is_lead_eligible: boolean }[]
    | null
  assignment_status?: AssignmentStatus | null
  status_note?: string | null
  left_early_time?: string | null
  status_updated_at?: string | null
  status_updated_by?: string | null
}

function toAssignmentStatus(status: ShiftStatus, assignmentStatus?: AssignmentStatus | null): AssignmentStatus {
  if (assignmentStatus) return assignmentStatus
  if (status === 'on_call') return 'on_call'
  return 'scheduled'
}

function normalizeShiftRows(rows: RawShiftRow[]): ShiftRow[] {
  return rows.map((row) => ({
    ...row,
    profiles: row.profiles ?? null,
    assignment_status: toAssignmentStatus(row.status, row.assignment_status),
    status_note: row.status_note ?? null,
    left_early_time: row.left_early_time ?? null,
    status_updated_at: row.status_updated_at ?? null,
    status_updated_by: row.status_updated_by ?? null,
  }))
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
  const issueFilter = params?.filter
  const focusMode = params?.focus
  const focusSlotParam = getSearchParam(params?.focus_slot)
  const panelParam = getSearchParam(params?.panel)
  const showUnavailable = params?.show_unavailable === 'true'
  const activePanel = panelParam === 'setup' ? 'setup' : null
  const successParam = getSearchParam(params?.success)
  const feedback = getScheduleFeedback(params)

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'role, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days, on_fmla, fmla_return_date, is_active, default_calendar_view'
    )
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'
  const canEditAssignmentStatus =
    role === 'manager' ||
    profile?.role === 'lead' ||
    ((profile?.role === 'therapist' || profile?.role === 'staff') &&
      profile?.is_lead_eligible === true)
  const canManageStaffing = role === 'manager'
  // Staff can view month status indicators read-only; only lead/manager can edit.
  const canAccessCoverageCalendar = canManageStaffing || role === 'therapist'
  const defaultCalendarView = profile?.default_calendar_view === 'night' ? 'night' : 'day'
  if (!canAccessCoverageCalendar && (viewMode === 'calendar' || viewMode === 'week')) {
    viewMode = 'week'
  }
  const isManagerCoverageView = role === 'manager' && (viewMode === 'calendar' || viewMode === 'week')
  const managerAttention = role === 'manager' ? await getManagerAttentionSnapshot(supabase) : null

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
      .select(
        'id, date, shift_type, status, assignment_status, status_note, left_early_time, status_updated_at, status_updated_by, role, user_id, profiles:profiles!shifts_user_id_fkey(full_name, is_lead_eligible)'
      )
      .eq('cycle_id', activeCycle.id)
      .order('date', { ascending: true })
      .order('shift_type', { ascending: true })

    if (role !== 'manager' && viewMode !== 'calendar' && viewMode !== 'week') {
      shiftsQuery = shiftsQuery.eq('user_id', user.id)
    }

    const { data: shiftsData, error: shiftsError } = await shiftsQuery
    if (!shiftsError) {
      shifts = normalizeShiftRows((shiftsData ?? []) as RawShiftRow[])
    } else {
      const shiftErrorMessage =
        typeof shiftsError?.message === 'string' ? shiftsError.message : ''
      const missingAssignmentStatusFields =
        shiftErrorMessage.includes('assignment_status') ||
        shiftErrorMessage.includes('status_note') ||
        shiftErrorMessage.includes('left_early_time') ||
        shiftErrorMessage.includes('status_updated_at') ||
        shiftErrorMessage.includes('status_updated_by')

      if (!missingAssignmentStatusFields) {
        console.warn(
          'Primary shifts query failed; trying legacy query.',
          shiftErrorMessage || shiftsError
        )
      } else {
        console.warn(
          'Assignment status columns are missing; using legacy shift query. Run latest migrations to enable status features.'
        )
      }

      let legacyShiftsQuery = supabase
        .from('shifts')
        .select('id, date, shift_type, status, role, user_id')
        .eq('cycle_id', activeCycle.id)
        .order('date', { ascending: true })
        .order('shift_type', { ascending: true })

      if (role !== 'manager' && viewMode !== 'calendar' && viewMode !== 'week') {
        legacyShiftsQuery = legacyShiftsQuery.eq('user_id', user.id)
      }

      const { data: legacyShiftsData, error: legacyShiftsError } = await legacyShiftsQuery
      if (legacyShiftsError) {
        const legacyShiftErrorMessage =
          typeof legacyShiftsError?.message === 'string' ? legacyShiftsError.message : ''
        console.warn(
          'Legacy shifts query also failed for schedule page.',
          legacyShiftErrorMessage || legacyShiftsError
        )
      } else {
        const legacyRows = (legacyShiftsData ?? []) as Array<{
          id: string
          date: string
          shift_type: 'day' | 'night'
          status: ShiftStatus
          role: 'lead' | 'staff'
          user_id: string
        }>
        shifts = normalizeShiftRows(
          legacyRows.map((row) => ({
            ...row,
            profiles: null,
          }))
        )
      }
    }
  }

  const profileByUserId = new Map<string, { full_name: string; is_lead_eligible: boolean }>()
  for (const shift of shifts) {
    const shiftProfile = getOne(shift.profiles)
    if (!shiftProfile) continue
    profileByUserId.set(shift.user_id, {
      full_name: String(shiftProfile.full_name ?? 'Unknown'),
      is_lead_eligible: Boolean(shiftProfile.is_lead_eligible),
    })
  }

  const unresolvedProfileIds = new Set<string>()
  for (const shift of shifts) {
    if (!profileByUserId.has(shift.user_id)) {
      unresolvedProfileIds.add(shift.user_id)
    }
    if (shift.status_updated_by && !profileByUserId.has(shift.status_updated_by)) {
      unresolvedProfileIds.add(shift.status_updated_by)
    }
  }

  if (unresolvedProfileIds.size > 0) {
    const unresolvedIds = Array.from(unresolvedProfileIds)
    const { data: unresolvedProfiles, error: unresolvedProfilesError } = await supabase
      .from('profiles')
      .select('id, full_name, is_lead_eligible')
      .in('id', unresolvedIds)

    if (unresolvedProfilesError) {
      console.warn(
        'Could not resolve one or more profile names for schedule coverage view.',
        unresolvedProfilesError.message || unresolvedProfilesError
      )
    } else {
      for (const row of unresolvedProfiles ?? []) {
        const id = String(row.id ?? '')
        if (!id) continue
        profileByUserId.set(id, {
          full_name: String(row.full_name ?? 'Unknown'),
          is_lead_eligible: Boolean(row.is_lead_eligible),
        })
      }
    }
  }

  shifts = shifts.map((shift) => {
    if (getOne(shift.profiles)) return shift
    const fallbackProfile = profileByUserId.get(shift.user_id)
    if (!fallbackProfile) return shift
    return {
      ...shift,
      profiles: {
        full_name: fallbackProfile.full_name,
        is_lead_eligible: fallbackProfile.is_lead_eligible,
      },
    }
  })

  const statusUpdatedByNameMap = new Map<string, string>()
  for (const shift of shifts) {
    const updaterId = shift.status_updated_by
    if (!updaterId) continue
    const updaterProfile = profileByUserId.get(updaterId)
    if (updaterProfile) {
      statusUpdatedByNameMap.set(updaterId, updaterProfile.full_name)
    }
  }

  let assignableTherapists: Therapist[] = []
  if (role === 'manager') {
    let therapistQuery = supabase
      .from('profiles')
      .select(
        'id, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days, on_fmla, fmla_return_date, is_active'
      )
      .eq('role', 'therapist')
      .order('full_name', { ascending: true })

    if (!showUnavailable) {
      therapistQuery = therapistQuery.eq('is_active', true).eq('on_fmla', false)
    }

    const { data: therapistData } = await therapistQuery
    const normalizedTherapists = ((therapistData ?? []) as Therapist[]).map((therapist) => ({
      ...therapist,
      preferred_work_days: Array.isArray(therapist.preferred_work_days)
        ? therapist.preferred_work_days
            .map((day) => Number(day))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : [],
    }))
    assignableTherapists = showUnavailable
      ? normalizedTherapists
      : getSchedulingEligibleEmployees(normalizedTherapists)
  }
  const cycleDates = activeCycle ? buildDateRange(activeCycle.start_date, activeCycle.end_date) : []

  const shiftByUserDate = new Map<string, ShiftRow>()
  for (const shift of shifts) {
    shiftByUserDate.set(`${shift.user_id}:${shift.date}`, shift)
  }

  const calendarShifts: CalendarShift[] = shifts.map((shift) => ({
    id: shift.id,
    date: shift.date,
    shift_type: shift.shift_type,
    status: shift.status,
    assignment_status: shift.assignment_status,
    status_note: shift.status_note,
    left_early_time: shift.left_early_time,
    status_updated_at: shift.status_updated_at,
    status_updated_by: shift.status_updated_by,
    status_updated_by_name: shift.status_updated_by
      ? statusUpdatedByNameMap.get(shift.status_updated_by) ?? 'Team member'
      : null,
    role: shift.role,
    user_id: shift.user_id,
    full_name: getOne(shift.profiles)?.full_name ?? 'Unknown',
    isLeadEligible: Boolean(getOne(shift.profiles)?.is_lead_eligible),
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
              is_lead_eligible: false,
              employment_type: 'full_time',
              max_work_days_per_week: 3,
              preferred_work_days: [],
              on_fmla: false,
              fmla_return_date: null,
              is_active: true,
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
            is_lead_eligible: Boolean(profile?.is_lead_eligible),
            employment_type: profile?.employment_type === 'part_time' || profile?.employment_type === 'prn' ? profile.employment_type : 'full_time',
            max_work_days_per_week:
              typeof profile?.max_work_days_per_week === 'number' ? profile.max_work_days_per_week : 3,
            preferred_work_days: Array.isArray(profile?.preferred_work_days)
              ? profile.preferred_work_days
              : [],
            on_fmla: Boolean(profile?.on_fmla),
            fmla_return_date: profile?.fmla_return_date ?? null,
            is_active: profile?.is_active !== false,
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

  const slotValidation =
    role === 'manager'
      ? summarizeShiftSlotViolations({
          cycleDates,
          assignments: shifts.map((shift) => ({
            date: shift.date,
            shiftType: shift.shift_type,
            status: shift.status,
            role: shift.role,
            therapistId: shift.user_id,
            therapistName: getOne(shift.profiles)?.full_name ?? 'Unknown',
            isLeadEligible: Boolean(getOne(shift.profiles)?.is_lead_eligible),
          })),
          minCoveragePerShift: MIN_SHIFT_COVERAGE_PER_DAY,
          maxCoveragePerShift: MAX_SHIFT_COVERAGE_PER_DAY,
        })
      : null

  const normalizedIssueFilter = issueFilter === 'unfilled' ? 'under_coverage' : issueFilter
  const isNeedsAttentionFilter = normalizedIssueFilter === 'needs_attention'
  const isSpecificIssueFilter =
    normalizedIssueFilter === 'missing_lead' ||
    normalizedIssueFilter === 'under_coverage' ||
    normalizedIssueFilter === 'over_coverage' ||
    normalizedIssueFilter === 'ineligible_lead' ||
    normalizedIssueFilter === 'multiple_leads'
  const activeIssueFilter: IssueFilter =
    isSpecificIssueFilter
      ? normalizedIssueFilter
      : 'all'
  const filteredSlotIssues =
    isNeedsAttentionFilter || activeIssueFilter === 'all'
      ? slotValidation?.issues ?? []
      : (slotValidation?.issues ?? []).filter((issue) => issue.reasons.includes(activeIssueFilter))
  const normalizedFocusSlot =
    focusSlotParam && /^\d{4}-\d{2}-\d{2}:(day|night)$/.test(focusSlotParam)
      ? focusSlotParam
      : null
  const focusSlotKey =
    normalizedFocusSlot ?? (focusMode === 'first' ? filteredSlotIssues[0]?.slotKey ?? null : null)

  const issueReasonsBySlot = Object.fromEntries(
    (slotValidation?.issues ?? []).map((issue) => [issue.slotKey, issue.reasons])
  )
  const scheduledShifts = shifts.filter(
    (shift) => shift.status === 'scheduled' || shift.status === 'on_call'
  )
  const dayShiftCount = scheduledShifts.filter((shift) => shift.shift_type === 'day').length
  const nightShiftCount = scheduledShifts.filter((shift) => shift.shift_type === 'night').length
  const publishSummary =
    role === 'manager' && activeCycle
      ? {
          cycleLabel: activeCycle.label,
          startDate: activeCycle.start_date,
          endDate: activeCycle.end_date,
          totalScheduledShifts: scheduledShifts.length,
          dayShifts: dayShiftCount,
          nightShifts: nightShiftCount,
          missingLead: slotValidation?.missingLead ?? 0,
          underCoverage: slotValidation?.underCoverage ?? 0,
          overCoverage: slotValidation?.overCoverage ?? 0,
        }
      : null

  let recentActivity: AuditLogRow[] = []
  if (isManagerCoverageView) {
    const { data: auditRows } = await supabase
      .from('audit_log')
      .select('id, action, target_type, target_id, created_at, user_id, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(10)
    recentActivity = (auditRows ?? []) as AuditLogRow[]
  }

  const showUnavailableParam = showUnavailable ? 'true' : undefined
  const buildIssueFilterUrl = (
    filter?: string,
    options?: { focusFirst?: boolean; focusSlot?: string }
  ) =>
    buildScheduleUrl(activeCycleId, viewMode, {
      show_unavailable: showUnavailableParam,
      filter,
      focus: options?.focusFirst ? 'first' : undefined,
      focus_slot: options?.focusSlot,
    })

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}
      {feedback?.variant === 'error' && (
        <p className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
          {feedback.message}
        </p>
      )}
      {successParam === 'cycle_published' && (
        <Card className="no-print border-[var(--success-border)] bg-[var(--success-subtle)]">
          <CardHeader>
            <CardTitle className="text-[var(--success-text)]">Cycle published successfully</CardTitle>
            <CardDescription className="text-[var(--success-text)]">
              The schedule is now live for your team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href={buildScheduleUrl(activeCycleId, 'week')}>View published schedule</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <ScheduleHeader
        role={role}
        viewMode={viewMode}
        activeCycleId={activeCycleId}
        activeCyclePublished={Boolean(activeCycle?.published)}
        setupHref={
          role === 'manager'
            ? buildScheduleUrl(activeCycleId, viewMode, {
                show_unavailable: showUnavailableParam,
                panel: 'setup',
              })
            : undefined
        }
        title={
          viewMode === 'calendar'
            ? 'Month Calendar'
            : 'Week Roster'
        }
        description={
          role === 'manager'
            ? 'Use Week for full roster details and Month for full-cycle coverage.'
            : 'View published cycles in Week or Month.'
        }
        toggleCyclePublishedAction={toggleCyclePublishedAction}
        generateDraftScheduleAction={generateDraftScheduleAction}
        resetDraftScheduleAction={resetDraftScheduleAction}
        publishSummary={publishSummary}
        showUnavailable={showUnavailable}
        canViewMonth={canAccessCoverageCalendar}
      />

      {role === 'manager' && (
        <ScheduleDrawerControls
          cycles={cycles}
          activeCycleId={activeCycleId}
          viewMode={viewMode}
          showUnavailable={showUnavailable}
          activePanel={activePanel}
          inlineErrorMessage={feedback?.variant === 'error' ? feedback.message : undefined}
          createCycleAction={createCycleAction}
        />
      )}

      {!isManagerCoverageView && (
      <Card className="no-print">
          <CardHeader>
            <CardTitle>Cycle Selection</CardTitle>
            <CardDescription>Pick a cycle to view the schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    variant="outline"
                    size="sm"
                    className={activeCycle?.id === cycle.id ? 'border-primary/40 bg-secondary text-foreground' : undefined}
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
                {role === 'manager' && <span className="text-xs text-muted-foreground">Publish actions are in the header.</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

        <Card className="no-print">
          {!isManagerCoverageView && (
            <CardHeader>
              <CardTitle>
                {viewMode === 'week'
                  ? role === 'manager'
                    ? 'Week Roster'
                    : 'My Week Schedule'
                  : role === 'manager'
                    ? 'Month Calendar'
                    : 'My Month Schedule'}
              </CardTitle>
              <CardDescription>
                {activeCycle
                  ? `${activeCycle.label} (${activeCycle.start_date} to ${activeCycle.end_date})`
                  : 'Select a cycle to view schedule details.'}
              </CardDescription>
            </CardHeader>
          )}
          <CardContent className={isManagerCoverageView ? 'pt-6' : undefined}>
            {!activeCycle && (
              <p className="text-sm text-muted-foreground">
                {role === 'manager'
                  ? 'Create a cycle or select one above to start building the schedule.'
                  : 'No published cycle selected.'}
              </p>
            )}

            {activeCycle && role === 'manager' && shifts.length === 0 && (
              <EmptyState
                title="No shifts scheduled yet - start by adding shifts or importing from a previous cycle."
                description="Open a calendar day to assign therapists, or use setup options to seed this cycle."
                className="mb-4 border-dashed"
              />
            )}

            {activeCycle && viewMode === 'calendar' && canAccessCoverageCalendar && (
              <ManagerMonthCalendar
                key={`${activeCycle.id}:${focusSlotKey ?? 'none'}:${defaultCalendarView}`}
                cycleId={activeCycle.id}
                startDate={activeCycle.start_date}
                endDate={activeCycle.end_date}
                therapists={assignableTherapists}
                shifts={calendarShifts}
                issueFilter={activeIssueFilter}
                focusSlotKey={focusSlotKey}
                issueReasonsBySlot={issueReasonsBySlot}
                defaultShiftType={defaultCalendarView}
                canManageStaffing={canManageStaffing}
                canEditAssignmentStatus={canEditAssignmentStatus}
              />
            )}
            {activeCycle && viewMode === 'week' && canAccessCoverageCalendar && (
              <ManagerWeekCalendar
                key={`${activeCycle.id}:week:${focusSlotKey ?? 'none'}:${defaultCalendarView}`}
                cycleId={activeCycle.id}
                startDate={activeCycle.start_date}
                endDate={activeCycle.end_date}
                shifts={calendarShifts}
                issueFilter={activeIssueFilter}
                focusSlotKey={focusSlotKey}
                issueReasonsBySlot={issueReasonsBySlot}
                defaultShiftType={defaultCalendarView}
                canEditAssignmentStatus={canEditAssignmentStatus}
              />
            )}
          </CardContent>
        </Card>

      {isManagerCoverageView && managerAttention && (
        <AttentionBar snapshot={managerAttention} variant="compact" context="coverage" />
      )}
      {isManagerCoverageView && activeCycle && slotValidation && (
        <Card className="no-print">
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge
                asChild
                variant={
                  activeIssueFilter === 'missing_lead'
                    ? 'destructive'
                    : slotValidation.missingLead > 0
                      ? 'destructive'
                      : 'outline'
                }
              >
                <Link href={buildIssueFilterUrl('missing_lead', { focusFirst: true })}>
                  Missing lead: {slotValidation.missingLead}
                </Link>
              </Badge>
              <Badge
                asChild
                variant={
                  activeIssueFilter === 'under_coverage'
                    ? 'destructive'
                    : slotValidation.underCoverage > 0
                      ? 'destructive'
                      : 'outline'
                }
              >
                <Link href={buildIssueFilterUrl('under_coverage', { focusFirst: true })}>
                  Under coverage: {slotValidation.underCoverage}
                </Link>
              </Badge>
              <Badge
                asChild
                variant={
                  activeIssueFilter === 'over_coverage'
                    ? 'destructive'
                    : slotValidation.overCoverage > 0
                      ? 'destructive'
                      : 'outline'
                }
              >
                <Link href={buildIssueFilterUrl('over_coverage', { focusFirst: true })}>
                  Over coverage: {slotValidation.overCoverage}
                </Link>
              </Badge>
              <Badge
                asChild
                variant={
                  activeIssueFilter === 'ineligible_lead'
                    ? 'destructive'
                    : slotValidation.ineligibleLead > 0
                      ? 'destructive'
                      : 'outline'
                }
              >
                <Link href={buildIssueFilterUrl('ineligible_lead', { focusFirst: true })}>
                  Ineligible lead: {slotValidation.ineligibleLead}
                </Link>
              </Badge>
              <Badge
                asChild
                variant={
                  activeIssueFilter === 'multiple_leads'
                    ? 'destructive'
                    : slotValidation.multipleLeads > 0
                      ? 'destructive'
                      : 'outline'
                }
              >
                <Link href={buildIssueFilterUrl('multiple_leads', { focusFirst: true })}>
                  Multiple leads: {slotValidation.multipleLeads}
                </Link>
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Coverage target: {MIN_SHIFT_COVERAGE_PER_DAY}-{MAX_SHIFT_COVERAGE_PER_DAY} with exactly one designated lead per shift.
              </p>
              <AffectedShiftsDrawer
                issues={slotValidation.issues}
                cycleId={activeCycle.id}
                viewMode={viewMode}
                showUnavailable={showUnavailable}
              />
            </div>
          </CardContent>
        </Card>
      )}
      {isManagerCoverageView && (
        <details className="no-print rounded-md border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Recent activity
          </summary>
          <div className="mt-3 space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity yet.</p>
            ) : (
              recentActivity.map((event) => (
                <div key={event.id} className="rounded-md border border-border px-3 py-2 text-xs">
                  <p className="text-foreground">
                    <span className="font-semibold">{getOne(event.profiles)?.full_name ?? 'A manager'}</span>{' '}
                    {formatAuditAction(event.action)}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(event.created_at).toLocaleString('en-US')}
                  </p>
                </div>
              ))
            )}
          </div>
        </details>
      )}

      <PrintSchedule
        activeCycle={activeCycle ? { label: activeCycle.label, start_date: activeCycle.start_date, end_date: activeCycle.end_date } : null}
        cycleDates={cycleDates}
        dayTeam={dayTeam}
        nightTeam={nightTeam}
        printUsers={printUsers}
        shiftByUserDate={Object.fromEntries(
          Array.from(shiftByUserDate.entries()).map(([key, shift]) => [key, shift.status])
        )}
        coverageTotalsByDate={Object.fromEntries(coverageTotalsByDate.entries())}
        isManager={role === 'manager'}
      />
    </div>
  )
}
