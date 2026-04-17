import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { escapeCsv, getOne } from '@/lib/csv-utils'
import { createClient } from '@/lib/supabase/server'

type ScheduleExportRow = {
  date: string
  shift_type: string
  role: string | null
  status: string | null
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

function dayOfWeekFromIsoDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', { weekday: 'long' })
}

function slugForScheduleFilename(label: string): string {
  return (
    label
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'cycle'
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const cycleId = url.searchParams.get('cycle_id')?.trim()
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'export_all_availability')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('shifts')
    .select(
      'date, shift_type, role, status, profiles!shifts_user_id_fkey(full_name), schedule_cycles!shifts_cycle_id_fkey(label, start_date, end_date)'
    )
    .eq('cycle_id', cycleId)
    .order('date', { ascending: true })

  if (error) {
    console.error('Failed to export schedule shifts:', error)
    return NextResponse.json({ error: 'Could not export schedule' }, { status: 500 })
  }

  const rows = (data ?? []) as ScheduleExportRow[]

  let cycleLabel = ''
  if (rows.length > 0) {
    cycleLabel = getOne(rows[0].schedule_cycles)?.label ?? ''
  }
  if (!cycleLabel) {
    const { data: cycleRow } = await supabase
      .from('schedule_cycles')
      .select('label')
      .eq('id', cycleId)
      .maybeSingle()
    cycleLabel = cycleRow?.label ?? cycleId
  }

  const header = [
    'date',
    'day_of_week',
    'therapist_name',
    'shift_type',
    'role',
    'status',
    'cycle_label',
  ]

  const lines = rows.map((row) => {
    const cycle = getOne(row.schedule_cycles)
    const prof = getOne(row.profiles)
    const values = [
      row.date,
      dayOfWeekFromIsoDate(row.date),
      prof?.full_name ?? '',
      row.shift_type,
      row.role ?? '',
      row.status ?? '',
      cycle?.label ?? cycleLabel,
    ]
    return values.map((value) => escapeCsv(String(value))).join(',')
  })

  const csv = [header.join(','), ...lines].join('\n')
  const filename = `schedule-${slugForScheduleFilename(cycleLabel)}-export.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
