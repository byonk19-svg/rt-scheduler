'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type DayOption = {
  label: string
  value: number
}

export function TeamQuickEditSchedulingSection({
  dayOptions,
  hasPattern,
  neverDays,
  onToggleDay,
  onToggleNeverDay,
  onTogglePattern,
  onWeekendRotationChange,
  onWorksDowModeChange,
  selectedDays,
  weekendRotation,
  weekendAnchorDate,
  worksDowMode,
}: {
  dayOptions: DayOption[]
  hasPattern: boolean
  neverDays: number[]
  onToggleDay: (value: number) => void
  onToggleNeverDay: (value: number) => void
  onTogglePattern: (checked: boolean) => void
  onWeekendRotationChange: (value: 'none' | 'every_other') => void
  onWorksDowModeChange: (value: 'hard' | 'soft') => void
  selectedDays: number[]
  weekendRotation: 'none' | 'every_other'
  weekendAnchorDate: string
  worksDowMode: 'hard' | 'soft'
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-sm font-semibold text-foreground">Scheduling Constraints</p>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Days they never work</p>
        <p className="text-xs text-muted-foreground">
          Auto-draft will never assign them on these days, regardless of anything else.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {dayOptions.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => onToggleNeverDay(day.value)}
              className={cn(
                'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                neverDays.includes(day.value)
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-border bg-card text-muted-foreground hover:border-destructive/40 hover:text-foreground'
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
        {neverDays.map((day) => (
          <input key={day} type="hidden" name="offs_dow" value={String(day)} />
        ))}
      </div>

      <div className="h-px bg-border/60" />

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="has_recurring_schedule"
            className="h-4 w-4"
            checked={hasPattern}
            onChange={(event) => onTogglePattern(event.target.checked)}
          />
          <span className="text-xs font-medium text-foreground">
            Has a fixed weekly pattern
            <span className="ml-1 font-normal text-muted-foreground">
              — works the same days every week
            </span>
          </span>
        </label>

        {hasPattern ? (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Days they work</p>
              <div className="flex flex-wrap gap-1.5">
                {dayOptions.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => onToggleDay(day.value)}
                    className={cn(
                      'h-9 w-10 rounded-lg border text-xs font-semibold transition-colors',
                      selectedDays.includes(day.value)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {selectedDays.map((day) => (
                <input key={day} type="hidden" name="works_dow" value={String(day)} />
              ))}
            </div>

            {selectedDays.length > 0 ? (
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
                      — will not be scheduled on other days
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
                      — preferred but can flex when needed
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

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
                  <label
                    htmlFor="weekend_anchor_date"
                    className="text-xs font-medium text-foreground"
                  >
                    Pick a Saturday for their next on-weekend block
                  </label>
                  <Input
                    id="weekend_anchor_date"
                    name="weekend_anchor_date"
                    type="date"
                    defaultValue={weekendAnchorDate}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-draft alternates weekends from this date.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
