'use client'

import { useMemo, useState, type FormEvent } from 'react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  describeWorkPatternSummary,
  normalizeWorkPattern,
  type RecurringPatternType,
  type WeekendRule,
  type WorkPattern,
  type WorkPatternCycleSegment,
} from '@/lib/coverage/work-patterns'
import { addDays, toIsoDate } from '@/lib/calendar-utils'
import { buildCycleAvailabilityBaseline } from '@/lib/availability-pattern-generator'
import { cn } from '@/lib/utils'

type Props = {
  initialPattern: WorkPattern | null
  saveAction: (formData: FormData) => void | Promise<void>
}

const PATTERN_OPTIONS: Array<{
  type: RecurringPatternType
  title: string
  description: string
}> = [
  {
    type: 'weekly_fixed',
    title: 'Same days every week',
    description: 'Use one positive weekday selector for a stable weekly pattern.',
  },
  {
    type: 'weekly_with_weekend_rotation',
    title: 'Same weekdays + weekend rotation',
    description:
      'Keep a stable weekday template and choose no weekends, every weekend, or every other weekend.',
  },
  {
    type: 'repeating_cycle',
    title: 'Repeating cycle',
    description: 'Define work/off segments like 4 on, 1 off, 2 on, 6 off.',
  },
  {
    type: 'none',
    title: 'No repeating schedule',
    description: 'Each future cycle starts blank, and you choose the days manually.',
  },
]

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

function formatPreviewDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function createDefaultSegments(initialPattern: WorkPattern | null): WorkPatternCycleSegment[] {
  if (
    initialPattern?.pattern_type === 'repeating_cycle' &&
    initialPattern.cycle_segments.length > 0
  ) {
    return initialPattern.cycle_segments
  }
  return [
    { kind: 'work', length_days: 4 },
    { kind: 'off', length_days: 3 },
  ]
}

export function RecurringPatternEditor({ initialPattern, saveAction }: Props) {
  const [patternType, setPatternType] = useState<RecurringPatternType>(
    initialPattern?.pattern_type ?? 'none'
  )
  const [weeklyWeekdays, setWeeklyWeekdays] = useState<number[]>(
    initialPattern?.weekly_weekdays ?? initialPattern?.works_dow ?? []
  )
  const [worksDowMode, setWorksDowMode] = useState<'hard' | 'soft'>(
    initialPattern?.works_dow_mode ?? 'hard'
  )
  const [weekendRule, setWeekendRule] = useState<WeekendRule>(
    initialPattern?.weekend_rule ??
      (initialPattern?.pattern_type === 'weekly_with_weekend_rotation' ? 'none' : 'none')
  )
  const [weekendAnchorDate, setWeekendAnchorDate] = useState(
    initialPattern?.weekend_anchor_date ?? ''
  )
  const [cycleAnchorDate, setCycleAnchorDate] = useState(initialPattern?.cycle_anchor_date ?? '')
  const [cycleSegments, setCycleSegments] = useState<WorkPatternCycleSegment[]>(
    createDefaultSegments(initialPattern)
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  function toggleWeekday(day: number) {
    setWeeklyWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right)
    )
  }

  function updateSegment(index: number, patch: Partial<WorkPatternCycleSegment>) {
    setCycleSegments((current) =>
      current.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...patch } : segment
      )
    )
  }

  function addSegment(kind: 'work' | 'off') {
    setCycleSegments((current) => [...current, { kind, length_days: 1 }])
  }

  function removeSegment(index: number) {
    setCycleSegments((current) => current.filter((_, segmentIndex) => segmentIndex !== index))
  }

  const previewPattern = useMemo(
    () =>
      normalizeWorkPattern({
        therapist_id: initialPattern?.therapist_id ?? 'therapist',
        pattern_type: patternType,
        weekly_weekdays:
          patternType === 'none' || patternType === 'repeating_cycle' ? [] : weeklyWeekdays,
        works_dow_mode: worksDowMode,
        weekend_rule: patternType === 'weekly_with_weekend_rotation' ? weekendRule : 'none',
        weekend_anchor_date:
          patternType === 'weekly_with_weekend_rotation' && weekendRule === 'every_other_weekend'
            ? weekendAnchorDate || null
            : null,
        cycle_anchor_date: patternType === 'repeating_cycle' ? cycleAnchorDate || null : null,
        cycle_segments: patternType === 'repeating_cycle' ? cycleSegments : [],
      }),
    [
      cycleAnchorDate,
      cycleSegments,
      initialPattern?.therapist_id,
      patternType,
      weeklyWeekdays,
      weekendAnchorDate,
      weekendRule,
      worksDowMode,
    ]
  )

  const previewBaseline = useMemo(() => {
    const start = new Date()
    const startKey = toIsoDate(start)
    const endKey = toIsoDate(addDays(start, 13))
    return buildCycleAvailabilityBaseline({
      cycleStart: startKey,
      cycleEnd: endKey,
      pattern: previewPattern,
    })
  }, [previewPattern])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (
      patternType !== 'none' &&
      patternType !== 'repeating_cycle' &&
      weeklyWeekdays.length === 0
    ) {
      event.preventDefault()
      setValidationError('Select at least one weekday for the recurring pattern.')
      return
    }

    if (
      patternType === 'weekly_with_weekend_rotation' &&
      weekendRule === 'every_other_weekend' &&
      weekendAnchorDate.trim().length === 0
    ) {
      event.preventDefault()
      setValidationError('Select the first working weekend for the every-other-weekend rule.')
      return
    }

    if (patternType === 'repeating_cycle') {
      if (cycleAnchorDate.trim().length === 0) {
        event.preventDefault()
        setValidationError('Select the date when the repeating cycle starts.')
        return
      }
      if (cycleSegments.length === 0 || cycleSegments.some((segment) => segment.length_days < 1)) {
        event.preventDefault()
        setValidationError('Add valid work/off segments before saving the repeating cycle.')
        return
      }
    }

    setValidationError(null)
  }

  const summary = describeWorkPatternSummary(previewPattern)

  return (
    <form
      action={saveAction}
      onSubmit={handleSubmit}
      className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_22rem]"
    >
      <input type="hidden" name="pattern_type" value={patternType} />
      <input type="hidden" name="works_dow_mode" value={worksDowMode} />
      <input type="hidden" name="weekend_rule" value={weekendRule} />
      <input type="hidden" name="weekend_anchor_date" value={weekendAnchorDate} />
      <input type="hidden" name="cycle_anchor_date" value={cycleAnchorDate} />
      <input type="hidden" name="cycle_segments_json" value={JSON.stringify(cycleSegments)} />
      {weeklyWeekdays.map((day) => (
        <input key={`weekday-${day}`} type="hidden" name="weekly_weekdays" value={String(day)} />
      ))}

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Choose a pattern type</CardTitle>
            <CardDescription>
              Start with the scheduling model that matches how you normally work.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {PATTERN_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => setPatternType(option.type)}
                className={cn(
                  'cursor-pointer rounded-lg border p-4 text-left text-sm transition-colors',
                  patternType === option.type
                    ? 'border-primary bg-[var(--info-subtle)] font-semibold text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                )}
              >
                <p className="font-semibold">{option.title}</p>
                <p className="mt-1 text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {(patternType === 'weekly_fixed' || patternType === 'weekly_with_weekend_rotation') && (
          <Card>
            <CardHeader>
              <CardTitle>Which days do you usually work?</CardTitle>
              <CardDescription>
                Pick the days that are normally part of your schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Usual work days</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium transition-colors',
                        weeklyWeekdays.includes(day.value)
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <details className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  This can vary sometimes
                </summary>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setWorksDowMode('hard')}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left',
                      worksDowMode === 'hard'
                        ? 'border-primary bg-primary/5'
                        : 'border-border/70 bg-card'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      These are my regular work days
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use this when other days should usually stay off your normal schedule.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorksDowMode('soft')}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left',
                      worksDowMode === 'soft'
                        ? 'border-primary bg-primary/5'
                        : 'border-border/70 bg-card'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      These are my usual days, but other days can still happen
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use this when the pattern is helpful as a starting point, but not rigid.
                    </p>
                  </button>
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {patternType === 'weekly_with_weekend_rotation' && (
          <Card>
            <CardHeader>
              <CardTitle>Weekend rule</CardTitle>
              <CardDescription>
                Decide how weekends work separately from your weekday pattern. If you choose every
                other weekend, add the first weekend you work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {(
                  [
                    ['none', 'No weekends'],
                    ['every_weekend', 'Every weekend'],
                    ['every_other_weekend', 'Every other weekend'],
                  ] as Array<[WeekendRule, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWeekendRule(value)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left',
                      weekendRule === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border/70 bg-card'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                  </button>
                ))}
              </div>

              {weekendRule === 'every_other_weekend' ? (
                <div className="space-y-1">
                  <Label htmlFor="weekend-anchor-date">First weekend you work</Label>
                  <input
                    id="weekend-anchor-date"
                    type="date"
                    value={weekendAnchorDate}
                    onChange={(event) => setWeekendAnchorDate(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pick the Saturday or Sunday that starts your every-other-weekend rotation.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {patternType === 'repeating_cycle' && (
          <Card>
            <CardHeader>
              <CardTitle>Repeating cycle</CardTitle>
              <CardDescription>
                Add work and off blocks in the order they repeat. Example: 4 on, 1 off, 2 on, 6 off.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="cycle-anchor-date">First day in this repeating pattern</Label>
                <input
                  id="cycle-anchor-date"
                  type="date"
                  value={cycleAnchorDate}
                  onChange={(event) => setCycleAnchorDate(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>

              <div className="space-y-3">
                {cycleSegments.map((segment, index) => (
                  <div
                    key={`segment-${index}`}
                    className="grid gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 md:grid-cols-[9rem_1fr_auto]"
                  >
                    <select
                      value={segment.kind}
                      onChange={(event) =>
                        updateSegment(index, {
                          kind: event.target.value === 'off' ? 'off' : 'work',
                        })
                      }
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="work">Work for</option>
                      <option value="off">Off for</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={segment.length_days}
                        onChange={(event) =>
                          updateSegment(index, {
                            length_days: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                        className="h-10 w-24 rounded-md border border-border bg-background px-3 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">
                        day{segment.length_days === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeSegment(index)}
                      disabled={cycleSegments.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => addSegment('work')}>
                  Add work block
                </Button>
                <Button type="button" variant="outline" onClick={() => addSegment('off')}>
                  Add off block
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {patternType === 'none' && (
          <Card>
            <CardHeader>
              <CardTitle>No repeating schedule</CardTitle>
              <CardDescription>
                Each future cycle will start blank. Use this only if your schedule does not repeat
                in a regular way.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {validationError ? (
          <p className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm font-medium text-[var(--error-text)]">
            {validationError}
          </p>
        ) : null}

        <div className="flex justify-end">
          <FormSubmitButton type="submit" pendingText="Saving pattern..." className="min-w-[12rem]">
            Save recurring pattern
          </FormSubmitButton>
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>What this saves</CardTitle>
            <CardDescription>
              This becomes the starting point for each future cycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{summary}</p>
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Hard rules vs preferences
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fixed work days and repeating off segments become baseline availability. Future
                cycle edits stay separate as overrides.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick preview</CardTitle>
            <CardDescription>Next 2 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(previewBaseline).map(([date, baseline]) => (
                <div
                  key={date}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="text-foreground">{formatPreviewDate(date)}</span>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-medium',
                      baseline.baselineStatus === 'available'
                        ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                        : baseline.baselineStatus === 'neutral'
                          ? 'bg-background text-muted-foreground ring-1 ring-border/60'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {baseline.baselineStatus === 'available'
                      ? 'Work day'
                      : baseline.baselineStatus === 'neutral'
                        ? 'Starts blank'
                        : 'Off day'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
