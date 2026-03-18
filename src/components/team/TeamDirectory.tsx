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
  saveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
}

type EditableRole = 'manager' | 'lead' | 'therapist'

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
  if (role === 'lead') return 'Lead'
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

function TeamMemberCard({ profile, onClick }: { profile: TeamProfileRecord; onClick: () => void }) {
  const isActive = profile.is_active !== false
  const hasCoverageLead = profile.is_lead_eligible === true

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
          {hasCoverageLead && profile.role !== 'lead' && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Coverage lead
            </span>
          )}
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

export function TeamDirectory({
  profiles,
  initialEditProfileId = null,
  saveTeamQuickEditAction,
}: TeamDirectoryProps) {
  const [editProfileId, setEditProfileId] = useState<string | null>(initialEditProfileId)
  const [draftRole, setDraftRole] = useState<EditableRole>('therapist')
  const [onFmla, setOnFmla] = useState(false)

  const activeProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_active !== false),
    [profiles]
  )
  const inactiveProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_active === false),
    [profiles]
  )
  const managers = useMemo(
    () => activeProfiles.filter((profile) => profile.role === 'manager'),
    [activeProfiles]
  )
  const leads = useMemo(
    () => activeProfiles.filter((profile) => profile.role === 'lead'),
    [activeProfiles]
  )
  const therapists = useMemo(
    () => activeProfiles.filter((profile) => profile.role !== 'manager' && profile.role !== 'lead'),
    [activeProfiles]
  )
  const editProfile = useMemo(
    () => profiles.find((profile) => profile.id === editProfileId) ?? null,
    [profiles, editProfileId]
  )
  const coverageLeadDisabled = draftRole === 'manager'

  useEffect(() => {
    if (!editProfile) return
    setDraftRole((editProfile.role as EditableRole | null) ?? 'therapist')
    setOnFmla(editProfile.on_fmla === true)
  }, [editProfile])

  return (
    <>
      <TeamSection title="Managers" profiles={managers} onOpen={setEditProfileId} />
      <TeamSection title="Leads" profiles={leads} onOpen={setEditProfileId} />
      <TeamSection title="Therapists" profiles={therapists} onOpen={setEditProfileId} />
      <TeamSection title="Inactive" profiles={inactiveProfiles} onOpen={setEditProfileId} />

      {profiles.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No team members found.</p>
        </div>
      )}

      <Dialog open={Boolean(editProfile)} onOpenChange={(open) => !open && setEditProfileId(null)}>
        {editProfile && (
          <DialogContent className="sm:max-w-[560px]">
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
                    <option value="lead">Lead</option>
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

              <div className="grid gap-2 sm:grid-cols-3">
                <label
                  className={cn(
                    'flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm',
                    coverageLeadDisabled && 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  <input
                    type="checkbox"
                    name="is_lead_eligible"
                    defaultChecked={editProfile.is_lead_eligible === true}
                    className="h-4 w-4"
                    disabled={coverageLeadDisabled}
                  />
                  Coverage lead
                </label>
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

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditProfileId(null)}>
                  Cancel
                </Button>
                <FormSubmitButton type="submit" pendingText="Saving...">
                  Save changes
                </FormSubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
