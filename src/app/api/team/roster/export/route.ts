import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { escapeCsv } from '@/lib/csv-utils'
import { createClient } from '@/lib/supabase/server'

type RosterExportRow = {
  full_name: string | null
  role: string
  shift_type: string | null
  employment_type: string | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
  phone_number: string | null
  max_work_days_per_week: number | null
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

  if (!can(parseRole(profile?.role), 'export_all_availability')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'full_name, role, shift_type, employment_type, is_lead_eligible, is_active, on_fmla, phone_number, max_work_days_per_week'
    )
    .not('role', 'is', null)
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Failed to export team roster:', error)
    return NextResponse.json({ error: 'Could not export team roster' }, { status: 500 })
  }

  const rows = (data ?? []) as RosterExportRow[]

  const header = [
    'full_name',
    'role',
    'shift_type',
    'employment_type',
    'is_lead_eligible',
    'is_active',
    'on_fmla',
    'phone_number',
    'max_work_days_per_week',
  ]

  const lines = rows.map((row) => {
    const values = [
      row.full_name ?? '',
      row.role,
      row.shift_type ?? '',
      row.employment_type ?? '',
      row.is_lead_eligible === null ? '' : String(row.is_lead_eligible),
      row.is_active === null ? '' : String(row.is_active),
      row.on_fmla === null ? '' : String(row.on_fmla),
      row.phone_number ?? '',
      row.max_work_days_per_week === null ? '' : String(row.max_work_days_per_week),
    ]
    return values.map((value) => escapeCsv(String(value))).join(',')
  })

  const csv = [header.join(','), ...lines].join('\n')
  const filename = 'team-roster-export.csv'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
