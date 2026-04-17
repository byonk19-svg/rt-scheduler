'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, RotateCcw } from 'lucide-react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TeamDirectoryFilters,
  type TeamDirectoryFilterState,
} from '@/components/team/team-directory-filters'
import {
  partitionTeamProfiles,
  TEAM_LEAD_ROLE_LABEL,
  TEAM_QUICK_EDIT_DIALOG_CLASS,
  teamMemberHasAppAccess,
  type TeamProfileRecord,
  type TeamSummaryCounts,
  type WorkPatternRecord,
} from '@/components/team/team-directory-model'
import {
  TeamDirectorySummaryChips,
  type DirectoryChipFilter,
} from '@/components/team/team-directory-summary-chips'
import { BulkActionBar } from '@/components/team/BulkActionBar'
import { TeamPersonRow } from '@/components/team/team-person-row'
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

const DOW_OPTIONS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

function initials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function employmentLabel(type: TeamProfileRecord['employment_type']): string {
  if (type === 'part_time') return 'Part-time'
  if (type === 'prn') return 'PRN'
  return 'Full-time'
}

function shiftLabel(type: TeamProfileRecord['shift_type']): string {
  return type === 'night' ? 'Night shift' : 'Day shift'
}

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase()
}

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

function matchesFormFilters(profile: TeamProfileRecord, f: TeamDirectoryFilterState): boolean {
  if (f.search.trim()) {
    const q = normalizeSearch(f.search)
    const name = normalizeSearch(profile.full_name ?? '')
    if (!name.includes(q)) return false
  }
  if (f.role !== 'all' && profile.role !== f.role) return false
  if (f.shift !== 'all' && (profile.shift_type ?? 'day') !== f.shift) return false
  if (f.employment !== 'all' && (profile.employment_type ?? 'full_time') !== f.employment)
    return false
  if (f.status === 'active' && !teamMemberHasAppAccess(profile)) return false
  if (f.status === 'inactive' && teamMemberHasAppAccess(profile)) return false
  if (f.status === 'fmla' && profile.on_fmla !== true) return false
  return true
}

function filterProfilesForDirectory(
  profiles: TeamProfileRecord[],
  chip: DirectoryChipFilter,
  form: TeamDirectoryFilterState
): TeamProfileRecord[] {
  return profiles.filter((p) => matchesChip(p, chip) && matchesFormFilters(p, form))
}

function CollapsibleTeamGroup({
  sectionKey,
  title,
  count,
  isOpen,
  onToggle,
  allSelected,
  onToggleSelectAll,
  children,
}: {
  sectionKey: TeamDirectorySectionKey
  title: string
  count: number
  isOpen: boolean
  onToggle: (sectionKey: TeamDirectorySectionKey, nextOpen: boolean) => void
  allSelected: boolean
  onToggleSelectAll: (checked: boolean) => void
  children: ReactNode
}) {
  if (count === 0) return null
  const summaryId = `team-directory-${sectionKey}-summary`
  const panelId = `team-directory-${sectionKey}-panel`

  return (
    <section className="border-b border-border/70 pb-1 last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
          checked={allSelected}
          onChange={(event) => onToggleSelectAll(event.target.checked)}
          aria-label={`Select all in ${title}`}
        />
        <button
          type="button"
          id={summaryId}
          aria-controls={panelId}
          aria-expanded={isOpen}
          onClick={() => onToggle(sectionKey, !isOpen)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
            aria-hidden
          />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        </button>
        <span className="rounded-full border border-border/70 bg-muted/25 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={summaryId}
        hidden={!isOpen}
        className="space-y-1 px-2 py-1"
      >
        {children}
      </div>
    </section>
  )
}

function renderGroupRows(
  profiles: TeamProfileRecord[],
  onOpen: (id: string) => void,
  selectedIds: Set<string>,
  onToggleSelected: (id: string) => void
): ReactNode {
  if (profiles.length === 0) return null
  return profiles.map((profile) => (
    <TeamPersonRow
      key={profile.id}
      profile={profile}
      onOpen={onOpen}
      isSelected={selectedIds.has(profile.id)}
      onToggle={() => onToggleSelected(profile.id)}
    />
  ))
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [chipFilter, setChipFilter] = useState<DirectoryChipFilter>('all')
  const [formFilters, setFormFilters] = useState<TeamDirectoryFilterState>({
    search: '',
    role: 'all',
    shift: 'all',
    employment: 'all',
    status: 'all',
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
  const hasActiveFilters =
    chipFilter !== 'all' ||
    formFilters.search.trim().length > 0 ||
    formFilters.role !== 'all' ||
    formFilters.shift !== 'all' ||
    formFilters.employment !== 'all' ||
    formFilters.status !== 'all'

  const effectiveSectionOpenState = useMemo(() => {
    if (!hasActiveFilters) return savedSectionOpenState

    const nextState: TeamDirectorySectionOpenState = { ...savedSectionOpenState }
    for (const key of SECTION_KEYS) {
      if (sections[key].length > 0) {
        nextState[key] = true
      }
    }
    return nextState
  }, [hasActiveFilters, savedSectionOpenState, sections])

  const hasExpandedSection = SECTION_KEYS.some((key) => savedSectionOpenState[key])
  const hasCollapsedSection = SECTION_KEYS.some((key) => !savedSectionOpenState[key])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      TEAM_DIRECTORY_SECTION_STORAGE_KEY,
      JSON.stringify(savedSectionOpenState)
    )
  }, [savedSectionOpenState])

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

  return (
    <>
      <div className="space-y-2 rounded-lg border border-border/60 bg-background p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Directory quick views
          </p>
          <p className="text-xs text-muted-foreground">{filteredProfiles.length} shown</p>
        </div>
        <TeamDirectorySummaryChips
          summary={summary}
          activeChip={chipFilter}
          onChipChange={setChipFilter}
        />
        <TeamDirectoryFilters
          value={formFilters}
          onChange={setFormFilters}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={expandAllSections}
                disabled={!hasCollapsedSection}
              >
                <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Expand all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={collapseAllSections}
                disabled={!hasExpandedSection}
              >
                <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Collapse all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Clear filters
              </Button>
            </>
          }
        />
      </div>

      <div
        className={cn(
          'space-y-1.5 rounded-lg border border-border/60 bg-card/30 p-2',
          selectedIds.size > 0 && 'pb-24'
        )}
      >
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-foreground">Grouped staff directory</h2>
          {hasActiveFilters ? (
            <span className="text-xs font-medium text-muted-foreground">Filtered view</span>
          ) : null}
        </div>

        <CollapsibleTeamGroup
          sectionKey="managers"
          title="Managers"
          count={sections.managers.length}
          isOpen={effectiveSectionOpenState.managers}
          onToggle={handleSectionToggle}
          allSelected={
            sections.managers.length > 0 &&
            sections.managers.every((profile) => selectedIds.has(profile.id))
          }
          onToggleSelectAll={(checked) =>
            onToggleGroupSelected(
              sections.managers.map((profile) => profile.id),
              checked
            )
          }
        >
          {renderGroupRows(sections.managers, openEditor, selectedIds, onToggleSelected)}
        </CollapsibleTeamGroup>

        <CollapsibleTeamGroup
          sectionKey="dayLeads"
          title="Day shift leads"
          count={sections.dayLeads.length}
          isOpen={effectiveSectionOpenState.dayLeads}
          onToggle={handleSectionToggle}
          allSelected={
            sections.dayLeads.length > 0 &&
            sections.dayLeads.every((profile) => selectedIds.has(profile.id))
          }
          onToggleSelectAll={(checked) =>
            onToggleGroupSelected(
              sections.dayLeads.map((profile) => profile.id),
              checked
            )
          }
        >
          {renderGroupRows(sections.dayLeads, openEditor, selectedIds, onToggleSelected)}
        </CollapsibleTeamGroup>

        <CollapsibleTeamGroup
          sectionKey="dayTherapists"
          title="Day shift therapists"
          count={sections.dayTherapists.length}
          isOpen={effectiveSectionOpenState.dayTherapists}
          onToggle={handleSectionToggle}
          allSelected={
            sections.dayTherapists.length > 0 &&
            sections.dayTherapists.every((profile) => selectedIds.has(profile.id))
          }
          onToggleSelectAll={(checked) =>
            onToggleGroupSelected(
              sections.dayTherapists.map((profile) => profile.id),
              checked
            )
          }
        >
          {renderGroupRows(sections.dayTherapists, openEditor, selectedIds, onToggleSelected)}
        </CollapsibleTeamGroup>

        <CollapsibleTeamGroup
          sectionKey="nightLeads"
          title="Night shift leads"
          count={sections.nightLeads.length}
          isOpen={effectiveSectionOpenState.nightLeads}
          onToggle={handleSectionToggle}
          allSelected={
            sections.nightLeads.length > 0 &&
            sections.nightLeads.every((profile) => selectedIds.has(profile.id))
          }
          onToggleSelectAll={(checked) =>
            onToggleGroupSelected(
              sections.nightLeads.map((profile) => profile.id),
              checked
            )
          }
        >
          {renderGroupRows(sections.nightLeads, openEditor, selectedIds, onToggleSelected)}
        </CollapsibleTeamGroup>

        <CollapsibleTeamGroup
          sectionKey="nightTherapists"
          title="Night shift therapists"
          count={sections.nightTherapists.length}
          isOpen={effectiveSectionOpenState.nightTherapists}
          onToggle={handleSectionToggle}
          allSelected={
            sections.nightTherapists.length > 0 &&
            sections.nightTherapists.every((profile) => selectedIds.has(profile.id))
          }
          onToggleSelectAll={(checked) =>
            onToggleGroupSelected(
              sections.nightTherapists.map((profile) => profile.id),
              checked
            )
          }
        >
          {renderGroupRows(sections.nightTherapists, openEditor, selectedIds, onToggleSelected)}
        </CollapsibleTeamGroup>

        <CollapsibleTeamGroup
          sectionKey="inactive"
          title="Inactive and off roster"
          count={sections.inactive.length}
          isOpen={effectiveSectionOpenState.inactive}
          onToggle={handleSectionToggle}
          allSelected={
            sections.inactive.length > 0 &&
            sections.inactive.every((profile) => selectedIds.has(profile.id))
          }
          onToggleSelectAll={(checked) =>
            onToggleGroupSelected(
              sections.inactive.map((profile) => profile.id),
              checked
            )
          }
        >
          {renderGroupRows(sections.inactive, openEditor, selectedIds, onToggleSelected)}
        </CollapsibleTeamGroup>
      </div>

      {filteredProfiles.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No people match these filters.</p>
        </div>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onApply={onApplyBulk}
      />

      <Dialog open={Boolean(editProfile)} onOpenChange={(open) => !open && setEditProfileId(null)}>
        {editProfile && (
          <DialogContent className={TEAM_QUICK_EDIT_DIALOG_CLASS}>
            <DialogHeader>
              <DialogTitle>Quick Edit Team Member</DialogTitle>
              <DialogDescription>
                Update access, staffing, and leave details without leaving the team roster.
              </DialogDescription>
            </DialogHeader>

            <form key={editProfile.id} action={saveTeamQuickEditAction} className="space-y-4">
              <input type="hidden" name="profile_id" value={editProfile.id} />

              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initials(editProfile.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {editProfile.full_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shiftLabel(editProfile.shift_type)} ·{' '}
                      {employmentLabel(editProfile.employment_type)}
                    </p>
                    {editProfile.phone_number ? (
                      <p className="text-xs text-muted-foreground">{editProfile.phone_number}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="full_name">Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    defaultValue={editProfile.full_name ?? ''}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    name="role"
                    value={draftRole}
                    onChange={(event) => setDraftRole(event.target.value as EditableRole)}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  >
                    <option value="therapist">Therapist</option>
                    <option value="lead">{TEAM_LEAD_ROLE_LABEL}</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shift_type">Shift</Label>
                  <select
                    id="shift_type"
                    name="shift_type"
                    defaultValue={editProfile.shift_type ?? 'day'}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  >
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="employment_type">Employment Type</Label>
                  <select
                    id="employment_type"
                    name="employment_type"
                    defaultValue={editProfile.employment_type ?? 'full_time'}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  >
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="prn">PRN</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fmla_return_date">FMLA Return Date</Label>
                  <Input
                    id="fmla_return_date"
                    name="fmla_return_date"
                    type="date"
                    defaultValue={editProfile.fmla_return_date ?? ''}
                    disabled={!onFmla}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="on_fmla"
                    defaultChecked={editProfile.on_fmla === true}
                    className="h-4 w-4"
                    onChange={(event) => setOnFmla(event.target.checked)}
                  />
                  On FMLA
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={editProfile.is_active !== false}
                    className="h-4 w-4"
                  />
                  Active
                </label>
              </div>

              {editProfileIsActive ? (
                <AccessChecklist role={draftRole} />
              ) : (
                <InactiveAccessNotice />
              )}

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-sm font-semibold text-foreground">Scheduling Constraints</p>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Days they never work</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-draft will never assign them on these days, regardless of anything else.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DOW_OPTIONS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleNeverDay(day.value)}
                        className={cn(
                          'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                          neverDays.includes(day.value)
                            ? 'border-destructive bg-destructive/10 text-destructive'
                            : 'border-border bg-card text-muted-foreground hover:border-destructive/40 hover:text-foreground'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  {neverDays.map((d) => (
                    <input key={d} type="hidden" name="offs_dow" value={String(d)} />
                  ))}
                </div>

                <div className="h-px bg-border/60" />

                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      name="has_recurring_schedule"
                      className="h-4 w-4"
                      checked={hasPattern}
                      onChange={(e) => setHasPattern(e.target.checked)}
                    />
                    <span className="text-xs font-medium text-foreground">
                      Has a fixed weekly pattern
                      <span className="ml-1 font-normal text-muted-foreground">
                        — works the same days every week
                      </span>
                    </span>
                  </label>

                  {hasPattern && (
                    <div className="space-y-3 pl-1">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground">Days they work</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DOW_OPTIONS.map((day) => (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleDay(day.value)}
                              className={cn(
                                'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                                selectedDays.includes(day.value)
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                              )}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                        {selectedDays.map((d) => (
                          <input key={d} type="hidden" name="works_dow" value={String(d)} />
                        ))}
                      </div>

                      {selectedDays.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">How strict?</p>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                            <input
                              type="radio"
                              name="works_dow_mode"
                              value="hard"
                              className="mt-0.5 h-4 w-4 shrink-0"
                              checked={worksDowMode === 'hard'}
                              onChange={() => setWorksDowMode('hard')}
                            />
                            <span>
                              <span className="font-medium text-foreground">Only these days</span>
                              <span className="ml-1 text-muted-foreground">
                                — will not be scheduled on other days
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                            <input
                              type="radio"
                              name="works_dow_mode"
                              value="soft"
                              className="mt-0.5 h-4 w-4 shrink-0"
                              checked={worksDowMode === 'soft'}
                              onChange={() => setWorksDowMode('soft')}
                            />
                            <span>
                              <span className="font-medium text-foreground">
                                Usually these days
                              </span>
                              <span className="ml-1 text-muted-foreground">
                                — preferred but can flex when needed
                              </span>
                            </span>
                          </label>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground">Weekend rotation</p>
                        <div className="space-y-1">
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                            <input
                              type="radio"
                              name="weekend_rotation"
                              value="none"
                              className="h-4 w-4 shrink-0"
                              checked={weekendRotation === 'none'}
                              onChange={() => setWeekendRotation('none')}
                            />
                            <span className="font-medium text-foreground">Works every weekend</span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                            <input
                              type="radio"
                              name="weekend_rotation"
                              value="every_other"
                              className="h-4 w-4 shrink-0"
                              checked={weekendRotation === 'every_other'}
                              onChange={() => setWeekendRotation('every_other')}
                            />
                            <span className="font-medium text-foreground">Every other weekend</span>
                          </label>
                        </div>

                        {weekendRotation === 'every_other' && (
                          <div className="mt-2 space-y-1">
                            <label
                              htmlFor="weekend_anchor_date"
                              className="text-xs font-medium text-foreground"
                            >
                              Pick a Saturday for their next on-weekend block
                            </label>
                            <Input
                              id="weekend_anchor_date"
                              name="weekend_anchor_date"
                              type="date"
                              defaultValue={workPatterns[editProfile.id]?.weekend_anchor_date ?? ''}
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              Auto-draft alternates weekends from this date.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                {!editProfileIsActive ? (
                  <Button type="submit" formAction={archiveTeamMemberAction} variant="outline">
                    Archive employee
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => setEditProfileId(null)}>
                    Cancel
                  </Button>
                  <FormSubmitButton type="submit" pendingText="Saving...">
                    Save changes
                  </FormSubmitButton>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
