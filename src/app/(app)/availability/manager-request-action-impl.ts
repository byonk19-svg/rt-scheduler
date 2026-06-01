'use server'

import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { findBlockingAvailabilityOverwrite } from '@/lib/availability-overwrite-guard'
import { getPlannerDateValidationError } from '@/lib/availability-planner'
import { buildManagerOverrideInput, intentForTherapistOverride } from '@/lib/employee-directory'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildAvailabilityUrl,
  getAuthenticatedUserWithRole,
  revalidateTherapistAvailabilitySurfaces,
} from './_actions/shared'

type ManagerAvailabilityRequestTarget = {
  cycle: {
    start_date: string
    end_date: string
    site_id: string | null
  }
}

async function loadManagerAvailabilityRequestTarget(
  admin: ReturnType<typeof createAdminClient>,
  managerId: string,
  therapistId: string,
  cycleId: string
): Promise<ManagerAvailabilityRequestTarget | null> {
  const { data: manager } = await admin
    .from('profiles')
    .select('site_id, is_active, archived_at')
    .eq('id', managerId)
    .maybeSingle()
  const { data: therapist } = await admin
    .from('profiles')
    .select('site_id, is_active, archived_at')
    .eq('id', therapistId)
    .maybeSingle()
  const { data: cycle } = await admin
    .from('schedule_cycles')
    .select('start_date, end_date, site_id')
    .eq('id', cycleId)
    .maybeSingle()

  if (
    !manager?.site_id ||
    manager.is_active === false ||
    manager.archived_at ||
    !therapist?.site_id ||
    therapist.is_active === false ||
    therapist.archived_at ||
    !cycle ||
    cycle.site_id !== manager.site_id ||
    therapist.site_id !== manager.site_id
  ) {
    return null
  }

  return { cycle }
}

export async function saveManagerAvailabilityRequestsAction(formData: FormData) {
  const { supabase, user, role, permissionContext } = await getAuthenticatedUserWithRole()
  const admin = createAdminClient()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const mode = String(formData.get('mode') ?? '').trim()
  const dates = formData
    .getAll('dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)

  if (mode !== 'need_off' && mode !== 'request_to_work') {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'manager_request_save_failed',
      })
    )
  }

  const target = await loadManagerAvailabilityRequestTarget(admin, user.id, therapistId, cycleId)
  const cycle = target?.cycle ?? null
  const validationError = getPlannerDateValidationError({
    cycle: cycle ? { start_date: cycle.start_date, end_date: cycle.end_date } : null,
    therapistId,
    dates,
    allowEmpty: true,
  })

  if (validationError) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'manager_request_save_failed',
      })
    )
  }

  const overrideType = mode === 'need_off' ? 'force_off' : 'force_on'
  const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b))
  const therapistIntent = intentForTherapistOverride(overrideType)
  const { data: existingRows, error: existingRowsError } = await supabase
    .from('availability_overrides')
    .select('id, date, note, override_type')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', therapistId)
    .eq('shift_type', 'both')
    .eq('source', 'manager')
    .in('intent', ['therapist_need_off', 'therapist_wants_work'])

  if (existingRowsError) {
    console.error('Failed to load existing therapist availability request rows:', existingRowsError)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'manager_request_save_failed',
      })
    )
  }

  const notesByDate = new Map(
    (existingRows ?? [])
      .filter((row) => uniqueDates.includes(String(row.date)))
      .map((row) => [String(row.date), row.note?.trim() || null])
  )

  const payload = uniqueDates.map((date) =>
    buildManagerOverrideInput({
      cycleId,
      therapistId,
      date,
      shiftType: 'both',
      overrideType,
      note: notesByDate.get(date) ?? null,
      managerId: user.id,
      intent: therapistIntent,
    })
  )

  const keepDates = new Set(uniqueDates)
  const rowsToDelete = (existingRows ?? [])
    .filter((row) => String(row.override_type) === overrideType && !keepDates.has(String(row.date)))
    .map((row) => String(row.id))

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_overrides')
      .delete()
      .in('id', rowsToDelete)

    if (deleteError) {
      console.error('Failed to replace manager availability requests:', deleteError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId || undefined,
          therapist: therapistId || undefined,
          error: 'manager_request_save_failed',
        })
      )
    }
  }

  if (payload.length > 0) {
    const { data: conflictingRows, error: conflictsError } = await supabase
      .from('availability_overrides')
      .select('date, shift_type, source')
      .eq('cycle_id', cycleId)
      .eq('therapist_id', therapistId)
      .eq('shift_type', 'both')
      .in('date', uniqueDates)

    if (conflictsError) {
      console.error('Failed to check manager request overwrite conflicts:', conflictsError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId || undefined,
          therapist: therapistId || undefined,
          error: 'manager_request_save_failed',
        })
      )
    }

    const blockingConflict = findBlockingAvailabilityOverwrite(
      conflictingRows ?? [],
      payload.map((row) => ({
        date: row.date,
        shift_type: row.shift_type,
        source: row.source,
      }))
    )
    if (blockingConflict) {
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId || undefined,
          therapist: therapistId || undefined,
          error: 'manager_request_availability_conflict',
        })
      )
    }

    const { error: upsertError } = await supabase
      .from('availability_overrides')
      .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (upsertError) {
      console.error('Failed to save manager availability requests:', upsertError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId || undefined,
          therapist: therapistId || undefined,
          error: 'manager_request_save_failed',
        })
      )
    }
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId || undefined,
      therapist: therapistId || undefined,
      success: 'manager_request_saved',
    })
  )
}

export async function deleteManagerAvailabilityRequestAction(formData: FormData) {
  const { supabase, user, role, permissionContext } = await getAuthenticatedUserWithRole()
  const admin = createAdminClient()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const overrideId = String(formData.get('override_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()

  if (!overrideId) {
    redirect(
      buildAvailabilityUrl({ cycle: cycleId || undefined, therapist: therapistId || undefined })
    )
  }

  const target = await loadManagerAvailabilityRequestTarget(admin, user.id, therapistId, cycleId)
  if (!target) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'manager_request_delete_failed',
      })
    )
  }

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', overrideId)
    .eq('source', 'manager')
    .in('intent', ['therapist_need_off', 'therapist_wants_work'])

  if (error) {
    console.error('Failed to delete therapist availability request from manager editor:', error)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'manager_request_delete_failed',
      })
    )
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId || undefined,
      therapist: therapistId || undefined,
      success: 'manager_request_deleted',
    })
  )
}
