'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import {
  applyAvailabilityEmailImport,
  deleteAvailabilityEmailIntake,
  reparseAvailabilityEmailIntake,
  updateEmailIntakeItemRequest,
  updateEmailIntakeTherapistMatch,
} from '@/lib/availability/email-intake-lifecycle'
import { buildEmailIntakeAvailabilityUrl, getAuthenticatedUserWithRole } from './_actions/shared'

export async function applyEmailAvailabilityImportAction(formData: FormData) {
  const { supabase, user, role, permissionContext } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const intakeId = String(formData.get('intake_id') ?? '').trim()

  if (!itemId && !intakeId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_apply_failed' }))
  }

  const result = await applyAvailabilityEmailImport({
    supabase,
    userId: user.id,
    itemId,
    intakeId,
  })

  if (!result.ok) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: result.error }))
  }

  revalidatePath('/availability')
  return {
    ok: true as const,
    cycleId: result.cycleId,
    therapistId: result.therapistId,
  }
}

export async function updateEmailIntakeTherapistAction(formData: FormData) {
  const { supabase, role, permissionContext } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const intakeId = String(formData.get('intake_id') ?? '').trim()
  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()

  if ((!itemId && !intakeId) || !therapistId || !cycleId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_match_failed' }))
  }

  const result = await updateEmailIntakeTherapistMatch({
    supabase,
    itemId,
    intakeId,
    therapistId,
    cycleId,
  })

  if (!result.ok) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: result.error }))
  }

  revalidatePath('/availability')
  redirect(buildEmailIntakeAvailabilityUrl({ success: 'email_intake_match_saved' }))
}

export async function updateEmailIntakeItemRequestAction(formData: FormData) {
  const { supabase, role, permissionContext } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const itemId = String(formData.get('item_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const overrideType = String(formData.get('override_type') ?? '').trim()
  const shiftType = String(formData.get('shift_type') ?? '').trim()
  const modeRaw = String(formData.get('mode') ?? '').trim()
  const mode = modeRaw === 'remove' ? 'remove' : 'cycle'

  if (
    !itemId ||
    !date ||
    (overrideType !== 'force_off' && overrideType !== 'force_on') ||
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both')
  ) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_request_update_failed' }))
  }

  const result = await updateEmailIntakeItemRequest({
    supabase,
    itemId,
    date,
    overrideType,
    shiftType,
    mode,
  })

  if (!result.ok) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: result.error }))
  }

  revalidatePath('/availability')
  return { ok: true as const }
}

export async function reparseEmailIntakeAction(formData: FormData) {
  const { supabase, role, permissionContext } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const intakeId = String(formData.get('intake_id') ?? '').trim()
  if (!intakeId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_reparse_failed' }))
  }

  const result = await reparseAvailabilityEmailIntake(supabase, intakeId)
  if (!result.ok) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: result.error }))
  }

  revalidatePath('/availability')
  redirect(buildEmailIntakeAvailabilityUrl({ success: 'email_intake_reparsed' }))
}

export async function deleteEmailIntakeAction(formData: FormData) {
  const { supabase, role, permissionContext } = await getAuthenticatedUserWithRole()

  if (!can(role, 'access_manager_ui', permissionContext)) {
    redirect('/availability')
  }

  const intakeId = String(formData.get('intake_id') ?? '').trim()
  if (!intakeId) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: 'email_intake_delete_failed' }))
  }

  const result = await deleteAvailabilityEmailIntake(supabase, intakeId)
  if (!result.ok) {
    redirect(buildEmailIntakeAvailabilityUrl({ error: result.error }))
  }

  revalidatePath('/availability')
  redirect(buildEmailIntakeAvailabilityUrl({ success: 'email_intake_deleted' }))
}

export const reparseAvailabilityEmailIntakeAction = reparseEmailIntakeAction
export const deleteAvailabilityEmailIntakeAction = deleteEmailIntakeAction
