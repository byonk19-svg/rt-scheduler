'use client'

import type { ReactNode } from 'react'

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
  actions?: ReactNode
}

const selectClass =
  'h-8 w-full min-w-0 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground'

export function TeamDirectoryFilters({ value, onChange, actions }: TeamDirectoryFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/95 p-2.5 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="team-dir-search" className="text-xs">
            Search
          </Label>
          <Input
            id="team-dir-search"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Name…"
            className="h-8"
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
      {actions ? (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
