'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { applyTemplateToCycle, type TemplateShiftData } from '@/lib/cycle-template'
import { insertUnpublishedCycleShifts } from '@/lib/coverage/auto-generated-shifts'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { buildScheduleActionUrl, getRoleForUser } from './helpers'

export async function applyTemplateAction(formData: FormData) {
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

  const templateId = String(formData.get('template_id') ?? '').trim()
  const cycleId = String(formData.get('new_cycle_id') ?? '').trim()

  if (!templateId || !cycleId) {
    redirect(buildScheduleActionUrl(cycleId || undefined, { error: 'template_apply_failed' }))
  }

  const [{ data: template, error: templateError }, { data: cycle, error: cycleError }] =
    await Promise.all([
      supabase.from('cycle_templates').select('id, shift_data').eq('id', templateId).maybeSingle(),
      supabase
        .from('schedule_cycles')
        .select('id, start_date, published, status, archived_at, site_id')
        .eq('id', cycleId)
        .maybeSingle(),
    ])

  if (templateError || !template || cycleError || !cycle) {
    redirect(buildScheduleActionUrl(cycleId, { error: 'template_apply_failed' }))
  }

  if (cycle.published || cycle.status !== 'draft' || cycle.archived_at) {
    redirect(buildScheduleActionUrl(cycleId, { error: 'template_cycle_not_draft' }))
  }

  const templateData = (
    Array.isArray(template.shift_data) ? template.shift_data : []
  ) as TemplateShiftData[]
  const templateUserIds = [...new Set(templateData.map((row) => row.user_id))]

  const { data: activeProfiles, error: activeProfilesError } =
    templateUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id')
          .in('id', templateUserIds)
          .in('role', ['therapist', 'lead'])
          .eq('is_active', true)
          .is('archived_at', null)
          .eq('site_id', cycle.site_id)
      : { data: [], error: null }

  if (activeProfilesError) {
    redirect(buildScheduleActionUrl(cycleId, { error: 'template_apply_failed' }))
  }

  const activeProfileIds = new Set((activeProfiles ?? []).map((row) => row.id as string))
  const shiftsToInsert = applyTemplateToCycle(templateData, cycle.start_date, activeProfileIds).map(
    (row) => ({
      cycle_id: cycleId,
      ...row,
    })
  )
  const skippedCount = templateData.length - shiftsToInsert.length

  const admin = createAdminClient()
  const insertResult = await insertUnpublishedCycleShifts(admin, {
    actorId: user.id,
    cycleId,
    rows: shiftsToInsert,
  })
  if (insertResult.error && !insertResult.duplicateConflict) {
    redirect(buildScheduleActionUrl(cycleId, { error: 'template_apply_failed' }))
  }

  revalidatePath('/schedule')

  redirect(
    buildScheduleActionUrl(cycleId, {
      success: 'template_applied',
      imported: String(insertResult.insertedCount),
      skipped: skippedCount > 0 ? String(skippedCount) : undefined,
    })
  )
}
