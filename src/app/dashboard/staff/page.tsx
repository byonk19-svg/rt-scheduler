import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FeedbackToast } from '@/components/feedback-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
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

  const [upcomingShiftsResult, overrideCountResult, pendingPostCountResult] = await Promise.all([
    activeCycle
      ? supabase
          .from('shifts')
          .select('id, date, shift_type, status, role')
          .eq('user_id', user.id)
          .eq('cycle_id', activeCycle.id)
          .gte('date', today)
          .in('status', ['scheduled', 'on_call'])
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

  const upcomingShifts = upcomingShiftsResult.data ?? []
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

  // Upcoming shift roster — who else is scheduled on the next 3 shifts --------
  type RosterShift = {
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
            .select('user_id, date, shift_type, role')
            .eq('cycle_id', activeCycle.id)
            .in('date', rosterDates)
            .in('status', ['scheduled', 'on_call'])
            .neq('user_id', user.id)
        ).data as RosterShift[] | null) ?? [])
      : []

  const rosterUserIds = [
    ...new Set(rosterRawShifts.map((s) => s.user_id).filter((id): id is string => Boolean(id))),
  ]
  const rosterNameById = new Map<string, string>()
  if (rosterUserIds.length > 0) {
    const { data: rosterProfiles } = await supabase
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
    const colleagues = rosterRawShifts
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
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      {/* Header */}
      <PageHeader
        title="Staff Home"
        subtitle={`Welcome, ${fullName}. Your self-service tools are prioritized below.`}
        badge={
          <>
            <Badge variant="secondary">Role: therapist</Badge>
            <Badge variant="outline">Team: Respiratory Therapy</Badge>
          </>
        }
      />

      {/* Metrics banner */}
      {activeCycle && (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {activeCycle.label}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="font-display text-xl font-extrabold text-foreground">{upcomingCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Upcoming shifts</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-foreground">{nextShiftLabel ?? 'None'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Next shift</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p
                className={cn(
                  'text-xs font-semibold',
                  availabilitySubmitted ? 'text-emerald-700' : 'text-amber-700'
                )}
              >
                {availabilitySubmitted ? '✓ Submitted' : 'Not submitted'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Availability</p>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming shift roster */}
      {upcomingRoster.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Upcoming shifts
          </p>
          <div className="space-y-3">
            {upcomingRoster.map((shift) => (
              <div key={shift.date} className="flex items-start gap-3">
                <div className="w-[96px] shrink-0">
                  <p className="text-xs font-semibold text-foreground">{shift.label}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                    {shift.shiftType} shift
                  </p>
                  {shift.myRole === 'lead' && (
                    <span className="mt-1 inline-block rounded border border-[var(--attention)] bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Lead
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {shift.colleagues.length > 0 ? (
                    shift.colleagues.map((c, i) => (
                      <span
                        key={i}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          c.isLead
                            ? 'border-[var(--attention)] bg-amber-50 text-amber-800'
                            : 'border-border bg-muted text-muted-foreground'
                        )}
                      >
                        {c.isLead ? '★ ' : ''}
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
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">My Schedule</h3>
            <p className="text-sm text-muted-foreground">
              {upcomingCount > 0
                ? `${String(upcomingCount)} upcoming shift${upcomingCount === 1 ? '' : 's'} this cycle.`
                : 'No upcoming shifts scheduled yet.'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/schedule">Open schedule</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Availability Requests</h3>
            <p className="text-sm text-muted-foreground">
              {activeCycle
                ? availabilitySubmitted
                  ? `Submitted for ${activeCycle.label}.`
                  : 'Availability not yet submitted for this cycle.'
                : 'Submit days you cannot work in upcoming cycles.'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/availability">Open requests</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h3 className="app-section-title">Shift Board</h3>
            <p className="text-sm text-muted-foreground">
              {pendingPostCount > 0
                ? `${String(pendingPostCount)} pending request${pendingPostCount === 1 ? '' : 's'}.`
                : 'No pending swap or pickup requests.'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/shift-board">Open shift board</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
