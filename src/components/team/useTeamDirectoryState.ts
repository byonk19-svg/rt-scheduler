'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { TeamDirectoryFilterState } from '@/components/team/team-directory-filters'
import type { DirectoryChipFilter } from '@/components/team/team-directory-summary-chips'

type TeamDirectorySectionKey =
  | 'managers'
  | 'dayLeads'
  | 'dayTherapists'
  | 'nightLeads'
  | 'nightTherapists'
  | 'inactive'

type TeamDirectorySectionOpenState = Record<TeamDirectorySectionKey, boolean>

const TEAM_DIRECTORY_SECTION_STORAGE_KEY = 'team-directory-section-open-state-v1'

const SECTION_KEYS: TeamDirectorySectionKey[] = [
  'managers',
  'dayLeads',
  'dayTherapists',
  'nightLeads',
  'nightTherapists',
  'inactive',
]

const DEFAULT_SECTION_OPEN_STATE: TeamDirectorySectionOpenState = {
  managers: true,
  dayLeads: true,
  dayTherapists: true,
  nightLeads: true,
  nightTherapists: true,
  inactive: true,
}

export function useTeamDirectoryState({
  bulkUpdateTeamMembersAction,
}: {
  bulkUpdateTeamMembersAction: (formData: FormData) => void | Promise<void>
}) {
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [chipFilter, setChipFilter] = useState<DirectoryChipFilter>('all')
  const [formFilters, setFormFilters] = useState<TeamDirectoryFilterState>({
    search: '',
    role: 'all',
    shift: 'all',
    employment: 'all',
    status: 'all',
  })
  const [savedSectionOpenState, setSavedSectionOpenState] = useState<TeamDirectorySectionOpenState>(
    () => {
      if (typeof window === 'undefined') {
        return DEFAULT_SECTION_OPEN_STATE
      }

      const raw = window.localStorage.getItem(TEAM_DIRECTORY_SECTION_STORAGE_KEY)
      if (!raw) return DEFAULT_SECTION_OPEN_STATE

      try {
        const parsed = JSON.parse(raw) as Partial<TeamDirectorySectionOpenState>
        const nextState: TeamDirectorySectionOpenState = { ...DEFAULT_SECTION_OPEN_STATE }
        for (const key of SECTION_KEYS) {
          if (typeof parsed[key] === 'boolean') {
            nextState[key] = parsed[key] as boolean
          }
        }
        return nextState
      } catch {
        return DEFAULT_SECTION_OPEN_STATE
      }
    }
  )

  const hasActiveFilters =
    chipFilter !== 'all' ||
    formFilters.search.trim().length > 0 ||
    formFilters.role !== 'all' ||
    formFilters.shift !== 'all' ||
    formFilters.employment !== 'all' ||
    formFilters.status !== 'all'

  const hasExpandedSection = SECTION_KEYS.some((key) => savedSectionOpenState[key])
  const hasCollapsedSection = SECTION_KEYS.some((key) => !savedSectionOpenState[key])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      TEAM_DIRECTORY_SECTION_STORAGE_KEY,
      JSON.stringify(savedSectionOpenState)
    )
  }, [savedSectionOpenState])

  const onToggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onToggleGroupSelected = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const onApplyBulk = useCallback(
    (action: string, value?: string) => {
      if (selectedIds.size === 0) return
      const formData = new FormData()
      for (const id of selectedIds) {
        formData.append('profile_ids', id)
      }
      formData.set('bulk_action', action)
      if (value) formData.set('bulk_value', value)
      setSelectedIds(new Set())
      void bulkUpdateTeamMembersAction(formData)
    },
    [bulkUpdateTeamMembersAction, selectedIds]
  )

  function toggleBulkMode() {
    setBulkMode((current) => {
      if (current) {
        setSelectedIds(new Set())
      }
      return !current
    })
  }

  function handleSectionToggle(sectionKey: TeamDirectorySectionKey, nextOpen: boolean) {
    setSavedSectionOpenState((current) => ({ ...current, [sectionKey]: nextOpen }))
  }

  function expandAllSections() {
    setSavedSectionOpenState((current) => {
      const next = { ...current }
      for (const key of SECTION_KEYS) next[key] = true
      return next
    })
  }

  function collapseAllSections() {
    setSavedSectionOpenState((current) => {
      const next = { ...current }
      for (const key of SECTION_KEYS) next[key] = false
      return next
    })
  }

  function clearFilters() {
    setChipFilter('all')
    setFormFilters({
      search: '',
      role: 'all',
      shift: 'all',
      employment: 'all',
      status: 'all',
    })
  }

  return {
    bulkMode,
    chipFilter,
    clearFilters,
    collapseAllSections,
    expandAllSections,
    formFilters,
    handleSectionToggle,
    hasActiveFilters,
    hasCollapsedSection,
    hasExpandedSection,
    onApplyBulk,
    onToggleGroupSelected,
    onToggleSelected,
    savedSectionOpenState,
    selectedIds,
    setChipFilter,
    setFormFilters,
    setSelectedIds,
    setShowAdvancedFilters,
    showAdvancedFilters,
    toggleBulkMode,
  }
}
