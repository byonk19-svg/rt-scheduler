import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'

type Role = 'manager' | 'therapist'

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
  redirect(`/schedule?cycle=${data.id}`)
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

  if (!cycleId) {
    redirect('/schedule')
  }

  const { error } = await supabase
    .from('schedule_cycles')
    .update({ published: !currentlyPublished })
    .eq('id', cycleId)

  if (error) {
    console.error('Failed to toggle schedule publication state:', error)
  }

  revalidatePath('/schedule')
  redirect(`/schedule?cycle=${cycleId}`)
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

  if (!cycleId || !userId || !date || !shiftType || !status) {
    redirect('/schedule')
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
  }

  revalidatePath('/schedule')
  redirect(`/schedule?cycle=${cycleId}`)
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

  if (!shiftId || !cycleId) {
    redirect('/schedule')
  }

  const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
  if (error) {
    console.error('Failed to delete shift:', error)
  }

  revalidatePath('/schedule')
  redirect(`/schedule?cycle=${cycleId}`)
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{ cycle?: string }>
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'

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

  return (
    <main className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Schedule Grid</h1>
            <p className="text-muted-foreground">
              {role === 'manager'
                ? 'Build and publish 6-week schedules for the department.'
                : 'View your shifts in published schedule cycles.'}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Card>
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
                    variant={activeCycle?.id === cycle.id ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Link href={`/schedule?cycle=${cycle.id}`}>
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
                  <form action={toggleCyclePublishedAction}>
                    <input type="hidden" name="cycle_id" value={activeCycle.id} />
                    <input
                      type="hidden"
                      name="currently_published"
                      value={String(activeCycle.published)}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      {activeCycle.published ? 'Move to Draft' : 'Publish Cycle'}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {role === 'manager' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create Schedule Cycle</CardTitle>
                <CardDescription>Set up a new 6-week scheduling period.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createCycleAction} className="space-y-4">
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
                <CardDescription>Assign therapists to day or night coverage.</CardDescription>
              </CardHeader>
              <CardContent>
                {!activeCycle ? (
                  <p className="text-sm text-muted-foreground">Create or select a cycle first.</p>
                ) : (
                  <form action={addShiftAction} className="space-y-4">
                    <input type="hidden" name="cycle_id" value={activeCycle.id} />

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
                    <Button type="submit">Add Shift</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{role === 'manager' ? 'Cycle Grid' : 'My Shift Calendar'}</CardTitle>
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
                  ? 'Create a cycle or select one above to start building the grid.'
                  : 'No published cycle selected.'}
              </p>
            )}

            {activeCycle && (
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
          </CardContent>
        </Card>

        {role === 'manager' && activeCycle && (
          <Card>
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
      </div>
    </main>
  )
}
