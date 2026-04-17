import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { escapeCsv, getOne } from '@/lib/csv-utils'
import { createClient } from '@/lib/supabase/server'

type AvailabilityExportRow = {
  cycle_id: string
  date: string
  override_type: 'force_off' | 'force_on'
  shift_type: 'day' | 'night' | 'both'
  note: string | null
  source: 'therapist' | 'manager' | null
  created_at: string
  therapist_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

type AvailabilitySubmissionExportRow = {
  therapist_id: string
  schedule_cycle_id: string
  submitted_at: string
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

  const isManager = can(parseRole(profile?.role), 'export_all_availability')

  let query = supabase
    .from('availability_overrides')
    .select(
      'cycle_id, date, override_type, shift_type, note, source, created_at, therapist_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  if (!isManager) {
    query = query.eq('therapist_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to export availability entries:', error)
    return NextResponse.json({ error: 'Could not export availability entries' }, { status: 500 })
  }

  const rows = (data ?? []) as AvailabilityExportRow[]
  const cycleIds = Array.from(new Set(rows.map((row) => row.cycle_id)))
  const submissionMap = new Map<string, string>()

  if (cycleIds.length > 0) {
    let submissionsQuery = supabase
      .from('therapist_availability_submissions')
      .select('therapist_id, schedule_cycle_id, submitted_at')
      .in('schedule_cycle_id', cycleIds)

    if (!isManager) {
      submissionsQuery = submissionsQuery.eq('therapist_id', user.id)
    }

    const { data: submissionRows, error: submissionError } = await submissionsQuery

    if (submissionError) {
      console.error('Failed to export therapist availability submissions:', submissionError)
      return NextResponse.json({ error: 'Could not export availability entries' }, { status: 500 })
    }

    for (const row of (submissionRows ?? []) as AvailabilitySubmissionExportRow[]) {
      submissionMap.set(`${row.therapist_id}:${row.schedule_cycle_id}`, row.submitted_at)
    }
  }

  const header = [
    'date',
    'cycle_label',
    'cycle_start',
    'cycle_end',
    'entry_type',
    'shift_scope',
    'source',
    'reason',
    'therapist',
    'submitted_at',
  ]

  const lines = rows.map((row) => {
    const cycle = getOne(row.schedule_cycles)
    const requester = getOne(row.profiles)
    const submittedAt = submissionMap.get(`${row.therapist_id}:${row.cycle_id}`) ?? ''

    const values = [
      row.date,
      cycle?.label ?? '',
      cycle?.start_date ?? '',
      cycle?.end_date ?? '',
      row.override_type,
      row.shift_type,
      row.source ?? 'therapist',
      row.note ?? '',
      requester?.full_name ?? '',
      submittedAt,
    ]

    return values.map((value) => escapeCsv(String(value))).join(',')
  })

  const csv = [header.join(','), ...lines].join('\n')
  const filename = isManager ? 'availability-overrides-all.csv' : 'availability-overrides-mine.csv'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
