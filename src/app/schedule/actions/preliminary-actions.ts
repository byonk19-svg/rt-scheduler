'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { notifyUsers } from '@/lib/notifications'
import { writeAuditLog } from '@/lib/audit-log'
import { sendPreliminarySnapshot } from '@/lib/preliminary-schedule/mutations'
import { buildScheduleUrl } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'
import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'

import {
  buildCoverageUrl,
  buildPreliminaryOpenShiftRows,
  getOne,
  getRoleForUser,
  type PreliminaryShiftLookupRow,
} from './helpers'

export async function sendPreliminaryScheduleAction(formData: FormData) {
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
  const view = String(formData.get('view') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  const buildReturnUrl = (
    cycleIdOverride: string | undefined,
    params?: Record<string, string | undefined>
  ) =>
    returnTo === 'coverage'
      ? buildCoverageUrl(cycleIdOverride, params)
      : buildScheduleUrl(cycleIdOverride, view, params)

  if (!cycleId) {
    redirect(buildReturnUrl(undefined, { ...viewParams, error: 'preliminary_missing_cycle' }))
  }

  const [{ data: cycle, error: cycleError }, { data: existingSnapshot, error: snapshotError }] =
    await Promise.all([
      supabase
        .from('schedule_cycles')
        .select('id, label, start_date, end_date, published')
        .eq('id', cycleId)
        .maybeSingle(),
      supabase
        .from('preliminary_snapshots')
        .select('id')
        .eq('cycle_id', cycleId)
        .eq('status', 'active')
        .maybeSingle(),
    ])

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for preliminary send:', cycleError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
  }

  if (snapshotError) {
    console.error('Failed to load active preliminary snapshot:', snapshotError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
  }

  if (cycle.published) {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_cycle_published' }))
  }

  const { data: shiftsData, error: shiftsError } = await supabase
    .from('shifts')
    .select(
      'id, cycle_id, user_id, date, shift_type, status, role, profiles:profiles!shifts_user_id_fkey(full_name)'
    )
    .eq('cycle_id', cycleId)

  if (shiftsError) {
    console.error('Failed to load shifts for preliminary send:', shiftsError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
  }

  const draftShifts = (shiftsData ?? []) as PreliminaryShiftLookupRow[]
  const missingOpenShifts = buildPreliminaryOpenShiftRows({
    cycleId,
    cycleStartDate: cycle.start_date,
    cycleEndDate: cycle.end_date,
    shifts: draftShifts,
  })

  let insertedOpenShifts: PreliminaryShiftLookupRow[] = []
  if (missingOpenShifts.length > 0) {
    const { data: insertedData, error: insertedError } = await supabase
      .from('shifts')
      .insert(missingOpenShifts)
      .select('id, cycle_id, user_id, date, shift_type, status, role')

    if (insertedError) {
      console.error('Failed to create preliminary open slots:', insertedError)
      redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
    }

    insertedOpenShifts = (
      (insertedData ?? []) as Array<{
        id: string
        cycle_id: string | null
        user_id: string | null
        date: string
        shift_type: 'day' | 'night'
        status: ShiftStatus
        role: ShiftRole
      }>
    ).map((shift) => ({
      ...shift,
      profiles: null,
    }))
  }

  const mappedShifts = [...draftShifts, ...insertedOpenShifts].map((shift) => ({
    id: shift.id,
    cycle_id: shift.cycle_id,
    user_id: shift.user_id,
    date: shift.date,
    shift_type: shift.shift_type,
    status: shift.status,
    role: shift.role,
    full_name: getOne(shift.profiles)?.full_name ?? null,
  }))

  const sendResult = await sendPreliminarySnapshot(supabase as never, {
    cycleId,
    actorId: user.id,
    shifts: mappedShifts,
  })

  if (sendResult.error || !sendResult.data) {
    console.error('Failed to send preliminary schedule:', sendResult.error)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
  }

  const { data: recipientsData, error: recipientsError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .order('id', { ascending: true })

  if (recipientsError) {
    console.error('Failed to load preliminary recipients:', recipientsError)
  } else {
    await notifyUsers(supabase, {
      userIds: (recipientsData ?? []).map((row) => row.id as string),
      eventType: existingSnapshot ? 'preliminary_refreshed' : 'preliminary_sent',
      title: existingSnapshot ? 'Preliminary schedule refreshed' : 'Preliminary schedule sent',
      message: `${cycle.label} is ready to review in the preliminary schedule.`,
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: existingSnapshot ? 'preliminary_schedule_refreshed' : 'preliminary_schedule_sent',
    targetType: 'schedule_cycle',
    targetId: cycleId,
  })

  revalidatePath('/coverage')
  revalidatePath('/schedule')
  revalidatePath('/preliminary')
  revalidatePath('/approvals')
  revalidatePath('/dashboard/manager')

  redirect(
    buildReturnUrl(cycleId, {
      ...viewParams,
      success: existingSnapshot ? 'preliminary_refreshed' : 'preliminary_sent',
    })
  )
}
