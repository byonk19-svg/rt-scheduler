'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { writeAuditLog } from '@/lib/audit-log'
import { formatDateLabel } from '@/lib/calendar-utils'
import { notifyUsers } from '@/lib/notifications'
import {
  availabilityDueDateKey,
  buildScheduleBlockLabel,
  isTherapistVisibleForAvailability,
  normalizeAvailabilityDueDate,
  validateScheduleBlockPlanning,
  type ScheduleBlockPlanningCycle,
} from '@/lib/schedule-block-planning'
import { createClient } from '@/lib/supabase/server'

import { getRoleForUser } from './helpers'

type PlanningCycleRow = ScheduleBlockPlanningCycle & {
  site_id: string | null
  preliminary_target_date: string | null
  final_publish_target_date: string | null
}

type ActorProfileRow = {
  site_id: string | null
}

type TherapistRecipientRow = {
  id: string
}

function firstDateValue(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? '').trim()
  return value.length > 0 ? value : null
}

function buildPlanningUrl(
  cycleId: string | undefined,
  params?: Record<string, string | undefined>
): string {
  const search = new URLSearchParams()
  if (cycleId) search.set('cycle', cycleId)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
  }
  const query = search.toString()
  return query ? `/schedule/planning?${query}` : '/schedule/planning'
}

function revalidatePlanningSurfaces() {
  revalidatePath('/schedule')
  revalidatePath('/schedule/planning')
  revalidatePath('/availability')
  revalidatePath('/therapist/availability')
  revalidatePath('/dashboard/manager')
  revalidatePath('/dashboard/staff')
}

function firstValidationError(errors: string[]): string {
  return errors[0] ?? 'planning_invalid'
}

function targetDateChanged(oldValue: string | null | undefined, newValue: string | null): boolean {
  return (oldValue ?? null) !== (newValue ?? null)
}

async function loadActorSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('site_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load manager site for Schedule Block Planning:', error)
    return null
  }

  return ((data ?? null) as ActorProfileRow | null)?.site_id ?? null
}

async function loadPlanningCycles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string | null
): Promise<PlanningCycleRow[]> {
  let query = supabase
    .from('schedule_cycles')
    .select(
      'id, label, start_date, end_date, published, status, archived_at, availability_due_at, preliminary_target_date, final_publish_target_date, site_id'
    )
    .is('archived_at', null)

  if (siteId) {
    query = query.eq('site_id', siteId)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to load Schedule Blocks for planning validation:', error)
    return []
  }
  return (data ?? []) as PlanningCycleRow[]
}

async function notifyTherapistsForAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    siteId: string | null
    cycleId: string
    cycleLabel: string
    dueDate: string
    changed: boolean
  }
) {
  let query = supabase
    .from('profiles')
    .select('id')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .is('archived_at', null)

  if (params.siteId) {
    query = query.eq('site_id', params.siteId)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to load therapist recipients for planning notification:', error)
    return
  }

  const recipients = ((data ?? []) as TherapistRecipientRow[]).map((row) => row.id)
  if (recipients.length === 0) return

  await notifyUsers(supabase, {
    userIds: recipients,
    eventType: params.changed ? 'availability_due_date_changed' : 'availability_ready',
    title: params.changed ? 'Availability due date changed' : 'Availability is ready',
    message: params.changed
      ? `${params.cycleLabel} availability is now due ${formatDateLabel(params.dueDate)}.`
      : `${params.cycleLabel} is ready for availability. Please submit by ${formatDateLabel(
          params.dueDate
        )}.`,
    targetType: 'schedule_cycle',
    targetId: params.cycleId,
  })
}

async function hasDependentScheduleBlockData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string
): Promise<boolean> {
  const [submissions, shifts, preliminary, publishEvents] = await Promise.all([
    supabase
      .from('therapist_availability_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_cycle_id', cycleId),
    supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('cycle_id', cycleId),
    supabase
      .from('preliminary_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
    supabase
      .from('publish_events')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
  ])

  for (const result of [submissions, shifts, preliminary, publishEvents]) {
    if (result.error) {
      console.error('Failed to check Schedule Block dependencies:', result.error)
      return true
    }
    if ((result.count ?? 0) > 0) return true
  }

  return false
}

export async function createScheduleBlockPlanningAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (!can(role, 'manage_schedule')) {
    redirect('/schedule')
  }

  const siteId = await loadActorSite(supabase, user.id)
  if (!siteId) {
    redirect(buildPlanningUrl(undefined, { error: 'planning_site_missing' }))
  }

  const startDate = firstDateValue(formData, 'start_date') ?? ''
  const endDate = firstDateValue(formData, 'end_date') ?? ''
  const availabilityDueDate = firstDateValue(formData, 'availability_due_date')
  const preliminaryTargetDate = firstDateValue(formData, 'preliminary_target_date')
  const finalPublishTargetDate = firstDateValue(formData, 'final_publish_target_date')
  const customLabel = String(formData.get('label') ?? '').trim()
  const cycles = await loadPlanningCycles(supabase, siteId)
  const validation = validateScheduleBlockPlanning(
    {
      startDate,
      endDate,
      availabilityDueDate,
      preliminaryTargetDate,
      finalPublishTargetDate,
      wasTherapistVisible: false,
    },
    cycles
  )

  if (!validation.valid) {
    redirect(buildPlanningUrl(undefined, { error: firstValidationError(validation.errors) }))
  }

  const availabilityDueAt = availabilityDueDate
    ? normalizeAvailabilityDueDate(availabilityDueDate)
    : null
  const label = customLabel || buildScheduleBlockLabel(startDate, endDate)

  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: startDate,
      end_date: endDate,
      published: false,
      status: 'draft',
      site_id: siteId,
      availability_due_at: availabilityDueAt,
      preliminary_target_date: preliminaryTargetDate,
      final_publish_target_date: finalPublishTargetDate,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('Failed to create Schedule Block Planning row:', error)
    redirect(buildPlanningUrl(undefined, { error: 'planning_create_failed' }))
  }

  const cycleId = String(data.id)
  await writeAuditLog(supabase, {
    userId: user.id,
    action: availabilityDueDate
      ? 'schedule_block_planning_created_visible'
      : 'schedule_block_planning_created',
    targetType: 'schedule_cycle',
    targetId: cycleId,
  })

  if (availabilityDueDate) {
    await notifyTherapistsForAvailability(supabase, {
      siteId,
      cycleId,
      cycleLabel: label,
      dueDate: availabilityDueDate,
      changed: false,
    })
  }

  revalidatePlanningSurfaces()
  redirect(
    buildPlanningUrl(cycleId, {
      success: 'planning_created',
      warning: validation.warnings[0],
    })
  )
}

export async function updateScheduleBlockPlanningAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (!can(role, 'manage_schedule')) {
    redirect('/schedule')
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!cycleId) {
    redirect(buildPlanningUrl(undefined, { error: 'planning_missing_cycle' }))
  }

  const siteId = await loadActorSite(supabase, user.id)
  if (!siteId) {
    redirect(buildPlanningUrl(cycleId, { error: 'planning_site_missing' }))
  }

  const cycles = await loadPlanningCycles(supabase, siteId)
  const currentCycle = cycles.find((cycle) => cycle.id === cycleId) ?? null
  if (!currentCycle) {
    redirect(buildPlanningUrl(undefined, { error: 'planning_cycle_not_found' }))
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  const wasTherapistVisible = isTherapistVisibleForAvailability(currentCycle, todayKey)
  const startDate = firstDateValue(formData, 'start_date') ?? currentCycle.start_date
  const endDate = firstDateValue(formData, 'end_date') ?? currentCycle.end_date
  const availabilityDueDate = firstDateValue(formData, 'availability_due_date')
  const preliminaryTargetDate = firstDateValue(formData, 'preliminary_target_date')
  const finalPublishTargetDate = firstDateValue(formData, 'final_publish_target_date')
  const customLabel = String(formData.get('label') ?? '').trim()

  const validation = validateScheduleBlockPlanning(
    {
      startDate,
      endDate,
      availabilityDueDate,
      preliminaryTargetDate,
      finalPublishTargetDate,
      wasTherapistVisible,
    },
    cycles,
    cycleId
  )

  if (!validation.valid) {
    redirect(buildPlanningUrl(cycleId, { error: firstValidationError(validation.errors) }))
  }

  const dateRangeChanged =
    startDate !== currentCycle.start_date || endDate !== currentCycle.end_date
  if (dateRangeChanged && (await hasDependentScheduleBlockData(supabase, cycleId))) {
    redirect(buildPlanningUrl(cycleId, { error: 'planning_dates_locked' }))
  }

  const oldDueDate = availabilityDueDateKey(currentCycle.availability_due_at)
  if (
    wasTherapistVisible &&
    oldDueDate &&
    availabilityDueDate &&
    availabilityDueDate < oldDueDate &&
    String(formData.get('confirm_earlier_due_date') ?? '') !== 'true'
  ) {
    redirect(buildPlanningUrl(cycleId, { error: 'planning_due_earlier_requires_confirm' }))
  }

  const preliminaryChanged = targetDateChanged(
    currentCycle.preliminary_target_date,
    preliminaryTargetDate
  )
  const finalPublishChanged = targetDateChanged(
    currentCycle.final_publish_target_date,
    finalPublishTargetDate
  )

  if (preliminaryChanged) {
    const { count, error } = await supabase
      .from('preliminary_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId)
    if (error || (count ?? 0) > 0) {
      redirect(buildPlanningUrl(cycleId, { error: 'planning_preliminary_target_locked' }))
    }
  }

  if (finalPublishChanged) {
    const { count, error } = await supabase
      .from('publish_events')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId)
    if (error || currentCycle.published || currentCycle.status === 'final' || (count ?? 0) > 0) {
      redirect(buildPlanningUrl(cycleId, { error: 'planning_publish_target_locked' }))
    }
  }

  const availabilityDueAt = availabilityDueDate
    ? normalizeAvailabilityDueDate(availabilityDueDate)
    : null
  const label = customLabel || currentCycle.label || buildScheduleBlockLabel(startDate, endDate)

  const { error: updateError } = await supabase
    .from('schedule_cycles')
    .update({
      label,
      start_date: startDate,
      end_date: endDate,
      availability_due_at: availabilityDueAt,
      preliminary_target_date: preliminaryTargetDate,
      final_publish_target_date: finalPublishTargetDate,
    })
    .eq('id', cycleId)

  if (updateError) {
    console.error('Failed to update Schedule Block Planning row:', updateError)
    redirect(buildPlanningUrl(cycleId, { error: 'planning_update_failed' }))
  }

  const becameVisible = !wasTherapistVisible && Boolean(availabilityDueDate)
  const dueDateChanged = oldDueDate !== availabilityDueDate
  if (availabilityDueDate && (becameVisible || (wasTherapistVisible && dueDateChanged))) {
    await notifyTherapistsForAvailability(supabase, {
      siteId,
      cycleId,
      cycleLabel: label,
      dueDate: availabilityDueDate,
      changed: wasTherapistVisible && dueDateChanged,
    })
  }

  if (dueDateChanged) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: becameVisible
        ? 'schedule_block_planning_made_visible'
        : 'schedule_block_availability_due_date_changed',
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })
  }
  if (preliminaryChanged) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'schedule_block_preliminary_target_changed',
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })
  }
  if (finalPublishChanged) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'schedule_block_final_publish_target_changed',
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })
  }

  revalidatePlanningSurfaces()
  redirect(
    buildPlanningUrl(cycleId, {
      success: 'planning_saved',
      warning: validation.warnings[0],
    })
  )
}
