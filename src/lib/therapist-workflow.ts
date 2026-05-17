import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { resolveTherapistAvailabilityWritePermission } from '@/lib/therapist-availability-submission'

export type TherapistWorkflowState =
  | 'availability_not_started'
  | 'availability_draft'
  | 'availability_submitted'
  | 'preliminary_review_available'
  | 'published_schedule_available'
  | 'cycle_closed'

export type TherapistWorkflowCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  availability_due_at?: string | null
}

export type TherapistWorkflowPreliminarySnapshot = {
  cycle_id: string
  status: 'active' | 'superseded' | 'closed'
}

export type TherapistWorkflowPublishedShift = {
  cycle_id: string
  date: string
}

export type TherapistWorkflowSubmission = {
  submittedAt: string
  lastEditedAt: string
}

export type TherapistWorkflowLink = {
  href: string
  label: string
}

export type TherapistShiftPostSummary = {
  pendingCount: number
  totalCount: number
}

export type TherapistWorkflowModel = {
  state: TherapistWorkflowState
  stateLabel: string
  primaryTitle: string
  primaryDescription: string
  actionCycle: TherapistWorkflowCycle | null
  cycleLabel: string | null
  cycleRangeLabel: string | null
  cycleReason: string | null
  primaryAction: TherapistWorkflowLink
  secondaryAction: TherapistWorkflowLink | null
  scheduleAction: TherapistWorkflowLink | null
  swapSummary: TherapistShiftPostSummary
  publishedShiftSummary: {
    cycleId: string | null
    upcomingCount: number
  }
}

function sortCyclesByStartDate(cycles: TherapistWorkflowCycle[]): TherapistWorkflowCycle[] {
  return [...cycles].sort((left, right) => left.start_date.localeCompare(right.start_date))
}

function getActivePreliminaryCycleId(
  preliminarySnapshots: TherapistWorkflowPreliminarySnapshot[]
): string | null {
  return preliminarySnapshots.find((snapshot) => snapshot.status === 'active')?.cycle_id ?? null
}

function resolveUpcomingPublishedCycle(params: {
  todayKey: string
  cycles: TherapistWorkflowCycle[]
  publishedShifts: TherapistWorkflowPublishedShift[]
}): { cycle: TherapistWorkflowCycle | null; upcomingCount: number } {
  const publishedShiftCounts = new Map<string, number>()

  for (const shift of params.publishedShifts) {
    if (shift.date < params.todayKey) continue
    publishedShiftCounts.set(shift.cycle_id, (publishedShiftCounts.get(shift.cycle_id) ?? 0) + 1)
  }

  const publishedCycles = sortCyclesByStartDate(params.cycles).filter((cycle) => cycle.published)
  const cycleWithUpcomingShift =
    publishedCycles.find((cycle) => (publishedShiftCounts.get(cycle.id) ?? 0) > 0) ?? null

  if (cycleWithUpcomingShift) {
    return {
      cycle: cycleWithUpcomingShift,
      upcomingCount: publishedShiftCounts.get(cycleWithUpcomingShift.id) ?? 0,
    }
  }

  const currentOrUpcomingPublished =
    publishedCycles.find((cycle) => cycle.end_date >= params.todayKey) ?? null

  if (!currentOrUpcomingPublished) {
    return { cycle: null, upcomingCount: 0 }
  }

  return {
    cycle: currentOrUpcomingPublished,
    upcomingCount: publishedShiftCounts.get(currentOrUpcomingPublished.id) ?? 0,
  }
}

export function resolveTherapistAvailabilityCycleId(params: {
  todayKey: string
  cycles: TherapistWorkflowCycle[]
  preliminarySnapshots: TherapistWorkflowPreliminarySnapshot[]
}): string | null {
  const activePreliminaryCycleId = getActivePreliminaryCycleId(params.preliminarySnapshots)

  return (
    sortCyclesByStartDate(params.cycles).find(
      (cycle) =>
        !cycle.published &&
        cycle.end_date >= params.todayKey &&
        cycle.id !== activePreliminaryCycleId
    )?.id ?? null
  )
}

export function resolveTherapistActionCycleId(params: {
  todayKey: string
  cycles: TherapistWorkflowCycle[]
  preliminarySnapshots: TherapistWorkflowPreliminarySnapshot[]
}): string | null {
  const activePreliminaryCycleId = getActivePreliminaryCycleId(params.preliminarySnapshots)
  if (activePreliminaryCycleId) return activePreliminaryCycleId

  return resolveTherapistAvailabilityCycleId(params)
}

export function resolveTherapistWorkflow(params: {
  todayKey: string
  cycles: TherapistWorkflowCycle[]
  availabilityEntryCountsByCycleId: Record<string, number>
  submissionsByCycleId: Record<string, TherapistWorkflowSubmission>
  preliminarySnapshots: TherapistWorkflowPreliminarySnapshot[]
  publishedShifts: TherapistWorkflowPublishedShift[]
  relevantShiftPostSummary: TherapistShiftPostSummary
  now?: Date
}): TherapistWorkflowModel {
  const orderedCycles = sortCyclesByStartDate(params.cycles)
  const activePreliminaryCycleId = getActivePreliminaryCycleId(params.preliminarySnapshots)
  const actionCycleId = resolveTherapistActionCycleId({
    todayKey: params.todayKey,
    cycles: orderedCycles,
    preliminarySnapshots: params.preliminarySnapshots,
  })
  const actionCycle = orderedCycles.find((cycle) => cycle.id === actionCycleId) ?? null
  const publishedSchedule = resolveUpcomingPublishedCycle({
    todayKey: params.todayKey,
    cycles: orderedCycles,
    publishedShifts: params.publishedShifts,
  })

  const scheduleAction = publishedSchedule.cycle
    ? {
        href: `/schedule?cycle=${publishedSchedule.cycle.id}`,
        label: 'View schedule',
      }
    : null

  if (actionCycle) {
    const cycleRangeLabel = formatHumanCycleRange(actionCycle.start_date, actionCycle.end_date)
    const cycleLink = `/therapist/availability?cycle=${actionCycle.id}`

    if (actionCycle.id === activePreliminaryCycleId) {
      return {
        state: 'preliminary_review_available',
        stateLabel: 'Review preliminary schedule',
        primaryTitle: 'Review preliminary schedule',
        primaryDescription:
          'The manager has posted a preliminary schedule for this Schedule Block. Review your assignments there now.',
        actionCycle,
        cycleLabel: actionCycle.label,
        cycleRangeLabel,
        cycleReason: 'This is the current Schedule Block with a live preliminary schedule.',
        primaryAction: {
          href: '/preliminary',
          label: 'Review preliminary schedule',
        },
        secondaryAction: scheduleAction,
        scheduleAction,
        swapSummary: params.relevantShiftPostSummary,
        publishedShiftSummary: {
          cycleId: publishedSchedule.cycle?.id ?? null,
          upcomingCount: publishedSchedule.upcomingCount,
        },
      }
    }

    const submission = params.submissionsByCycleId[actionCycle.id]
    const draftEntryCount = params.availabilityEntryCountsByCycleId[actionCycle.id] ?? 0
    const writePermission = resolveTherapistAvailabilityWritePermission(
      actionCycle,
      Boolean(submission),
      params.now
    )
    const availabilityPastDue =
      !submission && !writePermission.allowed && writePermission.reason === 'deadline_passed'

    if (!writePermission.allowed && !submission && writePermission.reason === 'cycle_ended') {
      return {
        state: 'cycle_closed',
        stateLabel: 'Schedule Block closed',
        primaryTitle: 'Schedule closed',
        primaryDescription:
          'Availability entry is closed for the active Schedule Block. Review history or wait for the next published schedule.',
        actionCycle,
        cycleLabel: actionCycle.label,
        cycleRangeLabel,
        cycleReason: 'This Schedule Block no longer accepts therapist availability changes.',
        primaryAction: {
          href: '/staff/history',
          label: 'View history',
        },
        secondaryAction: scheduleAction,
        scheduleAction,
        swapSummary: params.relevantShiftPostSummary,
        publishedShiftSummary: {
          cycleId: publishedSchedule.cycle?.id ?? null,
          upcomingCount: publishedSchedule.upcomingCount,
        },
      }
    }

    if (submission) {
      return {
        state: 'availability_submitted',
        stateLabel: 'Submitted',
        primaryTitle: 'Availability sent',
        primaryDescription:
          'Your availability is in for the next schedule. You can review it here while the schedule is being built.',
        actionCycle,
        cycleLabel: actionCycle.label,
        cycleRangeLabel,
        cycleReason: 'This is the next Schedule Block waiting on manager scheduling work.',
        primaryAction: {
          href: cycleLink,
          label: 'Review submitted availability',
        },
        secondaryAction: scheduleAction,
        scheduleAction,
        swapSummary: params.relevantShiftPostSummary,
        publishedShiftSummary: {
          cycleId: publishedSchedule.cycle?.id ?? null,
          upcomingCount: publishedSchedule.upcomingCount,
        },
      }
    }

    if (draftEntryCount > 0) {
      return {
        state: 'availability_draft',
        stateLabel: 'Draft saved',
        primaryTitle: availabilityPastDue
          ? 'Availability is past due'
          : 'Finish and send your availability',
        primaryDescription: availabilityPastDue
          ? 'You have a saved draft, but it was not sent before the deadline. Review it and contact your manager if you still need changes.'
          : 'You already started the next schedule. Finish it and send it so it counts.',
        actionCycle,
        cycleLabel: actionCycle.label,
        cycleRangeLabel,
        cycleReason: 'This is the next Schedule Block still waiting on your response.',
        primaryAction: {
          href: cycleLink,
          label: availabilityPastDue ? 'Review draft availability' : 'Finish and send availability',
        },
        secondaryAction: scheduleAction,
        scheduleAction,
        swapSummary: params.relevantShiftPostSummary,
        publishedShiftSummary: {
          cycleId: publishedSchedule.cycle?.id ?? null,
          upcomingCount: publishedSchedule.upcomingCount,
        },
      }
    }

    return {
      state: 'availability_not_started',
      stateLabel: 'Not started',
      primaryTitle: availabilityPastDue ? 'Availability is past due' : 'Tell us when you can work',
      primaryDescription: availabilityPastDue
        ? 'The due date passed before you sent this availability. Review the Schedule Block and contact your manager if you still need changes.'
        : 'The next schedule is open. Add your availability so the manager can build it.',
      actionCycle,
      cycleLabel: actionCycle.label,
      cycleRangeLabel,
      cycleReason: 'This is the next Schedule Block that still needs your response.',
      primaryAction: {
        href: cycleLink,
        label: availabilityPastDue ? 'Review availability' : 'Start availability',
      },
      secondaryAction: scheduleAction,
      scheduleAction,
      swapSummary: params.relevantShiftPostSummary,
      publishedShiftSummary: {
        cycleId: publishedSchedule.cycle?.id ?? null,
        upcomingCount: publishedSchedule.upcomingCount,
      },
    }
  }

  if (publishedSchedule.cycle) {
    return {
      state: 'published_schedule_available',
      stateLabel: 'Final schedule ready',
      primaryTitle: 'Final schedule ready',
      primaryDescription:
        publishedSchedule.upcomingCount > 0
          ? 'Your published shifts are ready. Use the schedule page for your finalized assignments.'
          : 'A published schedule is available even though you have no upcoming shifts assigned yet.',
      actionCycle: publishedSchedule.cycle,
      cycleLabel: publishedSchedule.cycle.label,
      cycleRangeLabel: formatHumanCycleRange(
        publishedSchedule.cycle.start_date,
        publishedSchedule.cycle.end_date
      ),
      cycleReason: 'This is the current published schedule available to therapists.',
      primaryAction: {
        href: `/schedule?cycle=${publishedSchedule.cycle.id}`,
        label: 'View schedule',
      },
      secondaryAction: {
        href: '/therapist/swaps',
        label: 'Shift Swaps & Pickups',
      },
      scheduleAction,
      swapSummary: params.relevantShiftPostSummary,
      publishedShiftSummary: {
        cycleId: publishedSchedule.cycle.id,
        upcomingCount: publishedSchedule.upcomingCount,
      },
    }
  }

  const latestClosedCycle = [...orderedCycles]
    .filter((cycle) => cycle.end_date < params.todayKey)
    .sort((left, right) => right.end_date.localeCompare(left.end_date))[0]

  return {
    state: 'cycle_closed',
    stateLabel: 'Schedule Block closed',
    primaryTitle: 'Schedule closed',
    primaryDescription:
      'There is no open therapist workflow right now. Use history for past activity and wait for the next Schedule Block to open.',
    actionCycle: latestClosedCycle ?? null,
    cycleLabel: latestClosedCycle?.label ?? null,
    cycleRangeLabel: latestClosedCycle
      ? formatHumanCycleRange(latestClosedCycle.start_date, latestClosedCycle.end_date)
      : null,
    cycleReason: latestClosedCycle
      ? 'The latest therapist Schedule Block has ended.'
      : 'There is no active therapist Schedule Block yet.',
    primaryAction: {
      href: '/staff/history',
      label: 'View history',
    },
    secondaryAction: scheduleAction,
    scheduleAction,
    swapSummary: params.relevantShiftPostSummary,
    publishedShiftSummary: {
      cycleId: null,
      upcomingCount: publishedSchedule.upcomingCount,
    },
  }
}
