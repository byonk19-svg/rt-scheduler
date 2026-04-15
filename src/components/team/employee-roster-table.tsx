'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type EmployeeRosterTableRow = {
  id: string
  full_name: string
  role: 'manager' | 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
  max_work_days_per_week: number
  is_lead_eligible: boolean
  matched_profile_id: string | null
  matched_at: string | null
  phone_number: string | null
}

type SortKey =
  | 'full_name'
  | 'role'
  | 'shift_type'
  | 'employment_type'
  | 'max_work_days_per_week'
  | 'phone_number'
  | 'status'

function RosterSortHeader({
  column,
  label,
  sortKey,
  sortDir,
  onToggle,
}: {
  column: SortKey
  label: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onToggle: (key: SortKey) => void
}) {
  const active = sortKey === column
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
    >
      {label}
      {active ? (
        sortDir === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        )
      ) : null}
    </button>
  )
}

function roleLabel(role: EmployeeRosterTableRow['role']): string {
  if (role === 'lead') return 'Lead Therapist'
  if (role === 'manager') return 'Manager'
  return 'Therapist'
}

function employmentLabel(type: EmployeeRosterTableRow['employment_type']): string {
  if (type === 'part_time') return 'Part-time'
  if (type === 'prn') return 'PRN'
  return 'Full-time'
}

type EmployeeRosterTableProps = {
  roster: EmployeeRosterTableRow[]
  deleteEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
}

export function EmployeeRosterTable({
  roster,
  deleteEmployeeRosterEntryAction,
}: EmployeeRosterTableProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | EmployeeRosterTableRow['role']>('all')
  const [shiftFilter, setShiftFilter] = useState<'all' | EmployeeRosterTableRow['shift_type']>(
    'all'
  )
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'signed_up'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('full_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return roster.filter((row) => {
      if (q && !row.full_name.toLowerCase().includes(q)) return false
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (shiftFilter !== 'all' && row.shift_type !== shiftFilter) return false
      if (statusFilter === 'pending' && row.matched_profile_id) return false
      if (statusFilter === 'signed_up' && !row.matched_profile_id) return false
      return true
    })
  }, [roster, search, roleFilter, shiftFilter, statusFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'status') {
        const sa = a.matched_profile_id ? 1 : 0
        const sb = b.matched_profile_id ? 1 : 0
        return (sa - sb) * dir
      }
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * dir
    })
    return copy
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (roster.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No roster entries yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roster by name…"
          className="h-8"
        />
        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | EmployeeRosterTableRow['role'])}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground"
        >
          <option value="all">All roles</option>
          <option value="manager">Manager</option>
          <option value="lead">Lead therapist</option>
          <option value="therapist">Therapist</option>
        </select>
        <select
          aria-label="Filter by shift"
          value={shiftFilter}
          onChange={(e) =>
            setShiftFilter(e.target.value as 'all' | EmployeeRosterTableRow['shift_type'])
          }
          className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground"
        >
          <option value="all">All shifts</option>
          <option value="day">Day</option>
          <option value="night">Night</option>
        </select>
        <select
          aria-label="Filter by roster status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'signed_up')}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="signed_up">Signed up</option>
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">
              <RosterSortHeader
                column="full_name"
                label="Name"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>
              <RosterSortHeader
                column="role"
                label="Role"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>
              <RosterSortHeader
                column="shift_type"
                label="Shift"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>
              <RosterSortHeader
                column="employment_type"
                label="Employment"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>
              <RosterSortHeader
                column="max_work_days_per_week"
                label="Max / wk"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>
              <RosterSortHeader
                column="phone_number"
                label="Phone"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>
              <RosterSortHeader
                column="status"
                label="Status"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead className="w-[88px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.full_name}</TableCell>
              <TableCell>{roleLabel(row.role)}</TableCell>
              <TableCell className="capitalize">{row.shift_type}</TableCell>
              <TableCell>{employmentLabel(row.employment_type)}</TableCell>
              <TableCell className="tabular-nums">{row.max_work_days_per_week}</TableCell>
              <TableCell className="max-w-[140px] truncate text-muted-foreground">
                {row.phone_number?.trim() ? row.phone_number : '—'}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    row.matched_profile_id
                      ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {row.matched_profile_id ? 'Signed up' : 'Pending'}
                </span>
              </TableCell>
              <TableCell className="py-2 text-right">
                <form action={deleteEmployeeRosterEntryAction} className="inline">
                  <input type="hidden" name="roster_id" value={row.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
