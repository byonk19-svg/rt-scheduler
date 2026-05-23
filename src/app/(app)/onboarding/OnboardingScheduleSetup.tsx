'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  ClipboardList,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Users,
  X,
} from 'lucide-react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { APP_PAGE_MAX_WIDTH_CLASS } from '@/components/shell/app-shell-config'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { buildCycleAvailabilityBaseline } from '@/lib/availability-pattern-generator'
import { addDays, toIsoDate } from '@/lib/calendar-utils'
import {
  normalizeWorkPattern,
  type RecurringPatternType,
  type WorkPattern,
  type WorkPatternCycleSegment,
} from '@/lib/coverage/work-patterns'
import type { PreferredWorkDaysMode } from '@/lib/staff-onboarding'
import { cn } from '@/lib/utils'

type CycleDayState = 'work' | 'off'

type Props = {
  initialPattern: WorkPattern | null
  initialMaxConsecutiveDays: number
  initialPreferredWorkDays: number[]
  initialPreferredWorkDaysMode: PreferredWorkDaysMode
  saveAction: (formData: FormData) => void | Promise<void>
}

const STEP_COUNT = 4
const STEP_LABELS = ['Schedule type', 'Your pattern', 'Preferences', 'Confirm'] as const

const SCHEDULE_TYPES: Array<{
  type: RecurringPatternType
  title: string
  detail: string
  example: string
  bestFor: string
  nextStep: string
  Icon: typeof CalendarCheck
}> = [
  {
    type: 'weekly_fixed',
    title: 'Same days weekly',
    detail: 'You usually work the same weekdays every week.',
    example: 'Example: Mon, Wed, Fri.',
    bestFor: 'Staff who usually work the same days every week.',
    nextStep: 'Choose your normal work days.',
    Icon: CalendarCheck,
  },
  {
    type: 'weekly_with_weekend_rotation',
    title: 'Weekdays + rotating weekends',
    detail: 'Your weekdays stay mostly the same, but weekends rotate.',
    example: 'Example: Every other weekend.',
    bestFor: 'Staff whose weekdays are predictable but weekends alternate.',
    nextStep: 'Choose your normal weekdays and the first weekend you work.',
    Icon: Users,
  },
  {
    type: 'repeating_cycle',
    title: 'Custom repeating pattern',
    detail: 'Your schedule follows a repeating sequence.',
    example: 'Example: 2 on / 2 off.',
    bestFor: 'Staff with a rotation like 2 on / 2 off, 3 on / 4 off, or Baylor.',
    nextStep: 'Build the repeating on/off sequence.',
    Icon: RotateCcw,
  },
  {
    type: 'none',
    title: 'No set schedule',
    detail: 'Your schedule changes often or is different every block.',
    example: 'Best if your days vary a lot.',
    bestFor: 'Staff who do not have a reliable normal pattern.',
    nextStep: 'Start blank and mark any days you never work.',
    Icon: Shuffle,
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

function getTodayKey() {
  return toIsoDate(new Date())
}

function createDefaultCycleDays(): CycleDayState[] {
  return [
    'work',
    'work',
    'work',
    'work',
    'off',
    'work',
    'work',
    'off',
    'off',
    'off',
    'off',
    'off',
    'off',
    'off',
  ]
}

function expandCycleSegments(segments: WorkPatternCycleSegment[]): CycleDayState[] {
  const days = segments.flatMap((segment) =>
    Array.from({ length: segment.length_days }, () => segment.kind)
  )

  return days.length > 0 ? days : createDefaultCycleDays()
}

function compactCycleDays(days: CycleDayState[]): WorkPatternCycleSegment[] {
  return days.reduce<WorkPatternCycleSegment[]>((segments, day) => {
    const prior = segments[segments.length - 1]
    if (prior?.kind === day) {
      prior.length_days += 1
      return segments
    }

    return [...segments, { kind: day, length_days: 1 }]
  }, [])
}

function formatCyclePattern(segments: WorkPatternCycleSegment[]): string {
  if (segments.length === 0) return 'No pattern yet'

  return segments
    .map((segment) => {
      const label = segment.kind === 'work' ? 'on' : 'off'
      return `${segment.length_days} ${label}`
    })
    .join(' → ')
}

function formatWeeklyPattern(days: number[]): string {
  if (days.length === 0) return 'No days selected'

  const sortedDays = WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.label)

  if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) {
    return 'Mon–Fri'
  }

  if (days.length === 7 && [0, 1, 2, 3, 4, 5, 6].every((day) => days.includes(day))) {
    return 'Sun–Sat'
  }

  return sortedDays.join(', ')
}

function formatShortWeekday(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', { weekday: 'short' })
}

function formatShortMonth(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', { month: 'short' })
}

function countLongestWorkingRun(days: Array<'available' | 'off' | 'neutral'>): number {
  let longest = 0
  let current = 0

  for (const day of days) {
    if (day === 'available') {
      current += 1
      longest = Math.max(longest, current)
      continue
    }

    current = 0
  }

  return longest
}

function getLongestRunIndexes<T>(items: T[], isWorkDay: (item: T, index: number) => boolean) {
  let longestStart = -1
  let longestLength = 0
  let currentStart = -1
  let currentLength = 0

  items.forEach((item, index) => {
    if (isWorkDay(item, index)) {
      if (currentLength === 0) currentStart = index
      currentLength += 1

      if (currentLength > longestLength) {
        longestStart = currentStart
        longestLength = currentLength
      }
      return
    }

    currentStart = -1
    currentLength = 0
  })

  if (longestStart < 0) return []

  return Array.from({ length: longestLength }, (_, offset) => longestStart + offset)
}

function normalizeInitialPreferredDays(
  mode: PreferredWorkDaysMode,
  days: number[],
  fallback: number[]
): number[] {
  if (mode === 'specific_days') return days
  return fallback.filter((day) => day >= 1 && day <= 5)
}

export function OnboardingScheduleSetup({
  initialPattern,
  initialMaxConsecutiveDays,
  initialPreferredWorkDays,
  initialPreferredWorkDaysMode,
  saveAction,
}: Props) {
  const [step, setStep] = useState(1)
  const [scheduleType, setScheduleType] = useState<RecurringPatternType>(
    initialPattern?.pattern_type ?? 'weekly_fixed'
  )
  const [weeklyDays, setWeeklyDays] = useState<number[]>(
    initialPattern?.weekly_weekdays?.length ? initialPattern.weekly_weekdays : []
  )
  const [neverWorkDays, setNeverWorkDays] = useState<number[]>(initialPattern?.offs_dow ?? [])
  const [cycleDays, setCycleDays] = useState<CycleDayState[]>(
    initialPattern?.pattern_type === 'repeating_cycle'
      ? expandCycleSegments(initialPattern.cycle_segments)
      : createDefaultCycleDays()
  )
  const [weekendAnchorDate, setWeekendAnchorDate] = useState(
    initialPattern?.weekend_anchor_date ?? ''
  )
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState(initialMaxConsecutiveDays)
  const [previewPulseKey, setPreviewPulseKey] = useState(0)
  const [preferredDays, setPreferredDays] = useState<number[]>(
    normalizeInitialPreferredDays(
      initialPreferredWorkDaysMode,
      initialPreferredWorkDays,
      weeklyDays
    )
  )

  const todayKey = useMemo(() => getTodayKey(), [])
  const cycleSegments = useMemo(() => compactCycleDays(cycleDays), [cycleDays])
  const effectivePreferredDays = preferredDays.filter((day) => !neverWorkDays.includes(day))
  const preferredWorkDaysMode: PreferredWorkDaysMode =
    effectivePreferredDays.length > 0 ? 'specific_days' : 'no_preference'

  const effectiveWeeklyDays =
    scheduleType === 'weekly_with_weekend_rotation'
      ? weeklyDays.filter((day) => day >= 1 && day <= 5 && !neverWorkDays.includes(day))
      : weeklyDays.filter((day) => !neverWorkDays.includes(day))

  const previewPattern = useMemo(() => {
    const emptyWeeklyPreviewPattern =
      (scheduleType === 'weekly_fixed' || scheduleType === 'weekly_with_weekend_rotation') &&
      effectiveWeeklyDays.length === 0

    if (emptyWeeklyPreviewPattern) {
      return normalizeWorkPattern({
        therapist_id: initialPattern?.therapist_id ?? 'therapist',
        pattern_type: 'none',
        works_dow_mode: 'hard',
        offs_dow: neverWorkDays,
        weekly_weekdays: [],
        weekend_rule: 'none',
        weekend_anchor_date: null,
        cycle_anchor_date: null,
        cycle_segments: [],
      })
    }

    return normalizeWorkPattern({
      therapist_id: initialPattern?.therapist_id ?? 'therapist',
      pattern_type: scheduleType,
      works_dow_mode: 'hard',
      offs_dow: neverWorkDays,
      weekly_weekdays:
        scheduleType === 'repeating_cycle' || scheduleType === 'none' ? [] : effectiveWeeklyDays,
      weekend_rule:
        scheduleType === 'weekly_with_weekend_rotation' ? 'every_other_weekend' : 'none',
      weekend_anchor_date:
        scheduleType === 'weekly_with_weekend_rotation' && weekendAnchorDate.trim().length > 0
          ? weekendAnchorDate
          : null,
      cycle_anchor_date: scheduleType === 'repeating_cycle' ? todayKey : null,
      cycle_segments: scheduleType === 'repeating_cycle' ? cycleSegments : [],
    })
  }, [
    cycleSegments,
    effectiveWeeklyDays,
    initialPattern?.therapist_id,
    neverWorkDays,
    scheduleType,
    todayKey,
    weekendAnchorDate,
  ])

  const previewDays = useMemo(() => {
    const cycleStart = todayKey
    const cycleEnd = toIsoDate(addDays(new Date(`${todayKey}T00:00:00`), 13))
    const baseline = buildCycleAvailabilityBaseline({
      cycleStart,
      cycleEnd,
      pattern: previewPattern,
    })

    return Object.entries(baseline).map(([date, value]) => ({
      date,
      status: value.baselineStatus,
    }))
  }, [previewPattern, todayKey])

  const workDaysInPattern =
    scheduleType === 'none'
      ? 0
      : scheduleType === 'repeating_cycle'
        ? cycleDays.filter((day) => day === 'work').length
        : effectiveWeeklyDays.length
  const offDaysInCycle = cycleDays.length - workDaysInPattern
  const longestRun = countLongestWorkingRun(previewDays.map((day) => day.status))
  const hasConsecutiveWarning = longestRun > maxConsecutiveDays
  const problemWeeklyDays =
    hasConsecutiveWarning && scheduleType !== 'repeating_cycle'
      ? getLongestRunIndexes(WEEKDAYS, (day) => effectiveWeeklyDays.includes(day.value)).map(
          (index) => WEEKDAYS[index].value
        )
      : []
  const problemCycleDayIndexes =
    hasConsecutiveWarning && scheduleType === 'repeating_cycle'
      ? getLongestRunIndexes(cycleDays, (day) => day === 'work')
      : []
  const scheduleSummary =
    step === 1 && scheduleType === 'repeating_cycle'
      ? 'Build pattern next'
      : step === 1 && scheduleType !== 'none'
        ? 'Pick days next'
        : scheduleType === 'repeating_cycle'
          ? formatCyclePattern(cycleSegments)
          : scheduleType === 'none'
            ? 'No set schedule'
            : scheduleType === 'weekly_with_weekend_rotation'
              ? `${formatWeeklyPattern(effectiveWeeklyDays)} + rotating weekends`
              : formatWeeklyPattern(effectiveWeeklyDays)
  const canContinueFromPattern =
    scheduleType === 'none' ||
    ((scheduleType === 'repeating_cycle'
      ? workDaysInPattern > 0 && offDaysInCycle > 0
      : effectiveWeeklyDays.length > 0) &&
      (scheduleType !== 'weekly_with_weekend_rotation' || weekendAnchorDate.trim().length > 0))

  function selectScheduleType(type: RecurringPatternType) {
    setScheduleType(type)
    setPreviewPulseKey((current) => current + 1)
  }

  function toggleWeeklyDay(day: number) {
    if (neverWorkDays.includes(day)) return

    setWeeklyDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right)
    )
  }

  function toggleCycleDay(index: number) {
    setCycleDays((current) =>
      current.map((day, dayIndex) => (dayIndex === index ? (day === 'work' ? 'off' : 'work') : day))
    )
  }

  function addCycleDay() {
    setCycleDays((current) => [...current, 'off'])
  }

  function removeCycleDay() {
    setCycleDays((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }

  function applyCyclePreset(preset: '3-3' | '4-4') {
    if (preset === '3-3') {
      setCycleDays(['work', 'work', 'work', 'off', 'off', 'off'])
    }
    if (preset === '4-4') {
      setCycleDays(['work', 'work', 'work', 'work', 'off', 'off', 'off', 'off'])
    }
  }

  function togglePreferredDay(day: number) {
    if (neverWorkDays.includes(day)) return

    setPreferredDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right)
    )
  }

  function toggleNeverWorkDay(day: number) {
    setNeverWorkDays((current) => {
      if (current.includes(day)) {
        return current.filter((value) => value !== day)
      }

      setWeeklyDays((weekly) => weekly.filter((value) => value !== day))
      setPreferredDays((preferred) => preferred.filter((value) => value !== day))
      return [...current, day].sort((left, right) => left - right)
    })
  }

  return (
    <form action={saveAction} className="min-h-screen bg-background">
      <input type="hidden" name="pattern_type" value={scheduleType} />
      <input
        type="hidden"
        name="weekend_rule"
        value={scheduleType === 'weekly_with_weekend_rotation' ? 'every_other_weekend' : 'none'}
      />
      <input type="hidden" name="weekend_anchor_date" value={weekendAnchorDate} />
      <input type="hidden" name="cycle_anchor_date" value={todayKey} />
      <input type="hidden" name="cycle_segments_json" value={JSON.stringify(cycleSegments)} />
      <input type="hidden" name="max_consecutive_days" value={maxConsecutiveDays} />
      <input type="hidden" name="preferred_work_days_mode" value={preferredWorkDaysMode} />
      {effectiveWeeklyDays.map((day) => (
        <input key={`weekly-${day}`} type="hidden" name="weekly_weekdays" value={day} />
      ))}
      {neverWorkDays.map((day) => (
        <input key={`never-${day}`} type="hidden" name="offs_dow" value={day} />
      ))}
      {effectivePreferredDays.map((day) => (
        <input key={`preferred-${day}`} type="hidden" name="preferred_work_days" value={day} />
      ))}

      <SetupHeader step={step} />
      <div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(26rem,0.8fr)]">
          <Card className="gap-0 overflow-hidden py-0 shadow-tw-md-strong">
            <CardContent
              className={cn(
                'flex flex-col px-4 py-3 sm:px-5 sm:py-3.5',
                step === 1 ? 'min-h-0' : 'min-h-[min(40rem,calc(100vh-8rem))]'
              )}
            >
              <div className="min-h-0 flex-1">
                {step === 1 ? (
                  <ScheduleTypeStep
                    scheduleType={scheduleType}
                    selectScheduleType={selectScheduleType}
                  />
                ) : null}

                {step === 2 && scheduleType !== 'repeating_cycle' ? (
                  <WeeklyPatternStep
                    scheduleType={scheduleType}
                    effectiveWeeklyDays={effectiveWeeklyDays}
                    toggleWeeklyDay={toggleWeeklyDay}
                    hasConsecutiveWarning={hasConsecutiveWarning}
                    longestRun={longestRun}
                    maxConsecutiveDays={maxConsecutiveDays}
                    problemWeeklyDays={problemWeeklyDays}
                    workDaysInPattern={workDaysInPattern}
                    neverWorkDays={neverWorkDays}
                    toggleNeverWorkDay={toggleNeverWorkDay}
                    weekendAnchorDate={weekendAnchorDate}
                    setWeekendAnchorDate={setWeekendAnchorDate}
                  />
                ) : null}

                {step === 2 && scheduleType === 'repeating_cycle' ? (
                  <RepeatingCycleStep
                    cycleDays={cycleDays}
                    cycleSegments={cycleSegments}
                    workDaysInPattern={workDaysInPattern}
                    offDaysInCycle={offDaysInCycle}
                    longestRun={longestRun}
                    maxConsecutiveDays={maxConsecutiveDays}
                    hasConsecutiveWarning={hasConsecutiveWarning}
                    problemCycleDayIndexes={problemCycleDayIndexes}
                    toggleCycleDay={toggleCycleDay}
                    addCycleDay={addCycleDay}
                    removeCycleDay={removeCycleDay}
                    applyCyclePreset={applyCyclePreset}
                    neverWorkDays={neverWorkDays}
                    toggleNeverWorkDay={toggleNeverWorkDay}
                  />
                ) : null}

                {step === 3 ? (
                  <PreferencesStep
                    maxConsecutiveDays={maxConsecutiveDays}
                    setMaxConsecutiveDays={setMaxConsecutiveDays}
                    preferredDays={effectivePreferredDays}
                    togglePreferredDay={togglePreferredDay}
                    hasConsecutiveWarning={hasConsecutiveWarning}
                    longestRun={longestRun}
                    neverWorkDays={neverWorkDays}
                  />
                ) : null}

                {step === 4 ? <ConfirmStep /> : null}
              </div>

              <div className="sticky bottom-0 z-10 -mx-4 mt-2.5 flex items-center justify-between gap-3 border-t border-border/70 bg-card/95 px-4 py-1.5 shadow-[0_-10px_28px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:-mx-5 sm:px-5">
                {step === 1 ? (
                  <span aria-hidden="true" />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                    className="min-w-24"
                  >
                    Back
                  </Button>
                )}
                {step < STEP_COUNT ? (
                  <Button
                    type="button"
                    onClick={() => setStep((current) => Math.min(STEP_COUNT, current + 1))}
                    disabled={step === 2 && !canContinueFromPattern}
                    size="sm"
                    className="min-w-32"
                  >
                    Next
                  </Button>
                ) : (
                  <FormSubmitButton
                    type="submit"
                    pendingText="Saving setup..."
                    className="min-w-40"
                  >
                    View my schedule
                  </FormSubmitButton>
                )}
              </div>
            </CardContent>
          </Card>

          <PreviewPanel
            step={step}
            scheduleType={scheduleType}
            previewDays={previewDays}
            scheduleSummary={scheduleSummary}
            longestRun={longestRun}
            maxConsecutiveDays={maxConsecutiveDays}
            neverWorkDays={neverWorkDays}
            previewPulseKey={previewPulseKey}
          />
        </div>
      </div>
    </form>
  )
}

function SetupHeader({ step }: { step: number }) {
  return (
    <header className="border-b border-sidebar-border/80 text-sidebar-foreground shadow-tw-app-chrome app-shell-chrome-primary">
      <div
        className={cn(
          'flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between',
          APP_PAGE_MAX_WIDTH_CLASS
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Teamwise - go to dashboard"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-md text-sidebar-primary hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-tw-2xs ring-1 ring-sidebar-ring/35">
            <CalendarCheck className="h-4 w-4 text-[color:var(--sidebar-ring)]" aria-hidden />
          </span>
          <span className="leading-none">
            <span className="block font-heading text-sm font-bold tracking-[-0.02em] text-sidebar-primary">
              Teamwise
            </span>
            <span className="mt-0.5 block text-[0.62rem] font-medium tracking-wide text-[color:var(--sidebar-muted)]">
              Respiratory Therapy
            </span>
          </span>
        </Link>

        <nav
          aria-label="Setup progress"
          className="flex flex-wrap items-center gap-1 md:justify-center"
        >
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1
            const active = stepNumber === step
            const complete = stepNumber < step

            return (
              <span
                key={label}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-sidebar-accent/85 text-sidebar-primary shadow-tw-2xs ring-2 ring-sidebar-ring/45 ring-offset-1 ring-offset-[var(--sidebar)]'
                    : complete
                      ? 'text-sidebar-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/35 hover:text-sidebar-accent-foreground'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-bold',
                    active
                      ? 'border-sidebar-ring bg-[color:var(--attention)] text-accent-foreground'
                      : complete
                        ? 'border-sidebar-ring/45 bg-sidebar-accent/45 text-sidebar-primary'
                        : 'border-sidebar-border text-sidebar-foreground'
                  )}
                >
                  {complete ? <Check className="h-3 w-3" aria-hidden="true" /> : stepNumber}
                </span>
                {label}
              </span>
            )
          })}
        </nav>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground hover:no-underline md:self-auto"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Exit setup
        </Link>
      </div>
    </header>
  )
}

function ScheduleTypeStep({
  scheduleType,
  selectScheduleType,
}: {
  scheduleType: RecurringPatternType
  selectScheduleType: (type: RecurringPatternType) => void
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-0.5">
        <h1 className="app-page-title max-w-2xl text-[1.38rem]">
          What kind of schedule do you usually follow?
        </h1>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
          This helps Teamwise build a starting pattern. You can still adjust individual days later.
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="sr-only">Schedule type</legend>
        {SCHEDULE_TYPES.map((option) => {
          const selected = scheduleType === option.type
          const Icon = option.Icon

          return (
            <div
              key={option.type}
              className={cn(
                'rounded-lg border transition-colors',
                selected
                  ? 'border-primary bg-[var(--info-subtle)] shadow-tw-sm'
                  : 'border-border bg-card hover:border-border/90 hover:bg-muted/20'
              )}
            >
              <button
                type="button"
                onClick={() => selectScheduleType(option.type)}
                aria-pressed={selected}
                className="flex w-full items-start gap-2.5 px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-tw-2xs',
                    selected
                      ? 'border-primary/20 bg-background text-primary'
                      : 'border-border/80 bg-muted/20 text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{option.title}</span>
                  </span>
                  <span className="block text-sm leading-5 text-muted-foreground">
                    {option.detail}
                  </span>
                  <span className="block text-xs font-medium leading-4 text-muted-foreground">
                    {option.example}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-primary bg-primary' : 'border-border bg-background'
                  )}
                  aria-hidden="true"
                >
                  {selected ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
                </span>
              </button>
            </div>
          )
        })}
      </fieldset>
    </div>
  )
}

function WeeklyPatternStep({
  scheduleType,
  effectiveWeeklyDays,
  toggleWeeklyDay,
  hasConsecutiveWarning,
  longestRun,
  maxConsecutiveDays,
  problemWeeklyDays,
  workDaysInPattern,
  neverWorkDays,
  toggleNeverWorkDay,
  weekendAnchorDate,
  setWeekendAnchorDate,
}: {
  scheduleType: RecurringPatternType
  effectiveWeeklyDays: number[]
  toggleWeeklyDay: (day: number) => void
  hasConsecutiveWarning: boolean
  longestRun: number
  maxConsecutiveDays: number
  problemWeeklyDays: number[]
  workDaysInPattern: number
  neverWorkDays: number[]
  toggleNeverWorkDay: (day: number) => void
  weekendAnchorDate: string
  setWeekendAnchorDate: (value: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="app-page-title text-[1.75rem]">
          {scheduleType === 'none' ? 'No set schedule' : 'Tap your work days'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {scheduleType === 'none'
            ? 'Start blank, then block days you never work.'
            : 'This is your normal schedule.'}
        </p>
      </div>

      {scheduleType === 'none' ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-5 py-8 text-base text-muted-foreground">
          Future schedules will start blank.
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => {
            const selected = effectiveWeeklyDays.includes(day.value)
            const rotatingWeekend =
              scheduleType === 'weekly_with_weekend_rotation' &&
              (day.value === 0 || day.value === 6)
            const neverWork = neverWorkDays.includes(day.value)
            const problemDay = hasConsecutiveWarning && problemWeeklyDays.includes(day.value)

            return (
              <button
                key={day.value}
                type="button"
                onClick={() => {
                  if (!rotatingWeekend && !neverWork) toggleWeeklyDay(day.value)
                }}
                disabled={rotatingWeekend || neverWork}
                className={cn(
                  'min-h-24 rounded-xl border px-1.5 text-sm font-bold transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground shadow-tw-pill'
                    : 'border-border/80 bg-background text-muted-foreground hover:bg-secondary/40',
                  problemDay &&
                    'border-[var(--warning-border)] ring-2 ring-[var(--warning-border)] ring-offset-2 ring-offset-background',
                  rotatingWeekend && 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
                  neverWork &&
                    'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                )}
              >
                {day.label}
                {rotatingWeekend ? <span className="mt-1 block text-[10px]">Rotates</span> : null}
                {neverWork ? <span className="mt-1 block text-[10px]">Never</span> : null}
              </button>
            )
          })}
        </div>
      )}

      {scheduleType === 'weekly_with_weekend_rotation' ? (
        <div className="rounded-xl border border-border/80 bg-muted/10 px-4 py-4">
          <label
            htmlFor="onboarding-weekend-anchor"
            className="text-sm font-semibold text-foreground"
          >
            First weekend you work
          </label>
          <input
            id="onboarding-weekend-anchor"
            type="date"
            value={weekendAnchorDate}
            onChange={(event) => setWeekendAnchorDate(event.target.value)}
            className="mt-2 h-11 w-full max-w-xs rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            This anchors the every-other-weekend rotation.
          </p>
        </div>
      ) : null}

      <NeverWorkDaysPicker selectedDays={neverWorkDays} toggleDay={toggleNeverWorkDay} />

      <div className="rounded-xl border border-border/80 bg-muted/15 px-4 py-4">
        {scheduleType === 'none' ? (
          <p className="text-sm text-muted-foreground">No fixed work days selected.</p>
        ) : hasConsecutiveWarning ? (
          <ConsecutiveDaysWarning longestRun={longestRun} maxConsecutiveDays={maxConsecutiveDays} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Longest streak: {longestRun} day{longestRun === 1 ? '' : 's'}.
          </p>
        )}
        {scheduleType === 'none' ? (
          <p className="mt-3 text-base font-bold text-foreground">
            We will start with a blank schedule.
          </p>
        ) : (
          <p className="mt-3 text-base font-bold text-foreground">
            {workDaysInPattern} day{workDaysInPattern === 1 ? '' : 's'} per week
          </p>
        )}
        {scheduleType !== 'none' && workDaysInPattern === 0 ? (
          <p className="mt-2 text-sm font-medium text-[var(--warning-text)]">
            Pick at least one day to continue.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function RepeatingCycleStep({
  cycleDays,
  cycleSegments,
  workDaysInPattern,
  offDaysInCycle,
  longestRun,
  maxConsecutiveDays,
  hasConsecutiveWarning,
  problemCycleDayIndexes,
  toggleCycleDay,
  addCycleDay,
  removeCycleDay,
  applyCyclePreset,
  neverWorkDays,
  toggleNeverWorkDay,
}: {
  cycleDays: CycleDayState[]
  cycleSegments: WorkPatternCycleSegment[]
  workDaysInPattern: number
  offDaysInCycle: number
  longestRun: number
  maxConsecutiveDays: number
  hasConsecutiveWarning: boolean
  problemCycleDayIndexes: number[]
  toggleCycleDay: (index: number) => void
  addCycleDay: () => void
  removeCycleDay: () => void
  applyCyclePreset: (preset: '3-3' | '4-4') => void
  neverWorkDays: number[]
  toggleNeverWorkDay: (day: number) => void
}) {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="app-page-title text-[1.75rem]">Build your pattern</h1>
        <p className="mt-2 text-sm text-muted-foreground">This is your normal schedule.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => applyCyclePreset('3-3')}>
          3 on / 3 off
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyCyclePreset('4-4')}>
          4 on / 4 off
        </Button>
        <span className="inline-flex min-h-9 items-center rounded-md border border-border/80 bg-muted/20 px-3 text-sm font-medium text-muted-foreground">
          Custom: tap days below
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-2">
          {cycleDays.map((day, index) => (
            <button
              key={`cycle-day-${index}`}
              type="button"
              onClick={() => toggleCycleDay(index)}
              className={cn(
                'flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-xl border text-sm transition-colors',
                day === 'work'
                  ? 'border-primary bg-primary text-primary-foreground shadow-tw-pill'
                  : 'border-border bg-muted/40 text-muted-foreground',
                problemCycleDayIndexes.includes(index) &&
                  'border-[var(--warning-border)] ring-2 ring-[var(--warning-border)] ring-offset-2 ring-offset-background'
              )}
            >
              <span className="text-xs font-medium">Day {index + 1}</span>
              <span className="mt-2 text-base font-bold">{day === 'work' ? 'Work' : 'Off'}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={addCycleDay}
            className="flex h-24 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-primary/60 bg-[var(--info-subtle)] text-primary transition-colors hover:border-primary"
            aria-label="Add cycle day"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="mt-1 text-xs font-semibold">Add</span>
          </button>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={removeCycleDay}
        disabled={cycleDays.length <= 1}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
        Remove day
      </Button>

      <NeverWorkDaysPicker selectedDays={neverWorkDays} toggleDay={toggleNeverWorkDay} />

      <div className="rounded-xl border border-border/80 bg-muted/15 px-4 py-4">
        {hasConsecutiveWarning ? (
          <ConsecutiveDaysWarning longestRun={longestRun} maxConsecutiveDays={maxConsecutiveDays} />
        ) : null}
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p>
            <span className="font-bold text-foreground">{cycleDays.length}-day cycle</span>
          </p>
          <p>
            <span className="font-bold text-foreground">{workDaysInPattern}</span> work
          </p>
          <p>
            <span className="font-bold text-foreground">{offDaysInCycle}</span> off
          </p>
          <p className="sm:col-span-3">
            <span className="font-bold text-foreground">Pattern:</span>{' '}
            {formatCyclePattern(cycleSegments)}
          </p>
        </div>
      </div>
    </div>
  )
}

function PreferencesStep({
  maxConsecutiveDays,
  setMaxConsecutiveDays,
  preferredDays,
  togglePreferredDay,
  hasConsecutiveWarning,
  longestRun,
  neverWorkDays,
}: {
  maxConsecutiveDays: number
  setMaxConsecutiveDays: (value: number) => void
  preferredDays: number[]
  togglePreferredDay: (day: number) => void
  hasConsecutiveWarning: boolean
  longestRun: number
  neverWorkDays: number[]
}) {
  return (
    <div className="space-y-7">
      <h1 className="app-page-title text-[1.75rem]">Preferences</h1>

      <div className="max-w-xs space-y-2">
        <label htmlFor="onboarding-max-consecutive" className="text-sm font-semibold">
          Max consecutive days
        </label>
        <select
          id="onboarding-max-consecutive"
          value={maxConsecutiveDays}
          onChange={(event) => setMaxConsecutiveDays(Number(event.target.value))}
          className="h-11 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <option key={value} value={value}>
              {value} day{value === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </div>

      {hasConsecutiveWarning ? (
        <ConsecutiveDaysWarning longestRun={longestRun} maxConsecutiveDays={maxConsecutiveDays} />
      ) : (
        <p className="rounded-xl border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-3 text-sm font-medium text-[var(--success-text)]">
          Your current pattern fits this limit.
        </p>
      )}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Preferred days (optional)</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEKDAYS.map((day) => {
            const selected = preferredDays.includes(day.value)
            const blocked = neverWorkDays.includes(day.value)
            return (
              <label
                key={day.value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors',
                  blocked
                    ? 'cursor-not-allowed border-border/70 bg-muted/20 text-muted-foreground opacity-70'
                    : selected
                      ? 'border-primary bg-[var(--info-subtle)] text-primary'
                      : 'border-border/80 hover:bg-secondary/35'
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => togglePreferredDay(day.value)}
                  disabled={blocked}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                {day.label}
                {blocked ? <span className="ml-auto text-xs font-medium">Never</span> : null}
              </label>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {neverWorkDays.length > 0
            ? 'Days marked never work are disabled here.'
            : 'Leave blank if any day is fine.'}
        </p>
      </fieldset>
    </div>
  )
}

function NeverWorkDaysPicker({
  selectedDays,
  toggleDay,
}: {
  selectedDays: number[]
  toggleDay: (day: number) => void
}) {
  return (
    <fieldset className="rounded-xl border border-border/80 bg-muted/10 px-4 py-4">
      <legend className="px-1 text-sm font-semibold text-foreground">Days you never work</legend>
      <p className="mt-1 text-xs text-muted-foreground">
        These days stay off even if a weekend rotation or cycle would otherwise mark them as work.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WEEKDAYS.map((day) => {
          const selected = selectedDays.includes(day.value)
          return (
            <label
              key={`never-work-${day.value}`}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors',
                selected
                  ? 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                  : 'border-border/80 bg-card hover:bg-secondary/35'
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleDay(day.value)}
                className="h-4 w-4 accent-[var(--destructive)]"
              />
              {day.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function ConfirmStep() {
  return (
    <div className="flex min-h-[30rem] flex-col justify-center space-y-4">
      <h1 className="app-page-title text-[1.75rem]">{"You're all set"}</h1>
      <p className="max-w-md text-base text-muted-foreground">
        Your schedule is ready. You can adjust anything anytime.
      </p>
    </div>
  )
}

function PreviewPanel({
  step,
  scheduleType,
  previewDays,
  scheduleSummary,
  longestRun,
  maxConsecutiveDays,
  neverWorkDays,
  previewPulseKey,
}: {
  step: number
  scheduleType: RecurringPatternType
  previewDays: Array<{ date: string; status: 'available' | 'off' | 'neutral' }>
  scheduleSummary: string
  longestRun: number
  maxConsecutiveDays: number
  neverWorkDays: number[]
  previewPulseKey: number
}) {
  const selectedType =
    SCHEDULE_TYPES.find((option) => option.type === scheduleType) ?? SCHEDULE_TYPES[0]

  return (
    <aside
      key={previewPulseKey}
      className="rounded-xl border border-border-light bg-card p-3.5 shadow-tw-md-strong motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-300 xl:sticky xl:top-2 xl:self-start"
    >
      <div>
        <div>
          <p className="app-page-title text-[1.35rem]">
            {step === 1 ? selectedType.title : 'Preview'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1 ? selectedType.detail : 'Next 2 weeks'}
          </p>
          {step === 1 ? null : (
            <p className="mt-1 text-sm font-medium leading-5 text-primary">Read-only preview</p>
          )}
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Best for
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-foreground">
              {selectedType.bestFor}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Next
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-foreground">
              {selectedType.nextStep}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm font-semibold leading-5 text-[var(--success-text)]">
            You can still mark exceptions later.
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <CalendarPreview previewDays={previewDays} />
          </div>

          <div className="mt-5 rounded-xl border border-border/70 bg-muted/10 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Pattern
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">{scheduleSummary}</p>
            {neverWorkDays.length > 0 ? (
              <p className="mt-2 text-sm font-medium text-[var(--error-text)]">
                Never: {formatWeeklyPattern(neverWorkDays)}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PreviewMetric
              icon={<ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />}
              label="Longest streak"
              value={`${longestRun} day${longestRun === 1 ? '' : 's'}`}
            />
            <PreviewMetric
              icon={<ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />}
              label="Your limit"
              value={`${maxConsecutiveDays} day${maxConsecutiveDays === 1 ? '' : 's'}`}
            />
          </div>
        </>
      )}
    </aside>
  )
}

function ConsecutiveDaysWarning({
  longestRun,
  maxConsecutiveDays,
}: {
  longestRun: number
  maxConsecutiveDays: number
}) {
  const daysToChange = longestRun - maxConsecutiveDays

  return (
    <div className="mt-4 rounded-xl border-2 border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-4 text-[var(--warning-text)] shadow-tw-ring-attention">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">Too many consecutive days</p>
          <p className="mt-1 text-sm">
            Your limit is {maxConsecutiveDays}, but this creates {longestRun} in a row.
          </p>
          <p className="mt-2 text-sm font-semibold">
            Turn off {daysToChange} work day{daysToChange === 1 ? '' : 's'} in this streak, or
            change your limit.
          </p>
        </div>
      </div>
    </div>
  )
}

function PreviewMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-20 items-center gap-4 rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
      {icon}
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function CalendarPreview({
  previewDays,
}: {
  previewDays: Array<{ date: string; status: 'available' | 'off' | 'neutral' }>
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-muted-foreground">
        {previewDays.slice(0, 7).map((day) => (
          <span key={`weekday-${day.date}`}>{formatShortWeekday(day.date)}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {previewDays.map((day) => {
          const date = new Date(`${day.date}T00:00:00`)
          const isWork = day.status === 'available'
          const isBlank = day.status === 'neutral'

          return (
            <div
              key={day.date}
              className={cn(
                'flex min-h-24 flex-col items-center justify-center rounded-lg border text-center text-sm',
                isWork
                  ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)] shadow-tw-pill'
                  : isBlank
                    ? 'border-dashed border-border bg-background text-muted-foreground'
                    : 'border-border/80 bg-muted/25 text-muted-foreground'
              )}
            >
              <span className="font-medium">{formatShortMonth(day.date)}</span>
              <span className="text-xl font-bold">{date.getDate()}</span>
              <span className="mt-1">{isWork ? 'Work' : isBlank ? 'Blank' : 'Off'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
