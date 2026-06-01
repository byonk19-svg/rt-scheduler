'use server'

import { redirect } from 'next/navigation'

import { recordSubmission, touchSubmission } from '@/lib/availability/submission-lifecycle'
import { findBlockingAvailabilityOverwrite } from '@/lib/availability-overwrite-guard'
import { loadAvailabilityWindowState } from '@/lib/availability-window'
import { intentForTherapistOverride } from '@/lib/employee-directory'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildAvailabilityUrl,
  getAuthenticatedUserWithRole,
  getReturnPath,
  revalidateTherapistAvailabilitySurfaces,
  type AvailabilityOverrideType,
  type AvailabilityShiftType,
} from './_actions/shared'

type WritableTherapistCycle = {
  start_date: string
  end_date: string
  site_id: string | null
}

async function loadWritableTherapistCycle(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  cycleId: string,
  returnPath: '/availability' | '/therapist/availability'
): Promise<WritableTherapistCycle> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('site_id, is_active, archived_at')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile?.site_id || profile.is_active === false || profile.archived_at) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const { data: cycle, error: cycleError } = await admin
    .from('schedule_cycles')
    .select('start_date, end_date, site_id')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle || cycle.site_id !== profile.site_id) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  return cycle
}

export async function submitAvailabilityEntryAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const admin = createAdminClient()
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

  await loadWritableTherapistCycle(admin, user.id, cycleId, returnPath)

  const availabilityWindow = await loadAvailabilityWindowState(admin as never, cycleId)
  if (availabilityWindow.locked) {
    redirect(buildAvailabilityUrl({ error: 'submission_closed', cycle: cycleId }, returnPath))
  }

  const { data: conflictingRows, error: conflictsError } = await supabase
    .from('availability_overrides')
    .select('date, shift_type, source')
    .eq('cycle_id', cycleId)
    .eq('therapist_id', user.id)
    .eq('date', date)
    .eq('shift_type', shiftType)

  if (conflictsError) {
    console.error('Failed to check availability overwrite conflicts:', conflictsError)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  const blockingConflict = findBlockingAvailabilityOverwrite(conflictingRows ?? [], [
    { date, shift_type: shiftType, source: 'therapist' },
  ])
  if (blockingConflict) {
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
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
      intent: intentForTherapistOverride(overrideType),
    },
    { onConflict: 'cycle_id,therapist_id,date,shift_type' }
  )

  if (error) {
    console.error('Failed to save availability override:', error)
    redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
  }

  await recordSubmission(admin as never, user.id, cycleId)

  revalidateTherapistAvailabilitySurfaces()
  redirect(buildAvailabilityUrl({ success: 'entry_submitted', cycle: cycleId }, returnPath))
}

export async function submitTherapistAvailabilityGridAction(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUserWithRole()
  const admin = createAdminClient()
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

  const cycle = await loadWritableTherapistCycle(admin, user.id, cycleId, returnPath)

  const availabilityWindow = await loadAvailabilityWindowState(admin as never, cycleId)
  if (availabilityWindow.locked) {
    redirect(buildAvailabilityUrl({ error: 'submission_closed', cycle: cycleId }, returnPath))
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
      intent: intentForTherapistOverride('force_on'),
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
      intent: intentForTherapistOverride('force_off'),
    })),
  ]

  if (payload.length > 0) {
    const payloadDates = [...new Set(payload.map((row) => row.date))]
    const { data: conflictingRows, error: conflictsError } = await supabase
      .from('availability_overrides')
      .select('date, shift_type, source')
      .eq('cycle_id', cycleId)
      .eq('therapist_id', user.id)
      .eq('shift_type', 'both')
      .in('date', payloadDates)

    if (conflictsError) {
      console.error('Failed to check therapist availability overwrite conflicts:', conflictsError)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
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
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }

    const { error: upsertError } = await supabase
      .from('availability_overrides')
      .upsert(payload, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

    if (upsertError) {
      console.error('Failed to save therapist availability grid:', upsertError)
      redirect(buildAvailabilityUrl({ error: 'submit_failed', cycle: cycleId }, returnPath))
    }
  }

  if (workflow === 'submit') {
    await recordSubmission(admin as never, user.id, cycleId)
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

  if (cycleId) {
    const admin = createAdminClient()
    await loadWritableTherapistCycle(admin, user.id, cycleId, returnPath)
    const availabilityWindow = await loadAvailabilityWindowState(admin as never, cycleId)
    if (availabilityWindow.locked) {
      redirect(buildAvailabilityUrl({ error: 'submission_closed', cycle: cycleId }, returnPath))
    }
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
    const admin = createAdminClient()
    await touchSubmission(admin as never, user.id, cycleId)
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(
    buildAvailabilityUrl({ success: 'entry_deleted', cycle: cycleId || undefined }, returnPath)
  )
}
