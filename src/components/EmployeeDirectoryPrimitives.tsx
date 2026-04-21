'use client'

import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

import { EMPLOYEE_META_BADGE_CLASS, LEAD_ELIGIBLE_BADGE_CLASS } from '@/lib/employee-tag-badges'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FormSubmitButton } from '@/components/form-submit-button'

type SortDirection = 'asc' | 'desc'
type DirectorySortKey = 'employee' | 'shift' | 'type' | 'tags'
type SortColumnLabel = 'Employee' | 'Shift/Team' | 'Type' | 'Tags'

type EmployeeLike = {
  id: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
  is_lead_eligible: boolean
  is_active: boolean
}

export function ShiftBadge({ shiftType }: { shiftType: EmployeeLike['shift_type'] }) {
  return (
    <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
      {shiftType}
    </Badge>
  )
}

export function EmployeeRowBadges({ employee }: { employee: EmployeeLike }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] capitalize',
          employee.shift_type === 'day'
            ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
            : 'border-border bg-muted text-foreground'
        )}
      >
        {employee.shift_type === 'day' ? 'Day' : 'Night'}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px]',
          employee.employment_type === 'full_time'
            ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
            : employee.employment_type === 'part_time'
              ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              : 'border-border bg-muted text-muted-foreground'
        )}
      >
        {employee.employment_type === 'full_time'
          ? 'FT'
          : employee.employment_type === 'part_time'
            ? 'PT'
            : 'PRN'}
      </Badge>
      {employee.is_lead_eligible ? (
        <Badge className={cn('text-[10px]', LEAD_ELIGIBLE_BADGE_CLASS)}>Lead</Badge>
      ) : null}
      {!employee.is_active ? (
        <Badge
          variant="outline"
          className="border-[var(--error-border)] bg-[var(--error-subtle)] text-[10px] text-[var(--error-text)]"
        >
          Inactive
        </Badge>
      ) : null}
    </div>
  )
}

export function SortHeaderButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: SortColumnLabel
  column: DirectorySortKey
  sortKey: DirectorySortKey
  sortDirection: SortDirection
  onSort: (key: DirectorySortKey) => void
}) {
  const isActive = sortKey === column

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--border)]'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label} ${isActive ? `(currently ${sortDirection})` : ''}`}
    >
      <span>{label}</span>
      {isActive ? (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-primary" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
      )}
    </button>
  )
}

export function EmployeeActionsMenu({
  employee,
  onEdit,
  onDeactivate,
  setEmployeeActiveAction,
}: {
  employee: EmployeeLike & { id: string }
  onEdit: () => void
  onDeactivate: () => void
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <details className="relative" onClick={(event) => event.stopPropagation()}>
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card text-sm hover:bg-secondary">
        ...
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-border bg-card p-1 shadow-sm">
        <button
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
          onClick={(event) => {
            event.preventDefault()
            onEdit()
          }}
        >
          Edit
        </button>
        {employee.is_active ? (
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-[var(--warning-text)] hover:bg-secondary"
            onClick={(event) => {
              event.preventDefault()
              onDeactivate()
            }}
          >
            Deactivate
          </button>
        ) : (
          <form action={setEmployeeActiveAction}>
            <input type="hidden" name="profile_id" value={employee.id} />
            <input type="hidden" name="set_active" value="true" />
            <FormSubmitButton
              type="submit"
              variant="ghost"
              size="sm"
              pendingText="Reactivating..."
              className="block w-full justify-start rounded px-2 py-1.5 text-left text-sm text-[var(--success-text)] hover:bg-secondary"
            >
              Reactivate
            </FormSubmitButton>
          </form>
        )}
        <div className="my-1 h-px bg-border" />
        <span className="block px-2 py-1 text-xs text-muted-foreground">
          Delete is replaced by deactivate.
        </span>
      </div>
    </details>
  )
}
