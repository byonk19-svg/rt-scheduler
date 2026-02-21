import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

type AvailabilityRow = {
  id: string
  date: string
  reason: string | null
  created_at: string
  user_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function submitAvailabilityRequest(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const date = String(formData.get('date') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()

  if (!date) {
    redirect('/availability')
  }

  const { error } = await supabase.from('availability_requests').insert({
    user_id: user.id,
    cycle_id: cycleId || null,
    date,
    reason: reason || null,
  })

  if (error) {
    console.error('Failed to create availability request:', error)
  }

  revalidatePath('/availability')
  redirect('/availability')
}

async function deleteAvailabilityRequest(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const requestId = String(formData.get('request_id') ?? '').trim()
  if (!requestId) {
    redirect('/availability')
  }

  const { error } = await supabase
    .from('availability_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to delete availability request:', error)
  }

  revalidatePath('/availability')
  redirect('/availability')
}

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .order('start_date', { ascending: false })

  const cycles = (cyclesData ?? []) as Cycle[]

  let requestsQuery = supabase
    .from('availability_requests')
    .select(
      'id, date, reason, created_at, user_id, profiles(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (role !== 'manager') {
    requestsQuery = requestsQuery.eq('user_id', user.id)
  }

  const { data: requestsData } = await requestsQuery
  const requests = (requestsData ?? []) as AvailabilityRow[]
  const hasCycles = cycles.length > 0
  const emptyColSpan = role === 'manager' ? 6 : 5

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Availability Requests</h1>
            <p className="text-slate-500">
              {role === 'manager'
                ? 'Review all submitted blackout dates.'
                : 'Submit days you cannot work for upcoming schedules.'}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit Request</CardTitle>
            <CardDescription>Select a date and optional cycle.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitAvailabilityRequest} className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cycle_id">Schedule Cycle</Label>
                <select
                  id="cycle_id"
                  name="cycle_id"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">No specific cycle</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.label} ({cycle.start_date} to {cycle.end_date})
                      {cycle.published ? '' : ' [draft]'}
                    </option>
                  ))}
                </select>
                {!hasCycles && (
                  <p className="text-xs text-slate-500">
                    No schedule cycles found yet. You can still submit requests.
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="reason">Reason (optional)</Label>
                <textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Family event, appointment, vacation, etc."
                />
              </div>

              <div className="md:col-span-3">
                <Button type="submit">Submit availability request</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{role === 'manager' ? 'All Requests' : 'My Requests'}</CardTitle>
            <CardDescription>
              {role === 'manager'
                ? 'Therapist blackout dates by cycle and date.'
                : 'Your submitted blackout dates.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Reason</TableHead>
                  {role === 'manager' && <TableHead>Requested By</TableHead>}
                  <TableHead>Submitted</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={emptyColSpan} className="py-6 text-center text-slate-500">
                      No availability requests yet.
                    </TableCell>
                  </TableRow>
                )}
                {requests.map((request) => {
                  const cycle = getOne(request.schedule_cycles)
                  const requester = getOne(request.profiles)
                  const canDelete = request.user_id === user.id

                  return (
                    <TableRow key={request.id}>
                      <TableCell>{formatDate(request.date)}</TableCell>
                      <TableCell>
                        {cycle ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})` : 'Unassigned'}
                      </TableCell>
                      <TableCell>{request.reason ?? '-'}</TableCell>
                      {role === 'manager' && <TableCell>{requester?.full_name ?? 'Unknown user'}</TableCell>}
                      <TableCell>{formatDateTime(request.created_at)}</TableCell>
                      <TableCell>
                        {canDelete ? (
                          <form action={deleteAvailabilityRequest}>
                            <input type="hidden" name="request_id" value={request.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Delete
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
