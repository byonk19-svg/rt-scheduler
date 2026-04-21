'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const DOW_OPTIONS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

export function WorkPatternScheduleFields({
  offsDow,
  therapistId,
  toggleDay,
  toggleOffDay,
  validationError,
  weekendAnchorDate,
  weekendRotation,
  worksDow,
  worksDowMode,
  onWeekendAnchorDateChange,
  onWeekendRotationChange,
  onWorksDowModeChange,
}: {
  offsDow: number[]
  therapistId: string
  toggleDay: (value: number) => void
  toggleOffDay: (value: number) => void
  validationError: string | null
  weekendAnchorDate: string
  weekendRotation: 'none' | 'every_other'
  worksDow: number[]
  worksDowMode: 'hard' | 'soft'
  onWeekendAnchorDateChange: (value: string) => void
  onWeekendRotationChange: (next: 'none' | 'every_other') => void
  onWorksDowModeChange: (next: 'hard' | 'soft') => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Days they never work</p>
        <p className="text-xs text-muted-foreground">
          Auto-draft will never assign them on these days.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DOW_OPTIONS.map((day) => (
            <button
              key={`off-${day.value}`}
              type="button"
              onClick={() => toggleOffDay(day.value)}
              className={cn(
                'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                offsDow.includes(day.value)
                  ? 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                  : 'border-border bg-card text-muted-foreground hover:border-[var(--error-border)]/40 hover:text-foreground'
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
        {offsDow.map((day) => (
          <input key={`offs-${day}`} type="hidden" name="offs_dow" value={String(day)} />
        ))}
      </div>

      <div className="h-px bg-border/60" />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Days they work</p>
          <div className="flex flex-wrap gap-1.5">
            {DOW_OPTIONS.map((day) => (
              <button
                key={`work-${day.value}`}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={cn(
                  'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                  worksDow.includes(day.value)
                    ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                    : 'border-border bg-card text-muted-foreground hover:border-[var(--success-border)]/40 hover:text-foreground'
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
          {worksDow.map((day) => (
            <input key={`works-${day}`} type="hidden" name="works_dow" value={String(day)} />
          ))}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">How strict?</p>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="works_dow_mode"
              value="hard"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={worksDowMode === 'hard'}
              onChange={() => onWorksDowModeChange('hard')}
            />
            <span>
              <span className="font-medium text-foreground">Only these days</span>
              <span className="ml-1 text-muted-foreground">
                - will not be scheduled on other days
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="works_dow_mode"
              value="soft"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={worksDowMode === 'soft'}
              onChange={() => onWorksDowModeChange('soft')}
            />
            <span>
              <span className="font-medium text-foreground">Usually these days</span>
              <span className="ml-1 text-muted-foreground">
                - preferred but can flex when needed
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Weekend rotation</p>
          <div className="space-y-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="weekend_rotation"
                value="none"
                className="h-4 w-4 shrink-0"
                checked={weekendRotation === 'none'}
                onChange={() => onWeekendRotationChange('none')}
              />
              <span className="font-medium text-foreground">Works every weekend</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="weekend_rotation"
                value="every_other"
                className="h-4 w-4 shrink-0"
                checked={weekendRotation === 'every_other'}
                onChange={() => onWeekendRotationChange('every_other')}
              />
              <span className="font-medium text-foreground">Every other weekend</span>
            </label>
          </div>

          {weekendRotation === 'every_other' ? (
            <div className="mt-2 space-y-1">
              <Label htmlFor={`weekend_anchor_date_${therapistId}`}>
                Pick a Saturday for their next on-weekend block
              </Label>
              <Input
                id={`weekend_anchor_date_${therapistId}`}
                name="weekend_anchor_date"
                type="date"
                value={weekendAnchorDate}
                onChange={(event) => onWeekendAnchorDateChange(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Auto-draft alternates weekends from this date.
              </p>
              {validationError ? (
                <p className="text-xs font-medium text-[var(--error-text)]">{validationError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
