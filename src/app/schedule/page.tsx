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
import { createClient } from '@/lib/supabase/server'
import { addShiftAction, createCycleAction, deleteShiftAction, generateDraftScheduleAction, toggleCyclePublishedAction } from './actions'
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
  const scheduleListRows: ScheduleListRow[] = shifts.map((shift) => ({
    id: shift.id,
    date: shift.date,
    therapistName: getOne(shift.profiles)?.full_name ?? 'Unknown',
    shiftType: shift.shift_type,
    status: shift.status,
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
      />

      {role === 'manager' && managerAttention && <ManagerAttentionPanel snapshot={managerAttention} />}

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
                cyclePublished={activeCycle.published}
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
