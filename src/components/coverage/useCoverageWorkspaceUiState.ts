'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { ReadonlyURLSearchParams } from 'next/navigation'

import type { ShiftTab } from '@/lib/coverage/selectors'
import {
  COVERAGE_SHIFT_QUERY_KEY,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'

type TemplateTarget = { cycleId: string; startDate: string } | null

export function useCoverageWorkspaceUiState({
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
}: {
  activeCycleId: string | null
  pathname: string
  printCycle: { start_date: string } | null
  profileDefaultAppliedRef: MutableRefObject<boolean>
  reviewTargetDay: { id: string } | null
  reviewTargetIndex: number
  router: AppRouterInstance
  search: ReadonlyURLSearchParams
  setAssignError: Dispatch<SetStateAction<string>>
  setAssigning: Dispatch<SetStateAction<boolean>>
  setRosterCellError: Dispatch<
    SetStateAction<{ dayId: string; memberId: string; message: string } | null>
  >
  setShiftTab: Dispatch<SetStateAction<ShiftTab>>
  setViewMode: Dispatch<SetStateAction<'week' | 'calendar' | 'roster'>>
  shiftTab: ShiftTab
  totalWeeks: number
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [preFlightDialogOpen, setPreFlightDialogOpen] = useState(false)
  const [clearDraftDialogOpen, setClearDraftDialogOpen] = useState(false)
  const [saveAsTemplateDialogOpen, setSaveAsTemplateDialogOpen] = useState(false)
  const [templateTarget, setTemplateTarget] = useState<TemplateTarget>(null)
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [showPlanningDetails, setShowPlanningDetails] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setWeekOffset(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeCycleId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setWeekOffset((current) => Math.min(current, Math.max(totalWeeks - 1, 0)))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [totalWeeks])

  const clearInlineFeedback = useCallback(() => {
    setAssignError('')
    setRosterCellError(null)
  }, [setAssignError, setRosterCellError])

  const handleReviewStep = useCallback(() => {
    setViewMode('week')
    const params = new URLSearchParams(search.toString())
    params.set('view', 'week')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setShowPlanningDetails(true)
    if (!reviewTargetDay || reviewTargetIndex < 0) {
      return
    }
    setSelectedId(reviewTargetDay.id)
    setWeekOffset(Math.floor(reviewTargetIndex / 7))
    clearInlineFeedback()
  }, [clearInlineFeedback, pathname, reviewTargetDay, reviewTargetIndex, router, search, setViewMode])

  const handleTabSwitch = useCallback(
    (tab: ShiftTab) => {
      setShiftTab(tab)
      profileDefaultAppliedRef.current = true
      setSelectedId(null)
      clearInlineFeedback()
      const params = new URLSearchParams(search.toString())
      params.set(COVERAGE_SHIFT_QUERY_KEY, shiftTabToQueryValue(tab))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [clearInlineFeedback, pathname, profileDefaultAppliedRef, router, search, setShiftTab]
  )

  const handleViewModeChange = useCallback(
    (nextViewMode: 'week' | 'roster') => {
      setViewMode(nextViewMode)
      setSelectedId(null)
      clearInlineFeedback()
      const params = new URLSearchParams(search.toString())
      params.set('view', nextViewMode)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [clearInlineFeedback, pathname, router, search, setViewMode]
  )

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId((previous) => (previous === id ? null : id))
      clearInlineFeedback()
    },
    [clearInlineFeedback]
  )

  const handleClose = useCallback(() => {
    setSelectedId(null)
    setAssigning(false)
    clearInlineFeedback()
  }, [clearInlineFeedback, setAssigning])

  const handleRosterOpenEditor = useCallback(
    (dayId: string) => {
      handleSelect(dayId)
    },
    [handleSelect]
  )

  const openCycleDialog = useCallback(() => {
    setCycleDialogOpen(true)
  }, [])

  const openPreflightDialog = useCallback(() => {
    setPreFlightDialogOpen(true)
  }, [])

  const openSaveAsTemplateDialog = useCallback(() => {
    setSaveAsTemplateDialogOpen(true)
  }, [])

  const openTemplateTarget = useCallback(() => {
    if (!activeCycleId || !printCycle) return
    setTemplateTarget({
      cycleId: activeCycleId,
      startDate: printCycle.start_date,
    })
  }, [activeCycleId, printCycle])

  return {
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
    shiftTab,
    showPlanningDetails,
    templateTarget,
    weekOffset,
  }
}
