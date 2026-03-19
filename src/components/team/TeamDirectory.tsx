'use client'

import { useEffect, useMemo, useState } from 'react'
import { Shield, User } from 'lucide-react'

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
import { formatEmployeeDate } from '@/lib/employee-directory'
import { getTeamRolePermissions } from '@/lib/team-role-permissions'
import { cn } from '@/lib/utils'

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
  initialEditProfileId?: string | null
  archiveTeamMemberAction: (formData: FormData) => void | Promise<void>
  saveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
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

function TeamMemberCard({ profile, onClick }: { profile: TeamProfileRecord; onClick: () => void }) {
  const isActive = teamMemberHasAppAccess(profile)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:border-primary/20 hover:shadow-md',
        !isActive && 'opacity-75'
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
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
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {profile.full_name ?? 'Unknown'}
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              roleBadgeClass(profile.role)
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{shiftLabel(profile.shift_type)}</span>
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
    </button>
  )
}

function TeamSection({
  title,
  profiles,
  onOpen,
}: {
  title: string
  profiles: TeamProfileRecord[]
  onOpen: (profileId: string) => void
}) {
  if (profiles.length === 0) return null

  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {profiles.map((profile) => (
          <TeamMemberCard key={profile.id} profile={profile} onClick={() => onOpen(profile.id)} />
        ))}
      </div>
    </section>
  )
}

function ShiftGroup({
  title,
  leads,
  therapists,
  onOpen,
}: {
  title: string
  leads: TeamProfileRecord[]
  therapists: TeamProfileRecord[]
  onOpen: (profileId: string) => void
}) {
  if (leads.length === 0 && therapists.length === 0) return null

  return (
    <section className="mb-8 rounded-2xl border border-border bg-muted/20 p-4 last:mb-0 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <TeamSection title="Lead Therapists" profiles={leads} onOpen={onOpen} />
      <TeamSection title="Therapists" profiles={therapists} onOpen={onOpen} />
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
  initialEditProfileId = null,
  archiveTeamMemberAction,
  saveTeamQuickEditAction,
}: TeamDirectoryProps) {
  const [editProfileId, setEditProfileId] = useState<string | null>(initialEditProfileId)
  const [draftRole, setDraftRole] = useState<EditableRole>('therapist')
  const [onFmla, setOnFmla] = useState(false)

  const sections = useMemo(() => partitionTeamProfiles(profiles), [profiles])
  const editProfile = useMemo(
    () => profiles.find((profile) => profile.id === editProfileId) ?? null,
    [profiles, editProfileId]
  )
  const editProfileIsActive = editProfile ? teamMemberHasAppAccess(editProfile) : false

  useEffect(() => {
    if (!editProfile) return
    setDraftRole((editProfile.role as EditableRole | null) ?? 'therapist')
    setOnFmla(editProfile.on_fmla === true)
  }, [editProfile])

  return (
    <>
      <TeamSection title="Managers" profiles={sections.managers} onOpen={setEditProfileId} />
      <ShiftGroup
        title="Day Shift"
        leads={sections.dayLeads}
        therapists={sections.dayTherapists}
        onOpen={setEditProfileId}
      />
      <ShiftGroup
        title="Night Shift"
        leads={sections.nightLeads}
        therapists={sections.nightTherapists}
        onOpen={setEditProfileId}
      />
      <TeamSection title="Inactive" profiles={sections.inactive} onOpen={setEditProfileId} />

      {profiles.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No team members found.</p>
        </div>
      )}

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
