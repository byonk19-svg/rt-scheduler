// Private helpers shared across schedule action modules. No 'use server' — not server actions.

import { parseRole } from '@/lib/auth/roles'
import {
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import { loadDraftInputsForCycle, toDraftInputSupabaseClient } from '@/lib/coverage/draft-inputs'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import {
  loadIneligibleAssignmentReadinessInputsForCycle,
  type ReadinessAssignmentConflictClient,
} from '@/lib/coverage/readiness-assignment-conflicts'
import {
  buildReadinessIssues,
  getBlockingReadinessIssues,
  type ReadinessIssue,
} from '@/lib/coverage/readiness-issues'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { createClient } from '@/lib/supabase/server'

export async function getRoleForUser(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.is_active === false || profile?.archived_at) return null

  return parseRole(profile?.role)
}

type TherapistWeeklyLimitProfile = {
  max_work_days_per_week: number | null
  employment_type: string | null
}

export function getWeeklyLimitFromProfile(
  profile: TherapistWeeklyLimitProfile | null | undefined
): number {
  const employmentDefault = getDefaultWeeklyLimitForEmploymentType(profile?.employment_type)
  return sanitizeWeeklyLimit(profile?.max_work_days_per_week, employmentDefault)
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

export function buildScheduleActionUrl(
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
  return query.length > 0 ? `/schedule?${query}` : '/schedule'
}

export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type ScheduleReadinessCycle = {
  id: string
  start_date: string
  end_date: string
  site_id?: string | null
}

export async function loadBlockingReadinessIssuesForCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycle: ScheduleReadinessCycle
): Promise<{ issues: ReadinessIssue[]; error: unknown | null }> {
  const draftInputs = await loadDraftInputsForCycle(toDraftInputSupabaseClient(supabase), {
    cycle,
    therapistScope: 'active-non-fmla',
  })

  if (draftInputs.error) {
    return { issues: [], error: draftInputs.error }
  }

  const ineligibleAssignments = await loadIneligibleAssignmentReadinessInputsForCycle(
    supabase as unknown as ReadinessAssignmentConflictClient,
    cycle.id
  )

  if (ineligibleAssignments.error) {
    return { issues: [], error: ineligibleAssignments.error }
  }

  const readinessIssues = buildReadinessIssues(generateDraftForCycle(draftInputs.data), {
    ineligibleAssignments: ineligibleAssignments.data,
  })
  return {
    issues: getBlockingReadinessIssues(readinessIssues),
    error: null,
  }
}

export function getPanelParam(formData: FormData): 'setup' | 'new-cycle' | 'add-shift' | undefined {
  const panel = String(formData.get('panel') ?? '').trim()
  if (panel === 'setup') return panel
  if (panel === 'new-cycle' || panel === 'add-shift') return panel
  return undefined
}
