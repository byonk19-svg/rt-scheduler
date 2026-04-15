'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type TeamDirectoryRoleFilter = 'all' | 'manager' | 'lead' | 'therapist'
export type TeamDirectoryShiftFilter = 'all' | 'day' | 'night'
export type TeamDirectoryEmploymentFilter = 'all' | 'full_time' | 'part_time' | 'prn'
export type TeamDirectoryStatusFilter = 'all' | 'active' | 'inactive' | 'fmla'

export type TeamDirectoryFilterState = {
  search: string
  role: TeamDirectoryRoleFilter
  shift: TeamDirectoryShiftFilter
  employment: TeamDirectoryEmploymentFilter
  status: TeamDirectoryStatusFilter
}

type TeamDirectoryFiltersProps = {
  value: TeamDirectoryFilterState
  onChange: (next: TeamDirectoryFilterState) => void
}

const selectClass =
  'h-9 w-full min-w-0 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground'

export function TeamDirectoryFilters({ value, onChange }: TeamDirectoryFiltersProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="team-dir-search" className="text-xs">
            Search
          </Label>
          <Input
            id="team-dir-search"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Name…"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="team-dir-role" className="text-xs">
            Role
          </Label>
          <select
            id="team-dir-role"
            className={selectClass}
            value={value.role}
            onChange={(e) =>
              onChange({ ...value, role: e.target.value as TeamDirectoryRoleFilter })
            }
          >
            <option value="all">All roles</option>
            <option value="manager">Manager</option>
            <option value="lead">Lead therapist</option>
            <option value="therapist">Therapist</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="team-dir-shift" className="text-xs">
            Shift
          </Label>
          <select
            id="team-dir-shift"
            className={selectClass}
            value={value.shift}
            onChange={(e) =>
              onChange({ ...value, shift: e.target.value as TeamDirectoryShiftFilter })
            }
          >
            <option value="all">All shifts</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="team-dir-emp" className="text-xs">
            Employment
          </Label>
          <select
            id="team-dir-emp"
            className={selectClass}
            value={value.employment}
            onChange={(e) =>
              onChange({ ...value, employment: e.target.value as TeamDirectoryEmploymentFilter })
            }
          >
            <option value="all">All types</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="prn">PRN</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="team-dir-status" className="text-xs">
            Status
          </Label>
          <select
            id="team-dir-status"
            className={selectClass}
            value={value.status}
            onChange={(e) =>
              onChange({ ...value, status: e.target.value as TeamDirectoryStatusFilter })
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="fmla">On FMLA</option>
          </select>
        </div>
      </div>
    </div>
  )
}
