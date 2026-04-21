'use client'

import { type MutableRefObject, useEffect, useState } from 'react'

import type {
  CoveragePageSnapshot,
  CycleRow,
  PreliminarySnapshotRow,
  PrintTherapist,
  TherapistOption,
} from '@/app/(app)/coverage/coverage-page-snapshot'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import type { DayItem, ShiftTab } from '@/lib/coverage/selectors'
import type { Role } from '@/lib/auth/roles'
import type { ShiftStatus } from '@/lib/shift-types'

export function useCoverageWorkspaceSnapshotState({
  initialSnapshot,
  initialShiftTab,
  onSnapshotReset,
  profileDefaultAppliedRef,
  rosterProfilesByShift,
  setShiftTab,
  shiftTab,
  shiftTabLockedFromUrl,
  therapistOptionsByShift,
}: {
  initialSnapshot: CoveragePageSnapshot
  initialShiftTab: ShiftTab
  onSnapshotReset: () => void
  profileDefaultAppliedRef: MutableRefObject<boolean>
  rosterProfilesByShift: CoveragePageSnapshot['rosterProfilesByShift']
  setShiftTab: (value: ShiftTab) => void
  shiftTab: ShiftTab
  shiftTabLockedFromUrl: boolean
  therapistOptionsByShift: CoveragePageSnapshot['allTherapistsByShift']
}) {
  const [dayDays, setDayDays] = useState<DayItem[]>(() => initialSnapshot.dayDays)
  const [nightDays, setNightDays] = useState<DayItem[]>(() => initialSnapshot.nightDays)
  const [activeCycleId, setActiveCycleId] = useState<string | null>(() => initialSnapshot.activeCycleId)
  const [activeCyclePublished, setActiveCyclePublished] = useState(
    () => initialSnapshot.activeCyclePublished
  )
  const [activePreliminarySnapshot, setActivePreliminarySnapshot] =
    useState<PreliminarySnapshotRow | null>(() => initialSnapshot.activePreliminarySnapshot)
  const [availableCycles, setAvailableCycles] = useState<CycleRow[]>(() => initialSnapshot.availableCycles)
  const [printCycle, setPrintCycle] = useState<{
    label: string
    start_date: string
    end_date: string
  } | null>(() => initialSnapshot.printCycle)
  const [printCycleDates, setPrintCycleDates] = useState<string[]>(() => initialSnapshot.printCycleDates)
  const [printDayTeam, setPrintDayTeam] = useState<PrintTherapist[]>(() => initialSnapshot.printDayTeam)
  const [printNightTeam, setPrintNightTeam] = useState<PrintTherapist[]>(
    () => initialSnapshot.printNightTeam
  )
  const [printUsers, setPrintUsers] = useState<PrintTherapist[]>(() => initialSnapshot.printUsers)
  const [printShiftByUserDate, setPrintShiftByUserDate] = useState<Record<string, ShiftStatus>>(
    () => initialSnapshot.printShiftByUserDate
  )
  const [allTherapists, setAllTherapists] = useState<TherapistOption[]>(() => initialSnapshot.allTherapists)
  const [rosterProfiles, setRosterProfiles] = useState<RosterMemberRow[]>(() => initialSnapshot.rosterProfiles)
  const [activeOpCodes, setActiveOpCodes] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialSnapshot.activeOpCodes))
  )
  const [loading, setLoading] = useState(false)
  const [selectedCycleHasShiftRows, setSelectedCycleHasShiftRows] = useState(
    () => initialSnapshot.selectedCycleHasShiftRows
  )
  const [error, setError] = useState<string>(() => initialSnapshot.error)
  const [canManageCoverage, setCanManageCoverage] = useState(() => initialSnapshot.canManageCoverage)
  const [canUpdateAssignmentStatus, setCanUpdateAssignmentStatus] = useState(
    () => initialSnapshot.canUpdateAssignmentStatus
  )
  const [actorRole, setActorRole] = useState<Role | null>(() => initialSnapshot.actorRole)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    profileDefaultAppliedRef.current = shiftTabLockedFromUrl
    setShiftTab(initialShiftTab)
    setDayDays(initialSnapshot.dayDays)
    setNightDays(initialSnapshot.nightDays)
    setActiveCycleId(initialSnapshot.activeCycleId)
    setActiveCyclePublished(initialSnapshot.activeCyclePublished)
    setActivePreliminarySnapshot(initialSnapshot.activePreliminarySnapshot)
    setAvailableCycles(initialSnapshot.availableCycles)
    setPrintCycle(initialSnapshot.printCycle)
    setPrintCycleDates(initialSnapshot.printCycleDates)
    setPrintDayTeam(initialSnapshot.printDayTeam)
    setPrintNightTeam(initialSnapshot.printNightTeam)
    setPrintUsers(initialSnapshot.printUsers)
    setPrintShiftByUserDate(initialSnapshot.printShiftByUserDate)
    setAllTherapists(initialSnapshot.allTherapists)
    setRosterProfiles(initialSnapshot.rosterProfiles)
    setActiveOpCodes(new Map(Object.entries(initialSnapshot.activeOpCodes)))
    setLoading(false)
    setSelectedCycleHasShiftRows(initialSnapshot.selectedCycleHasShiftRows)
    setError(initialSnapshot.error)
    setCanManageCoverage(initialSnapshot.canManageCoverage)
    setCanUpdateAssignmentStatus(initialSnapshot.canUpdateAssignmentStatus)
    setActorRole(initialSnapshot.actorRole)
    onSnapshotReset()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    initialShiftTab,
    initialSnapshot,
    onSnapshotReset,
    profileDefaultAppliedRef,
    setShiftTab,
    shiftTabLockedFromUrl,
  ])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const shiftType = shiftTab === 'Day' ? 'day' : 'night'
    setAllTherapists(therapistOptionsByShift[shiftType] ?? [])
    setRosterProfiles(rosterProfilesByShift[shiftType] ?? [])
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [rosterProfilesByShift, shiftTab, therapistOptionsByShift])

  return {
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
    setActiveCycleId,
    setActiveCyclePublished,
    setActiveOpCodes,
    setActivePreliminarySnapshot,
    setAllTherapists,
    setAvailableCycles,
    setCanManageCoverage,
    setCanUpdateAssignmentStatus,
    setDayDays,
    setError,
    setLoading,
    setNightDays,
    setPrintCycle,
    setPrintCycleDates,
    setPrintDayTeam,
    setPrintNightTeam,
    setPrintShiftByUserDate,
    setPrintUsers,
    setRosterProfiles,
    setSelectedCycleHasShiftRows,
  }
}
