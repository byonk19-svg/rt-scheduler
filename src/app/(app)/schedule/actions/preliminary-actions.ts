'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { notifyUsers } from '@/lib/notifications'
import { writeAuditLog } from '@/lib/audit-log'
import { buildScheduleUrl } from '@/lib/schedule-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import {
  buildScheduleActionUrl,
  getRoleForUser,
  loadBlockingReadinessIssuesForCycle,
} from './helpers'

type SendPreliminaryScheduleRpcClient = {
  rpc: (
    fn: 'app_send_preliminary_schedule',
    args: { p_actor_id: string; p_cycle_id: string }
  ) => PromiseLike<{
    data: Array<{ id: string; label: string; was_refresh: boolean }> | null
    error: { message?: string } | null
  }>
}

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
      ? buildScheduleActionUrl(cycleIdOverride, params)
      : buildScheduleUrl(cycleIdOverride, view, params)

  if (!cycleId) {
    redirect(buildReturnUrl(undefined, { ...viewParams, error: 'preliminary_missing_cycle' }))
  }

  const { data: cycleData, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, status, site_id')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycleData) {
    console.error('Failed to load cycle for preliminary readiness validation:', cycleError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
  }

  if (cycleData.status === 'archived') {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_cycle_archived' }))
  }

  if (cycleData.published || cycleData.status === 'final') {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_cycle_published' }))
  }

  const readinessValidation = await loadBlockingReadinessIssuesForCycle(supabase, {
    id: cycleData.id,
    start_date: cycleData.start_date,
    end_date: cycleData.end_date,
    site_id: cycleData.site_id,
  })

  if (readinessValidation.error) {
    console.error('Failed to load preliminary readiness validation:', readinessValidation.error)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'preliminary_send_failed' }))
  }

  if (readinessValidation.issues.length > 0) {
    redirect(
      buildReturnUrl(cycleId, {
        ...viewParams,
        error: 'preliminary_readiness_blocked',
        readiness_issues: String(readinessValidation.issues.length),
      })
    )
  }

  const preliminaryMutationClient =
    createAdminClient() as unknown as SendPreliminaryScheduleRpcClient
  const sendResult = await preliminaryMutationClient.rpc('app_send_preliminary_schedule', {
    p_actor_id: user.id,
    p_cycle_id: cycleId,
  })

  const sendRow = sendResult.data?.[0] ?? null
  if (sendResult.error || !sendRow) {
    console.error('Failed to send preliminary schedule:', sendResult.error)
    const message = sendResult.error?.message ?? ''
    const sendError = /archived/i.test(message)
      ? 'preliminary_cycle_archived'
      : /published|final/i.test(message)
        ? 'preliminary_cycle_published'
        : 'preliminary_send_failed'
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: sendError }))
  }

  const { data: recipientsData, error: recipientsError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .is('archived_at', null)
    .eq('site_id', cycleData.site_id ?? '__missing_site__')
    .order('id', { ascending: true })

  if (recipientsError) {
    console.error('Failed to load preliminary recipients:', recipientsError)
  } else {
    await notifyUsers(supabase, {
      userIds: (recipientsData ?? []).map((row) => row.id as string),
      eventType: sendRow.was_refresh ? 'preliminary_refreshed' : 'preliminary_sent',
      title: sendRow.was_refresh ? 'Preliminary schedule refreshed' : 'Preliminary schedule sent',
      message: `${sendRow.label} is ready to review in the preliminary schedule.`,
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: sendRow.was_refresh ? 'preliminary_schedule_refreshed' : 'preliminary_schedule_sent',
    targetType: 'schedule_cycle',
    targetId: cycleId,
  })

  revalidatePath('/schedule')
  revalidatePath('/preliminary')
  revalidatePath('/approvals')
  revalidatePath('/dashboard/manager')

  redirect(
    buildReturnUrl(cycleId, {
      ...viewParams,
      success: sendRow.was_refresh ? 'preliminary_refreshed' : 'preliminary_sent',
    })
  )
}
