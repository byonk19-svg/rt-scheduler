'use client'

import { useMemo, useState } from 'react'

import {
  filterEmployeeDirectoryRecords,
  type EmployeeDirectoryRecord,
  type EmployeeDirectoryTab,
} from '@/lib/employee-directory'

type DirectorySortKey = 'employee' | 'shift' | 'type' | 'tags'
type SortDirection = 'asc' | 'desc'

export function useEmployeeDirectoryListState({
  employees,
}: {
  employees: EmployeeDirectoryRecord[]
}) {
  const [tab, setTab] = useState<EmployeeDirectoryTab>('all')
  const [searchText, setSearchText] = useState('')
  const [leadOnly, setLeadOnly] = useState(false)
  const [fmlaOnly, setFmlaOnly] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [employmentFilter, setEmploymentFilter] = useState<
    'all' | 'full_time' | 'part_time' | 'prn'
  >('all')
  const [sortKey, setSortKey] = useState<DirectorySortKey>('employee')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const filteredEmployees = useMemo(() => {
    const base = filterEmployeeDirectoryRecords(employees, {
      tab,
      searchText,
      leadOnly,
      fmlaOnly,
      includeInactive,
    })
    if (employmentFilter === 'all') return base
    return base.filter((employee) => employee.employment_type === employmentFilter)
  }, [employees, employmentFilter, fmlaOnly, includeInactive, leadOnly, searchText, tab])

  const sortedEmployees = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const shiftRank = (value: EmployeeDirectoryRecord['shift_type']) => (value === 'day' ? 0 : 1)
    const typeRank = (value: EmployeeDirectoryRecord['employment_type']) => {
      if (value === 'full_time') return 0
      if (value === 'part_time') return 1
      return 2
    }
    const tagsRank = (employee: EmployeeDirectoryRecord) => {
      const hasLead = employee.is_lead_eligible ? 1 : 0
      const hasFmla = employee.on_fmla ? 1 : 0
      const isInactive = employee.is_active ? 0 : 1
      return hasLead * 4 + hasFmla * 2 + isInactive
    }

    return filteredEmployees.slice().sort((a, b) => {
      let result = 0
      if (sortKey === 'employee') {
        result = a.full_name.localeCompare(b.full_name) || a.email.localeCompare(b.email)
      } else if (sortKey === 'shift') {
        result =
          shiftRank(a.shift_type) - shiftRank(b.shift_type) ||
          a.full_name.localeCompare(b.full_name)
      } else if (sortKey === 'type') {
        result =
          typeRank(a.employment_type) - typeRank(b.employment_type) ||
          a.full_name.localeCompare(b.full_name)
      } else {
        result = tagsRank(a) - tagsRank(b) || a.full_name.localeCompare(b.full_name)
      }
      return result * direction
    })
  }, [filteredEmployees, sortDirection, sortKey])

  function handleSort(nextKey: DirectorySortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection('asc')
  }

  return {
    employmentFilter,
    fmlaOnly,
    handleSort,
    includeInactive,
    leadOnly,
    searchText,
    setEmploymentFilter,
    setFmlaOnly,
    setIncludeInactive,
    setLeadOnly,
    setSearchText,
    setTab,
    sortDirection,
    sortKey,
    sortedEmployees,
    tab,
  }
}
