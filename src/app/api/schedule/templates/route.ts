import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { serializeCycleShifts } from '@/lib/cycle-template'
import { createClient } from '@/lib/supabase/server'

type CycleTemplateRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  shift_data: Array<{ day_of_cycle: number }> | null
}

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase,
      user: null,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_schedule', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      supabase,
      user: null,
    }
  }

  return { error: null, supabase, user }
}

export async function GET() {
  const { error, supabase } = await requireManager()
  if (error) return error

  const { data, error: templatesError } = await supabase
    .from('cycle_templates')
    .select('id, name, description, created_at, shift_data')
    .order('created_at', { ascending: false })

  if (templatesError) {
    return NextResponse.json({ error: templatesError.message }, { status: 500 })
  }

  const rows = ((data ?? []) as CycleTemplateRow[]).map((row) => {
    const shiftData = Array.isArray(row.shift_data) ? row.shift_data : []
    const uniqueDays = new Set(shiftData.map((item) => item.day_of_cycle))
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      shift_count: shiftData.length,
      day_count: uniqueDays.size,
    }
  })

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const { error, supabase, user } = await requireManager()
  if (error || !user) return error

  const body = (await request.json()) as {
    cycleId?: string
    name?: string
    description?: string
  }
  const cycleId = String(body.cycleId ?? '').trim()
  const name = String(body.name ?? '').trim()
  const description = String(body.description ?? '').trim() || null

  if (!cycleId || !name) {
    return NextResponse.json({ error: 'cycleId and name are required' }, { status: 400 })
  }

  const [{ data: cycle, error: cycleError }, { data: shifts, error: shiftsError }] =
    await Promise.all([
      supabase.from('schedule_cycles').select('id, start_date').eq('id', cycleId).maybeSingle(),
      supabase
        .from('shifts')
        .select('user_id, date, shift_type, role')
        .eq('cycle_id', cycleId)
        .not('user_id', 'is', null),
    ])

  if (cycleError || !cycle || shiftsError) {
    return NextResponse.json({ error: 'Could not load cycle shifts' }, { status: 500 })
  }

  const shiftData = serializeCycleShifts(
    (shifts ?? []) as Array<{
      user_id: string
      date: string
      shift_type: 'day' | 'night'
      role: 'staff' | 'lead'
    }>,
    cycle.start_date
  )

  const { data: inserted, error: insertError } = await supabase
    .from('cycle_templates')
    .insert({
      name,
      description,
      created_by: user.id,
      shift_data: shiftData,
    })
    .select('id')
    .maybeSingle()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ id: inserted?.id ?? null, shift_count: shiftData.length })
}
