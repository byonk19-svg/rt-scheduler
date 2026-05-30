'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { shiftOverridesToCycle } from '@/lib/copy-cycle-availability'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildAvailabilityUrl,
  getAuthenticatedUserWithRole,
  type AvailabilityOverrideType,
  type AvailabilityShiftType,
} from './_actions/shared'
import { loadManagerAvailabilityPlannerTarget } from './manager-planner-target'

function isAvailabilityShiftType(value: unknown): value is AvailabilityShiftType {
  return value === 'day' || value === 'night' || value === 'both'
}

function isAvailabilityOverrideType(value: unknown): value is AvailabilityOverrideType {
  return value === 'force_on' || value === 'force_off'
}

export async function copyAvailabilityFromPreviousCycleAction(formData: FormData) {
  const { supabase, user, role, permissionContext } = await getAuthenticatedUserWithRole()
  const admin = createAdminClient()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()

  if (!cycleId || !therapistId) {
    redirect('/availability')
  }

  const noSourceUrl = buildAvailabilityUrl({
    error: 'copy_no_source',
    cycle: cycleId,
    therapist: therapistId,
  })

  const target = await loadManagerAvailabilityPlannerTarget({
    admin,
    managerId: user.id,
    therapistId,
    cycleId,
  })

  if (!target) {
    redirect(noSourceUrl)
  }

  const { data: sourceCycleRows } = await supabase
    .from('availability_overrides')
    .select('cycle_id, schedule_cycles(start_date, end_date, site_id)')
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')
    .neq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
    .limit(1)

  const rawSourceRow = (sourceCycleRows ?? [])[0] as
    | {
        cycle_id: string
        schedule_cycles:
          | { start_date: string; end_date: string; site_id: string | null }
          | Array<{ start_date: string; end_date: string; site_id: string | null }>
          | null
      }
    | undefined
  const sourceCycle =
    rawSourceRow == null
      ? null
      : Array.isArray(rawSourceRow.schedule_cycles)
        ? (rawSourceRow.schedule_cycles[0] ?? null)
        : rawSourceRow.schedule_cycles
  const sourceRow =
    rawSourceRow && sourceCycle
      ? {
          cycle_id: rawSourceRow.cycle_id,
          schedule_cycles: sourceCycle,
        }
      : null

  if (!sourceRow || sourceRow.schedule_cycles.site_id !== target.cycle.site_id) {
    redirect(noSourceUrl)
  }

  const { data: sourceOverrides } = await supabase
    .from('availability_overrides')
    .select('date, override_type, shift_type, note')
    .eq('cycle_id', sourceRow.cycle_id)
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')

  if (!sourceOverrides || sourceOverrides.length === 0) {
    redirect(noSourceUrl)
  }

  const { data: existingRows } = await supabase
    .from('availability_overrides')
    .select('date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', therapistId)
    .eq('source', 'manager')

  const normalizedSourceOverrides: Array<{
    date: string
    override_type: AvailabilityOverrideType
    shift_type: AvailabilityShiftType
    note: string | null
  }> = []

  for (const row of sourceOverrides) {
    const overrideType = row.override_type
    const shiftType = row.shift_type ?? 'both'

    if (!isAvailabilityOverrideType(overrideType) || !isAvailabilityShiftType(shiftType)) {
      redirect(noSourceUrl)
    }

    normalizedSourceOverrides.push({
      date: String(row.date),
      override_type: overrideType,
      shift_type: shiftType,
      note: row.note ?? null,
    })
  }

  const shifted = shiftOverridesToCycle({
    sourceOverrides: normalizedSourceOverrides.map((row) => ({
      date: String(row.date),
      override_type: row.override_type,
      shift_type: row.shift_type,
      note: row.note ?? null,
    })),
    sourceCycleStart: sourceRow.schedule_cycles.start_date,
    sourceCycleEnd: sourceRow.schedule_cycles.end_date,
    targetCycleStart: target.cycle.start_date,
    targetCycleEnd: target.cycle.end_date,
    existingTargetDates: new Set((existingRows ?? []).map((row) => String(row.date))),
  })

  if (shifted.length === 0) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'copy_nothing_new',
      })
    )
  }

  const payload = shifted.map((row) => ({
    therapist_id: therapistId,
    cycle_id: cycleId,
    date: row.date,
    shift_type: row.shift_type,
    override_type: row.override_type,
    note: row.note,
    created_by: user.id,
    source: 'manager' as const,
    intent: row.override_type === 'force_off' ? 'manager_block' : 'manager_force',
  }))

  const { error: upsertError } = await supabase
    .from('availability_overrides')
    .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (upsertError) {
    console.error('Failed to copy availability overrides:', upsertError)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'copy_failed',
      })
    )
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId,
      therapist: therapistId,
      success: 'copy_success',
      copied: String(shifted.length),
    })
  )
}
