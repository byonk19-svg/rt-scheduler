import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, CheckCircle2, Clock, Send } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { dateFromKey, formatDateLabel, formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  buildTherapistSubmissionUiState,
  resolveAvailabilityDueSupportLine,
} from '@/lib/therapist-availability-submission'
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
  const firstName = fullName.split(/\s+/)[0] ?? fullName

  const today = new Date().toISOString().split('T')[0]

  const { data: cycles } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, archived_at, published, availability_due_at')
    .is('archived_at', null)
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

  const [upcomingShiftsResult, therapistSubmissionResult, pendingPostCountResult] =
    await Promise.all([
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
            .from('therapist_availability_submissions')
            .select('submitted_at, last_edited_at, schedule_cycle_id')
            .eq('therapist_id', user.id)
            .eq('schedule_cycle_id', activeCycle.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
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

  const submissionRow = therapistSubmissionResult.data as {
    submitted_at: string
    last_edited_at: string
    schedule_cycle_id: string
  } | null
  const submissionUi = buildTherapistSubmissionUiState(
    submissionRow
      ? {
          schedule_cycle_id: submissionRow.schedule_cycle_id,
          submitted_at: submissionRow.submitted_at,
          last_edited_at: submissionRow.last_edited_at,
        }
      : null
  )
  const availabilitySubmitted = submissionUi.isSubmitted

  const pendingPostCount = pendingPostCountResult.count ?? 0

  const cycleRangeLabel =
    activeCycle && !Number.isNaN(dateFromKey(activeCycle.start_date).getTime())
      ? formatHumanCycleRange(activeCycle.start_date, activeCycle.end_date)
      : null

  const availabilityDueLine =
    activeCycle && !availabilitySubmitted
      ? resolveAvailabilityDueSupportLine(
          {
            start_date: activeCycle.start_date,
            availability_due_at: activeCycle.availability_due_at ?? null,
          },
          availabilitySubmitted
        )
      : null

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

  const nextShiftTypeLabel = nextShift?.shift_type
    ? `${nextShift.shift_type.charAt(0).toUpperCase()}${nextShift.shift_type.slice(1)} shift`
    : null

  return (
    <div className="space-y-4">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-tw-float-lg">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {firstName}
            </h1>
            {activeCycle && cycleRangeLabel ? (
              <>
                <p className="mt-2 text-sm font-medium text-foreground">Cycle: {cycleRangeLabel}</p>
                {activeCycle.published ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Published {formatDateLabel(activeCycle.start_date)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No active scheduling cycle yet.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5',
                  availabilitySubmitted
                    ? 'border-border/70 bg-muted/20'
                    : 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/50 text-[var(--warning-text)]'
                )}
              >
                {availabilitySubmitted ? 'Availability: Submitted' : 'Availability: Not submitted'}
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {upcomingCount} upcoming shifts
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
                {pendingPostCount} requests awaiting action
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!availabilitySubmitted ? (
              <>
                <Button asChild size="sm">
                  <Link href="/therapist/availability">
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Submit availability
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/shift-board">Browse open shifts</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="sm">
                  <Link href="/shift-board">Browse open shifts</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/therapist/availability">Edit availability</Link>
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Upcoming Shifts
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
              <p className="text-sm font-medium text-foreground">
                No shifts scheduled yet for this cycle
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The schedule is still being filled. You can browse open shifts now, and submit
                availability if you have not done so yet.
              </p>
              <div className="mt-3 flex justify-center">
                <Button asChild size="sm">
                  <Link href="/shift-board">Browse open shifts</Link>
                </Button>
              </div>
            </div>
          )}
          <div className="mt-2 border-t border-border/40 pt-2 text-right">
            <Link
              href="/staff/my-schedule"
              className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all my shifts &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Next Shift</span>
            <Clock className="h-3.5 w-3.5" />
          </div>
          {nextShift && nextShiftLabel ? (
            <>
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
                {nextShiftLabel}
              </p>
              {nextShiftTypeLabel ? (
                <p className="mt-0.5 text-sm font-medium capitalize text-foreground">
                  {nextShiftTypeLabel}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Your next shift in this published schedule
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-sm font-medium text-foreground">No shift scheduled yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your next scheduled shift will appear here once you are on the roster.
              </p>
            </>
          )}
        </div>
        <div
          className={cn(
            'rounded-xl border px-3 py-2.5',
            availabilitySubmitted
              ? 'border-border bg-muted/30'
              : 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/40'
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Availability for This Cycle</span>
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
            {availabilitySubmitted ? 'Submitted' : 'Not submitted'}
          </p>
          {availabilitySubmitted && submissionUi.submittedAtDisplay ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Submitted {submissionUi.submittedAtDisplay}
            </p>
          ) : null}
          {availabilitySubmitted && submissionUi.lastEditedDisplay ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last edited {submissionUi.lastEditedDisplay}
            </p>
          ) : null}
          {!availabilitySubmitted && availabilityDueLine ? (
            <p className="mt-2 text-xs font-medium leading-snug text-foreground/90">
              {availabilityDueLine}
            </p>
          ) : null}
          {!availabilitySubmitted ? (
            <Link
              href="/therapist/availability"
              className="mt-2.5 inline-block text-xs font-medium text-primary hover:underline"
            >
              Submit availability &rarr;
            </Link>
          ) : (
            <Link
              href="/therapist/availability"
              className="mt-2.5 inline-block text-xs font-medium text-primary hover:underline"
            >
              Edit availability &rarr;
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Requests Awaiting Action</span>
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
            {pendingPostCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Swap or pickup requests that need your response
          </p>
        </div>
      </section>
    </div>
  )
}
