'use server'

import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { recordSubmission, touchSubmission } from '@/lib/availability/submission-lifecycle'
import { getPlannerDateValidationError } from '@/lib/availability-planner'
import { buildManagerOverrideInput, intentForTherapistOverride } from '@/lib/employee-directory'
import {
  buildAvailabilityUrl,
  getAuthenticatedUserWithRole,
  revalidateTherapistAvailabilitySurfaces,
} from './_actions/shared'

export async function saveManagerAvailabilityRequestsAction(formData: FormData) {
  const { supabase, user, role } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const mode = String(formData.get('mode') ?? '').trim()
  const dates = formData
    .getAll('dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (mode !== 'need_off' && mode !== 'request_to_work') {
    redirect(
      buildAvailabilityUrl({
        cycle: cycleId || undefined,
        therapist: therapistId || undefined,
        error: 'manager_request_save_failed',
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

  await recordSubmission(supabase, therapistId, cycleId)
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

  await touchSubmission(supabase, therapistId, cycleId)
  revalidateTherapistAvailabilitySurfaces()
  redirect(
    buildAvailabilityUrl({
      cycle: cycleId || undefined,
      therapist: therapistId || undefined,
      success: 'manager_request_deleted',
    })
  )
}
