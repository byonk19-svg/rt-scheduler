'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { writeAuditLog } from '@/lib/audit-log'
import { insertUnpublishedCycleShifts } from '@/lib/coverage/auto-generated-shifts'
import { loadDraftInputsForCycle, toDraftInputSupabaseClient } from '@/lib/coverage/draft-inputs'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import { NO_ELIGIBLE_CANDIDATES_REASON } from '@/lib/coverage/generator-slot'
import { buildDateRange, buildScheduleUrl } from '@/lib/schedule-helpers'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { buildCoverageUrl, getRoleForUser } from './helpers'

export async function generateDraftScheduleAction(formData: FormData) {
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
    redirect(buildReturnUrl(undefined, { ...viewParams, error: 'auto_missing_cycle' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, published, status')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for auto-generation:', cycleError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_failed' }))
  }

  if (cycle.published) {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_cycle_published' }))
  }

  if (cycle.status !== 'draft') {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_cycle_not_draft' }))
  }

  const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
  if (cycleDates.length === 0) {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_failed' }))
  }

  const admin = createAdminClient()
  const { error: clearUnfilledReasonError } = await admin.rpc(
    'app_delete_unpublished_cycle_shifts',
    {
      p_actor_id: user.id,
      p_cycle_id: cycleId,
      p_unfilled_only: true,
    }
  )

  if (clearUnfilledReasonError) {
    console.error('Failed to clear prior unfilled reason placeholders:', clearUnfilledReasonError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_failed' }))
  }

  const draftInputs = await loadDraftInputsForCycle(toDraftInputSupabaseClient(supabase), {
    cycle: { id: cycleId, start_date: cycle.start_date, end_date: cycle.end_date },
  })

  if (draftInputs.error) {
    console.error('Failed to load scheduling data for auto-generation:', draftInputs.error)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_failed' }))
  }

  if (draftInputs.data.therapists.length === 0) {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_no_therapists' }))
  }

  const {
    draftShiftsToInsert,
    pendingLeadUpdates,
    unfilledConstraintSlots,
    unfilledSlots,
    constraintsUnfilledSlots,
    missingLeadSlots,
    forcedMustWorkMisses,
  } = generateDraftForCycle(draftInputs.data)

  if (draftShiftsToInsert.length > 0) {
    const insertResult = await insertUnpublishedCycleShifts(admin, {
      actorId: user.id,
      cycleId,
      rows: draftShiftsToInsert,
    })

    if (insertResult.error && !insertResult.duplicateConflict) {
      console.error('Failed to insert auto-generated shifts:', insertResult.error)
      redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_db_error' }))
    }

    if (insertResult.duplicateConflict) {
      console.warn(
        'Auto-generate encountered concurrent duplicate shifts; draft may be incomplete.'
      )
      redirect(
        buildReturnUrl(cycleId, {
          ...viewParams,
          error: 'auto_generate_coverage_incomplete',
          dropped: String(draftShiftsToInsert.length),
        })
      )
    }

    const silentlyDropped = draftShiftsToInsert.length - insertResult.insertedCount
    if (silentlyDropped > 0) {
      console.warn(
        `Auto-generate: ${silentlyDropped} shift(s) skipped due to concurrent conflicts.`
      )
      redirect(
        buildReturnUrl(cycleId, {
          ...viewParams,
          error: 'auto_generate_coverage_incomplete',
          dropped: String(silentlyDropped),
        })
      )
    }
  }

  if (unfilledConstraintSlots.length > 0) {
    const unfilledReasonRows = unfilledConstraintSlots.map((slot) => ({
      cycle_id: cycleId,
      user_id: null,
      date: slot.date,
      shift_type: slot.shiftType,
      status: 'called_off' as const,
      assignment_status: 'cancelled' as const,
      role: 'staff' as const,
      unfilled_reason: NO_ELIGIBLE_CANDIDATES_REASON,
      status_note: `Missing ${slot.missingCount} required assignment${slot.missingCount === 1 ? '' : 's'} due to hard constraints.`,
    }))

    const unfilledInsertResult = await insertUnpublishedCycleShifts(admin, {
      actorId: user.id,
      cycleId,
      rows: unfilledReasonRows,
    })

    if (unfilledInsertResult.error) {
      console.error('Failed to record unfilled constraint reasons:', unfilledInsertResult.error)
      redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_db_error' }))
    }
  }

  if (pendingLeadUpdates.length > 0) {
    for (const update of pendingLeadUpdates) {
      const leadResult = await setDesignatedLeadMutation(supabase, {
        cycleId,
        therapistId: update.therapistId,
        date: update.date,
        shiftType: update.shiftType,
      })
      if (!leadResult.ok) {
        console.error('Auto-generate failed to designate lead for slot:', update, leadResult.error)
        redirect(
          buildReturnUrl(cycleId, { ...viewParams, error: 'auto_generate_lead_assignment_failed' })
        )
      }
    }
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: 'draft_schedule_generated',
    targetType: 'schedule_cycle',
    targetId: cycleId,
  })

  revalidatePath('/schedule')
  revalidatePath('/coverage')
  redirect(
    buildReturnUrl(cycleId, {
      ...viewParams,
      auto: 'generated',
      added: String(draftShiftsToInsert.length),
      unfilled: String(unfilledSlots),
      constraints_unfilled: String(constraintsUnfilledSlots),
      lead_missing: String(missingLeadSlots),
      forced_misses: forcedMustWorkMisses > 0 ? String(forcedMustWorkMisses) : undefined,
    })
  )
}

export async function resetDraftScheduleAction(formData: FormData) {
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
    redirect(buildReturnUrl(undefined, { ...viewParams, error: 'reset_missing_cycle' }))
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published, status')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for reset:', cycleError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'reset_failed' }))
  }

  if (cycle.published) {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'reset_cycle_published' }))
  }

  if (cycle.status !== 'draft' && cycle.status !== 'preliminary') {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'reset_invalid_state' }))
  }

  const admin = createAdminClient()
  const { data: resetRows, error: resetError } = await admin.rpc('app_start_schedule_cycle_over', {
    p_actor_id: user.id,
    p_cycle_id: cycleId,
  })

  if (resetError) {
    console.error('Failed to reset draft shifts:', resetError)
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'reset_failed' }))
  }

  const resetRow = Array.isArray(resetRows) ? resetRows[0] : resetRows
  const removedCount = resetRow?.deleted_count ?? 0

  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/preliminary')
  redirect(
    buildReturnUrl(cycleId, {
      ...viewParams,
      draft: 'reset',
      removed: String(removedCount),
    })
  )
}
