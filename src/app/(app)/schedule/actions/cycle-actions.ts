'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { buildDateRange, buildScheduleUrl } from '@/lib/schedule-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'

import { buildScheduleActionUrl, getPanelParam, getRoleForUser } from './helpers'

type CycleImportSourceRow = {
  id: string
  start_date: string
  end_date: string
}

type ImportedShiftRow = {
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
}

type DeleteCycleMutationClient = {
  rpc: (
    fn: 'app_delete_empty_draft_schedule_cycle',
    args: { p_actor_id: string; p_cycle_id: string }
  ) => PromiseLike<{
    data: Array<{ id: string }> | { id: string } | null
    error: { code?: string; message?: string } | null
  }>
}

const SCHEDULE_BLOCK_DAY_COUNT = 42
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function isSundayToSixWeekSaturdayRange(startDate: string, endDate: string): boolean {
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!start || !end) return false

  const inclusiveDays = (end.getTime() - start.getTime()) / MS_PER_DAY + 1
  return start.getUTCDay() === 0 && inclusiveDays === SCHEDULE_BLOCK_DAY_COUNT
}

export async function deleteCycleAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const returnToPublish = String(formData.get('return_to') ?? '').trim() === 'publish'

  if (!user) {
    redirect('/login')
  }

  const role = await getRoleForUser(user.id)
  if (!can(role, 'manage_schedule')) {
    redirect(
      returnToPublish
        ? '/publish?error=delete_cycle_unauthorized'
        : '/schedule?error=delete_cycle_unauthorized'
    )
  }

  const cycleId = String(formData.get('cycle_id') ?? '').trim()

  const { data: cycle } = await supabase
    .from('schedule_cycles')
    .select('id, published, status, archived_at')
    .eq('id', cycleId)
    .maybeSingle()

  if (!cycle) {
    redirect(
      returnToPublish
        ? '/publish?error=delete_cycle_not_found'
        : '/schedule?error=delete_cycle_not_found'
    )
  }

  if (cycle.published) {
    redirect(
      returnToPublish
        ? '/publish?error=delete_cycle_published'
        : '/schedule?error=delete_cycle_published'
    )
  }

  if (cycle.status !== 'draft' || cycle.archived_at) {
    redirect(
      returnToPublish
        ? '/publish?error=delete_cycle_not_draft'
        : '/schedule?error=delete_cycle_not_draft'
    )
  }

  const admin = (() => {
    try {
      return createAdminClient() as unknown as DeleteCycleMutationClient
    } catch (error) {
      console.error('Failed to initialize admin client for cycle delete:', error)
      redirect(
        returnToPublish
          ? '/publish?error=delete_cycle_failed'
          : '/schedule?error=delete_cycle_failed'
      )
    }
  })()

  const { data: deletedRows, error } = await admin.rpc('app_delete_empty_draft_schedule_cycle', {
    p_actor_id: user.id,
    p_cycle_id: cycleId,
  })

  if (error) {
    console.error('Failed to delete cycle:', error)
    if (error.code === '23503' || /cannot be deleted|has schedule/i.test(error.message ?? '')) {
      redirect(
        returnToPublish
          ? '/publish?error=delete_cycle_not_empty'
          : '/schedule?error=delete_cycle_not_empty'
      )
    }
    if (error.code === '55000' || /only empty unpublished draft/i.test(error.message ?? '')) {
      redirect(
        returnToPublish
          ? '/publish?error=delete_cycle_not_draft'
          : '/schedule?error=delete_cycle_not_draft'
      )
    }
    redirect(
      returnToPublish ? '/publish?error=delete_cycle_failed' : '/schedule?error=delete_cycle_failed'
    )
  }

  const deleted = Array.isArray(deletedRows) ? deletedRows.length > 0 : Boolean(deletedRows)
  if (!deleted) {
    console.error('Delete cycle affected 0 rows')
    redirect(
      returnToPublish ? '/publish?error=delete_cycle_failed' : '/schedule?error=delete_cycle_failed'
    )
  }

  revalidatePath('/publish')
  revalidatePath('/schedule')
  revalidatePath('/availability')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/manager')
  revalidatePath('/dashboard/staff')
  redirect(returnToPublish ? '/publish?success=cycle_deleted' : '/schedule?success=cycle_deleted')
}

export async function createCycleAction(formData: FormData) {
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

  const { data: actorProfile, error: actorProfileError } = await supabase
    .from('profiles')
    .select('site_id')
    .eq('id', user.id)
    .maybeSingle()

  if (actorProfileError || !actorProfile?.site_id) {
    console.error('Failed to load manager site for cycle creation:', actorProfileError)
    redirect('/schedule?error=create_cycle_failed')
  }

  const label = String(formData.get('label') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const copyFromLastCycle = String(formData.get('copy_from_last_cycle') ?? '') === 'on'
  const publishedRequested = String(formData.get('published') ?? '') === 'on'
  const published = copyFromLastCycle ? false : publishedRequested
  const view = String(formData.get('view') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const coverageCurrentCycleId = String(formData.get('current_cycle_id') ?? '').trim()
  const coverageShift = String(formData.get('shift') ?? '').trim()
  const coverageContextParams =
    returnTo === 'coverage'
      ? {
          shift: coverageShift === 'day' || coverageShift === 'night' ? coverageShift : undefined,
        }
      : undefined
  const panel = getPanelParam(formData)
  const errorViewParams = panel ? { panel } : undefined
  const buildReturnUrl = (
    cycleIdOverride: string | undefined,
    params?: Record<string, string | undefined>
  ) =>
    returnTo === 'coverage'
      ? buildScheduleActionUrl((cycleIdOverride ?? coverageCurrentCycleId) || undefined, {
          ...coverageContextParams,
          ...params,
        })
      : buildScheduleUrl(cycleIdOverride, view, params)
  const revalidateCreatedCycleSurfaces = () => {
    revalidatePath('/schedule')
  }

  if (!label || !startDate || !endDate) {
    redirect(buildReturnUrl(undefined, { ...errorViewParams, error: 'create_cycle_failed' }))
  }

  if (endDate < startDate) {
    redirect(buildReturnUrl(undefined, { ...errorViewParams, error: 'create_cycle_invalid_range' }))
  }

  if (!isSundayToSixWeekSaturdayRange(startDate, endDate)) {
    redirect(
      buildReturnUrl(undefined, { ...errorViewParams, error: 'create_cycle_invalid_block_shape' })
    )
  }

  const { data: overlappingCycles, error: overlapError } = await supabase
    .from('schedule_cycles')
    .select('id')
    .is('archived_at', null)
    .eq('site_id', actorProfile.site_id)
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (overlapError) {
    console.error('Failed to validate schedule cycle overlap:', overlapError)
    redirect(buildReturnUrl(undefined, { ...errorViewParams, error: 'create_cycle_failed' }))
  }

  if ((overlappingCycles ?? []).length > 0) {
    redirect(buildReturnUrl(undefined, { ...errorViewParams, error: 'create_cycle_overlap' }))
  }

  const { data, error } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: startDate,
      end_date: endDate,
      published,
      status: published ? 'final' : 'draft',
      site_id: actorProfile.site_id,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('Failed to create schedule cycle:', error)
    redirect(buildReturnUrl(undefined, { ...errorViewParams, error: 'create_cycle_failed' }))
  }

  if (copyFromLastCycle) {
    const [sourceCycleResult, importedShiftsResult] = await Promise.all([
      supabase
        .from('schedule_cycles')
        .select('id, start_date, end_date')
        .eq('published', true)
        .eq('site_id', actorProfile.site_id)
        .neq('id', data.id)
        .order('end_date', { ascending: false })
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('schedule_cycles').select('id').eq('id', data.id).maybeSingle(),
    ])

    if (sourceCycleResult.error || importedShiftsResult.error || !importedShiftsResult.data) {
      console.error('Failed to prepare import from previous cycle:', {
        sourceCycleError: sourceCycleResult.error,
        importedCycleError: importedShiftsResult.error,
      })
      revalidateCreatedCycleSurfaces()
      redirect(
        buildReturnUrl(data.id, { ...errorViewParams, error: 'copy_from_last_cycle_failed' })
      )
    }

    const sourceCycle = sourceCycleResult.data as CycleImportSourceRow | null
    if (sourceCycle) {
      const { data: sourceShiftsData, error: sourceShiftsError } = await supabase
        .from('shifts')
        .select('user_id, date, shift_type, status, role')
        .eq('cycle_id', sourceCycle.id)
        .is('unfilled_reason', null)
        .not('user_id', 'is', null)

      if (sourceShiftsError) {
        console.error('Failed to load source shifts for cycle import:', sourceShiftsError)
        revalidateCreatedCycleSurfaces()
        redirect(
          buildReturnUrl(data.id, { ...errorViewParams, error: 'copy_from_last_cycle_failed' })
        )
      }

      const sourceShifts = (sourceShiftsData ?? []) as ImportedShiftRow[]
      if (sourceShifts.length > 0) {
        const sourceDates = buildDateRange(sourceCycle.start_date, sourceCycle.end_date)
        const sourceIndexByDate = new Map(sourceDates.map((date, index) => [date, index]))
        const targetDates = buildDateRange(startDate, endDate)
        const sourceTherapistIds = Array.from(new Set(sourceShifts.map((shift) => shift.user_id)))

        const { data: eligibleProfilesData, error: eligibleProfilesError } = await supabase
          .from('profiles')
          .select('id')
          .in('id', sourceTherapistIds)
          .in('role', ['therapist', 'lead'])
          .eq('is_active', true)
          .eq('on_fmla', false)
          .eq('site_id', actorProfile.site_id)

        if (eligibleProfilesError) {
          console.error(
            'Failed to load eligible therapists for cycle import:',
            eligibleProfilesError
          )
          revalidateCreatedCycleSurfaces()
          redirect(
            buildReturnUrl(data.id, { ...errorViewParams, error: 'copy_from_last_cycle_failed' })
          )
        }

        const eligibleTherapistIds = new Set(
          (eligibleProfilesData ?? []).map((row) => row.id as string)
        )
        let skippedAssignments = 0
        const shiftsToInsert = sourceShifts
          .map((shift) => {
            if (!eligibleTherapistIds.has(shift.user_id)) {
              skippedAssignments += 1
              return null
            }

            const sourceIndex = sourceIndexByDate.get(shift.date)
            if (sourceIndex === undefined) {
              skippedAssignments += 1
              return null
            }

            const targetDate = targetDates[sourceIndex]
            if (!targetDate) {
              skippedAssignments += 1
              return null
            }

            return {
              cycle_id: data.id,
              user_id: shift.user_id,
              date: targetDate,
              shift_type: shift.shift_type,
              status: shift.status,
              role: shift.role,
            }
          })
          .filter((shift): shift is NonNullable<typeof shift> => Boolean(shift))

        let copiedAssignments = 0
        if (shiftsToInsert.length > 0) {
          const { data: insertedShifts, error: insertedShiftsError } = await supabase
            .from('shifts')
            .upsert(shiftsToInsert, { onConflict: 'cycle_id,user_id,date', ignoreDuplicates: true })
            .select('id')

          if (insertedShiftsError) {
            console.error('Failed to insert imported shifts:', insertedShiftsError)
            revalidateCreatedCycleSurfaces()
            redirect(
              buildReturnUrl(data.id, { ...errorViewParams, error: 'copy_from_last_cycle_failed' })
            )
          }

          copiedAssignments = insertedShifts?.length ?? 0
        }

        revalidateCreatedCycleSurfaces()
        redirect(
          buildReturnUrl(data.id, {
            success: 'cycle_created',
            copied: String(copiedAssignments),
            skipped: String(skippedAssignments),
          })
        )
      }
    }

    revalidateCreatedCycleSurfaces()
    redirect(buildReturnUrl(data.id, { success: 'cycle_created', copied: '0' }))
  }

  revalidateCreatedCycleSurfaces()
  redirect(buildReturnUrl(data.id, { success: 'cycle_created' }))
}
