import type { WorkPatternRecord } from '@/components/team/team-directory-model'
import {
  describeWorkPatternSummary,
  normalizeWorkPattern,
  type WorkPattern,
} from '@/lib/coverage/work-patterns'
import { cn } from '@/lib/utils'

type Props = {
  pattern?: WorkPatternRecord | WorkPattern | null
  worksDow?: number[]
  offsDow?: number[]
  weekendRotation?: string | null
  worksDowMode?: string
}

const DOW_OPTIONS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

function normalizePatternFromProps(props: Props): WorkPattern | null {
  if (props.pattern) {
    return normalizeWorkPattern({
      therapist_id: props.pattern.therapist_id ?? 'therapist',
      pattern_type: props.pattern.pattern_type,
      works_dow: props.pattern.works_dow,
      offs_dow: props.pattern.offs_dow,
      works_dow_mode: props.pattern.works_dow_mode,
      weekend_rotation: props.pattern.weekend_rotation,
      weekend_anchor_date: props.pattern.weekend_anchor_date,
      weekly_weekdays: props.pattern.weekly_weekdays ?? props.pattern.works_dow,
      weekend_rule: props.pattern.weekend_rule,
      cycle_anchor_date: props.pattern.cycle_anchor_date,
      cycle_segments: props.pattern.cycle_segments,
      shift_preference: props.pattern.shift_preference,
    })
  }

  if (!props.worksDow && !props.offsDow && !props.weekendRotation && !props.worksDowMode) {
    return null
  }

  return normalizeWorkPattern({
    therapist_id: 'therapist',
    works_dow: props.worksDow ?? [],
    offs_dow: props.offsDow ?? [],
    works_dow_mode: props.worksDowMode === 'soft' ? 'soft' : 'hard',
    weekend_rotation: props.weekendRotation === 'every_other' ? 'every_other' : 'none',
    weekend_anchor_date: null,
  })
}

function getPatternModeLabel(pattern: WorkPattern): string {
  if (pattern.pattern_type === 'repeating_cycle') return 'Repeating cycle'
  return pattern.works_dow_mode === 'soft' ? 'Usual work days' : 'Fixed work days'
}

export function WorkPatternCard(props: Props) {
  const pattern = normalizePatternFromProps(props)
  if (!pattern) {
    return <p className="text-sm text-muted-foreground">No normal schedule saved yet.</p>
  }

  const worksDow = pattern.works_dow
  const offsDow = pattern.offs_dow
  const summary = describeWorkPatternSummary(pattern)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-card px-3.5 py-3">
        <p className="text-sm font-semibold text-foreground">{summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground">
            {getPatternModeLabel(pattern)}
          </span>
        </div>
      </div>

      {pattern.pattern_type !== 'repeating_cycle' ? (
        <div className="flex flex-wrap gap-1.5">
          {DOW_OPTIONS.map((day) => (
            <span
              key={day.value}
              className={cn(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold',
                worksDow.includes(day.value) &&
                  'bg-[var(--success-subtle)] text-[var(--success-text)]',
                !worksDow.includes(day.value) &&
                  offsDow.includes(day.value) &&
                  'bg-[var(--error-subtle)] text-[var(--error-text)]',
                !worksDow.includes(day.value) &&
                  !offsDow.includes(day.value) &&
                  'bg-[var(--muted)] text-[var(--muted-foreground)]'
              )}
            >
              {day.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
