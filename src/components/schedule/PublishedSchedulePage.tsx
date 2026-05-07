import { redirect } from 'next/navigation'

import {
  TherapistShiftCalendar,
  type TherapistShiftDay,
  type TherapistShiftMember,
  type TherapistShiftWeek,
} from '@/components/schedule/TherapistShiftCalendar'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { fetchPublishedScheduleWindow, type MyScheduleTeamShiftRow } from '@/lib/staff-my-schedule'
import { createClient } from '@/lib/supabase/server'

const PERIOD_DAYS = 35
const HOURS_PER_SHIFT = 12
const MEMBER_COLORS = [
  'bg-primary',
  'bg-[color:var(--attention)]',
  'bg-[color:var(--success-text)]',
  'bg-[color:var(--info-text)]',
  'bg-[color:var(--warning-text)]',
  'bg-[color:var(--muted-foreground)]',
] as const

function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPeriodLabel(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T12:00:00`)
  const end = new Date(`${endIso}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} - ${endIso}`
  }
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} - ${endLabel}`
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function startOfWeekIso(date: Date): string {
  const local = new Date(date)
  local.setHours(12, 0, 0, 0)
  local.setDate(local.getDate() - local.getDay())
  return toIsoDate(local)
}

function parseStartParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return startOfWeekIso(fromIsoDate(raw))
  }
  return startOfWeekIso(new Date())
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return name.trim() || 'Team member'
  return `${parts[0]} ${parts[parts.length - 1]?.charAt(0) ?? ''}.`
}

function memberFromShift(
  row: MyScheduleTeamShiftRow,
  userId: string,
  colorIndex: number
): TherapistShiftMember | null {
  if (!row.user_id) return null
  const profile = getOne(row.profiles)
  const name = profile?.full_name?.trim() || 'Team member'

  return {
    id: row.user_id,
    name,
    shortName: shortName(name),
    initials: initials(name),
    colorClass: MEMBER_COLORS[colorIndex % MEMBER_COLORS.length] ?? 'bg-primary',
    isLead: row.role === 'lead' || profile?.role === 'lead',
    isYou: row.user_id === userId,
  }
}

function sortMembers(left: TherapistShiftMember, right: TherapistShiftMember): number {
  if (left.isLead !== right.isLead) return left.isLead ? -1 : 1
  if (left.isYou !== right.isYou) return left.isYou ? -1 : 1
  return left.name.localeCompare(right.name)
}

function buildMemberMap(rows: MyScheduleTeamShiftRow[], user: TherapistShiftMember) {
  const members = new Map<string, TherapistShiftMember>([[user.id, user]])
  for (const row of rows) {
    const member = memberFromShift(row, user.id, members.size)
    if (!member) continue
    const existing = members.get(member.id)
    members.set(
      member.id,
      existing ? { ...existing, isLead: existing.isLead || member.isLead } : member
    )
  }
  return members
}

function buildWeeks(args: {
  startIso: string
  rows: MyScheduleTeamShiftRow[]
  userId: string
  userShiftType: 'day' | 'night'
  members: Map<string, TherapistShiftMember>
}): TherapistShiftWeek[] {
  const weeks: TherapistShiftWeek[] = []
  for (let weekIndex = 0; weekIndex < 5; weekIndex += 1) {
    const weekStart = addDays(args.startIso, weekIndex * 7)
    const days: TherapistShiftDay[] = []

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const isoDate = addDays(weekStart, dayIndex)
      const date = fromIsoDate(isoDate)
      const dayRows = args.rows.filter(
        (row) => row.date === isoDate && row.shift_type === args.userShiftType
      )
      const userShift = dayRows.find((row) => row.user_id === args.userId) ?? null
      const team = dayRows
        .map((row) => (row.user_id ? args.members.get(row.user_id) : null))
        .filter((member): member is TherapistShiftMember => Boolean(member))
        .sort(sortMembers)

      days.push({
        isoDate,
        weekdayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        userShift: userShift
          ? {
              shiftType: userShift.shift_type === 'night' ? 'night' : 'day',
              role: userShift.role,
              assignmentStatus: userShift.assignment_status,
              status: userShift.status,
            }
          : null,
        team,
      })
    }

    weeks.push({
      id: `week-${weekIndex + 1}`,
      label: `Week ${weekIndex + 1}`,
      rangeLabel: `${formatShortDate(days[0]?.isoDate ?? weekStart)} - ${formatShortDate(
        days[days.length - 1]?.isoDate ?? weekStart
      )}`,
      days,
    })
  }

  return weeks
}

export async function PublishedSchedulePage({
  title = 'My Shifts',
  backHref = '/dashboard/staff',
  scheduleHref = '/therapist/schedule',
  searchParams,
}: {
  title?: string
  backHref?: string
  scheduleHref?: string
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, shift_type, max_work_days_per_week')
    .eq('id', user.id)
    .maybeSingle()

  if (can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  const startIso = parseStartParam(searchParams?.start)
  const endIso = addDays(startIso, PERIOD_DAYS - 1)
  const rows = await fetchPublishedScheduleWindow(supabase, startIso, endIso)
  const currentUserRows = rows.filter((row) => row.user_id === user.id)
  const userShiftType =
    profile?.shift_type === 'night'
      ? 'night'
      : currentUserRows.find((row) => row.shift_type === 'night')?.shift_type === 'night'
        ? 'night'
        : 'day'
  const userName = profile?.full_name?.trim() || user.email || 'You'
  const currentMember: TherapistShiftMember = {
    id: user.id,
    name: userName,
    shortName: shortName(userName),
    initials: initials(userName),
    colorClass: MEMBER_COLORS[1],
    isLead: currentUserRows.some((row) => row.role === 'lead') || profile?.role === 'lead',
    isYou: true,
  }
  const members = buildMemberMap(rows, currentMember)
  const weeks = buildWeeks({ startIso, rows, userId: user.id, userShiftType, members })
  const days = weeks.flatMap((week) => week.days)
  const shiftCount = days.filter((day) => Boolean(day.userShift)).length
  const leadCount = days.filter((day) => day.userShift?.role === 'lead').length
  const dayShiftCount = days.filter((day) => day.userShift?.shiftType === 'day').length
  const nightShiftCount = days.filter((day) => day.userShift?.shiftType === 'night').length

  return (
    <TherapistShiftCalendar
      key={startIso}
      title={title}
      subtitle="Your published schedule and who you're working with."
      periodLabel={formatPeriodLabel(startIso, endIso)}
      previousHref={`${scheduleHref}?start=${addDays(startIso, -PERIOD_DAYS)}`}
      nextHref={`${scheduleHref}?start=${addDays(startIso, PERIOD_DAYS)}`}
      weeks={weeks}
      teammates={Array.from(members.values()).sort(sortMembers)}
      summary={{
        shiftCount,
        leadCount,
        dayShiftCount,
        nightShiftCount,
        dayOffCount: days.length - shiftCount,
        totalHours: shiftCount * HOURS_PER_SHIFT,
      }}
      backHref={backHref}
    />
  )
}
