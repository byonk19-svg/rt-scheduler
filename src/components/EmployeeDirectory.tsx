'use client'

import { useCallback, useMemo, useState } from 'react'

import {
  buildMissingAvailabilityRows,
  formatEmployeeDate,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'
import { shiftMonthKey } from '@/lib/calendar-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmployeeDeactivateDialog } from '@/components/EmployeeDeactivateDialog'
import { EmployeeEditDialog } from '@/components/EmployeeEditDialog'
import { EmployeeDirectoryFiltersPanel } from '@/components/EmployeeDirectoryFiltersPanel'
import { EmployeeDirectoryRoster } from '@/components/EmployeeDirectoryRoster'
import { EmployeeMissingAvailabilityPanel } from '@/components/EmployeeMissingAvailabilityPanel'
import { useEmployeeDirectoryListState } from '@/components/useEmployeeDirectoryListState'
import { useEmployeeDirectoryOverrides } from '@/components/useEmployeeDirectoryOverrides'

type EmployeeDirectoryProps = {
  employees: EmployeeDirectoryRecord[]
  cycles: Array<{
    id: string
    label: string
    start_date: string
    end_date: string
    published: boolean
  }>
  dateOverrides: Array<{
    id: string
    therapist_id: string
    cycle_id: string
    date: string
    shift_type: 'day' | 'night' | 'both'
    override_type: 'force_off' | 'force_on'
    note: string | null
    created_at: string
    source: 'therapist' | 'manager'
  }>
  initialEditEmployeeId?: string | null
  initialFocusAvailability?: boolean
  initialOverrideCycleId?: string | null
  /** Therapist IDs with an official availability submission for the selected cycle; enables aligned manager metrics. */
  officialSubmissionTherapistIds?: string[]
  saveEmployeeAction: (formData: FormData) => void | Promise<void>
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
  saveEmployeeDateOverrideAction: (
    prevState: { error: string } | null,
    formData: FormData
  ) => Promise<{ error: string } | null>
  deleteEmployeeDateOverrideAction: (
    prevState: { error: string; profileId: string } | null,
    formData: FormData
  ) => Promise<{ error: string; profileId: string } | null>
  copyEmployeeShiftsAction: (
    prevState: { error: string; employeeId: string } | null,
    formData: FormData
  ) => Promise<{ error: string; employeeId: string } | null>
}

type DrawerTab = 'profile' | 'scheduling' | 'overrides'
const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function employmentLabel(value: EmployeeDirectoryRecord['employment_type']): string {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

function weekdayLabel(values: number[]): string {
  if (values.length === 0) return 'Any day'
  const byValue = new Map(WEEKDAY_OPTIONS.map((option) => [option.value, option.label]))
  return values
    .filter((value) => byValue.has(value))
    .map((value) => byValue.get(value) ?? '')
    .filter((value) => value.length > 0)
    .join(', ')
}

export function EmployeeDirectory({
  employees,
  cycles,
  dateOverrides,
  initialEditEmployeeId = null,
  initialFocusAvailability = false,
  initialOverrideCycleId = null,
  officialSubmissionTherapistIds,
  saveEmployeeAction,
  setEmployeeActiveAction,
  saveEmployeeDateOverrideAction,
  deleteEmployeeDateOverrideAction,
  copyEmployeeShiftsAction,
}: EmployeeDirectoryProps) {
  const [availabilityCycleId, setAvailabilityCycleId] = useState<string>('')
  const [collapsedMissing, setCollapsedMissing] = useState(false)
  const [editState, setEditState] = useState<{
    employeeId: string
    onFmla: boolean
    weekendRotation: 'none' | 'every_other'
    worksDowMode: 'hard' | 'soft'
  } | null>(() => {
    if (!initialEditEmployeeId) return null
    const employee = employees.find((row) => row.id === initialEditEmployeeId)
    if (!employee) return null
    return {
      employeeId: employee.id,
      onFmla: employee.on_fmla,
      weekendRotation: employee.weekend_rotation,
      worksDowMode: employee.works_dow_mode,
    }
  })
  const [deactivateEmployeeId, setDeactivateEmployeeId] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(
    initialEditEmployeeId && initialFocusAvailability ? 'overrides' : 'profile'
  )
  const selectedAvailabilityCycleId = availabilityCycleId || cycles[0]?.id || ''
  const listState = useEmployeeDirectoryListState({ employees })
  const overrides = useEmployeeDirectoryOverrides({
    copyEmployeeShiftsAction,
    currentEmployeeId: editState?.employeeId ?? null,
    cycles,
    dateOverrides,
    deleteEmployeeDateOverrideAction,
    initialEditEmployeeId,
    initialFocusAvailability,
    initialOverrideCycleId,
    saveEmployeeDateOverrideAction,
    selectedAvailabilityCycleId,
  })

  const openEditForEmployee = useCallback(
    (employeeId: string, options?: { focusAvailability?: boolean; cycleId?: string }) => {
      const employee = employees.find((row) => row.id === employeeId)
      if (!employee) return
      setEditState({
        employeeId: employee.id,
        onFmla: employee.on_fmla,
        weekendRotation: employee.weekend_rotation,
        worksDowMode: employee.works_dow_mode,
      })
      const shouldFocusAvailability = Boolean(options?.focusAvailability)
      setDrawerTab(shouldFocusAvailability ? 'overrides' : 'profile')
      overrides.openOverridesForEmployee(employeeId, options)
    },
    [employees, overrides]
  )

  const editEmployee = useMemo(
    () => employees.find((employee) => employee.id === editState?.employeeId) ?? null,
    [employees, editState?.employeeId]
  )
  const onFmlaDraft = editState?.onFmla ?? false
  const weekendRotationDraft = editState?.weekendRotation ?? 'none'
  const worksDowModeDraft = editState?.worksDowMode ?? 'hard'

  const deactivateEmployee = useMemo(
    () => employees.find((employee) => employee.id === deactivateEmployeeId) ?? null,
    [employees, deactivateEmployeeId]
  )
  const cycleLabelById = useMemo(
    () =>
      new Map(
        cycles.map((cycle) => [
          cycle.id,
          `${cycle.label} (${formatEmployeeDate(cycle.start_date)} to ${formatEmployeeDate(cycle.end_date)})`,
        ])
      ),
    [cycles]
  )
  const missingAvailabilityRows = useMemo(
    () =>
      buildMissingAvailabilityRows(
        employees,
        dateOverrides,
        selectedAvailabilityCycleId,
        officialSubmissionTherapistIds !== undefined
          ? { officialSubmissionTherapistIds: new Set(officialSubmissionTherapistIds) }
          : undefined
      ),
    [dateOverrides, employees, officialSubmissionTherapistIds, selectedAvailabilityCycleId]
  )

  return (
    <Card id="employee-directory">
      <CardHeader>
        <CardTitle>Employee Directory</CardTitle>
        <CardDescription>
          Search, filter, and maintain active staffing profiles in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmployeeDirectoryFiltersPanel
          employmentFilter={listState.employmentFilter}
          fmlaOnly={listState.fmlaOnly}
          includeInactive={listState.includeInactive}
          leadOnly={listState.leadOnly}
          onEmploymentFilterChange={listState.setEmploymentFilter}
          onFmlaOnlyChange={listState.setFmlaOnly}
          onIncludeInactiveChange={listState.setIncludeInactive}
          onLeadOnlyChange={listState.setLeadOnly}
          onSearchTextChange={listState.setSearchText}
          onTabChange={listState.setTab}
          searchText={listState.searchText}
          sortedEmployeesCount={listState.sortedEmployees.length}
          tab={listState.tab}
        />

        <EmployeeMissingAvailabilityPanel
          collapsed={collapsedMissing}
          cycles={cycles.map((cycle) => ({ id: cycle.id, label: cycle.label }))}
          missingAvailabilityRows={missingAvailabilityRows}
          onCycleChange={setAvailabilityCycleId}
          onEditEmployee={openEditForEmployee}
          onToggleCollapsed={() => setCollapsedMissing((prev) => !prev)}
          selectedAvailabilityCycleId={selectedAvailabilityCycleId}
        />

        <EmployeeDirectoryRoster
          employees={listState.sortedEmployees}
          formatDate={formatEmployeeDate}
          formatEmploymentLabel={employmentLabel}
          formatWeekdayLabel={weekdayLabel}
          includeInactive={listState.includeInactive}
          onDeactivateEmployee={setDeactivateEmployeeId}
          onEditEmployee={(employeeId) => openEditForEmployee(employeeId)}
          onSort={listState.handleSort}
          setEmployeeActiveAction={setEmployeeActiveAction}
          sortDirection={listState.sortDirection}
          sortKey={listState.sortKey}
        />
      </CardContent>

      <EmployeeEditDialog
        cycleLabelById={cycleLabelById}
        cycles={cycles}
        dayOptions={WEEKDAY_OPTIONS}
        drawerTab={drawerTab}
        editEmployee={editEmployee}
        editEmployeeDateOverrides={overrides.editEmployeeDateOverrides}
        focusAvailabilitySection={overrides.focusAvailabilitySection}
        onClose={() => {
          setEditState(null)
          setDrawerTab('profile')
          overrides.resetOverridesState()
        }}
        onDrawerTabChange={setDrawerTab}
        onFmlaDraft={onFmlaDraft}
        onFmlaDraftChange={(checked: boolean) =>
          setEditState((current) => (current ? { ...current, onFmla: checked } : current))
        }
        onWeekendRotationChange={(value) =>
          setEditState((current) => (current ? { ...current, weekendRotation: value } : current))
        }
        onWorksDowModeChange={(value) =>
          setEditState((current) => (current ? { ...current, worksDowMode: value } : current))
        }
        overrideActions={{
          availabilitySectionRef: overrides.availabilitySectionRef,
          calendarRef: overrides.calendarRef,
          canGoNextMonth: overrides.canGoNextMonth,
          canGoPrevMonth: overrides.canGoPrevMonth,
          copyShiftsFormAction: overrides.copyShiftsFormAction,
          copyShiftsFormState: overrides.copyShiftsFormState,
          copySourceCycleId: overrides.copySourceCycleId,
          copyTargetCycleId: overrides.copyTargetCycleId,
          deleteOverrideFormAction: overrides.deleteOverrideFormAction,
          deleteOverrideFormState: overrides.deleteOverrideFormState,
          onAddDateToOverrideBatch: overrides.addDateToOverrideBatch,
          onCalendarDayMouseDown: overrides.handleCalendarDayMouseDown,
          onCalendarDayMouseEnter: overrides.handleCalendarDayMouseEnter,
          onCalendarDayTouchStart: overrides.handleCalendarDayTouchStart,
          onCopySourceCycleIdChange: overrides.setCopySourceCycleId,
          onCopyTargetCycleIdChange: overrides.setCopyTargetCycleId,
          onOverrideCycleChange: (nextCycleId) => {
            if (!editEmployee) return
            overrides.handleOverrideCycleChange(editEmployee.id, nextCycleId)
          },
          onOverrideDateDraftChange: (value) => {
            overrides.setOverrideDateDraft(value)
            overrides.setOverrideDateError(null)
          },
          onOverrideDateErrorChange: overrides.setOverrideDateError,
          onOverrideDatesClear: () => {
            overrides.setOverrideDatesDraft([])
            overrides.setOverrideDateError(null)
          },
          onOverrideDateRemove: (dateValue) =>
            overrides.setOverrideDatesDraft((current) =>
              current.filter((value) => value !== dateValue)
            ),
          onShowNextMonth: () =>
            overrides.setOverrideCalendarMonthStart((current) => shiftMonthKey(current, 1)),
          onShowPreviousMonth: () =>
            overrides.setOverrideCalendarMonthStart((current) => shiftMonthKey(current, -1)),
          overrideCalendarMonthKey: overrides.overrideCalendarMonthKey,
          overrideCalendarTitle: overrides.overrideCalendarTitle,
          overrideCalendarWeeks: overrides.overrideCalendarWeeks,
          overrideCycleIdDraft: overrides.overrideCycleIdDraft,
          overrideDateDraft: overrides.overrideDateDraft,
          overrideDateError: overrides.overrideDateError,
          overrideDatesDraft: overrides.overrideDatesDraft,
          overrideFormAction: overrides.overrideFormAction,
          overrideFormState: overrides.overrideFormState,
          selectedOverrideCycle: overrides.selectedOverrideCycle,
          selectedOverrideDatesSet: overrides.selectedOverrideDatesSet,
        }}
        saveEmployeeAction={saveEmployeeAction}
        weekendRotationDraft={weekendRotationDraft}
        worksDowModeDraft={worksDowModeDraft}
      />

      <EmployeeDeactivateDialog
        employee={deactivateEmployee}
        onClose={() => setDeactivateEmployeeId(null)}
        setEmployeeActiveAction={setEmployeeActiveAction}
      />
    </Card>
  )
}
