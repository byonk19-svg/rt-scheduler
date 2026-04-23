'use client'

import { useMemo, useState } from 'react'

import { TeamDirectoryControlPanel } from '@/components/team/TeamDirectoryControlPanel'
import { type TeamDirectoryFilterState } from '@/components/team/team-directory-filters'
import { TeamDirectoryGroupedSections } from '@/components/team/TeamDirectoryGroupedSections'
import { TeamQuickEditDialog } from '@/components/team/TeamQuickEditDialog'
import { useTeamDirectoryState } from '@/components/team/useTeamDirectoryState'
import {
  partitionTeamProfiles,
  TEAM_LEAD_ROLE_LABEL,
  TEAM_QUICK_EDIT_DIALOG_CLASS,
  teamMemberHasAppAccess,
  type TeamProfileRecord,
  type TeamSummaryCounts,
  type WorkPatternRecord,
} from '@/components/team/team-directory-model'
import { type DirectoryChipFilter } from '@/components/team/team-directory-summary-chips'
import { BulkActionBar } from '@/components/team/BulkActionBar'
import { getTeamRolePermissions } from '@/lib/team-role-permissions'
import { cn } from '@/lib/utils'

export type { TeamProfileRecord, WorkPatternRecord, TeamSummaryCounts }
export {
  partitionTeamProfiles,
  TEAM_LEAD_ROLE_LABEL,
  TEAM_QUICK_EDIT_DIALOG_CLASS,
  teamMemberHasAppAccess,
}

type TeamDirectoryProps = {
  summary: TeamSummaryCounts
  profiles: TeamProfileRecord[]
  workPatterns?: Record<string, WorkPatternRecord>
  initialEditProfileId?: string | null
  archiveTeamMemberAction: (formData: FormData) => void | Promise<void>
  saveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
  bulkUpdateTeamMembersAction: (formData: FormData) => void | Promise<void>
}

type EditableRole = 'manager' | 'lead' | 'therapist'

const DOW_OPTIONS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

function matchesChip(profile: TeamProfileRecord, chip: DirectoryChipFilter): boolean {
  const active = teamMemberHasAppAccess(profile)
  switch (chip) {
    case 'all':
      return true
    case 'managers':
      return active && profile.role === 'manager'
    case 'leads':
      return active && profile.role === 'lead'
    case 'therapists':
      return active && profile.role === 'therapist'
    case 'day':
      return active && profile.shift_type !== 'night'
    case 'night':
      return active && profile.shift_type === 'night'
    case 'inactive':
      return !active
    case 'fmla':
      return profile.on_fmla === true
    default:
      return true
  }
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function matchesFormFilters(
  profile: TeamProfileRecord,
  filters: TeamDirectoryFilterState
): boolean {
  if (filters.search.trim()) {
    const query = normalizeSearch(filters.search)
    const name = normalizeSearch(profile.full_name ?? '')
    if (!name.includes(query)) return false
  }
  if (filters.role !== 'all' && profile.role !== filters.role) return false
  if (filters.shift !== 'all' && (profile.shift_type ?? 'day') !== filters.shift) return false
  if (
    filters.employment !== 'all' &&
    (profile.employment_type ?? 'full_time') !== filters.employment
  ) {
    return false
  }
  if (filters.status === 'active' && !teamMemberHasAppAccess(profile)) return false
  if (filters.status === 'inactive' && teamMemberHasAppAccess(profile)) return false
  if (filters.status === 'fmla' && profile.on_fmla !== true) return false
  return true
}

function filterProfilesForDirectory(
  profiles: TeamProfileRecord[],
  chip: DirectoryChipFilter,
  form: TeamDirectoryFilterState
): TeamProfileRecord[] {
  return profiles.filter(
    (profile) => matchesChip(profile, chip) && matchesFormFilters(profile, form)
  )
}

function AccessChecklist({ role }: { role: EditableRole }) {
  const permissions = getTeamRolePermissions(role)

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold text-foreground">App access</p>
        <p className="text-xs text-muted-foreground">
          This updates automatically from the selected role.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {permissions.map((permission) => (
          <div
            key={permission.label}
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
              permission.allowed
                ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                : 'border-border bg-card text-muted-foreground'
            )}
          >
            <span>{permission.label}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              {permission.allowed ? 'Yes' : 'No'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InactiveAccessNotice() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-sm font-semibold text-foreground">App access</p>
      <p className="mt-1 text-sm text-muted-foreground">No app access while inactive.</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Inactive team members cannot sign in or use manager, lead, or therapist tools until they are
        reactivated.
      </p>
    </div>
  )
}

export function TeamDirectory({
  summary,
  profiles,
  workPatterns = {},
  initialEditProfileId = null,
  archiveTeamMemberAction,
  saveTeamQuickEditAction,
  bulkUpdateTeamMembersAction,
}: TeamDirectoryProps) {
  const {
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
  } = useTeamDirectoryState({
    bulkUpdateTeamMembersAction,
  })
  const filteredProfiles = useMemo(
    () => filterProfilesForDirectory(profiles, chipFilter, formFilters),
    [profiles, chipFilter, formFilters]
  )

  const sections = useMemo(() => partitionTeamProfiles(filteredProfiles), [filteredProfiles])

  const initialEditProfile = profiles.find((profile) => profile.id === initialEditProfileId) ?? null
  const initialPattern = initialEditProfile ? (workPatterns[initialEditProfile.id] ?? null) : null

  const [editProfileId, setEditProfileId] = useState<string | null>(initialEditProfile?.id ?? null)
  const [draftRole, setDraftRole] = useState<EditableRole>(
    (initialEditProfile?.role as EditableRole | null) ?? 'therapist'
  )
  const [onFmla, setOnFmla] = useState(initialEditProfile?.on_fmla === true)
  const [hasPattern, setHasPattern] = useState(
    initialPattern !== null && initialPattern.works_dow.length > 0
  )
  const [selectedDays, setSelectedDays] = useState<number[]>(initialPattern?.works_dow ?? [])
  const [neverDays, setNeverDays] = useState<number[]>(initialPattern?.offs_dow ?? [])
  const [worksDowMode, setWorksDowMode] = useState<'hard' | 'soft'>(
    initialPattern?.works_dow_mode ?? 'hard'
  )
  const [weekendRotation, setWeekendRotation] = useState<'none' | 'every_other'>(
    initialPattern?.weekend_rotation ?? 'none'
  )

  const editProfile = useMemo(
    () => profiles.find((profile) => profile.id === editProfileId) ?? null,
    [profiles, editProfileId]
  )
  const editProfileIsActive = editProfile ? teamMemberHasAppAccess(editProfile) : false
  const effectiveSectionOpenState = useMemo(() => {
    if (!hasActiveFilters) return savedSectionOpenState

    return {
      managers: sections.managers.length > 0 ? true : savedSectionOpenState.managers,
      dayLeads: sections.dayLeads.length > 0 ? true : savedSectionOpenState.dayLeads,
      dayTherapists: sections.dayTherapists.length > 0 ? true : savedSectionOpenState.dayTherapists,
      nightLeads: sections.nightLeads.length > 0 ? true : savedSectionOpenState.nightLeads,
      nightTherapists:
        sections.nightTherapists.length > 0 ? true : savedSectionOpenState.nightTherapists,
      inactive: sections.inactive.length > 0 ? true : savedSectionOpenState.inactive,
    }
  }, [hasActiveFilters, savedSectionOpenState, sections])

  function openEditor(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return
    const pattern = workPatterns[profileId] ?? null
    setEditProfileId(profileId)
    setDraftRole((profile.role as EditableRole | null) ?? 'therapist')
    setOnFmla(profile.on_fmla === true)
    setHasPattern(pattern !== null && (pattern.works_dow ?? []).length > 0)
    setSelectedDays(pattern?.works_dow ?? [])
    setNeverDays(pattern?.offs_dow ?? [])
    setWorksDowMode(pattern?.works_dow_mode ?? 'hard')
    setWeekendRotation(pattern?.weekend_rotation ?? 'none')
  }

  function toggleDay(value: number) {
    setSelectedDays((current) =>
      current.includes(value) ? current.filter((d) => d !== value) : [...current, value]
    )
  }

  function toggleNeverDay(value: number) {
    setNeverDays((current) =>
      current.includes(value) ? current.filter((d) => d !== value) : [...current, value]
    )
  }

  return (
    <>
      <TeamDirectoryControlPanel
        bulkMode={bulkMode}
        chipFilter={chipFilter}
        clearFilters={clearFilters}
        collapseAllSections={collapseAllSections}
        expandAllSections={expandAllSections}
        filteredCount={filteredProfiles.length}
        formFilters={formFilters}
        hasCollapsedSection={hasCollapsedSection}
        hasExpandedSection={hasExpandedSection}
        onChipChange={setChipFilter}
        onFiltersChange={setFormFilters}
        onToggleBulkMode={toggleBulkMode}
        onToggleShowAdvanced={setShowAdvancedFilters}
        showAdvancedFilters={showAdvancedFilters}
        summary={summary}
      />

      <TeamDirectoryGroupedSections
        bulkMode={bulkMode}
        effectiveSectionOpenState={effectiveSectionOpenState}
        hasActiveFilters={hasActiveFilters}
        onOpenEditor={openEditor}
        onToggleGroupSelected={onToggleGroupSelected}
        onToggleSection={handleSectionToggle}
        onToggleSelected={onToggleSelected}
        sections={sections}
        selectedIds={selectedIds}
      />

      {filteredProfiles.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No people match these filters.</p>
        </div>
      ) : null}

      <BulkActionBar
        selectedCount={bulkMode ? selectedIds.size : 0}
        onClear={() => setSelectedIds(new Set())}
        onApply={onApplyBulk}
      />

      <TeamQuickEditDialog
        accessContent={
          editProfileIsActive ? <AccessChecklist role={draftRole} /> : <InactiveAccessNotice />
        }
        archiveTeamMemberAction={archiveTeamMemberAction}
        dayOptions={DOW_OPTIONS}
        draftRole={draftRole}
        editProfile={editProfile}
        editProfileIsActive={editProfileIsActive}
        hasPattern={hasPattern}
        neverDays={neverDays}
        onClose={() => setEditProfileId(null)}
        onToggleDay={toggleDay}
        onToggleNeverDay={toggleNeverDay}
        onTogglePattern={setHasPattern}
        onWeekendRotationChange={setWeekendRotation}
        onWorksDowModeChange={setWorksDowMode}
        onFmlaChange={setOnFmla}
        onRoleChange={setDraftRole}
        onSetEditProfileId={setEditProfileId}
        onSetHasPattern={setHasPattern}
        onSetNeverDays={setNeverDays}
        onSetOnFmla={setOnFmla}
        onSetSelectedDays={setSelectedDays}
        onSetWeekendRotation={setWeekendRotation}
        onSetWorksDowMode={setWorksDowMode}
        onSaveTeamQuickEditAction={saveTeamQuickEditAction}
        onFmla={onFmla}
        selectedDays={selectedDays}
        weekendRotation={weekendRotation}
        workPattern={editProfile ? (workPatterns[editProfile.id] ?? null) : null}
        worksDowMode={worksDowMode}
      />
    </>
  )
}
