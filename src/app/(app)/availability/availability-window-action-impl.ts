'use server'

import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildAvailabilityUrl,
  getAuthenticatedUserWithRole,
  revalidateTherapistAvailabilitySurfaces,
} from './_actions/shared'

function getCycleId(formData: FormData) {
  return String(formData.get('cycle_id') ?? '').trim()
}

async function requireManager() {
  const { user, role } = await getAuthenticatedUserWithRole()
  if (!can(parseRole(role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }
  return user
}

export async function closeAvailabilityWindowAction(formData: FormData) {
  const user = await requireManager()
  const cycleId = getCycleId(formData)
  if (!cycleId) {
    redirect(buildAvailabilityUrl({ error: 'availability_window_failed' }))
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('schedule_cycles')
    .update({
      availability_closed_at: new Date().toISOString(),
      availability_closed_by: user.id,
    })
    .eq('id', cycleId)

  if (error) {
    console.error('Failed to close availability window:', error)
    redirect(buildAvailabilityUrl({ error: 'availability_window_failed', cycle: cycleId }))
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(buildAvailabilityUrl({ success: 'availability_closed', cycle: cycleId }))
}

export async function reopenAvailabilityWindowAction(formData: FormData) {
  const user = await requireManager()
  const cycleId = getCycleId(formData)
  if (!cycleId) {
    redirect(buildAvailabilityUrl({ error: 'availability_window_failed' }))
  }

  const admin = createAdminClient()
  const { data: cycle, error: cycleError } = await admin
    .from('schedule_cycles')
    .select('id, published, status, archived_at')
    .eq('id', cycleId)
    .maybeSingle()

  if (
    cycleError ||
    !cycle ||
    cycle.published ||
    cycle.archived_at ||
    cycle.status === 'preliminary' ||
    cycle.status === 'final' ||
    cycle.status === 'offline' ||
    cycle.status === 'archived'
  ) {
    redirect(buildAvailabilityUrl({ error: 'availability_window_failed', cycle: cycleId }))
  }

  const { error } = await admin
    .from('schedule_cycles')
    .update({
      availability_reopened_at: new Date().toISOString(),
      availability_reopened_by: user.id,
    })
    .eq('id', cycleId)

  if (error) {
    console.error('Failed to reopen availability window:', error)
    redirect(buildAvailabilityUrl({ error: 'availability_window_failed', cycle: cycleId }))
  }

  revalidateTherapistAvailabilitySurfaces()
  redirect(buildAvailabilityUrl({ success: 'availability_reopened', cycle: cycleId }))
}
