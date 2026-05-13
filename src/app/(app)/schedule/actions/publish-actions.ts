'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { notifyUsers } from '@/lib/notifications'
import { writeAuditLog } from '@/lib/audit-log'
import { summarizeAvailabilityPublishIssues } from '@/lib/availability-publish-validation'
import { getPublishEmailConfig, processQueuedPublishEmails } from '@/lib/publish-events'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildDateRange,
  buildScheduleUrl,
  countsTowardWeeklyLimit,
  getWeekBoundsForDate,
  weeklyCountKey,
} from '@/lib/schedule-helpers'
import {
  summarizePublishWeeklyViolations,
  summarizeShiftSlotViolations,
} from '@/lib/schedule-rule-validation'
import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MAX_WORK_DAYS_PER_WEEK,
  MIN_SHIFT_COVERAGE_PER_DAY,
  getWeeklyMinimumForEmploymentType,
} from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import type { ShiftLimitRow, ShiftRole } from '@/app/schedule/types'

import {
  buildScheduleActionUrl,
  getOne,
  getRoleForUser,
  getWeeklyLimitFromProfile,
} from './helpers'

// Primary schedule publish toggle. Publish history/email requeue actions live in
// `src/app/(app)/publish/actions.ts` because they are event-history operations.

type ShiftPublishValidationRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: string
  role: ShiftRole
  user_id: string
  unfilled_reason: string | null
  availability_override: boolean
  availability_override_reason: string | null
  availability_override_by: string | null
  availability_override_at: string | null
  profiles:
    | { full_name: string; is_lead_eligible: boolean }
    | { full_name: string; is_lead_eligible: boolean }[]
    | null
}

type AvailabilityOverridePublishRow = {
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  source?: 'manager' | 'therapist' | null
  note?: string | null
}

type PublishRecipientRow = {
  id: string
  email: string | null
  full_name: string | null
  notification_email_enabled?: boolean | null
}

type PublishCycleMutationClient = {
  rpc: (
    fn: 'app_publish_schedule_cycle',
    args: { p_actor_id: string; p_cycle_id: string }
  ) => PromiseLike<{
    data: Array<{ id: string }> | { id: string } | null
    error: { message?: string } | null
  }>
}

export async function toggleCyclePublishedAction(formData: FormData) {
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
  const currentlyPublished = String(formData.get('currently_published') ?? '').trim() === 'true'
  const view = String(formData.get('view') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const showUnavailable = String(formData.get('show_unavailable') ?? '').trim() === 'true'
  const overrideWeeklyRules = String(formData.get('override_weekly_rules') ?? '').trim() === 'true'
  const overrideShiftRules = String(formData.get('override_shift_rules') ?? '').trim() === 'true'
  const acknowledgeMissingAvailability =
    String(formData.get('acknowledge_missing_availability') ?? '').trim() === 'true'
  const viewParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  const buildReturnUrl = (
    cycleIdOverride: string | undefined,
    params?: Record<string, string | undefined>
  ) =>
    returnTo === 'coverage'
      ? buildScheduleActionUrl(cycleIdOverride, params)
      : buildScheduleUrl(cycleIdOverride, view, params)
  let publishCycleDetails: { label: string; startDate: string; endDate: string } | null = null

  if (!cycleId) {
    redirect(buildReturnUrl(undefined, viewParams))
  }

  if (currentlyPublished) {
    redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'take_offline_from_publish_history' }))
  }

  if (!currentlyPublished) {
    const { data: cycle, error: cycleError } = await supabase
      .from('schedule_cycles')
      .select('label, start_date, end_date, status, site_id')
      .eq('id', cycleId)
      .maybeSingle()

    if (cycleError || !cycle) {
      console.error('Failed to load cycle for publish validation:', cycleError)
      redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
    }
    publishCycleDetails = {
      label: cycle.label,
      startDate: cycle.start_date,
      endDate: cycle.end_date,
    }

    const cycleDates = buildDateRange(cycle.start_date, cycle.end_date)
    const cycleWeekDates = new Map<string, Set<string>>()
    const cycleWeekEnds = new Map<string, string>()
    for (const date of cycleDates) {
      const bounds = getWeekBoundsForDate(date)
      if (!bounds) continue
      const dates = cycleWeekDates.get(bounds.weekStart) ?? new Set<string>()
      dates.add(date)
      cycleWeekDates.set(bounds.weekStart, dates)
      cycleWeekEnds.set(bounds.weekStart, bounds.weekEnd)
    }

    if (!overrideWeeklyRules) {
      const { data: therapistsData, error: therapistsError } = await supabase
        .from('profiles')
        .select('id, max_work_days_per_week, employment_type')
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true)
        .eq('on_fmla', false)

      if (therapistsError) {
        console.error('Failed to load therapists for publish validation:', therapistsError)
        redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
      }

      const therapists = (therapistsData ?? []) as Array<{
        id: string
        max_work_days_per_week: number | null
        employment_type: string | null
      }>
      const therapistIds = therapists.map((row) => row.id)
      const maxWorkDaysByTherapist = new Map<string, number>(
        therapists.map((therapist) => [
          therapist.id,
          getWeeklyLimitFromProfile({
            max_work_days_per_week: therapist.max_work_days_per_week,
            employment_type: therapist.employment_type,
          }),
        ])
      )
      const minWorkDaysByTherapist = new Map<string, number>(
        therapists.map((therapist) => {
          const weeklyLimit = maxWorkDaysByTherapist.get(therapist.id) ?? MAX_WORK_DAYS_PER_WEEK
          const baselineMinimum = getWeeklyMinimumForEmploymentType(therapist.employment_type)
          return [therapist.id, Math.min(weeklyLimit, baselineMinimum)]
        })
      )
      if (therapistIds.length > 0 && cycleWeekDates.size > 0) {
        const weekStarts = Array.from(cycleWeekDates.keys()).sort()
        const minWeekStart = weekStarts[0]
        const maxWeekEnd = cycleWeekEnds.get(weekStarts[weekStarts.length - 1]) ?? minWeekStart

        const { data: shiftsData, error: shiftsError } = await supabase
          .from('shifts')
          .select('user_id, date, status')
          .in('user_id', therapistIds)
          .gte('date', minWeekStart)
          .lte('date', maxWeekEnd)

        if (shiftsError) {
          console.error('Failed to load shifts for publish validation:', shiftsError)
          redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
        }

        const weeklyWorkedDatesByUserWeek = new Map<string, Set<string>>()
        for (const row of (shiftsData ?? []) as ShiftLimitRow[]) {
          if (!countsTowardWeeklyLimit(row.status)) continue
          const bounds = getWeekBoundsForDate(row.date)
          if (!bounds) continue
          const key = weeklyCountKey(row.user_id, bounds.weekStart)
          const workedDates = weeklyWorkedDatesByUserWeek.get(key) ?? new Set<string>()
          workedDates.add(row.date)
          weeklyWorkedDatesByUserWeek.set(key, workedDates)
        }

        const { underCount, overCount, violations } = summarizePublishWeeklyViolations({
          therapistIds,
          cycleWeekDates,
          weeklyWorkedDatesByUserWeek,
          maxWorkDaysByTherapist,
          minWorkDaysByTherapist,
        })
        if (violations > 0) {
          redirect(
            buildReturnUrl(cycleId, {
              ...viewParams,
              error: 'publish_weekly_rule_violation',
              violations: String(violations),
              under: String(underCount),
              over: String(overCount),
              override_weekly_rules: overrideWeeklyRules ? 'true' : undefined,
              override_shift_rules: overrideShiftRules ? 'true' : undefined,
              acknowledge_missing_availability: acknowledgeMissingAvailability ? 'true' : undefined,
            })
          )
        }
      }
    }

    const { data: shiftCoverageData, error: shiftCoverageError } = await supabase
      .from('shifts')
      .select(
        'id, date, shift_type, status, role, user_id, unfilled_reason, availability_override, availability_override_reason, availability_override_by, availability_override_at, profiles:profiles!shifts_user_id_fkey(full_name, is_lead_eligible)'
      )
      .eq('cycle_id', cycleId)
      .gte('date', cycle.start_date)
      .lte('date', cycle.end_date)

    if (shiftCoverageError) {
      console.error('Failed to load shifts for coverage validation:', shiftCoverageError)
      redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
    }

    const shiftCoverageRows = (shiftCoverageData ?? []) as ShiftPublishValidationRow[]
    const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
      supabase,
      shiftCoverageRows.map((row) => row.id)
    )

    if (!overrideShiftRules) {
      const slotValidation = summarizeShiftSlotViolations({
        cycleDates,
        assignments: shiftCoverageRows.map((row) => ({
          date: row.date,
          shiftType: row.shift_type,
          status: activeOperationalCodesByShiftId.has(row.id) ? 'called_off' : 'scheduled',
          role: row.role,
          therapistId: row.user_id,
          therapistName: getOne(row.profiles)?.full_name ?? 'Unknown',
          isLeadEligible: Boolean(getOne(row.profiles)?.is_lead_eligible),
        })),
        minCoveragePerShift: MIN_SHIFT_COVERAGE_PER_DAY,
        maxCoveragePerShift: MAX_SHIFT_COVERAGE_PER_DAY,
      })

      if (slotValidation.violations > 0) {
        redirect(
          buildReturnUrl(cycleId, {
            ...viewParams,
            error: 'publish_shift_rule_violation',
            under_coverage: String(slotValidation.underCoverage),
            over_coverage: String(slotValidation.overCoverage),
            lead_missing: String(slotValidation.missingLead),
            lead_multiple: String(slotValidation.multipleLeads),
            lead_ineligible: String(slotValidation.ineligibleLead),
            override_weekly_rules: overrideWeeklyRules ? 'true' : undefined,
            override_shift_rules: overrideShiftRules ? 'true' : undefined,
            acknowledge_missing_availability: acknowledgeMissingAvailability ? 'true' : undefined,
          })
        )
      }
    }

    const { data: availabilityOverrideData, error: availabilityOverrideError } = await supabase
      .from('availability_overrides')
      .select('therapist_id, cycle_id, date, shift_type, override_type, source, note')
      .eq('cycle_id', cycleId)

    if (availabilityOverrideError) {
      console.error(
        'Failed to load availability overrides for publish validation:',
        availabilityOverrideError
      )
      redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
    }

    const availabilityOverrides = (availabilityOverrideData ??
      []) as AvailabilityOverridePublishRow[]
    let expectedTherapistIds: string[] = []
    let submittedTherapistIds: string[] = []

    if (!acknowledgeMissingAvailability) {
      const { data: expectedTherapistsData, error: expectedTherapistsError } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true)
        .eq('on_fmla', false)
        .is('archived_at', null)
        .eq('site_id', cycle.site_id)

      if (expectedTherapistsError) {
        console.error(
          'Failed to load therapists for availability publish validation:',
          expectedTherapistsError
        )
        redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
      }

      expectedTherapistIds = ((expectedTherapistsData ?? []) as Array<{ id: string }>).map(
        (row) => row.id
      )

      const { data: submissionData, error: submissionError } = await supabase
        .from('therapist_availability_submissions')
        .select('therapist_id')
        .eq('schedule_cycle_id', cycleId)

      if (submissionError) {
        console.error(
          'Failed to load availability submissions for publish validation:',
          submissionError
        )
        redirect(buildReturnUrl(cycleId, { ...viewParams, error: 'publish_validation_failed' }))
      }

      submittedTherapistIds = ((submissionData ?? []) as Array<{ therapist_id: string }>).map(
        (row) => row.therapist_id
      )
    }

    const availabilitySummary = summarizeAvailabilityPublishIssues({
      overrides: availabilityOverrides.map((override) => ({
        ...override,
        source:
          override.source === 'manager' || override.source === 'therapist'
            ? override.source
            : undefined,
      })),
      scheduledShifts: shiftCoverageRows.map((row) => ({
        user_id: row.user_id,
        date: row.date,
        shift_type: row.shift_type,
        status: activeOperationalCodesByShiftId.has(row.id) ? 'called_off' : row.status,
        availability_override: row.availability_override,
        availability_override_reason: row.availability_override_reason,
        availability_override_by: row.availability_override_by,
        availability_override_at: row.availability_override_at,
      })),
      expectedTherapistIds,
      submittedTherapistIds,
    })

    if (
      availabilitySummary.needToWorkMisses > 0 ||
      availabilitySummary.needOffOverridesMissingReason > 0
    ) {
      redirect(
        buildReturnUrl(cycleId, {
          ...viewParams,
          error: 'publish_availability_rule_violation',
          need_to_work_misses: String(availabilitySummary.needToWorkMisses),
          need_off_overrides: String(availabilitySummary.needOffOverridesMissingReason),
          override_weekly_rules: overrideWeeklyRules ? 'true' : undefined,
          override_shift_rules: overrideShiftRules ? 'true' : undefined,
          acknowledge_missing_availability: acknowledgeMissingAvailability ? 'true' : undefined,
        })
      )
    }

    if (!acknowledgeMissingAvailability && availabilitySummary.missingAvailabilitySubmissions > 0) {
      redirect(
        buildReturnUrl(cycleId, {
          ...viewParams,
          error: 'publish_missing_availability_warning',
          missing_availability: String(availabilitySummary.missingAvailabilitySubmissions),
          override_weekly_rules: overrideWeeklyRules ? 'true' : undefined,
          override_shift_rules: overrideShiftRules ? 'true' : undefined,
        })
      )
    }
  }

  const publishMutationClient = createAdminClient() as unknown as PublishCycleMutationClient

  const { data: updatedCycle, error } = await publishMutationClient.rpc(
    'app_publish_schedule_cycle',
    {
      p_actor_id: user.id,
      p_cycle_id: cycleId,
    }
  )

  if (error) {
    console.error('Failed to toggle schedule publication state:', error)
    const publishError =
      !currentlyPublished && /resolve preliminary marks/i.test(error.message ?? '')
        ? 'publish_unresolved_preliminary_marks'
        : !currentlyPublished && /resolve preliminary requests/i.test(error.message ?? '')
          ? 'publish_unresolved_preliminary_requests'
          : !currentlyPublished && /another live block|same date range/i.test(error.message ?? '')
            ? 'publish_republish_conflict'
            : !currentlyPublished && /Need to Work|Need Off|availability/i.test(error.message ?? '')
              ? 'publish_availability_rule_violation'
              : !currentlyPublished &&
                  /designated lead|lead-capable assigned/i.test(error.message ?? '')
                ? 'publish_shift_rule_violation'
                : !currentlyPublished && /draft or preliminary/i.test(error.message ?? '')
                  ? 'publish_invalid_state'
                  : 'publish_failed'
    redirect(
      buildReturnUrl(cycleId, {
        ...viewParams,
        error: currentlyPublished ? 'unpublish_failed' : publishError,
      })
    )
  }

  const hasUpdatedCycle = Array.isArray(updatedCycle)
    ? updatedCycle.length > 0
    : Boolean(updatedCycle)

  if (!hasUpdatedCycle && !error) {
    redirect(
      buildReturnUrl(cycleId, {
        ...viewParams,
        error: currentlyPublished ? 'unpublish_state_changed' : 'publish_state_changed',
      })
    )
  }

  if (!currentlyPublished && !error && hasUpdatedCycle) {
    const emailConfig = getPublishEmailConfig()
    let publishEventId: string | null = null
    let publishedAt: string | null = null
    let recipientCount = 0
    let queuedCount = 0
    let sentCount = 0
    let failedCount = 0
    let emailQueueError: string | null = null

    await writeAuditLog(supabase, {
      userId: user.id,
      action: 'cycle_published',
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })

    const { data: therapistProfiles, error: therapistProfilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, notification_email_enabled')
      .in('role', ['therapist', 'lead'])
      .eq('is_active', true)

    if (therapistProfilesError) {
      console.error('Failed to load recipients for publish notifications:', therapistProfilesError)
      emailQueueError = 'recipient_lookup_failed'
    }

    const dedupedRecipients = Array.from(
      new Map(
        ((therapistProfiles ?? []) as PublishRecipientRow[])
          .filter((row) => Boolean(row.email) && row.notification_email_enabled !== false)
          .map((row) => [
            String(row.email ?? '')
              .trim()
              .toLowerCase(),
            {
              id: row.id,
              email: String(row.email ?? '')
                .trim()
                .toLowerCase(),
              fullName: row.full_name?.trim() || null,
            },
          ])
      ).values()
    )

    recipientCount = dedupedRecipients.length
    const therapistIds = dedupedRecipients.map((recipient) => recipient.id)
    const cycleLabel = publishCycleDetails?.label ?? 'Schedule Block'
    const cycleRange = publishCycleDetails
      ? `${publishCycleDetails.startDate} to ${publishCycleDetails.endDate}`
      : 'the current date range'

    const { data: publishEventRow, error: publishEventError } = await supabase
      .from('publish_events')
      .insert({
        cycle_id: cycleId,
        published_by: user.id,
        status: 'success',
        channel: 'email',
        recipient_count: recipientCount,
        queued_count: recipientCount,
        sent_count: 0,
        failed_count: 0,
        error_message: !emailConfig.configured
          ? 'Email not configured; schedule is still published in-app.'
          : null,
      })
      .select('id, published_at')
      .maybeSingle()

    if (publishEventError || !publishEventRow) {
      console.error('Failed to create publish event:', publishEventError)
      emailQueueError = 'publish_event_insert_failed'
    } else {
      publishEventId = publishEventRow.id
      publishedAt = publishEventRow.published_at
      const currentPublishEventId = publishEventRow.id

      if (dedupedRecipients.length > 0) {
        const { data: outboxRows, error: outboxError } = await supabase
          .from('notification_outbox')
          .upsert(
            dedupedRecipients.map((recipient) => ({
              publish_event_id: currentPublishEventId,
              user_id: recipient.id,
              email: recipient.email,
              name: recipient.fullName,
              channel: 'email',
              status: 'queued',
            })),
            { onConflict: 'publish_event_id,email,channel', ignoreDuplicates: true }
          )
          .select('id')

        if (outboxError) {
          console.error('Failed to queue publish emails:', outboxError)
          emailQueueError = 'notification_outbox_insert_failed'
          queuedCount = 0
          failedCount = recipientCount
          await supabase
            .from('publish_events')
            .update({
              status: 'failed',
              queued_count: 0,
              sent_count: 0,
              failed_count: failedCount,
              error_message: 'Could not queue email notifications.',
            })
            .eq('id', publishEventId)
        } else {
          queuedCount = outboxRows?.length ?? recipientCount
          await supabase
            .from('publish_events')
            .update({
              recipient_count: recipientCount,
              queued_count: queuedCount,
              sent_count: 0,
              failed_count: 0,
              status: 'success',
            })
            .eq('id', publishEventId)
        }
      } else {
        queuedCount = 0
        await supabase
          .from('publish_events')
          .update({
            recipient_count: 0,
            queued_count: 0,
            sent_count: 0,
            failed_count: 0,
            status: 'success',
          })
          .eq('id', publishEventId)
      }
    }

    await notifyUsers(supabase, {
      userIds: therapistIds,
      eventType: 'cycle_published',
      title: 'Cycle published',
      message: `${cycleLabel} (${cycleRange}) is now published.`,
      targetType: 'schedule_cycle',
      targetId: cycleId,
    })

    if (publishEventId && queuedCount > 0) {
      try {
        const admin = createAdminClient()
        const processResult = await processQueuedPublishEmails(admin, {
          publishEventId,
          batchSize: queuedCount,
        })

        if (processResult.publishEventCounts) {
          queuedCount = processResult.publishEventCounts.queuedCount
          sentCount = processResult.publishEventCounts.sentCount
          failedCount = processResult.publishEventCounts.failedCount
        }

        if (!processResult.emailConfigured) {
          emailQueueError = emailQueueError ?? 'email_not_configured'
        }
      } catch (processError) {
        console.error('Failed to process publish emails immediately:', processError)
        emailQueueError = emailQueueError ?? 'immediate_publish_process_failed'
      }
    }

    revalidatePath('/publish')
    if (publishEventId) {
      revalidatePath(`/publish/${publishEventId}`)
    }

    revalidatePath('/schedule')
    redirect(
      buildReturnUrl(cycleId, {
        ...viewParams,
        success: 'cycle_published',
        publish_event_id: publishEventId ?? undefined,
        recipient_count: String(recipientCount),
        queued_count: String(queuedCount),
        sent_count: String(sentCount),
        failed_count: String(failedCount),
        published_at: publishedAt ?? undefined,
        email_configured: emailConfig.configured ? 'true' : 'false',
        email_queue_error: emailQueueError ?? undefined,
      })
    )
  }

  revalidatePath('/schedule')
  redirect(
    buildReturnUrl(cycleId, {
      ...viewParams,
      success: 'cycle_published',
    })
  )
}
