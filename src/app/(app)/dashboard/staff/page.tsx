import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Send } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { StaffDashboardHero } from '@/components/staff/StaffDashboardHero'
import { StaffDashboardPublishedShifts } from '@/components/staff/StaffDashboardPublishedShifts'
import { StaffDashboardSummaryCards } from '@/components/staff/StaffDashboardSummaryCards'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { dateFromKey, formatDateLabel, formatHumanCycleRange } from '@/lib/calendar-utils'
import {
  buildTherapistSubmissionUiState,
  resolveAvailabilityDueSupportLine,
} from '@/lib/therapist-availability-submission'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMyPublishedUpcomingShifts } from '@/lib/staff-my-schedule'
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

  const upcomingPublishedWidget = await fetchMyPublishedUpcomingShifts(supabase, user.id, 5)

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

      <StaffDashboardHero
        activeCyclePublished={Boolean(activeCycle?.published)}
        availabilitySubmitted={availabilitySubmitted}
        cycleRangeLabel={cycleRangeLabel}
        firstName={firstName}
        pendingPostCount={pendingPostCount}
        upcomingCount={upcomingCount}
        upcomingRoster={upcomingRoster}
      />

      <StaffDashboardPublishedShifts rows={upcomingPublishedWidget} />

      <StaffDashboardSummaryCards
        availabilityDueLine={availabilityDueLine}
        availabilitySubmitted={availabilitySubmitted}
        lastEditedDisplay={submissionUi.lastEditedDisplay}
        nextShiftLabel={nextShiftLabel}
        nextShiftTypeLabel={nextShiftTypeLabel}
        pendingPostCount={pendingPostCount}
        submittedAtDisplay={submissionUi.submittedAtDisplay}
      />
    </div>
  )
}
