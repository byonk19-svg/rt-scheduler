'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'

export type TeamProfileRecord = {
  id: string
  full_name: string | null
  role: 'manager' | 'therapist' | 'staff' | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
}

type TeamDirectoryProps = {
  profiles: TeamProfileRecord[]
  initialEditProfileId?: string | null
  saveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
}

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
  if (role === 'staff') return 'Staff'
  return 'Therapist'
}

function TherapistCard({ profile, onClick }: { profile: TeamProfileRecord; onClick: () => void }) {
  const isLead = profile.is_lead_eligible === true
  const emp = employmentLabel(profile.employment_type)
  const shift = profile.shift_type === 'night' ? 'Night' : 'Day'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:border-primary/20 hover:shadow-md"
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          isLead
            ? 'border border-primary/20 bg-primary/10 text-primary'
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
              isLead ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            {isLead ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {isLead ? 'Lead' : roleLabel(profile.role)}
          </span>
          {profile.on_fmla && (
            <span className="inline-flex items-center rounded-full bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning-text)]">
              FMLA
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{shift} shift</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{emp}</span>
        </div>
      </div>
    </button>
  )
}

export function TeamDirectory({
  profiles,
  initialEditProfileId = null,
  saveTeamQuickEditAction,
}: TeamDirectoryProps) {
  const [editProfileId, setEditProfileId] = useState<string | null>(initialEditProfileId)

  const activeProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_active !== false),
    [profiles]
  )
  const leads = useMemo(
    () => activeProfiles.filter((profile) => profile.is_lead_eligible === true),
    [activeProfiles]
  )
  const staff = useMemo(
    () => activeProfiles.filter((profile) => profile.is_lead_eligible !== true),
    [activeProfiles]
  )
  const editProfile = useMemo(
    () => profiles.find((profile) => profile.id === editProfileId) ?? null,
    [profiles, editProfileId]
  )

  return (
    <>
      {leads.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lead Therapists
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {leads.map((profile) => (
              <TherapistCard
                key={profile.id}
                profile={profile}
                onClick={() => setEditProfileId(profile.id)}
              />
            ))}
          </div>
        </section>
      )}

      {staff.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff Therapists
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {staff.map((profile) => (
              <TherapistCard
                key={profile.id}
                profile={profile}
                onClick={() => setEditProfileId(profile.id)}
              />
            ))}
          </div>
        </section>
      )}

      {activeProfiles.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No active team members found.</p>
          <Link
            href="/directory"
            className="mt-2 inline-block text-xs text-primary hover:underline"
          >
            Add team members in the directory
          </Link>
        </div>
      )}

      <Dialog open={Boolean(editProfile)} onOpenChange={(open) => !open && setEditProfileId(null)}>
        {editProfile && (
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Quick Edit Therapist</DialogTitle>
              <DialogDescription>
                Update the roster fields here. Use the full directory for contact info or scheduling
                settings.
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
                      {editProfile.shift_type === 'night' ? 'Night' : 'Day'} shift ·{' '}
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
                    defaultValue={editProfile.role ?? 'therapist'}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  >
                    <option value="therapist">Therapist</option>
                    <option value="staff">Staff</option>
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
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_lead_eligible"
                    defaultChecked={editProfile.is_lead_eligible === true}
                    className="h-4 w-4"
                  />
                  Lead eligible
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="on_fmla"
                    defaultChecked={editProfile.on_fmla === true}
                    className="h-4 w-4"
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

              <DialogFooter className="gap-2 sm:items-center sm:justify-between">
                <Link
                  href={`/directory?edit_profile=${editProfile.id}`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Open full directory
                </Link>
                <div className="flex gap-2">
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
