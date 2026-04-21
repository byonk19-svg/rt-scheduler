'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { WorkspaceMetricTone } from '@/components/coverage/coverage-workspace-chrome'
import { CoverageWorkspaceActionForms } from '@/components/coverage/CoverageWorkspaceActionForms'
import { CoverageWorkspaceHeader } from '@/components/coverage/CoverageWorkspaceHeader'
import { CoverageWorkspaceControls } from '@/components/coverage/CoverageWorkspaceControls'
import { CoverageWorkspaceBanners } from '@/components/coverage/CoverageWorkspaceBanners'
import { CoverageWorkspaceMetrics } from '@/components/coverage/CoverageWorkspaceMetrics'
import { CoverageWorkspaceOverlays } from '@/components/coverage/CoverageWorkspaceOverlays'
import { CoverageWorkspaceScheduleSurface } from '@/components/coverage/CoverageWorkspaceScheduleSurface'
import { useCoverageWorkspaceAssignments } from '@/components/coverage/useCoverageWorkspaceAssignments'
import { useCoverageSelectedDayContext } from '@/components/coverage/useCoverageSelectedDayContext'
import { useCoverageWorkspaceSearchState } from '@/components/coverage/useCoverageWorkspaceSearchState'
import { useCoverageWorkspaceSnapshotState } from '@/components/coverage/useCoverageWorkspaceSnapshotState'
import { useCoverageWorkspaceUiState } from '@/components/coverage/useCoverageWorkspaceUiState'
import { useCoverageWorkspaceViewModel } from '@/components/coverage/useCoverageWorkspaceViewModel'

import {
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  sendPreliminaryScheduleAction,
  toggleCyclePublishedAction,
} from '@/app/schedule/actions'
import type {
  CoveragePageSnapshot,
} from '@/app/(app)/coverage/coverage-page-snapshot'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import {
  countActive,
  type DayItem,
  type ShiftTab,
} from '@/lib/coverage/selectors'
import type { Role } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/client'
import { getCoverageWorkspaceDescription } from '@/lib/coverage/coverage-workspace-state'

type CoverageViewMode = 'week' | 'calendar' | 'roster'

export function CoverageClientPage({
  initialShiftTab,
  shiftTabLockedFromUrl,
  initialViewMode,
  initialSnapshot,
}: {
  initialShiftTab: ShiftTab
  shiftTabLockedFromUrl: boolean
  initialViewMode: CoverageViewMode
  initialSnapshot: CoveragePageSnapshot
}) {
  const search = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const therapistOptionsByShift = initialSnapshot.allTherapistsByShift
  const rosterProfilesByShift = initialSnapshot.rosterProfilesByShift
  const {
    autoParam,
    draftParam,
    errorParam,
    overrideShiftRulesParam,
    overrideWeeklyRulesParam,
    scheduleFeedbackParams,
    successParam,
    urlShiftTab,
  } = useCoverageWorkspaceSearchState(search)
  const [shiftTab, setShiftTab] = useState<ShiftTab>(() => initialShiftTab)
  const [viewMode, setViewMode] = useState<CoverageViewMode>(() => initialViewMode)
  const profileDefaultAppliedRef = useRef(shiftTabLockedFromUrl)
  const [assigning, setAssigning] = useState(false)
  const [unassigningShiftId, setUnassigningShiftId] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<string>('')
  const [rosterCellError, setRosterCellError] = useState<{
    dayId: string
    memberId: string
    message: string
  } | null>(null)
  const autoDraftFormRef = useRef<HTMLFormElement>(null)
  const clearDraftFormRef = useRef<HTMLFormElement>(null)
  const {
    activeCycleId,
    activeCyclePublished,
    activeOpCodes,
    activePreliminarySnapshot,
    actorRole,
    allTherapists,
    availableCycles,
    canManageCoverage,
    canUpdateAssignmentStatus,
    dayDays,
    error,
    loading,
    nightDays,
    printCycle,
    printCycleDates,
    printDayTeam,
    printNightTeam,
    printShiftByUserDate,
    printUsers,
    rosterProfiles,
    selectedCycleHasShiftRows,
    setActiveOpCodes,
    setDayDays,
    setError,
    setLoading,
    setNightDays,
  } = useCoverageWorkspaceSnapshotState({
    initialSnapshot,
    initialShiftTab,
    onSnapshotReset: () => {
      setAssignError('')
      setRosterCellError(null)
    },
    profileDefaultAppliedRef,
    rosterProfilesByShift,
    setShiftTab,
    shiftTab,
    shiftTabLockedFromUrl,
    therapistOptionsByShift,
  })
  const days = shiftTab === 'Day' ? dayDays : nightDays
  const setDays = shiftTab === 'Day' ? setDayDays : setNightDays
  const totalWeeks = Math.max(Math.ceil(days.length / 7), 1)
  useEffect(() => {
    if (urlShiftTab != null) {
      setShiftTab(urlShiftTab)
      profileDefaultAppliedRef.current = true
    }
  }, [urlShiftTab])

  useEffect(() => {
    setViewMode(initialViewMode)
  }, [initialViewMode])
  const {
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
  } = useCoverageWorkspaceViewModel({
    activeCycleId,
    activeCyclePublished,
    activePreliminarySnapshot,
    actorRole,
    autoParam,
    availableCycles,
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
  })
  const {
    clearDraftDialogOpen,
    cycleDialogOpen,
    handleClose,
    handleReviewStep,
    handleRosterOpenEditor,
    handleSelect,
    handleTabSwitch,
    handleViewModeChange,
    openCycleDialog,
    openPreflightDialog,
    openSaveAsTemplateDialog,
    openTemplateTarget,
    preFlightDialogOpen,
    saveAsTemplateDialogOpen,
    selectedId,
    setClearDraftDialogOpen,
    setCycleDialogOpen,
    setPreFlightDialogOpen,
    setSaveAsTemplateDialogOpen,
    setShowPlanningDetails,
    setTemplateTarget,
    setWeekOffset,
    showPlanningDetails,
    templateTarget,
    weekOffset,
  } = useCoverageWorkspaceUiState({
    activeCycleId,
    pathname,
    printCycle,
    profileDefaultAppliedRef,
    reviewTargetDay,
    reviewTargetIndex,
    router,
    search,
    setAssignError,
    setAssigning,
    setRosterCellError,
    setShiftTab,
    setViewMode,
    shiftTab,
    totalWeeks,
  })
  const deferredSelectedId = useDeferredValue(selectedId)
  const { hasOperationalEntries, isPastDate, selectedDay, weeklyTherapistCounts } =
    useCoverageSelectedDayContext({
      activeOpCodes,
      dayDays,
      days,
      nightDays,
      selectedId,
      shiftTab,
    })
  const { handleAssignTherapist, handleChangeStatus, handleUnassign } =
    useCoverageWorkspaceAssignments({
      activeCycleId,
      allTherapists,
      canUpdateAssignmentStatus,
      days,
      selectedDayId: selectedDay?.id ?? null,
      setActiveOpCodes,
      setAssignError,
      setAssigning,
      setDays,
      setError,
      setRosterCellError,
      setUnassigningShiftId,
      shiftTab,
      supabase,
      unassigningShiftId,
      router,
    })

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print">
        <CoverageWorkspaceActionForms
          activeCycleId={activeCycleId}
          autoDraftFormRef={autoDraftFormRef}
          clearDraftFormRef={clearDraftFormRef}
          generateDraftScheduleAction={generateDraftScheduleAction}
          resetDraftScheduleAction={resetDraftScheduleAction}
        />

        <CoverageWorkspaceHeader
          activeCycleId={activeCycleId}
          activeCyclePublished={activeCyclePublished}
          actionBarStatusHint={actionBarStatusHint}
          canManageCoverage={canManageCoverage}
          canPublishCycle={canPublishCycle}
          canRunAutoDraft={canRunAutoDraft}
          canSendPreliminary={canSendPreliminary}
          coverageWorkflowSteps={coverageWorkflowSteps}
          cycleRangeLabel={cycleRangeLabel}
          descriptionText={getCoverageWorkspaceDescription({
            noCycleSelected,
            canManageCoverage,
            showEmptyDraftState,
            canUpdateAssignmentStatus,
          })}
          onOpenClearDraft={() => setClearDraftDialogOpen(true)}
          onOpenCycleDialog={openCycleDialog}
          onOpenPreflight={openPreflightDialog}
          onOpenReviewStep={handleReviewStep}
          onOpenSaveAsTemplate={openSaveAsTemplateDialog}
          onPrint={() => window.print()}
          preliminaryLive={preliminaryLive}
          publishAction={toggleCyclePublishedAction}
          sendPreliminaryAction={sendPreliminaryScheduleAction}
          showEmptyDraftState={showEmptyDraftState}
          workspaceStatusLabel={workspaceStatusLabel}
          workspaceStatusTone={workspaceStatusTone}
        />
      </div>

      <div className="no-print px-5 py-4">
        <div className="space-y-4">
          {!noCycleSelected ? (
            <CoverageWorkspaceControls
              activeCycleId={activeCycleId}
              availableCycles={availableCycles}
              renderedViewMode={renderedViewMode}
              shiftTab={shiftTab}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onShiftTabChange={handleTabSwitch}
            />
          ) : null}

          {!noCycleSelected ? (
            <CoverageWorkspaceMetrics
              activeStaffCount={rosterMembers.length}
              issueCount={issueCount}
              priorityGapDays={coverageSummary.priorityGapDays}
              staffedDays={coverageSummary.staffedDays}
              shiftTab={shiftTab}
              unassignedDays={coverageSummary.unassignedDays}
            />
          ) : null}

          <CoverageWorkspaceBanners
            activeCycleId={activeCycleId}
            activeCyclePublished={activeCyclePublished}
            canManageCoverage={canManageCoverage}
            canRunAutoDraft={canRunAutoDraft}
            canStartFromTemplate={Boolean(activeCycleId && printCycle)}
            nextActionLabel={nextActionLabel}
            noCycleSelected={noCycleSelected}
            planningNotices={planningNotices}
            preliminaryLive={preliminaryLive}
            preliminarySentLabel={preliminarySentLabel}
            publishAction={toggleCyclePublishedAction}
            publishOverrideConfig={publishOverrideConfig}
            renderedViewMode={renderedViewMode}
            showEmptyDraftState={showEmptyDraftState}
            showPlanningDetails={showPlanningDetails}
            weekRosterHref={weekRosterHref}
            workspaceStatusTone={workspaceStatusTone}
            onAssignFirstDay={() => {
              const first = days[0]
              if (first) handleSelect(first.id)
            }}
            onOpenCycleDialog={openCycleDialog}
            onOpenPreflight={openPreflightDialog}
            onOpenTemplateTarget={openTemplateTarget}
            onTogglePlanningDetails={() => setShowPlanningDetails((current) => !current)}
          />

          {!noCycleSelected ? (
            <CoverageWorkspaceScheduleSurface
              renderedViewMode={renderedViewMode}
              shiftTab={shiftTab}
              cycleRangeLabel={cycleRangeLabel}
              hasSchedulingContent={hasSchedulingContent}
              printCycleDates={printCycleDates}
              rosterMembers={rosterMembers}
              days={days}
              canManageCoverage={canManageCoverage}
              canUpdateAssignmentStatus={canUpdateAssignmentStatus}
              deferredSelectedId={deferredSelectedId}
              rosterCellError={rosterCellError}
              loading={loading}
              selectedId={selectedId}
              weekOffset={weekOffset}
              totalWeeks={totalWeeks}
              onRosterOpenEditor={handleRosterOpenEditor}
              onSelect={handleSelect}
              onChangeStatus={handleChangeStatus}
              onWeekOffsetChange={setWeekOffset}
            />
          ) : null}
        </div>
      </div>

      <CoverageWorkspaceOverlays
        activeCycleId={activeCycleId}
        activeCyclePublished={activeCyclePublished}
        allTherapists={allTherapists}
        applyAutoDraft={() => autoDraftFormRef.current?.requestSubmit()}
        assigning={assigning}
        availableCycles={availableCycles}
        canManageCoverage={canManageCoverage}
        clearDraftDialogOpen={clearDraftDialogOpen}
        clearDraftFormRef={clearDraftFormRef}
        cycleDialogOpen={cycleDialogOpen}
        handleAssignTherapist={handleAssignTherapist}
        handleClose={handleClose}
        handleUnassign={handleUnassign}
        hasOperationalEntries={hasOperationalEntries}
        isPastDate={isPastDate}
        preFlightDialogOpen={preFlightDialogOpen}
        printCycle={printCycle}
        printCycleDates={printCycleDates}
        printDayTeam={printDayTeam}
        printNightTeam={printNightTeam}
        printShiftByUserDate={printShiftByUserDate}
        printUsers={printUsers}
        saveAsTemplateDialogOpen={saveAsTemplateDialogOpen}
        selectedDay={selectedDay}
        setClearDraftDialogOpen={setClearDraftDialogOpen}
        setCycleDialogOpen={setCycleDialogOpen}
        setPreFlightDialogOpen={setPreFlightDialogOpen}
        setSaveAsTemplateDialogOpen={setSaveAsTemplateDialogOpen}
        setTemplateTarget={setTemplateTarget}
        showFullPrintRoster={showFullPrintRoster}
        templateTarget={templateTarget}
        unassigningShiftId={unassigningShiftId}
        weeklyTherapistCounts={weeklyTherapistCounts}
        assignError={assignError}
      />
    </div>
  )
}
