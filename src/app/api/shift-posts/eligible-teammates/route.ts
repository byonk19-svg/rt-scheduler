import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ShiftRow = {
  id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  role: 'lead' | 'staff'
  status: string | null
  assignment_status: string | null
  schedule_cycles?: { published: boolean }[] | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const shiftId = new URL(request.url).searchParams.get('shiftId')?.trim() ?? ''
  if (!shiftId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .select('id, user_id, date, shift_type, role, status, assignment_status, schedule_cycles!inner(published)')
    .eq('id', shiftId)
    .maybeSingle()

  const requestShift = (shift ?? null) as ShiftRow | null
  const published = requestShift?.schedule_cycles?.[0]?.published

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

  let requireLeadEligibleReplacement = false
  if (requestShift.role === 'lead') {
    const { count } = await admin
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('date', requestShift.date)
      .eq('shift_type', requestShift.shift_type)
      .eq('role', 'lead')
      .eq('status', 'scheduled')
      .eq('assignment_status', 'scheduled')

    requireLeadEligibleReplacement = (count ?? 0) <= 1
  }

  let profilesQuery = admin
    .from('profiles')
    .select('id, full_name, is_lead_eligible, is_active')
    .in('role', ['therapist', 'lead'])
    .eq('shift_type', requestShift.shift_type)
    .eq('is_active', true)
    .is('archived_at', null)
    .neq('id', user.id)

  if (requireLeadEligibleReplacement) {
    profilesQuery = profilesQuery.eq('is_lead_eligible', true)
  }

  const { data: profiles, error: profilesError } = await profilesQuery
  if (profilesError) {
    return NextResponse.json({ error: 'Could not load eligible teammates.' }, { status: 500 })
  }

  const teammates = ((profiles ?? []) as ProfileRow[]).map((profile) => ({
    id: profile.id,
    name: profile.full_name ?? 'Unknown therapist',
    avatar: (profile.full_name ?? 'Unknown therapist')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    shift: requestShift.shift_type === 'day' ? 'Day' : 'Night',
    isLead: profile.is_lead_eligible === true,
  }))

  return NextResponse.json({ teammates })
}
