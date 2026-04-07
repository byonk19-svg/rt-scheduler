'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { SupabaseClient } from '@supabase/supabase-js'

import { can } from '@/lib/auth/can'
import {
  buildPlannerSavePayload,
  getPlannerDateValidationError,
  toOverrideType,
} from '@/lib/availability-planner'
import { createClient } from '@/lib/supabase/server'

async function upsertTherapistSubmissionAfterOfficialSave(
  supabase: SupabaseClient,
  therapistId: string,
  cycleId: string
) {
  const now = new Date().toISOString()
  const { data: existing, error: loadError } = await supabase
    .from('therapist_availability_submissions')
    .select('submitted_at')
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)
    .maybeSingle()

  if (loadError) {
    console.error('Failed to load therapist availability submission:', loadError)
    return
  }

  if (!existing) {
    const { error } = await supabase.from('therapist_availability_submissions').insert({
      therapist_id: therapistId,
      schedule_cycle_id: cycleId,
      submitted_at: now,
      last_edited_at: now,
    })
    if (error) {
      console.error('Failed to insert therapist availability submission:', error)
    }
    return
  }

  const { error } = await supabase
    .from('therapist_availability_submissions')
    .update({ last_edited_at: now })
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)

  if (error) {
    console.error('Failed to update therapist availability submission:', error)
  }
}

async function touchTherapistSubmissionLastEditedIfExists(
  supabase: SupabaseClient,
  therapistId: string,
  cycleId: string
) {
  if (!cycleId) return
  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('therapist_availability_submissions')
    .select('id')
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)
    .maybeSingle()

  if (!existing) return

  const { error } = await supabase
    .from('therapist_availability_submissions')
    .update({ last_edited_at: now })
    .eq('therapist_id', therapistId)
    .eq('schedule_cycle_id', cycleId)

  if (error) {
    console.error('Failed to touch therapist availability submission last_edited_at:', error)
  }
}

function revalidateTherapistAvailabilitySurfaces() {
  revalidatePath('/availability')
  revalidatePath('/therapist/availability')
  revalidatePath('/dashboard/staff')
}

type AvailabilityOverrideType = 'force_off' | 'force_on'
type AvailabilityShiftType = 'day' | 'night' | 'both'

function getReturnPath(value: string | null): '/availability' | '/therapist/availability' {
  return value === '/therapist/availability' ? '/therapist/availability' : '/availability'
}

function buildAvailabilityUrl(
  params?: Record<string, string | undefined>,
  returnPath: '/availability' | '/therapist/availability' = '/availability'
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      search.set(key, value)
    }
  }
  const query = search.toString()
  return query.length > 0 ? `${returnPath}?${query}` : returnPath
}

async function getAuthenticatedUserWithRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    role: profile?.role ?? null,
  }
}

export async function submitAvailabilityEntryAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const returnPath = getReturnPath(String(formData.get('return_to') ?? '').trim() || null)

  const date = String(formData.get('date') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? 'both').trim() as AvailabilityShiftType
  const overrideType = String(
    formData.get('override_type') ?? ''
  ).trim() as AvailabilityOverrideType
  const note = String(formData.get('note') ?? '').trim()

  if (
    !date ||
    !cycleId ||
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') ||
    (overrideType !== 'force_off' && overrideType !== 'force_on')
  ) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed' }, returnPath))
  }

  const { error } = await supabase.from('availability_overrides').upsert(
    {
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: shiftType,
      override_type: overrideType,
      note: note || null,
      created_by: user.id,
      source: 'therapist',
    },
    { onConflict: 'cycle_id,therapist_id,date,shift_type' }
  )

  if (error) {
    console.error('Failed to save availability override:', error)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  await upsertTherapistSubmissionAfterOfficialSave(supabase, user.id, cycleId)

  revalidateTherapistAvailabilitySurfaces()
  redirect(buildAvailabilityUrl({ success: 'entry_submitted', cycle: cycleId }, returnPath))
}

export async function submitTherapistAvailabilityGridAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const returnPath = getReturnPath(String(formData.get('return_to') ?? '').trim() || null)

  const workflowRaw = String(formData.get('workflow') ?? 'submit')
    .trim()
    .toLowerCase()
  const workflow: 'draft' | 'submit' = workflowRaw === 'draft' ? 'draft' : 'submit'

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const canWorkDates = formData
    .getAll('can_work_dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
  const cannotWorkDates = formData
    .getAll('cannot_work_dates')
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
  const rawNotesJson = String(formData.get('notes_json') ?? '').trim()

  if (!cycleId) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed' }, returnPath))
  }

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (!cycle) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const isValidCycleDate = (date: string) => date >= cycle.start_date && date <= cycle.end_date

  const uniqueCanWorkDates = Array.from(new Set(canWorkDates.filter(isValidCycleDate)))
  const uniqueCannotWorkDates = Array.from(new Set(cannotWorkDates.filter(isValidCycleDate)))
  const cannotWorkSet = new Set(uniqueCannotWorkDates)
  const resolvedCanWorkDates = uniqueCanWorkDates.filter((date) => !cannotWorkSet.has(date))
  let notesByDate: Record<string, string> = {}
  if (rawNotesJson) {
    try {
      const parsed = JSON.parse(rawNotesJson) as Record<string, unknown>
      notesByDate = Object.fromEntries(
        Object.entries(parsed)
          .map(([date, note]) => [date, String(note ?? '').trim()])
          .filter(([date, note]) => isValidCycleDate(date) && note.length > 0)
      )
    } catch (error) {
      console.error('Failed to parse therapist availability notes payload:', error)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('availability_overrides')
    .select('id, date')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', user.id)
    .eq('shift_type', 'both')
    .eq('source', 'therapist')

  if (existingRowsError) {
    console.error('Failed to load existing therapist availability overrides:', existingRowsError)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const desiredDates = new Set([...resolvedCanWorkDates, ...uniqueCannotWorkDates])
  const rowsToDelete = (existingRows ?? [])
    .filter((row) => !desiredDates.has(String(row.date)))
    .map((row) => String(row.id))

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_overrides')
      .delete()
      .in('id', rowsToDelete)

    if (deleteError) {
      console.error('Failed to remove therapist availability overrides:', deleteError)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  const payload = [
    ...resolvedCanWorkDates.map((date) => ({
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: 'both' as const,
      override_type: 'force_on' as const,
      note: notesByDate[date] ?? null,
      created_by: user.id,
      source: 'therapist' as const,
    })),
    ...uniqueCannotWorkDates.map((date) => ({
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: 'both' as const,
      override_type: 'force_off' as const,
      note: notesByDate[date] ?? null,
      created_by: user.id,
      source: 'therapist' as const,
    })),
  ]

  if (payload.length > 0) {
    const { error: upsertError } = await supabase
      .from('availability_overrides')
      .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (upsertError) {
      console.error('Failed to save therapist availability grid:', upsertError)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  if (workflow === 'submit') {
    await upsertTherapistSubmissionAfterOfficialSave(supabase, user.id, cycleId)
  }

  revalidateTherapistAvailabilitySurfaces()
  const successParam = workflow === 'draft' ? 'draft_saved' : 'entry_submitted'
  redirect(buildAvailabilityUrl({ success: successParam, cycle: cycleId }, returnPath))
}

export async function deleteAvailabilityEntryAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const returnPath = getReturnPath(String(formData.get('return_to') ?? '').trim() || null)

  const entryId = String(formData.get('entry_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!entryId) {
    redirect(returnPath)
  }

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', entryId)
    .eq('therapist_id', user.id)

  if (error) {
    console.error('Failed to delete availability override:', error)
    redirect(
      buildAvailabilityUrl({ error: 'delete_failed', cycle: cycleId || undefined }, returnPath)
    )
  }

  if (cycleId) {
    await touchTherapistSubmissionLastEditedIfExists(supabase, user.id, cycleId)
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(
    buildAvailabilityUrl({ success: 'entry_deleted', cycle: cycleId || undefined }, returnPath)
  )
}

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
