import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveOperationalCodeMap, isWorkingScheduledShift } from '@/lib/operational-codes'
import { siteLocalDateKey } from '@/lib/calendar-utils'

type RequestType = 'swap' | 'pickup'

type ShiftRow = {
  id: string
  cycle_id: string
  site_id: string | null
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  role: 'lead' | 'staff'
  status: string | null
  assignment_status: string | null
  schedule_cycles?: { published: boolean } | { published: boolean }[] | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  archived_at?: string | null
  role?: string | null
  shift_type?: 'day' | 'night' | null
  site_id?: string | null
}

function isRequestType(value: string): value is RequestType {
  return value === 'swap' || value === 'pickup'
}

function toTeammate(profile: ProfileRow, shiftType: ShiftRow['shift_type']) {
  const name = profile.full_name ?? 'Unknown therapist'

  return {
    id: profile.id,
    name,
    avatar: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    shift: shiftType === 'day' ? 'Day' : 'Night',
    isLead: profile.is_lead_eligible === true,
  }
}

function formatTherapistShiftLabel(date: string, shiftType: ShiftRow['shift_type']): string {
  const parsed = new Date(`${date}T00:00:00`)
  const formattedDate = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${formattedDate} ${shiftType === 'day' ? 'day' : 'night'} shift`
}

function isPublishedCycle(cycle: ShiftRow['schedule_cycles']): boolean {
  if (Array.isArray(cycle)) return cycle[0]?.published === true
  return cycle?.published === true
}

function getShiftSlotKey(date: string, shiftType: ShiftRow['shift_type']): string {
  return `${date}:${shiftType}`
}

async function filterWorkingScheduledShifts<T extends { id: string; status?: string | null }>(
  admin: unknown,
  rows: T[]
): Promise<T[]> {
  const activeOperationalCodes = await fetchActiveOperationalCodeMap(
    admin,
    rows.map((row) => row.id)
  )

  return rows.filter((row) =>
    isWorkingScheduledShift({
      status: row.status,
      activeOperationalCode: activeOperationalCodes.get(row.id),
    })
  )
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const shiftId = params.get('shiftId')?.trim() ?? ''
  const requestTypeValue = params.get('requestType')?.trim() ?? ''

  if (!shiftId || !isRequestType(requestTypeValue)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const todayKey = siteLocalDateKey()

  const [{ data: shift, error: shiftError }, { data: requesterProfile }] = await Promise.all([
    admin
      .from('shifts')
      .select(
        'id, cycle_id, site_id, user_id, date, shift_type, role, status, assignment_status, schedule_cycles!inner(published)'
      )
      .eq('id', shiftId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('id, is_lead_eligible, is_active, archived_at, site_id')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const requestShift = (shift ?? null) as ShiftRow | null
  const actorProfile = (requesterProfile ?? null) as Pick<
    ProfileRow,
    'is_lead_eligible' | 'is_active' | 'archived_at' | 'site_id'
  > | null
  const actorSiteId = actorProfile?.site_id ?? null
  const actorIsLeadEligible = actorProfile?.is_lead_eligible === true

  const requestShiftActiveOperationalCodes = await fetchActiveOperationalCodeMap(admin, [
    requestShift?.id ?? '',
  ])

  if (
    shiftError ||
    !requestShift ||
    requestShift.user_id !== user.id ||
    requestShift.site_id !== actorSiteId ||
    actorProfile?.is_active === false ||
    Boolean(actorProfile?.archived_at) ||
    !actorSiteId ||
    !isPublishedCycle(requestShift.schedule_cycles) ||
    !isWorkingScheduledShift({
      status: requestShift.status,
      activeOperationalCode: requestShiftActiveOperationalCodes.get(requestShift.id),
    })
  ) {
    return NextResponse.json({ error: 'Shift was not found.' }, { status: 404 })
  }

  const { data: slotLeadRows, error: slotLeadRowsError } = await admin
    .from('shifts')
    .select('id, user_id, status, schedule_cycles!inner(published)')
    .eq('cycle_id', requestShift.cycle_id)
    .eq('site_id', actorSiteId)
    .eq('date', requestShift.date)
    .eq('shift_type', requestShift.shift_type)
    .eq('role', 'lead')
    .eq('status', 'scheduled')
    .eq('schedule_cycles.published', true)

  if (slotLeadRowsError) {
    return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
  }

  const leadShiftRows = (
    await filterWorkingScheduledShifts(
      admin,
      (slotLeadRows ?? []) as Array<Pick<ShiftRow, 'id' | 'user_id' | 'status'>>
    )
  ).filter((row): row is Pick<ShiftRow, 'id' | 'user_id' | 'status'> & { user_id: string } =>
    Boolean(row.user_id)
  )
  const leadUserIds = Array.from(new Set(leadShiftRows.map((row) => row.user_id)))

  let leadEligibilityByUserId = new Map<string, boolean>()
  if (leadUserIds.length > 0) {
    const { data: leadProfiles, error: leadProfilesError } = await admin
      .from('profiles')
      .select('id, is_lead_eligible')
      .in('id', leadUserIds)
      .eq('site_id', actorSiteId)

    if (leadProfilesError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    leadEligibilityByUserId = new Map(
      ((leadProfiles ?? []) as Array<Pick<ProfileRow, 'id' | 'is_lead_eligible'>>).map(
        (profile) => [profile.id, profile.is_lead_eligible === true]
      )
    )
  }

  const hasOtherLeadEligibleShift = (excludedShiftId: string) =>
    leadShiftRows.some(
      (row) => row.id !== excludedShiftId && leadEligibilityByUserId.get(row.user_id) === true
    )

  if (requestTypeValue === 'swap') {
    const { data: candidateShiftRows, error: candidateShiftRowsError } = await admin
      .from('shifts')
      .select('id, user_id, date, shift_type, role, status, schedule_cycles!inner(published)')
      .eq('cycle_id', requestShift.cycle_id)
      .eq('site_id', actorSiteId)
      .eq('shift_type', requestShift.shift_type)
      .gt('date', todayKey)
      .eq('status', 'scheduled')
      .eq('schedule_cycles.published', true)
      .neq('date', requestShift.date)
      .neq('user_id', user.id)

    if (candidateShiftRowsError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    const sortedCandidateShiftRows = (
      await filterWorkingScheduledShifts(admin, (candidateShiftRows ?? []) as ShiftRow[])
    )
      .filter((row): row is ShiftRow & { user_id: string } => Boolean(row.user_id))
      .sort((left, right) => left.date.localeCompare(right.date))
    const candidateShiftByUserId = new Map<string, ShiftRow & { user_id: string }>()

    sortedCandidateShiftRows.forEach((row) => {
      if (!candidateShiftByUserId.has(row.user_id)) {
        candidateShiftByUserId.set(row.user_id, row)
      }
    })
    const candidateUserIds = Array.from(candidateShiftByUserId.keys())

    if (candidateUserIds.length === 0) {
      return NextResponse.json({ teammates: [] })
    }

    const { data: candidateProfiles, error: candidateProfilesError } = await admin
      .from('profiles')
      .select('id, full_name, is_lead_eligible, is_active, archived_at, role')
      .in('id', candidateUserIds)
      .in('role', ['therapist', 'lead'])
      .eq('site_id', actorSiteId)
      .eq('is_active', true)
      .is('archived_at', null)

    if (candidateProfilesError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    const leadCoverageDates = Array.from(
      new Set([
        requestShift.date,
        ...Array.from(candidateShiftByUserId.values()).map((row) => row.date),
      ])
    )
    const { data: swapLeadRows, error: swapLeadRowsError } = await admin
      .from('shifts')
      .select('id, user_id, date, shift_type, status, schedule_cycles!inner(published)')
      .eq('cycle_id', requestShift.cycle_id)
      .eq('site_id', actorSiteId)
      .in('date', leadCoverageDates)
      .eq('shift_type', requestShift.shift_type)
      .eq('role', 'lead')
      .eq('status', 'scheduled')
      .eq('schedule_cycles.published', true)

    if (swapLeadRowsError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    const swapLeadShiftRows = (
      await filterWorkingScheduledShifts(admin, (swapLeadRows ?? []) as ShiftRow[])
    ).filter((row): row is ShiftRow & { user_id: string } => Boolean(row.user_id))
    const swapLeadUserIds = Array.from(new Set(swapLeadShiftRows.map((row) => row.user_id)))
    let swapLeadEligibilityByUserId = new Map<string, boolean>()

    if (swapLeadUserIds.length > 0) {
      const { data: swapLeadProfiles, error: swapLeadProfilesError } = await admin
        .from('profiles')
        .select('id, is_lead_eligible')
        .in('id', swapLeadUserIds)
        .eq('site_id', actorSiteId)

      if (swapLeadProfilesError) {
        return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
      }

      swapLeadEligibilityByUserId = new Map(
        ((swapLeadProfiles ?? []) as Array<Pick<ProfileRow, 'id' | 'is_lead_eligible'>>).map(
          (profile) => [profile.id, profile.is_lead_eligible === true]
        )
      )
    }

    const leadShiftRowsBySlot = new Map<string, Array<ShiftRow & { user_id: string }>>()
    swapLeadShiftRows.forEach((row) => {
      const key = getShiftSlotKey(row.date, row.shift_type)
      leadShiftRowsBySlot.set(key, [...(leadShiftRowsBySlot.get(key) ?? []), row])
    })

    const hasOtherLeadEligibleShiftForSlot = (
      date: string,
      shiftType: ShiftRow['shift_type'],
      excludedShiftId: string
    ) =>
      (leadShiftRowsBySlot.get(getShiftSlotKey(date, shiftType)) ?? []).some(
        (row) => row.id !== excludedShiftId && swapLeadEligibilityByUserId.get(row.user_id) === true
      )

    const teammates = ((candidateProfiles ?? []) as ProfileRow[])
      .sort((left, right) =>
        (left.full_name ?? 'Unknown therapist').localeCompare(
          right.full_name ?? 'Unknown therapist'
        )
      )
      .map((profile) => {
        const candidateShift = candidateShiftByUserId.get(profile.id)
        const base = toTeammate(profile, requestShift.shift_type)

        if (!candidateShift) {
          return {
            ...base,
            verdict: 'not_allowed' as const,
            consequence: null,
            nextMove: null,
            availabilityReason: 'Not scheduled on this shift.',
            currentShiftLabel: null,
          }
        }

        const currentShiftLabel = `Currently on ${formatTherapistShiftLabel(
          candidateShift.date,
          candidateShift.shift_type
        )}`

        const requesterLeadRisk =
          requestShift.role === 'lead' &&
          profile.is_lead_eligible !== true &&
          !hasOtherLeadEligibleShiftForSlot(
            requestShift.date,
            requestShift.shift_type,
            requestShift.id
          )
        const partnerLeadRisk =
          candidateShift.role === 'lead' &&
          !actorIsLeadEligible &&
          !hasOtherLeadEligibleShiftForSlot(
            candidateShift.date,
            candidateShift.shift_type,
            candidateShift.id
          )

        if (requesterLeadRisk || partnerLeadRisk) {
          const consequence = requesterLeadRisk
            ? `Your ${formatTherapistShiftLabel(requestShift.date, requestShift.shift_type)} would lose its only lead.`
            : `Their ${formatTherapistShiftLabel(candidateShift.date, candidateShift.shift_type)} would lose its only lead.`

          return {
            ...base,
            verdict: 'needs_manager_review' as const,
            consequence,
            nextMove: 'Try another lead-qualified teammate if you want a safer swap.',
            availabilityReason: null,
            currentShiftLabel,
          }
        }

        return {
          ...base,
          verdict: 'coverage_safe' as const,
          consequence: 'Both shifts stay covered after the exchange.',
          nextMove: null,
          availabilityReason: null,
          currentShiftLabel,
        }
      })

    const bestOptionId =
      teammates.find((teammate) => teammate.verdict === 'coverage_safe')?.id ??
      teammates.find((teammate) => teammate.verdict === 'needs_manager_review')?.id ??
      null

    return NextResponse.json({
      teammates: teammates.map((teammate) => ({
        ...teammate,
        isBestOption: teammate.id === bestOptionId,
      })),
    })
  }

  const { data: pickupProfiles, error: pickupProfilesError } = await admin
    .from('profiles')
    .select('id, full_name, is_lead_eligible, is_active, archived_at, role, shift_type')
    .in('role', ['therapist', 'lead'])
    .eq('site_id', actorSiteId)
    .eq('shift_type', requestShift.shift_type)
    .eq('is_active', true)
    .is('archived_at', null)
    .neq('id', user.id)

  if (pickupProfilesError) {
    return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
  }

  const pickupCandidateProfiles = (pickupProfiles ?? []) as ProfileRow[]
  const pickupCandidateIds = pickupCandidateProfiles.map((profile) => profile.id)

  let scheduledUserIds = new Set<string>()
  if (pickupCandidateIds.length > 0) {
    const { data: scheduledRows, error: scheduledRowsError } = await admin
      .from('shifts')
      .select('id, user_id, status, schedule_cycles!inner(published)')
      .eq('cycle_id', requestShift.cycle_id)
      .eq('site_id', actorSiteId)
      .eq('date', requestShift.date)
      .eq('shift_type', requestShift.shift_type)
      .eq('status', 'scheduled')
      .eq('schedule_cycles.published', true)
      .in('user_id', pickupCandidateIds)

    if (scheduledRowsError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    const workingScheduledRows = await filterWorkingScheduledShifts(
      admin,
      (scheduledRows ?? []) as Array<Pick<ShiftRow, 'id' | 'user_id' | 'status'>>
    )
    scheduledUserIds = new Set(
      workingScheduledRows
        .map((row) => row.user_id)
        .filter((value): value is string => Boolean(value))
    )
  }

  const teammates = pickupCandidateProfiles
    .filter((profile) => !scheduledUserIds.has(profile.id))
    .filter((profile) => {
      if (requestShift.role !== 'lead') {
        return true
      }

      if (profile.is_lead_eligible === true) {
        return true
      }

      return hasOtherLeadEligibleShift(requestShift.id)
    })
    .sort((left, right) =>
      (left.full_name ?? 'Unknown therapist').localeCompare(right.full_name ?? 'Unknown therapist')
    )
    .map((profile) => toTeammate(profile, requestShift.shift_type))

  return NextResponse.json({ teammates })
}
