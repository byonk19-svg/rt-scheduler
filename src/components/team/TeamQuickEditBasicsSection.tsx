'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TEAM_LEAD_ROLE_LABEL,
  type TeamProfileRecord,
} from '@/components/team/team-directory-model'

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

function shiftLabel(type: TeamProfileRecord['shift_type']): string {
  return type === 'night' ? 'Night shift' : 'Day shift'
}

export function TeamQuickEditBasicsSection({
  draftRole,
  editProfile,
  onFmla,
  onFmlaChange,
  onRoleChange,
}: {
  draftRole: EditableRole
  editProfile: TeamProfileRecord
  onFmla: boolean
  onFmlaChange: (checked: boolean) => void
  onRoleChange: (value: EditableRole) => void
}) {
  return (
    <>
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
              {shiftLabel(editProfile.shift_type)} · {employmentLabel(editProfile.employment_type)}
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
            onChange={(event) => onRoleChange(event.target.value as EditableRole)}
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
            onChange={(event) => onFmlaChange(event.target.checked)}
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
    </>
  )
}
