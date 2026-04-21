'use client'

import { Badge } from '@/components/ui/badge'
import { FormSubmitButton } from '@/components/form-submit-button'
import { formatEmployeeDate } from '@/lib/employee-directory'

type EmployeeDateOverride = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  source: 'therapist' | 'manager'
}

export function EmployeeOverrideHistoryPanel({
  cycleLabelById,
  deleteOverrideFormAction,
  deleteOverrideFormState,
  editEmployeeDateOverrides,
  employeeId,
}: {
  cycleLabelById: Map<string, string>
  deleteOverrideFormAction: (formData: FormData) => void
  deleteOverrideFormState: { error: string; profileId: string } | null
  editEmployeeDateOverrides: EmployeeDateOverride[]
  employeeId: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Current overrides
      </p>
      {deleteOverrideFormState?.error && deleteOverrideFormState.profileId === employeeId ? (
        <p
          role="alert"
          className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-medium text-[var(--error-text)]"
        >
          {deleteOverrideFormState.error}
        </p>
      ) : null}
      {editEmployeeDateOverrides.length === 0 ? (
        <p className="text-sm text-muted-foreground">No date overrides for this therapist yet.</p>
      ) : (
        <div className="space-y-2">
          {editEmployeeDateOverrides.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background p-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {formatEmployeeDate(row.date)} -{' '}
                  {row.override_type === 'force_on' ? 'Available to work' : 'Need off'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {cycleLabelById.get(row.cycle_id) ?? row.cycle_id}
                    {row.note ? ` | ${row.note}` : ''}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {row.source === 'manager' ? 'Entered by manager' : 'Entered by therapist'}
                  </Badge>
                </div>
              </div>
              <form action={deleteOverrideFormAction}>
                <input type="hidden" name="override_id" value={row.id} />
                <input type="hidden" name="profile_id" value={employeeId} />
                <input type="hidden" name="cycle_id" value={row.cycle_id} />
                <FormSubmitButton type="submit" variant="ghost" size="sm" pendingText="Deleting...">
                  Delete
                </FormSubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
