import type { ReactNode } from 'react'

import { PlannerSelectedDatesForm } from '@/components/availability/PlannerSelectedDatesForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { PlannerMode } from '@/lib/availability-planner'
import { cn } from '@/lib/utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
}

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type PlannerControlRailProps = {
  cycles: Cycle[]
  therapists: TherapistOption[]
  selectedCycleId: string
  selectedTherapistId: string
  selectedTherapist: TherapistOption | null
  mode: PlannerMode
  selectedDates: string[]
  onCycleChange: (value: string) => void
  onTherapistChange: (value: string) => void
  onModeChange: (value: PlannerMode) => void
  onClearSelectedDates: () => void
  onRemoveSelectedDate: (date: string) => void
  copyAction: (formData: FormData) => void | Promise<void>
  saveAction: (formData: FormData) => void | Promise<void>
  footer?: ReactNode
}

function employmentLabel(value: TherapistOption['employment_type']) {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

export function PlannerControlRail({
  cycles,
  therapists,
  selectedCycleId,
  selectedTherapistId,
  selectedTherapist,
  mode,
  selectedDates,
  onCycleChange,
  onTherapistChange,
  onModeChange,
  onClearSelectedDates,
  onRemoveSelectedDate,
  copyAction,
  saveAction,
  footer,
}: PlannerControlRailProps) {
  return (
    <div className="space-y-3.5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Planner controls</h2>
        <p className="text-sm text-muted-foreground">
          Choose a cycle and therapist, then mark dates in the calendar.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="planner_cycle_id"
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Schedule cycle
          </Label>
          <select
            id="planner_cycle_id"
            className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={selectedCycleId}
            onChange={(event) => onCycleChange(event.target.value)}
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.label} ({cycle.start_date} to {cycle.end_date})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="planner_therapist_id"
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Therapist
          </Label>
          <select
            id="planner_therapist_id"
            className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={selectedTherapistId}
            onChange={(event) => onTherapistChange(event.target.value)}
          >
            {(['day', 'night'] as const).map((shiftType) => {
              const group = therapists.filter((therapist) => therapist.shift_type === shiftType)
              if (group.length === 0) return null

              return (
                <optgroup key={shiftType} label={shiftType === 'day' ? 'Day Shift' : 'Night Shift'}>
                  {group.map((therapist) => (
                    <option key={therapist.id} value={therapist.id}>
                      {therapist.full_name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
      </div>

      {selectedTherapist ? (
        <div
          className="rounded-[1.1rem] border border-border/60 bg-background/70 px-3 py-2.5"
          role="group"
          aria-label="Therapist shift and employment"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-medium">
              {selectedTherapist.shift_type === 'night' ? 'Night shift' : 'Day shift'}
            </Badge>
            <Badge variant="outline" className="font-medium text-muted-foreground">
              {employmentLabel(selectedTherapist.employment_type)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Planner changes apply to {selectedTherapist.full_name}&apos;s scheduled shift pattern.
          </p>
        </div>
      ) : null}

      {selectedCycleId && selectedTherapistId ? (
        <form action={copyAction}>
          <input type="hidden" name="cycle_id" value={selectedCycleId} />
          <input type="hidden" name="therapist_id" value={selectedTherapistId} />
          <Button
            type="submit"
            variant="outline"
            className="min-h-11 w-full justify-center border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Copy from last block
          </Button>
        </form>
      ) : null}

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Planner mode
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-background/80 p-1">
          <button
            type="button"
            className={cn(
              'h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              mode === 'will_work'
                ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onModeChange('will_work')}
          >
            Will work
          </button>
          <button
            type="button"
            className={cn(
              'h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              mode === 'cannot_work'
                ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onModeChange('cannot_work')}
          >
            Cannot work
          </button>
        </div>
      </div>

      <PlannerSelectedDatesForm
        selectedCycleId={selectedCycleId}
        selectedTherapistId={selectedTherapistId}
        selectedTherapistShiftType={selectedTherapist?.shift_type ?? 'day'}
        mode={mode}
        selectedDates={selectedDates}
        onClearSelectedDates={onClearSelectedDates}
        onRemoveSelectedDate={onRemoveSelectedDate}
        saveAction={saveAction}
      />

      {footer}
    </div>
  )
}
