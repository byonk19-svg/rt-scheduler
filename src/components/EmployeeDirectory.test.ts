import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const employeeDirectorySource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeDirectory.tsx'),
  'utf8'
)
const employeeDirectoryFiltersPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeDirectoryFiltersPanel.tsx'),
  'utf8'
)
const employeeMissingAvailabilityPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeMissingAvailabilityPanel.tsx'),
  'utf8'
)
const employeeEditOverridesPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeEditOverridesPanel.tsx'),
  'utf8'
)
const employeeOverrideHistoryPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeOverrideHistoryPanel.tsx'),
  'utf8'
)
const employeeCopyShiftPatternPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeCopyShiftPatternPanel.tsx'),
  'utf8'
)
const employeeOverrideCalendarSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeOverrideCalendar.tsx'),
  'utf8'
)
const employeeOverrideFormPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeOverrideFormPanel.tsx'),
  'utf8'
)
const employeeEditDialogSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeEditDialog.tsx'),
  'utf8'
)
const employeeDirectoryRosterSource = readFileSync(
  resolve(process.cwd(), 'src/components/EmployeeDirectoryRoster.tsx'),
  'utf8'
)
const employeeDirectoryOverridesHookSource = readFileSync(
  resolve(process.cwd(), 'src/components/useEmployeeDirectoryOverrides.ts'),
  'utf8'
)
const employeeDirectoryListStateHookSource = readFileSync(
  resolve(process.cwd(), 'src/components/useEmployeeDirectoryListState.ts'),
  'utf8'
)

describe('EmployeeDirectory framing', () => {
  it('keeps the filter and search controls for the directory surface', () => {
    expect(employeeDirectoryFiltersPanelSource).toContain('Shift:')
    expect(employeeDirectoryFiltersPanelSource).toContain('Search name or email')
    expect(employeeMissingAvailabilityPanelSource).toContain('Missing availability')
    expect(employeeDirectorySource).toContain('Employee Directory')
  })

  it('keeps the overrides workflow in a dedicated drawer panel', () => {
    expect(employeeOverrideFormPanelSource).toContain('Date Overrides (Manager)')
    expect(employeeOverrideCalendarSource).toContain('Calendar multi-select')
    expect(employeeOverrideHistoryPanelSource).toContain('Current overrides')
    expect(employeeCopyShiftPatternPanelSource).toContain('Copy shift pattern')
    expect(employeeEditDialogSource).toContain('EmployeeEditOverridesPanel')
    expect(employeeDirectorySource).toContain('EmployeeEditDialog')
  })

  it('keeps the roster rendering in a dedicated surface component', () => {
    expect(employeeDirectoryRosterSource).toContain('No employees match the current filters.')
    expect(employeeDirectorySource).toContain('EmployeeDirectoryRoster')
  })

  it('keeps override and calendar state in a dedicated hook', () => {
    expect(employeeDirectoryOverridesHookSource).toContain('useEmployeeDirectoryOverrides')
    expect(employeeDirectoryOverridesHookSource).toContain('handleCalendarDayMouseDown')
    expect(employeeDirectorySource).toContain('useEmployeeDirectoryOverrides')
  })

  it('keeps list filtering and sorting in a dedicated hook', () => {
    expect(employeeDirectoryListStateHookSource).toContain('useEmployeeDirectoryListState')
    expect(employeeDirectoryListStateHookSource).toContain('filterEmployeeDirectoryRecords')
    expect(employeeDirectorySource).toContain('useEmployeeDirectoryListState')
  })
})
