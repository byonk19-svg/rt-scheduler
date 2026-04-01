import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, CheckCircle2, Clock, Send } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { createAdminClient } from '@/lib/supabase/admin'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

type StaffDashboardSearchParams = {
  success?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getStaffDashboardFeedback(
  params?: StaffDashboardSearchParams
): { message: string; variant: 'success' } | null {
  const success = getSearchParam(params?.success)
  if (success === 'signed_in') return { message: 'Signed in successfully.', variant: 'success' }
  if (success === 'access_requested')
    return { message: 'Access request submitted and signed in.', variant: 'success' }
  return null
}

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<StaffDashboardSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
  const feedback = getStaffDashboardFeedback(params)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = can(parseRole(profile?.role), 'access_manager_ui')
  if (isManager) {
    redirect('/dashboard/manager')
  }

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Staff member'

  // Fetch live metrics --------------------------------------------------------
  const today = new Date().toISOString().split('T')[0]

  const { data: cycles } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date')
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .limit(2)

  const activeCycle =
    (cycles ?? []).find((c) => c.start_date <= today && c.end_date >= today) ??
    (cycles ?? [])[0] ??
    null

  type UpcomingShiftRow = {
    id: string
    date: string
    shift_type: string | null
    role: string | null
  }
  const [upcomingShiftsResult, overrideCountResult, pendingPostCountResult] = await Promise.all([
    activeCycle
      ? supabase
          .from('shifts')
          .select('id, date, shift_type, role')
          .eq('user_id', user.id)
          .eq('cycle_id', activeCycle.id)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),
    activeCycle
      ? supabase
          .from('availability_overrides')
          .select('id', { head: true, count: 'exact' })
          .eq('therapist_id', user.id)
          .eq('cycle_id', activeCycle.id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('shift_posts')
      .select('id', { head: true, count: 'exact' })
      .eq('posted_by', user.id)
      .eq('status', 'pending'),
  ])

  const upcomingShiftRows = (upcomingShiftsResult.data ?? []) as UpcomingShiftRow[]
  const upcomingActiveOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    upcomingShiftRows.map((row) => row.id)
  )
  const upcomingShifts = upcomingShiftRows.filter(
    (row) => !upcomingActiveOperationalCodesByShiftId.has(row.id)
  )
  const upcomingCount = upcomingShifts.length
  const nextShift = upcomingShifts[0] ?? null
  const nextShiftLabel = nextShift
    ? new Date(`${nextShift.date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null
  const availabilitySubmitted = (overrideCountResult.count ?? 0) > 0
  const pendingPostCount = pendingPostCountResult.count ?? 0

  // Upcoming shift roster - who else is scheduled on the next 3 shifts --------
  type RosterShift = {
    id: string
    user_id: string | null
    date: string
    shift_type: string | null
    role: string | null
  }
  const rosterDates = upcomingShifts.slice(0, 3).map((s) => s.date)
  const rosterRawShifts: RosterShift[] =
    rosterDates.length > 0 && activeCycle
      ? (((
          await supabase
            .from('shifts')
            .select('id, user_id, date, shift_type, role')
            .eq('cycle_id', activeCycle.id)
            .in('date', rosterDates)
            .neq('user_id', user.id)
        ).data as RosterShift[] | null) ?? [])
      : []
  const rosterActiveOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    rosterRawShifts.map((shift) => shift.id)
  )
  const rosterShifts = rosterRawShifts.filter(
    (shift) => !rosterActiveOperationalCodesByShiftId.has(shift.id)
  )

  const rosterUserIds = [
    ...new Set(rosterShifts.map((s) => s.user_id).filter((id): id is string => Boolean(id))),
  ]
  const rosterNameById = new Map<string, string>()
  if (rosterUserIds.length > 0) {
    const adminSupabase = createAdminClient()
    const { data: rosterProfiles } = await adminSupabase
      .from('profiles')
      .select('id, full_name')
      .in('id', rosterUserIds)
    for (const p of rosterProfiles ?? []) {
      if (p.id && p.full_name) rosterNameById.set(p.id, p.full_name)
    }
  }

  type ShiftColleague = { name: string; isLead: boolean }
  type UpcomingShiftRoster = {
    date: string
    label: string
    shiftType: string
    myRole: string
    colleagues: ShiftColleague[]
  }
  const upcomingRoster: UpcomingShiftRoster[] = upcomingShifts.slice(0, 3).map((myShift) => {
    const colleagues = rosterShifts
      .filter((s) => s.date === myShift.date && s.shift_type === myShift.shift_type)
      .map((s) => ({
        name: s.user_id ? (rosterNameById.get(s.user_id) ?? '?') : '?',
        isLead: s.role === 'lead',
      }))
      .sort((a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0))
    return {
      date: myShift.date,
      label: new Date(`${myShift.date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      shiftType: myShift.shift_type ?? 'day',
      myRole: myShift.role ?? 'staff',
      colleagues,
    }
  })
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_12px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Staff Home
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Welcome, {fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCycle
                ? `${activeCycle.label} | ${activeCycle.start_date} to ${activeCycle.end_date}`
                : 'No active cycle selected'}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {upcomingCount} upcoming
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {pendingPostCount} pending posts
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/therapist/availability">
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Submit availability
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/shift-board">Open shift board</Link>
            </Button>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Upcoming shifts
          </p>
          {upcomingRoster.length > 0 ? (
            <div className="divide-y divide-border">
              {upcomingRoster.map((shift) => (
                <div
                  key={shift.date}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="w-[96px] shrink-0">
                    <p className="text-xs font-semibold text-foreground">{shift.label}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                      {shift.shiftType} shift
                    </p>
                    {shift.myRole === 'lead' && (
                      <span
                        className="mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          borderColor: 'var(--warning-border)',
                          backgroundColor: 'var(--warning-subtle)',
                          color: 'var(--warning-text)',
                        }}
                      >
                        Lead
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {shift.colleagues.length > 0 ? (
                      shift.colleagues.map((c, i) => (
                        <span
                          key={i}
                          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          style={
                            c.isLead
                              ? {
                                  borderColor: 'var(--warning-border)',
                                  backgroundColor: 'var(--warning-subtle)',
                                  color: 'var(--warning-text)',
                                }
                              : {
                                  borderColor: 'var(--border)',
                                  backgroundColor: 'var(--muted)',
                                  color: 'var(--muted-foreground)',
                                }
                          }
                        >
                          {c.isLead ? 'Lead: ' : ''}
                          {c.name.split(' ')[0]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No colleagues assigned yet.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No upcoming shifts yet in this cycle.</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/therapist/availability">Submit availability</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/shift-board">Browse open shifts</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Next shift</span>
            <Clock className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
            {nextShiftLabel ?? '--'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Earliest scheduled shift</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Availability</span>
            <CheckCircle2
              className={cn(
                'h-3.5 w-3.5',
                availabilitySubmitted ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'
              )}
            />
          </div>
          <p
            className={cn(
              'mt-1.5 text-lg font-semibold tracking-tight',
              availabilitySubmitted ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'
            )}
          >
            {availabilitySubmitted ? 'Ready' : 'Pending'}
          </p>
          {availabilitySubmitted ? (
            <p className="mt-1 text-xs text-muted-foreground">Future-cycle submission</p>
          ) : (
            <Link
              href="/therapist/availability"
              className="mt-1 block text-xs text-primary hover:underline"
            >
              Submit now &rarr;
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pending posts</span>
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
            {pendingPostCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Swap or pickup requests awaiting action
          </p>
        </div>
      </section>
    </div>
  )
}
