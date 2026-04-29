import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type RequestType = 'swap' | 'pickup'

type ShiftRow = {
  id: string
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

  const [{ data: shift, error: shiftError }, { data: requesterProfile }] = await Promise.all([
    admin
      .from('shifts')
      .select(
        'id, user_id, date, shift_type, role, status, assignment_status, schedule_cycles!inner(published)'
      )
      .eq('id', shiftId)
      .maybeSingle(),
    admin.from('profiles').select('id, is_lead_eligible').eq('id', user.id).maybeSingle(),
  ])

  const requestShift = (shift ?? null) as ShiftRow | null
  const published = Array.isArray(requestShift?.schedule_cycles)
    ? requestShift.schedule_cycles[0]?.published
    : requestShift?.schedule_cycles?.published
  const actorIsLeadEligible =
    ((requesterProfile ?? null) as Pick<ProfileRow, 'is_lead_eligible'> | null)
      ?.is_lead_eligible === true

  if (
    shiftError ||
    !requestShift ||
    requestShift.user_id !== user.id ||
    published !== true ||
    requestShift.status !== 'scheduled' ||
    requestShift.assignment_status !== 'scheduled'
  ) {
    return NextResponse.json({ error: 'Shift was not found.' }, { status: 404 })
  }

  const { data: slotLeadRows, error: slotLeadRowsError } = await admin
    .from('shifts')
    .select('id, user_id, schedule_cycles!inner(published)')
    .eq('date', requestShift.date)
    .eq('shift_type', requestShift.shift_type)
    .eq('role', 'lead')
    .eq('status', 'scheduled')
    .eq('assignment_status', 'scheduled')
    .eq('schedule_cycles.published', true)

  if (slotLeadRowsError) {
    return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
  }

  const leadShiftRows = ((slotLeadRows ?? []) as Array<Pick<ShiftRow, 'id' | 'user_id'>>).filter(
    (row): row is Pick<ShiftRow, 'id' | 'user_id'> & { user_id: string } => Boolean(row.user_id)
  )
  const leadUserIds = Array.from(new Set(leadShiftRows.map((row) => row.user_id)))

  let leadEligibilityByUserId = new Map<string, boolean>()
  if (leadUserIds.length > 0) {
    const { data: leadProfiles, error: leadProfilesError } = await admin
      .from('profiles')
      .select('id, is_lead_eligible')
      .in('id', leadUserIds)

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
      .select('id, user_id, role, schedule_cycles!inner(published)')
      .eq('date', requestShift.date)
      .eq('shift_type', requestShift.shift_type)
      .eq('status', 'scheduled')
      .eq('assignment_status', 'scheduled')
      .eq('schedule_cycles.published', true)
      .neq('user_id', user.id)

    if (candidateShiftRowsError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    const candidateShiftByUserId = new Map(
      ((candidateShiftRows ?? []) as Array<Pick<ShiftRow, 'id' | 'user_id' | 'role'>>)
        .filter((row): row is Pick<ShiftRow, 'id' | 'user_id' | 'role'> & { user_id: string } =>
          Boolean(row.user_id)
        )
        .map((row) => [row.user_id, row])
    )
    const candidateUserIds = Array.from(candidateShiftByUserId.keys())

    if (candidateUserIds.length === 0) {
      return NextResponse.json({ teammates: [] })
    }

    const { data: candidateProfiles, error: candidateProfilesError } = await admin
      .from('profiles')
      .select('id, full_name, is_lead_eligible, is_active, archived_at, role')
      .in('id', candidateUserIds)
      .in('role', ['therapist', 'lead'])
      .eq('is_active', true)
      .is('archived_at', null)

    if (candidateProfilesError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    const teammates = ((candidateProfiles ?? []) as ProfileRow[])
      .filter((profile) => {
        const candidateShift = candidateShiftByUserId.get(profile.id)
        if (!candidateShift) return false

        if (requestShift.role === 'lead' && profile.is_lead_eligible !== true) {
          return hasOtherLeadEligibleShift(requestShift.id)
        }

        if (candidateShift.role === 'lead' && !actorIsLeadEligible) {
          return hasOtherLeadEligibleShift(candidateShift.id)
        }

        return true
      })
      .sort((left, right) =>
        (left.full_name ?? 'Unknown therapist').localeCompare(
          right.full_name ?? 'Unknown therapist'
        )
      )
      .map((profile) => toTeammate(profile, requestShift.shift_type))

    return NextResponse.json({ teammates })
  }

  const { data: pickupProfiles, error: pickupProfilesError } = await admin
    .from('profiles')
    .select('id, full_name, is_lead_eligible, is_active, archived_at, role, shift_type')
    .in('role', ['therapist', 'lead'])
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
      .select('user_id, schedule_cycles!inner(published)')
      .eq('date', requestShift.date)
      .eq('status', 'scheduled')
      .eq('assignment_status', 'scheduled')
      .eq('schedule_cycles.published', true)
      .in('user_id', pickupCandidateIds)

    if (scheduledRowsError) {
      return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
    }

    scheduledUserIds = new Set(
      ((scheduledRows ?? []) as Array<Pick<ShiftRow, 'user_id'>>)
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
