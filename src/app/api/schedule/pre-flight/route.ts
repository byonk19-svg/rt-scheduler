import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { loadDraftInputsForCycle, toDraftInputSupabaseClient } from '@/lib/coverage/draft-inputs'
import { runPreFlight, summarizePreFlight } from '@/lib/coverage/pre-flight'
import { createClient } from '@/lib/supabase/server'

type CycleRow = {
  id: string
  start_date: string
  end_date: string
  published: boolean
  site_id: string | null
}

type ActorProfileRow = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
  site_id: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()
  const actorProfile = (profile ?? null) as ActorProfileRow | null

  if (
    !can(parseRole(actorProfile?.role), 'manage_schedule', {
      isActive: actorProfile?.is_active !== false,
      archivedAt: actorProfile?.archived_at ?? null,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!actorProfile?.site_id) {
    return NextResponse.json({ error: 'Actor site is missing.' }, { status: 403 })
  }

  const body = (await request.json()) as { cycleId?: string }
  const cycleId = String(body.cycleId ?? '').trim()
  if (!cycleId) {
    return NextResponse.json({ error: 'cycleId is required' }, { status: 400 })
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, published, site_id')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const cycleRow = cycle as CycleRow
  if (cycleRow.site_id !== actorProfile.site_id) {
    return NextResponse.json({ error: 'Cycle is outside your site scope.' }, { status: 403 })
  }

  const draftInputs = await loadDraftInputsForCycle(toDraftInputSupabaseClient(supabase), {
    cycle: {
      id: cycleId,
      start_date: cycleRow.start_date,
      end_date: cycleRow.end_date,
      site_id: cycleRow.site_id,
    },
    therapistScope: 'active-non-fmla',
  })

  if (draftInputs.error) {
    return NextResponse.json({ error: 'Could not load pre-flight data' }, { status: 500 })
  }

  const result = runPreFlight(draftInputs.data)
  const summary = summarizePreFlight(result)

  return NextResponse.json({
    unfilledSlots: summary.unfilledSlots,
    missingLeadSlots: summary.missingLeadSlots,
    forcedMustWorkMisses: summary.forcedMustWorkMisses,
    details: summary.details.map((detail) => ({
      date: detail.date,
      shiftType: detail.shiftType,
    })),
  })
}
