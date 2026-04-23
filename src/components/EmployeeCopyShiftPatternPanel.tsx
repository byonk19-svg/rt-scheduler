'use client'

import { FormSubmitButton } from '@/components/form-submit-button'

type EmployeeCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

export function EmployeeCopyShiftPatternPanel({
  copyShiftsFormAction,
  copyShiftsFormState,
  copySourceCycleId,
  copyTargetCycleId,
  cycles,
  employeeId,
  onCopySourceCycleIdChange,
  onCopyTargetCycleIdChange,
}: {
  copyShiftsFormAction: (formData: FormData) => void
  copyShiftsFormState: { error: string; employeeId: string } | null
  copySourceCycleId: string
  copyTargetCycleId: string
  cycles: EmployeeCycle[]
  employeeId: string
  onCopySourceCycleIdChange: (value: string) => void
  onCopyTargetCycleIdChange: (value: string) => void
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Copy shift pattern
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Copy this employee&apos;s scheduled shifts from one cycle to another. Shifts already in the
        target cycle are kept.
      </p>
      <form action={copyShiftsFormAction} className="mt-3 space-y-2">
        <input type="hidden" name="employee_id" value={employeeId} />
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            From cycle
            <select
              name="source_cycle_id"
              value={copySourceCycleId}
              onChange={(event) => onCopySourceCycleIdChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            To cycle
            <select
              name="target_cycle_id"
              value={copyTargetCycleId}
              onChange={(event) => onCopyTargetCycleIdChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FormSubmitButton
          type="submit"
          size="sm"
          disabled={
            !copySourceCycleId || !copyTargetCycleId || copySourceCycleId === copyTargetCycleId
          }
          pendingText="Copying..."
        >
          Copy shifts
        </FormSubmitButton>
        {copyShiftsFormState?.error && copyShiftsFormState.employeeId === employeeId ? (
          <p
            role="alert"
            className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-medium text-[var(--error-text)]"
          >
            {copyShiftsFormState.error}
          </p>
        ) : null}
      </form>
    </div>
  )
}
