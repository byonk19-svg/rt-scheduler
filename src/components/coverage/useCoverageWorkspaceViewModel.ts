'use client'

import { useMemo } from 'react'

import type { CycleRow, PreliminarySnapshotRow } from '@/app/(app)/coverage/coverage-page-snapshot'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import { countActive, type DayItem, type ShiftTab } from '@/lib/coverage/selectors'
import type { Role } from '@/lib/auth/roles'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { getScheduleFeedback } from '@/lib/schedule-helpers'
import type { ScheduleSearchParams } from '@/app/schedule/types'
import {
  COVERAGE_SHIFT_QUERY_KEY,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'
import {
  getCoverageActionBarStatusHint,
  getCoverageCycleRangeLabel,
  getCoverageNextActionLabel,
  getCoveragePlanningNotices,
  getCoverageSummary,
  getCoverageWorkspaceStatus,
} from '@/lib/coverage/coverage-workspace-state'

type CoverageViewMode = 'week' | 'calendar' | 'roster'
type RenderedCoverageViewMode = 'week' | 'roster'

function toRenderedCoverageViewMode(viewMode: CoverageViewMode): RenderedCoverageViewMode {
  return viewMode === 'roster' ? 'roster' : 'week'
}

export function useCoverageWorkspaceViewModel({
  activeCycleId,
  activeCyclePublished,
  activePreliminarySnapshot,
  actorRole,
  autoParam,
  availableCycles: _availableCycles,
  canManageCoverage,
  canUpdateAssignmentStatus,
  days,
  draftParam,
  error,
  errorParam,
  loading,
  overrideShiftRulesParam,
  overrideWeeklyRulesParam,
  printCycle,
  rosterProfiles,
  scheduleFeedbackParams,
  search,
  selectedCycleHasShiftRows,
  shiftTab,
  successParam,
  viewMode,
}: {
  activeCycleId: string | null
  activeCyclePublished: boolean
  activePreliminarySnapshot: PreliminarySnapshotRow | null
  actorRole: Role | null
  autoParam: string | null
  availableCycles: CycleRow[]
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  days: DayItem[]
  draftParam: string | null
  error: string
  errorParam: string | null
  loading: boolean
  overrideShiftRulesParam: string | null
  overrideWeeklyRulesParam: string | null
  printCycle: { label: string; start_date: string; end_date: string } | null
  rosterProfiles: RosterMemberRow[]
  scheduleFeedbackParams: ScheduleSearchParams
  search: URLSearchParams
  selectedCycleHasShiftRows: boolean
  shiftTab: ShiftTab
  successParam: string | null
  viewMode: CoverageViewMode
}) {
  const publishErrorMessage = useMemo(() => {
    if (!errorParam) return null
    const feedback = getScheduleFeedback(scheduleFeedbackParams)
    if (feedback?.variant === 'error') return feedback.message
    return `Publish blocked: ${errorParam.replaceAll('_', ' ')}.`
  }, [errorParam, scheduleFeedbackParams])

  const autoDraftFeedback = useMemo(() => {
    if (!autoParam && !draftParam) return null
    return getScheduleFeedback(scheduleFeedbackParams)
  }, [autoParam, draftParam, scheduleFeedbackParams])

  const publishOverrideConfig = useMemo(() => {
    if (errorParam === 'publish_weekly_rule_violation') {
      return {
        weekly: 'true',
        shift: overrideShiftRulesParam === 'true' ? 'true' : 'false',
        label: 'Publish with weekly override',
        description: 'Bypass weekly workload validation for this publish only.',
      }
    }

    if (errorParam === 'publish_shift_rule_violation') {
      return {
        weekly: overrideWeeklyRulesParam === 'true' ? 'true' : 'false',
        shift: 'true',
        label: 'Publish with shift override',
        description: 'Bypass shift coverage and lead validation for this publish only.',
      }
    }

    return null
  }, [errorParam, overrideShiftRulesParam, overrideWeeklyRulesParam])

  const issueCount = useMemo(
    () => days.filter((day) => day.dayStatus === 'missing_lead').length,
    [days]
  )

  const weekRosterHref = useMemo(() => {
    const params = new URLSearchParams()
    if (activeCycleId) params.set('cycle', activeCycleId)
    params.set('view', viewMode)
    params.set(COVERAGE_SHIFT_QUERY_KEY, shiftTabToQueryValue(shiftTab))
    return `/coverage?${params.toString()}`
  }, [activeCycleId, shiftTab, viewMode])

  const renderedViewMode = useMemo(
    () => toRenderedCoverageViewMode(viewMode),
    [viewMode]
  )

  const preliminaryLive = Boolean(activePreliminarySnapshot)
  const preliminarySentLabel = useMemo(() => {
    if (!activePreliminarySnapshot) return null
    return new Date(activePreliminarySnapshot.sent_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [activePreliminarySnapshot])

  const showFullPrintRoster = canManageCoverage || actorRole === 'lead'
  const rosterMembers = useMemo<RosterMemberRow[]>(() => rosterProfiles, [rosterProfiles])
  const noCycleSelected = !loading && !activeCycleId
  const showEmptyDraftState = !loading && Boolean(activeCycleId) && !selectedCycleHasShiftRows
  const cycleRangeLabel = useMemo(
    () => getCoverageCycleRangeLabel(printCycle, formatHumanCycleRange),
    [printCycle]
  )
  const { workspaceStatusTone, workspaceStatusLabel } = useMemo(
    () => getCoverageWorkspaceStatus({ noCycleSelected, activeCyclePublished, showEmptyDraftState }),
    [activeCyclePublished, noCycleSelected, showEmptyDraftState]
  )
  const coverageSummary = useMemo(() => getCoverageSummary(days), [days])
  const hasSchedulingContent = selectedCycleHasShiftRows && days.length > 0
  const canRunAutoDraft = Boolean(activeCycleId) && !activeCyclePublished
  const canSendPreliminary = Boolean(activeCycleId) && !activeCyclePublished && selectedCycleHasShiftRows
  const canPublishCycle = Boolean(activeCycleId) && selectedCycleHasShiftRows
  const reviewTargetDay = useMemo(
    () => days.find((day) => day.constraintBlocked || !day.leadShift || countActive(day) < 3) ?? null,
    [days]
  )
  const reviewTargetIndex = useMemo(() => {
    if (!reviewTargetDay) return -1
    return days.findIndex((day) => day.id === reviewTargetDay.id)
  }, [days, reviewTargetDay])
  const coverageWorkflowSteps = ['1 Draft', '2 Review', '3 Send preliminary', '4 Publish'] as const
  const actionBarStatusHint = getCoverageActionBarStatusHint({
    noCycleSelected,
    selectedCycleHasShiftRows,
    activeCyclePublished,
    canSendPreliminary,
    canPublishCycle,
  })
  const nextActionLabel = getCoverageNextActionLabel({
    noCycleSelected,
    canManageCoverage,
    showEmptyDraftState,
    activeCyclePublished,
  })
  const planningNotices = getCoveragePlanningNotices({
    successParam,
    errorParam,
    autoDraftFeedbackMessage: autoDraftFeedback?.message ?? null,
    publishErrorMessage,
    error,
  })

  return {
    actionBarStatusHint,
    canPublishCycle,
    canRunAutoDraft,
    canSendPreliminary,
    coverageSummary,
    coverageWorkflowSteps,
    cycleRangeLabel,
    hasSchedulingContent,
    issueCount,
    nextActionLabel,
    noCycleSelected,
    planningNotices,
    preliminaryLive,
    preliminarySentLabel,
    publishErrorMessage,
    publishOverrideConfig,
    renderedViewMode,
    reviewTargetDay,
    reviewTargetIndex,
    rosterMembers,
    showEmptyDraftState,
    showFullPrintRoster,
    weekRosterHref,
    workspaceStatusLabel,
    workspaceStatusTone,
  }
}
