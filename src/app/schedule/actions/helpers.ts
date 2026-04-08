// Private helpers shared across schedule action modules. No 'use server' — not server actions.

import { parseRole } from '@/lib/auth/roles'
import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'
import {
  MAX_WORK_DAYS_PER_WEEK,
  MIN_SHIFT_COVERAGE_PER_DAY,
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { buildDateRange, coverageSlotKey, countsTowardWeeklyLimit } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'

export async function getRoleForUser(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return parseRole(profile?.role)
}

export type TherapistWeeklyLimitProfile = {
  max_work_days_per_week: number | null
  employment_type: string | null
}

export function getWeeklyLimitFromProfile(
  profile: TherapistWeeklyLimitProfile | null | undefined
): number {
  const employmentDefault = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, employmentDefault)
}

export async function getTherapistWeeklyLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  therapistId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('max_work_days_per_week, employment_type')
    .eq('id', therapistId)
    .maybeSingle()

  if (error) return MAX_WORK_DAYS_PER_WEEK

  return getWeeklyLimitFromProfile((data ?? null) as TherapistWeeklyLimitProfile | null)
}

export async function countWorkingScheduledForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotRows: Array<{ id: string }>
): Promise<number> {
  const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    slotRows.map((row) => row.id)
  )
  return slotRows.filter((row) => !activeOperationalCodesByShiftId.has(row.id)).length
}

export function buildCoverageUrl(
  cycleId?: string,
  params?: Record<string, string | undefined>
): string {
  const search = new URLSearchParams()
  if (cycleId) {
    search.set('cycle', cycleId)
  }
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
  }
  const query = search.toString()
  return query.length > 0 ? `/coverage?${query}` : '/coverage'
}

export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function getPanelParam(formData: FormData): 'setup' | 'new-cycle' | 'add-shift' | undefined {
  const panel = String(formData.get('panel') ?? '').trim()
  if (panel === 'setup') return panel
  if (panel === 'new-cycle' || panel === 'add-shift') return panel
  return undefined
}

export type PreliminaryShiftLookupRow = {
  id: string
  cycle_id: string | null
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

export type PreliminaryShiftInsertRow = {
  cycle_id: string
  user_id: null
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
}

export function buildPreliminaryOpenShiftRows(params: {
  cycleId: string
  cycleStartDate: string
  cycleEndDate: string
  shifts: PreliminaryShiftLookupRow[]
}): PreliminaryShiftInsertRow[] {
  const coverageBySlot = new Map<string, number>()

  for (const shift of params.shifts) {
    if (!countsTowardWeeklyLimit(shift.status)) continue
    const key = coverageSlotKey(shift.date, shift.shift_type)
    coverageBySlot.set(key, (coverageBySlot.get(key) ?? 0) + 1)
  }

  const placeholders: PreliminaryShiftInsertRow[] = []
  for (const date of buildDateRange(params.cycleStartDate, params.cycleEndDate)) {
    for (const shiftType of ['day', 'night'] as const) {
      const slotKey = coverageSlotKey(date, shiftType)
      const existingCoverage = coverageBySlot.get(slotKey) ?? 0
      const missingCoverage = Math.max(0, MIN_SHIFT_COVERAGE_PER_DAY - existingCoverage)

      for (let index = 0; index < missingCoverage; index += 1) {
        placeholders.push({
          cycle_id: params.cycleId,
          user_id: null,
          date,
          shift_type: shiftType,
          status: 'scheduled',
          role: 'staff',
        })
      }
    }
  }

  return placeholders
}
