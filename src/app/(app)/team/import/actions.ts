'use server'

import { redirect } from 'next/navigation'

import { normalizeRosterFullName } from '@/lib/employee-roster-bulk'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'

type ManagedRole = 'manager' | 'therapist' | 'lead'
type ShiftType = 'day' | 'night'
type EmploymentType = 'full_time' | 'part_time' | 'prn'

type ImportRow = {
  full_name: string
  shift_type?: ShiftType
  role?: ManagedRole
  employment_type?: EmploymentType
  phone_number?: string
  max_work_days_per_week?: string
}

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_directory', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard/staff')
  }

  return { supabase, userId: user.id }
}

export async function bulkImportRosterAction(formData: FormData) {
  const { supabase, userId } = await requireManager()
  const rowsJson = String(formData.get('rows_json') ?? '[]')

  let rows: ImportRow[]
  try {
    rows = JSON.parse(rowsJson) as ImportRow[]
  } catch {
    redirect('/team?tab=roster&error=import_failed')
  }

  const payload = rows.map((row) => ({
    full_name: row.full_name.trim(),
    normalized_full_name: normalizeRosterFullName(row.full_name),
    role: row.role ?? 'therapist',
    shift_type: row.shift_type ?? 'day',
    employment_type: row.employment_type ?? 'full_time',
    phone_number: row.phone_number?.trim() || null,
    max_work_days_per_week: (() => {
      const parsed = Number(row.max_work_days_per_week ?? 3)
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 7 ? parsed : 3
    })(),
    is_lead_eligible: row.role === 'lead',
    is_active: true,
    updated_by: userId,
    created_by: userId,
  }))

  const { error } = await supabase.from('employee_roster').upsert(payload, {
    onConflict: 'normalized_full_name',
  })

  if (error) {
    redirect('/team?tab=roster&error=import_failed')
  }

  redirect(`/team?tab=roster&success=imported&count=${payload.length}`)
}
