'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Shield, User } from 'lucide-react'

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
import { BulkActionBar } from '@/components/team/BulkActionBar'
import { formatEmployeeDate } from '@/lib/employee-directory'
import { getTeamRolePermissions } from '@/lib/team-role-permissions'
import { cn } from '@/lib/utils'

export type WorkPatternRecord = {
  works_dow: number[]
  offs_dow: number[]
  works_dow_mode: 'hard' | 'soft'
  weekend_rotation: 'none' | 'every_other'
  weekend_anchor_date: string | null
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

export type TeamProfileRecord = {
  id: string
  full_name: string | null
  role: 'manager' | 'therapist' | 'lead' | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
  fmla_return_date: string | null
}

type TeamDirectoryProps = {
  profiles: TeamProfileRecord[]
  workPatterns?: Record<string, WorkPatternRecord>
  initialEditProfileId?: string | null
  archiveTeamMemberAction: (formData: FormData) => void | Promise<void>
  saveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
  bulkUpdateTeamMembersAction: (formData: FormData) => void | Promise<void>
}

type EditableRole = 'manager' | 'lead' | 'therapist'
type ShiftBucket = 'day' | 'night'

type TeamDirectorySections = {
  managers: TeamProfileRecord[]
  inactive: TeamProfileRecord[]
  dayLeads: TeamProfileRecord[]
  dayTherapists: TeamProfileRecord[]
  nightLeads: TeamProfileRecord[]
  nightTherapists: TeamProfileRecord[]
}

export const TEAM_QUICK_EDIT_DIALOG_CLASS =
  'max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]'
export const TEAM_LEAD_ROLE_LABEL = 'Lead Therapist'

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

function roleLabel(role: TeamProfileRecord['role']): string {
  if (role === 'manager') return 'Manager'
  if (role === 'lead') return TEAM_LEAD_ROLE_LABEL
  return 'Therapist'
}

function roleBadgeClass(role: TeamProfileRecord['role']): string {
  if (role === 'manager') return 'bg-secondary text-secondary-foreground'
  if (role === 'lead') return 'bg-primary/10 text-primary'
  return 'bg-muted text-muted-foreground'
}

function SectionHeaderCheckbox({
  allSelected,
  someSelected,
  onChange,
  ariaLabel,
}: {
  allSelected: boolean
  someSelected: boolean
  onChange: (selectAll: boolean) => void
  ariaLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
      checked={allSelected}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
    />
  )
}

function shiftLabel(type: TeamProfileRecord['shift_type']): string {
  return type === 'night' ? 'Night shift' : 'Day shift'
}

function shiftBucket(type: TeamProfileRecord['shift_type']): ShiftBucket {
  return type === 'night' ? 'night' : 'day'
}

export function teamMemberHasAppAccess(profile: Pick<TeamProfileRecord, 'is_active'>): boolean {
  return profile.is_active !== false
}

export function partitionTeamProfiles(profiles: TeamProfileRecord[]): TeamDirectorySections {
  const sections: TeamDirectorySections = {
    managers: [],
    inactive: [],
    dayLeads: [],
    dayTherapists: [],
    nightLeads: [],
    nightTherapists: [],
  }

  for (const profile of profiles) {
    if (!teamMemberHasAppAccess(profile)) {
      sections.inactive.push(profile)
      continue
    }

    if (profile.role === 'manager') {
      sections.managers.push(profile)
      continue
    }

    const bucket = shiftBucket(profile.shift_type)
    if (profile.role === 'lead') {
      if (bucket === 'night') sections.nightLeads.push(profile)
      else sections.dayLeads.push(profile)
      continue
    }

    if (bucket === 'night') sections.nightTherapists.push(profile)
    else sections.dayTherapists.push(profile)
  }

  return sections
}

function TeamMemberCard({
  profile,
  onClick,
  isSelected = false,
  onToggle,
}: {
  profile: TeamProfileRecord
  onClick: () => void
  isSelected?: boolean
  onToggle?: () => void
}) {
  const isActive = teamMemberHasAppAccess(profile)

  const card = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-4 rounded-xl border border-border/70 bg-card/85 p-5 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-card hover:shadow-md active:scale-[0.99] active:shadow-sm',
        profile.role === 'lead' &&
          'border-primary/30 bg-primary/[0.04] hover:border-primary/50 hover:bg-primary/[0.07]',
        !isActive && 'opacity-75',
        onToggle && isSelected && 'ring-2 ring-primary/25'
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-transform group-hover:scale-105',
          profile.role === 'lead'
            ? 'border border-primary/20 bg-primary/10 text-primary'
            : profile.role === 'manager'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground'
        )}
      >
        {initials(profile.full_name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {profile.full_name ?? 'Unknown'}
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              roleBadgeClass(profile.role),
              profile.role === 'lead' && 'ring-1 ring-primary/10'
            )}
          >
            {profile.role === 'lead' ? (
              <Shield className="h-2.5 w-2.5" />
            ) : (
              <User className="h-2.5 w-2.5" />
            )}
            {roleLabel(profile.role)}
          </span>
          {profile.on_fmla && (
            <span className="inline-flex items-center rounded-full bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning-text)]">
              FMLA
            </span>
          )}
          {!isActive && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                profile.shift_type === 'night' ? 'bg-[var(--warning)]' : 'bg-[var(--info)]'
              )}
            />
            {shiftLabel(profile.shift_type)}
          </span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{employmentLabel(profile.employment_type)}</span>
          {profile.on_fmla && profile.fmla_return_date && (
            <>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>Return {formatEmployeeDate(profile.fmla_return_date)}</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary/50" />
    </button>
  )

  if (!onToggle) {
    return card
  }

  return (
    <div className="flex w-full items-stretch gap-3">
      <label className="flex shrink-0 cursor-pointer items-start pt-5">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
          checked={isSelected}
          onChange={() => onToggle()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${profile.full_name ?? 'team member'}`}
        />
      </label>
      <div className="min-w-0 flex-1">{card}</div>
    </div>
  )
}

function TeamSection({
  title,
  profiles,
  onOpen,
  selectedIds,
  onToggleId,
  onToggleSectionIds,
}: {
  title: string
  profiles: TeamProfileRecord[]
  onOpen: (profileId: string) => void
  selectedIds: Set<string>
  onToggleId: (id: string) => void
  onToggleSectionIds: (ids: string[], selectAll: boolean) => void
}) {
  if (profiles.length === 0) return null

  const ids = profiles.map((p) => p.id)
  const allSelected = profiles.length > 0 && profiles.every((p) => selectedIds.has(p.id))
  const someSelected = profiles.some((p) => selectedIds.has(p.id))

  return (
    <section className="mb-8 last:mb-0">
      <div className="mb-3 flex items-center gap-2.5">
        <SectionHeaderCheckbox
          allSelected={allSelected}
          someSelected={someSelected}
          onChange={(selectAll) => onToggleSectionIds(ids, selectAll)}
          ariaLabel={`Select all in ${title}`}
        />
        <div className="h-3.5 w-0.5 rounded-full bg-primary/40" />
        <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-foreground/70">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border/60" />
        <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {profiles.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {profiles.map((profile) => (
          <TeamMemberCard
            key={profile.id}
            profile={profile}
            onClick={() => onOpen(profile.id)}
            isSelected={selectedIds.has(profile.id)}
            onToggle={() => onToggleId(profile.id)}
          />
        ))}
      </div>
    </section>
  )
}

function ShiftGroup({
  title,
  shiftType,
  leads,
  therapists,
  onOpen,
  selectedIds,
  onToggleId,
  onToggleSectionIds,
}: {
  title: string
  shiftType: 'day' | 'night'
  leads: TeamProfileRecord[]
  therapists: TeamProfileRecord[]
  onOpen: (profileId: string) => void
  selectedIds: Set<string>
  onToggleId: (id: string) => void
  onToggleSectionIds: (ids: string[], selectAll: boolean) => void
}) {
  if (leads.length === 0 && therapists.length === 0) return null

  const groupProfiles = [...leads, ...therapists]
  const groupIds = groupProfiles.map((p) => p.id)
  const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id))
  const someGroupSelected = groupIds.some((id) => selectedIds.has(id))

  return (
    <section
      className={cn(
        'mb-8 rounded-2xl border p-4 last:mb-0 sm:p-5',
        shiftType === 'night'
          ? 'border-[var(--warning-border)]/40 bg-[var(--warning-subtle)]/20'
          : 'border-[var(--info-border)]/40 bg-[var(--info-subtle)]/20'
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]',
            shiftType === 'night' ? 'text-[var(--warning-text)]' : 'text-[var(--info-text)]'
          )}
        >
          <SectionHeaderCheckbox
            allSelected={allGroupSelected}
            someSelected={someGroupSelected}
            onChange={(selectAll) => onToggleSectionIds(groupIds, selectAll)}
            ariaLabel={`Select all in ${title}`}
          />
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              shiftType === 'night' ? 'bg-[var(--warning)]' : 'bg-[var(--info)]'
            )}
          />
          {title}
        </h2>
        <span className="shrink-0 rounded-full border border-border/70 bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {leads.length + therapists.length} total
        </span>
      </div>
      <TeamSection
        title="Lead Therapists"
        profiles={leads}
        onOpen={onOpen}
        selectedIds={selectedIds}
        onToggleId={onToggleId}
        onToggleSectionIds={onToggleSectionIds}
      />
      <TeamSection
        title="Therapists"
        profiles={therapists}
        onOpen={onOpen}
        selectedIds={selectedIds}
        onToggleId={onToggleId}
        onToggleSectionIds={onToggleSectionIds}
      />
    </section>
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
  profiles,
  workPatterns = {},
  initialEditProfileId = null,
  archiveTeamMemberAction,
  saveTeamQuickEditAction,
  bulkUpdateTeamMembersAction,
}: TeamDirectoryProps) {
  const initialEditProfile = profiles.find((profile) => profile.id === initialEditProfileId) ?? null
  const initialPattern = initialEditProfile ? (workPatterns[initialEditProfile.id] ?? null) : null

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [editProfileId, setEditProfileId] = useState<string | null>(initialEditProfile?.id ?? null)
  const [draftRole, setDraftRole] = useState<EditableRole>(
    (initialEditProfile?.role as EditableRole | null) ?? 'therapist'
  )
  const [onFmla, setOnFmla] = useState(initialEditProfile?.on_fmla === true)

  // Work pattern state
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

  const sections = useMemo(() => partitionTeamProfiles(profiles), [profiles])
  const toggleSelectedId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSectionIds = useCallback((ids: string[], selectAll: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selectAll) {
        for (const id of ids) next.add(id)
      } else {
        for (const id of ids) next.delete(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const runBulkAction = useCallback(
    (action: string, value?: string) => {
      if (selectedIds.size === 0) return
      const fd = new FormData()
      for (const id of selectedIds) {
        fd.append('profile_ids', id)
      }
      fd.set('bulk_action', action)
      if (value) fd.set('bulk_value', value)
      setSelectedIds(new Set())
      void bulkUpdateTeamMembersAction(fd)
    },
    [bulkUpdateTeamMembersAction, selectedIds]
  )

  const editProfile = useMemo(
    () => profiles.find((profile) => profile.id === editProfileId) ?? null,
    [profiles, editProfileId]
  )
  const editProfileIsActive = editProfile ? teamMemberHasAppAccess(editProfile) : false

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
      <div className={cn(selectedIds.size > 0 && 'pb-24')}>
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
          <TeamSection
            title="Managers"
            profiles={sections.managers}
            onOpen={openEditor}
            selectedIds={selectedIds}
            onToggleId={toggleSelectedId}
            onToggleSectionIds={toggleSectionIds}
          />
        </div>
        <ShiftGroup
          title="Day Shift"
          shiftType="day"
          leads={sections.dayLeads}
          therapists={sections.dayTherapists}
          onOpen={openEditor}
          selectedIds={selectedIds}
          onToggleId={toggleSelectedId}
          onToggleSectionIds={toggleSectionIds}
        />
        <ShiftGroup
          title="Night Shift"
          shiftType="night"
          leads={sections.nightLeads}
          therapists={sections.nightTherapists}
          onOpen={openEditor}
          selectedIds={selectedIds}
          onToggleId={toggleSelectedId}
          onToggleSectionIds={toggleSectionIds}
        />
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
          <TeamSection
            title="Inactive"
            profiles={sections.inactive}
            onOpen={openEditor}
            selectedIds={selectedIds}
            onToggleId={toggleSelectedId}
            onToggleSectionIds={toggleSectionIds}
          />
        </div>

        {profiles.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">No team members found.</p>
          </div>
        )}
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onApply={runBulkAction}
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

              {/* ── Scheduling Constraints ── */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-sm font-semibold text-foreground">Scheduling Constraints</p>

                {/* ── Days they never work (offs_dow) — always shown ── */}
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

                {/* ── Recurring weekly pattern (works_dow) — toggled ── */}
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
                      {/* Work days */}
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

                      {/* Strictness */}
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

                      {/* Weekend rotation */}
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
