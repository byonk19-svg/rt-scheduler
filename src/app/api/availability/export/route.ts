import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type AvailabilityExportRow = {
  date: string
  reason: string | null
  created_at: string
  user_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

export async function GET() {
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

  const isManager = profile?.role === 'manager'

  let query = supabase
    .from('availability_requests')
    .select(
      'date, reason, created_at, user_id, profiles(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  if (!isManager) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to export availability requests:', error)
    return NextResponse.json({ error: 'Could not export requests' }, { status: 500 })
  }

  const rows = (data ?? []) as AvailabilityExportRow[]
  const header = [
    'date',
    'cycle_label',
    'cycle_start',
    'cycle_end',
    'reason',
    'requested_by',
    'submitted_at',
  ]

  const lines = rows.map((row) => {
    const cycle = getOne(row.schedule_cycles)
    const requester = getOne(row.profiles)
    const submittedAt = new Date(row.created_at).toISOString()

    const values = [
      row.date,
      cycle?.label ?? '',
      cycle?.start_date ?? '',
      cycle?.end_date ?? '',
      row.reason ?? '',
      requester?.full_name ?? '',
      submittedAt,
    ]

    return values.map((value) => escapeCsv(String(value))).join(',')
  })

  const csv = [header.join(','), ...lines].join('\n')
  const filename = isManager ? 'availability-requests-all.csv' : 'availability-requests-mine.csv'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
