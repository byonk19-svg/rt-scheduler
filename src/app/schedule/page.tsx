import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ScheduleListTable, type ScheduleListRow } from '@/app/schedule/schedule-list-table'
import { ManagerAttentionPanel } from '@/components/ManagerAttentionPanel'
import { ScheduleHeader } from '@/components/ScheduleHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerMonthCalendar } from '@/components/manager-month-calendar'
import { PrintSchedule } from '@/components/print-schedule'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { summarizeShiftSlotViolations } from '@/lib/schedule-rule-validation'
import { MIN_SHIFT_COVERAGE_PER_DAY, MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/server'
import { getSchedulingEligibleEmployees } from '@/lib/employee-directory'
import {
  addShiftAction,
  createCycleAction,
  deleteShiftAction,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  setDesignatedLeadAction,
  toggleCyclePublishedAction,
} from './actions'
import type { CalendarShift, Cycle, Role, ScheduleSearchParams, ShiftRow, Therapist, ViewMode } from './types'
import { buildDateRange, buildScheduleUrl, formatDate, getOne, getScheduleFeedback, normalizeViewMode } from '@/lib/schedule-helpers'

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
  const showUnavailable = params?.show_unavailable === 'true'
  const feedback = getScheduleFeedback(params)

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'role, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days, on_fmla, fmla_return_date, is_active'
    )
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'
  if (role !== 'manager' && viewMode === 'calendar') {
    viewMode = 'grid'
  }
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
      .select('id, date, shift_type, status, role, user_id, profiles(full_name, is_lead_eligible)')
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
  const leadEligibleTherapists = assignableTherapists.filter((therapist) => therapist.is_lead_eligible)

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

  const leadNameBySlot = new Map<string, string | null>()
  for (const shift of shifts) {
    const slotKey = `${shift.date}:${shift.shift_type}`
    if (shift.role === 'lead') {
      leadNameBySlot.set(slotKey, getOne(shift.profiles)?.full_name ?? 'Unknown')
    } else if (!leadNameBySlot.has(slotKey)) {
      leadNameBySlot.set(slotKey, null)
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
  const activeIssueFilter =
    normalizedIssueFilter === 'missing_lead' ||
    normalizedIssueFilter === 'under_coverage' ||
    normalizedIssueFilter === 'over_coverage'
      ? normalizedIssueFilter
      : 'all'
  const filteredSlotIssues =
    isNeedsAttentionFilter || activeIssueFilter === 'all'
      ? slotValidation?.issues ?? []
      : (slotValidation?.issues ?? []).filter((issue) => issue.reasons.includes(activeIssueFilter))
  const focusSlotKey = focusMode === 'first' ? filteredSlotIssues[0]?.slotKey ?? null : null

  const slotIssuesByKey = new Map((slotValidation?.issues ?? []).map((issue) => [issue.slotKey, issue]))

  const scheduleListRows: ScheduleListRow[] = shifts.map((shift) => ({
    id: shift.id,
    date: shift.date,
    therapistName: getOne(shift.profiles)?.full_name ?? 'Unknown',
    shiftType: shift.shift_type,
    status: shift.status,
    role: shift.role,
    slotLeadName: leadNameBySlot.get(`${shift.date}:${shift.shift_type}`) ?? null,
    slotMissingLead: Boolean(slotIssuesByKey.get(`${shift.date}:${shift.shift_type}`)?.reasons.includes('missing_lead')),
  }))

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <ScheduleHeader
        role={role}
        viewMode={viewMode}
        activeCycleId={activeCycleId}
        activeCyclePublished={Boolean(activeCycle?.published)}
        title={
          viewMode === 'calendar'
            ? 'Month Calendar'
            : viewMode === 'grid'
              ? 'Schedule Grid'
              : 'Schedule List'
        }
        description={
          role === 'manager'
            ? 'Use tabs to switch views, then publish when this cycle is ready.'
            : 'View your shifts in published cycles using Grid or List.'
        }
        toggleCyclePublishedAction={toggleCyclePublishedAction}
        generateDraftScheduleAction={generateDraftScheduleAction}
        resetDraftScheduleAction={resetDraftScheduleAction}
        showUnavailable={showUnavailable}
      />

      {role === 'manager' && managerAttention && <ManagerAttentionPanel snapshot={managerAttention} />}
      {role === 'manager' && activeCycle && slotValidation && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Draft Rule Warnings</CardTitle>
            <CardDescription>
              Coverage target is {MIN_SHIFT_COVERAGE_PER_DAY}-{MAX_SHIFT_COVERAGE_PER_DAY} and each shift needs one designated lead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={slotValidation.missingLead > 0 ? 'destructive' : 'outline'}>
                Missing lead: {slotValidation.missingLead}
              </Badge>
              <Badge variant={slotValidation.ineligibleLead > 0 ? 'destructive' : 'outline'}>
                Ineligible lead: {slotValidation.ineligibleLead}
              </Badge>
              <Badge variant={slotValidation.multipleLeads > 0 ? 'destructive' : 'outline'}>
                Multiple leads: {slotValidation.multipleLeads}
              </Badge>
              <Badge variant={slotValidation.underCoverage > 0 ? 'destructive' : 'outline'}>
                Under coverage: {slotValidation.underCoverage}
              </Badge>
              <Badge variant={slotValidation.overCoverage > 0 ? 'destructive' : 'outline'}>
                Over coverage: {slotValidation.overCoverage}
              </Badge>
            </div>
            {slotValidation.issues.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Affected shifts:{' '}
                {slotValidation.issues
                  .slice(0, 8)
                  .map((issue) => `${issue.date} ${issue.shiftType}`)
                  .join(', ')}
                {slotValidation.issues.length > 8 ? `, +${slotValidation.issues.length - 8} more` : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
                  <>
                    <form action={addShiftAction} className="space-y-4">
                      <input type="hidden" name="cycle_id" value={activeCycle.id} />
                      <input type="hidden" name="view" value={viewMode} />
                      <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />

                      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                        <span>
                          {showUnavailable
                            ? 'Showing unavailable employees (FMLA/inactive).'
                            : 'FMLA and inactive employees are hidden by default.'}
                        </span>
                        <Button asChild size="xs" variant="ghost">
                          <Link
                            href={
                              activeCycle
                                ? buildScheduleUrl(activeCycle.id, viewMode, {
                                    show_unavailable: showUnavailable ? 'false' : 'true',
                                  })
                                : buildScheduleUrl(undefined, viewMode, {
                                    show_unavailable: showUnavailable ? 'false' : 'true',
                                  })
                            }
                          >
                            {showUnavailable ? 'Hide unavailable' : 'Show unavailable'}
                          </Link>
                        </Button>
                      </div>

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
                              {therapist.full_name} ({therapist.shift_type}
                              {therapist.on_fmla || !therapist.is_active ? ', unavailable' : ''})
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
                        Override weekly limit for this shift
                      </label>
                      <Button type="submit">Add Shift</Button>
                    </form>

                    <div className="my-5 border-t border-border" />

                    <form action={setDesignatedLeadAction} className="space-y-4">
                      <input type="hidden" name="cycle_id" value={activeCycle.id} />
                      <input type="hidden" name="view" value={viewMode} />
                      <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Designated Lead</h4>
                        <p className="text-xs text-muted-foreground">
                          Select exactly one lead for each day/night shift. Only lead-eligible therapists are listed.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="lead_date">Date</Label>
                          <Input id="lead_date" name="date" type="date" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lead_shift_type">Shift Type</Label>
                          <select
                            id="lead_shift_type"
                            name="shift_type"
                            className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                            defaultValue="day"
                          >
                            <option value="day">Day</option>
                            <option value="night">Night</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="therapist_id_lead">Designated Lead</Label>
                          <select
                            id="therapist_id_lead"
                            name="therapist_id"
                            className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                            defaultValue=""
                            required
                          >
                            <option value="" disabled>
                              Select lead-eligible therapist
                            </option>
                            {leadEligibleTherapists.map((therapist) => (
                              <option key={therapist.id} value={therapist.id}>
                                {therapist.full_name} ({therapist.shift_type}
                                {therapist.on_fmla || !therapist.is_active ? ', unavailable' : ''})
                              </option>
                            ))}
                          </select>
                          {leadEligibleTherapists.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No lead-eligible therapists found. Update profile eligibility first.
                            </p>
                          )}
                        </div>
                      </div>
                      <Button type="submit" variant="outline" disabled={leadEligibleTherapists.length === 0}>
                        Set designated lead
                      </Button>
                    </form>
                  </>
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
                cyclePublished={activeCycle.published}
                therapists={assignableTherapists}
                shifts={calendarShifts}
                issueFilter={activeIssueFilter}
                focusSlotKey={focusSlotKey}
                focusFirst={focusMode === 'first'}
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
                      const daySlotKey = `${date}:day`
                      const nightSlotKey = `${date}:night`
                      const dayLeadName = leadNameBySlot.get(daySlotKey)
                      const nightLeadName = leadNameBySlot.get(nightSlotKey)
                      const dayIssue = slotIssuesByKey.get(daySlotKey)
                      const nightIssue = slotIssuesByKey.get(nightSlotKey)

                      return (
                        <TableRow key={date}>
                          <TableCell>{formatDate(date)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Lead:</span>
                                {dayLeadName ? (
                                  <span className="text-xs font-semibold text-foreground">{dayLeadName}</span>
                                ) : (
                                  <span className="text-xs font-semibold text-[var(--warning-text)]">Missing lead</span>
                                )}
                                {dayIssue?.reasons.includes('missing_lead') && (
                                  <span className="text-xs text-[var(--warning-text)]">!</span>
                                )}
                              </div>
                              {row.day.length === 0 ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <div className="space-y-1">
                                  {row.day.map((shift) => (
                                    <div key={shift.id} className="flex items-center gap-2 text-sm">
                                      <span>{getOne(shift.profiles)?.full_name ?? 'Unknown'} ({shift.status})</span>
                                      {shift.role === 'lead' && (
                                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">
                                          Lead
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Lead:</span>
                                {nightLeadName ? (
                                  <span className="text-xs font-semibold text-foreground">{nightLeadName}</span>
                                ) : (
                                  <span className="text-xs font-semibold text-[var(--warning-text)]">Missing lead</span>
                                )}
                                {nightIssue?.reasons.includes('missing_lead') && (
                                  <span className="text-xs text-[var(--warning-text)]">!</span>
                                )}
                              </div>
                              {row.night.length === 0 ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <div className="space-y-1">
                                  {row.night.map((shift) => (
                                    <div key={shift.id} className="flex items-center gap-2 text-sm">
                                      <span>{getOne(shift.profiles)?.full_name ?? 'Unknown'} ({shift.status})</span>
                                      {shift.role === 'lead' && (
                                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">
                                          Lead
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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
              <ScheduleListTable
                role={role}
                rows={scheduleListRows}
                emptyMessage="No shifts in this cycle yet."
                cycleId={activeCycle.id}
                viewMode={viewMode}
                deleteShiftAction={deleteShiftAction}
              />
            )}

            {activeCycle && viewMode === 'list' && role !== 'manager' && (
              <ScheduleListTable
                role={role}
                rows={scheduleListRows}
                emptyMessage="No assigned shifts in this cycle yet."
                cycleId={activeCycle.id}
                viewMode={viewMode}
              />
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
              <ScheduleListTable
                role={role}
                rows={scheduleListRows}
                emptyMessage="No shifts in this cycle yet."
                cycleId={activeCycle.id}
                viewMode={viewMode}
                deleteShiftAction={deleteShiftAction}
              />
            </CardContent>
          </Card>
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
