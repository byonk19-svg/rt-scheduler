import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type CycleLookupRow = {
  id: string
  published: boolean
}

type ShiftUserRow = {
  user_id: string | null
}

type ProfileNameRow = {
  id: string
  full_name: string | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const cycleId = url.searchParams.get('cycle_id')?.trim() ?? ''

  if (!cycleId) {
    return NextResponse.json({ error: 'cycle_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: profile }, { data: cycle }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('schedule_cycles').select('id, published').eq('id', cycleId).maybeSingle(),
  ])

  const role = parseRole(profile?.role)
  const canReadDraftCoverage = can(role, 'manage_coverage') || role === 'lead'
  const cycleRow = (cycle ?? null) as CycleLookupRow | null

  if (!cycleRow) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  if (!cycleRow.published && !canReadDraftCoverage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: shifts, error: shiftError } = await admin
    .from('shifts')
    .select('user_id')
    .eq('cycle_id', cycleId)
    .not('user_id', 'is', null)

  if (shiftError) {
    console.error('Failed to load coverage names from shifts:', shiftError)
    return NextResponse.json({ error: 'Could not load coverage names' }, { status: 500 })
  }

  const userIds = [
    ...new Set(
      ((shifts ?? []) as ShiftUserRow[])
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (userIds.length === 0) {
    return NextResponse.json({ namesById: {} }, { status: 200 })
  }

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)

  if (profileError) {
    console.error('Failed to load coverage names from profiles:', profileError)
    return NextResponse.json({ error: 'Could not load coverage names' }, { status: 500 })
  }

  const namesById = Object.fromEntries(
    ((profiles ?? []) as ProfileNameRow[])
      .filter((row) => row.id && row.full_name)
      .map((row) => [row.id, row.full_name as string])
  )

  return NextResponse.json({ namesById }, { status: 200 })
}
