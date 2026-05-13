'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import {
  buildPlannerSavePayload,
  getPlannerDateValidationError,
  toOverrideType,
} from '@/lib/availability-planner'
import {
  buildAvailabilityUrl,
  getAuthenticatedUserWithRole,
  type AvailabilityShiftType,
} from './_actions/shared'

export async function saveManagerPlannerDatesAction(formData: FormData) {
  const { supabase, user, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? 'both').trim() as AvailabilityShiftType
  const mode = String(formData.get('mode') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  const dates = formData
    .getAll('dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') ||
    (mode !== 'will_work' && mode !== 'cannot_work')
  ) {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'planner_save_failed',
      })
    )
  }

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
        error: 'planner_save_failed',
      })
    )
  }

  const overrideType = toOverrideType(mode)
  const { data: existingRows, error: existingRowsError } = await supabase
    .from('availability_overrides')
    .select('id, date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', therapistId)
    .eq('shift_type', shiftType)
    .eq('override_type', overrideType)
    .eq('source', 'manager')

  if (existingRowsError) {
    console.error('Failed to load existing manager planner overrides:', existingRowsError)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId,
        therapist: therapistId,
        error: 'planner_save_failed',
      })
    )
  }

  const payload = buildPlannerSavePayload({
    cycleId,
    therapistId,
    shiftType,
    mode,
    dates,
    note,
    managerId: user.id,
  })

  const keepDates = new Set(payload.map((row) => row.date))
  const rowsToDelete = (existingRows ?? [])
    .filter((row) => !keepDates.has(String(row.date)))
    .map((row) => String(row.id))

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_overrides')
      .delete()
      .in('id', rowsToDelete)

    if (deleteError) {
      console.error('Failed to replace manager planner overrides:', deleteError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId,
          therapist: therapistId,
          error: 'planner_save_failed',
        })
      )
    }
  }

  if (payload.length > 0) {
    const { error: upsertError } = await supabase
      .from('availability_overrides')
      .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (upsertError) {
      console.error('Failed to save manager planner overrides:', upsertError)
      redirect(
        buildAvailabilityUrl({
          cycle: cycleId,
          therapist: therapistId,
          error: 'planner_save_failed',
        })
      )
    }
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId,
      therapist: therapistId,
      success: 'planner_saved',
    })
  )
}

export async function deleteManagerPlannerDateAction(formData: FormData) {
  const { supabase, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
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

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', overrideId)
    .eq('source', 'manager')

  if (error) {
    console.error('Failed to delete manager planner override:', error)
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'planner_delete_failed',
      })
    )
  }

  revalidatePath('/availability')
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId || undefined,
      therapist: therapistId || undefined,
      success: 'planner_deleted',
    })
  )
}
