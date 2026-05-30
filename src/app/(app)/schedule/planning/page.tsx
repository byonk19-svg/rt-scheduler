import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Plus,
} from 'lucide-react'

import {
  createScheduleBlockPlanningAction,
  updateScheduleBlockPlanningAction,
} from '@/app/schedule/actions'
import { ManagerToolAccessDenied } from '@/components/auth/ManagerToolAccessDenied'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { resolveManagerToolAccess } from '@/lib/auth/manager-tool-access'
import {
  addDays,
  dateFromKey,
  formatDateLabel,
  formatHumanCycleRange,
  toIsoDate,
} from '@/lib/calendar-utils'
import {
  availabilityDueDateKey,
  buildScheduleBlockLabel,
  sortVisibleAvailabilityCycles,
  suggestNextScheduleBlock,
  suggestPlanningDates,
  validateScheduleBlockPlanning,
  type ScheduleBlockPlanningCycle,
} from '@/lib/schedule-block-planning'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Schedule Block Planning',
  description: 'Plan upcoming Schedule Blocks and manager scheduling milestones.',
}

export const dynamic = 'force-dynamic'

type SearchParams = {
  cycle?: string | string[]
  success?: string | string[]
  error?: string | string[]
  warning?: string | string[]
  pending_due_date?: string | string[]
}

type ProfileRow = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
  site_id: string | null
}

type PlanningCycleRow = ScheduleBlockPlanningCycle & {
  site_id: string | null
  preliminary_target_date: string | null
  final_publish_target_date: string | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function todayKey(): string {
  return toIsoDate(new Date())
}

function nextSundayFromToday(today: string): string {
  const cursor = dateFromKey(today)
  while (cursor.getDay() !== 0) {
    cursor.setDate(cursor.getDate() + 1)
  }
  return toIsoDate(cursor)
}

function fallbackSuggestedBlock(today: string) {
  const startDate = nextSundayFromToday(today)
  const endDate = toIsoDate(addDays(dateFromKey(startDate), 41))
  return {
    startDate,
    endDate,
    label: buildScheduleBlockLabel(startDate, endDate),
  }
}

function formatMaybeDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  return formatDateLabel(value)
}

function feedbackMessage(
  params: SearchParams | undefined
): { tone: 'success' | 'error' | 'warning'; text: string } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)
  const warning = getSearchParam(params?.warning)

  if (warning === 'compressed_timeline') {
    return {
      tone: 'warning',
      text: 'Planning dates are close together. Review the timeline before relying on it.',
    }
  }
  if (success === 'planning_created') {
    return { tone: 'success', text: 'Schedule Block Planning saved.' }
  }
  if (success === 'planning_saved') {
    return { tone: 'success', text: 'Planning dates updated.' }
  }
  if (!error) return null

  const copy: Record<string, string> = {
    invalid_block_shape: 'Schedule Blocks must start on Sunday and last six weeks.',
    schedule_block_overlap: 'That Schedule Block overlaps an existing block.',
    availability_due_after_start: 'Availability due date must be before the Schedule Block starts.',
    final_publish_target_after_start:
      'Final Publish target must be before the Schedule Block starts.',
    availability_due_after_preliminary_target:
      'Availability due date must be on or before the Preliminary target.',
    preliminary_target_after_final_publish_target:
      'Preliminary target must be on or before the Final Publish target.',
    visible_due_date_required: 'Visible Schedule Blocks must keep an availability due date.',
    planning_due_earlier_requires_confirm: 'Confirm the earlier due date before saving.',
    planning_dates_locked: 'Date ranges are locked after availability or schedule work exists.',
    planning_preliminary_target_locked:
      'Preliminary target is locked after Preliminary has been sent.',
    planning_publish_target_locked:
      'Final Publish target is locked after Final Publish has happened.',
    planning_block_not_future: 'Schedule Block Planning is only for future blocks.',
    planning_lifecycle_locked:
      'Planning dates are locked after the Schedule Block starts, advances, or goes offline.',
  }

  return {
    tone: 'error',
    text: copy[error] ?? 'Could not save Schedule Block Planning. Refresh and try again.',
  }
}

function scheduleBuildStatus(cycle: PlanningCycleRow): string {
  if (cycle.published || cycle.status === 'final') return 'Published'
  if (cycle.status === 'preliminary') return 'Preliminary sent'
  return 'Draft'
}

function isReadOnlyContextCycle(cycle: PlanningCycleRow, today: string): boolean {
  return (
    cycle.start_date <= today ||
    cycle.published ||
    cycle.status === 'final' ||
    cycle.status === 'preliminary'
  )
}

function isEditableUpcomingCycle(cycle: PlanningCycleRow, today: string): boolean {
  return cycle.status !== 'archived' && !isReadOnlyContextCycle(cycle, today)
}

function hasPlanningGap(cycle: PlanningCycleRow, today: string): boolean {
  if (cycle.start_date < today) return false
  return (
    !cycle.availability_due_at || !cycle.preliminary_target_date || !cycle.final_publish_target_date
  )
}

function classifyCycles(cycles: PlanningCycleRow[], today: string) {
  const editableUpcoming = cycles.filter((cycle) => isEditableUpcomingCycle(cycle, today))
  const needsPlanning = editableUpcoming.filter((cycle) => hasPlanningGap(cycle, today))
  const planned = sortVisibleAvailabilityCycles(
    editableUpcoming.filter((cycle) => !hasPlanningGap(cycle, today))
  )
  const currentOrRecent = cycles
    .filter((cycle) => cycle.status !== 'archived' && isReadOnlyContextCycle(cycle, today))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .slice(0, 3)

  return { needsPlanning, planned, currentOrRecent }
}

type PlanningChecklistItem = {
  label: string
  value: string
  missing: boolean
}

function planningChecklist(cycle: {
  availability_due_date?: string | null
  availability_due_at?: string | null
  preliminary_target_date: string | null
  final_publish_target_date: string | null
}): PlanningChecklistItem[] {
  const dueDate =
    'availability_due_date' in cycle
      ? cycle.availability_due_date
      : availabilityDueDateKey(cycle.availability_due_at)

  return [
    {
      label: 'Availability due',
      value: dueDate ? formatMaybeDate(dueDate) : 'Missing',
      missing: !dueDate,
    },
    {
      label: 'Preliminary target',
      value: cycle.preliminary_target_date
        ? formatMaybeDate(cycle.preliminary_target_date)
        : 'Missing',
      missing: !cycle.preliminary_target_date,
    },
    {
      label: 'Final publish target',
      value: cycle.final_publish_target_date
        ? formatMaybeDate(cycle.final_publish_target_date)
        : 'Missing',
      missing: !cycle.final_publish_target_date,
    },
  ]
}

function planningNeededSummary(count: number): string {
  return `${count} future ${count === 1 ? 'block needs' : 'blocks need'} planning`
}

function planningDatesNeededSummary(count: number): string {
  return `${count} ${count === 1 ? 'needs' : 'need'} dates`
}

function contextPlanningDatesLabel(cycle: PlanningCycleRow): string {
  const missingCount = planningChecklist(cycle).filter((item) => item.missing).length
  if (missingCount === 0) return 'Complete'
  return 'Missing historical targets'
}

function safeDateParam(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function PlanningBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold',
        tone === 'success'
          ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
          : tone === 'warning'
            ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
            : 'border-border bg-background text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

function PlanningChecklist({ items }: { items: PlanningChecklistItem[] }) {
  return (
    <div className="grid gap-1.5 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.missing ? AlertCircle : CheckCircle2
        return (
          <div
            key={item.label}
            className={cn(
              'flex min-h-10 items-start gap-2 rounded-md border px-2.5 py-1.5',
              item.missing
                ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)]'
                : 'border-border bg-background'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4',
                item.missing ? 'text-[var(--warning-text)]' : 'text-[var(--success-text)]'
              )}
            />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-semibold',
                  item.missing ? 'text-[var(--warning-text)]' : 'text-foreground'
                )}
              >
                {item.value}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlanningFields({
  cycle,
  mode,
  includeBlockFields = mode === 'create',
  submitLabel,
  confirmEarlierDueDate = false,
}: {
  cycle: {
    id?: string
    label: string
    start_date: string
    end_date: string
    availability_due_date: string | null
    preliminary_target_date: string | null
    final_publish_target_date: string | null
  }
  mode: 'create' | 'update'
  includeBlockFields?: boolean
  submitLabel?: string
  confirmEarlierDueDate?: boolean
}) {
  const action =
    mode === 'create' ? createScheduleBlockPlanningAction : updateScheduleBlockPlanningAction
  const validation = validateScheduleBlockPlanning(
    {
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      availabilityDueDate: cycle.availability_due_date,
      preliminaryTargetDate: cycle.preliminary_target_date,
      finalPublishTargetDate: cycle.final_publish_target_date,
    },
    [],
    cycle.id
  )

  return (
    <form action={action} className="space-y-3">
      {cycle.id ? <input type="hidden" name="cycle_id" value={cycle.id} /> : null}
      {confirmEarlierDueDate ? (
        <input type="hidden" name="confirm_earlier_due_date" value="true" />
      ) : null}
      {includeBlockFields ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Start date
              <input
                name="start_date"
                type="date"
                defaultValue={cycle.start_date}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              End date
              <input
                name="end_date"
                type="date"
                defaultValue={cycle.end_date}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>
          <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
            Custom label
            <input
              name="label"
              defaultValue={cycle.label}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="start_date" value={cycle.start_date} />
          <input type="hidden" name="end_date" value={cycle.end_date} />
          <input type="hidden" name="label" value={cycle.label} />
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Availability due
          <input
            name="availability_due_date"
            type="date"
            defaultValue={cycle.availability_due_date ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Send preliminary target
          <input
            name="preliminary_target_date"
            type="date"
            defaultValue={cycle.preliminary_target_date ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Final publish target
          <input
            name="final_publish_target_date"
            type="date"
            defaultValue={cycle.final_publish_target_date ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>
      {validation.warnings.includes('compressed_timeline') ? (
        <p className="text-xs font-medium text-[var(--warning-text)]">
          These milestones are close together.
        </p>
      ) : null}
      {confirmEarlierDueDate ? (
        <p className="text-xs font-medium text-[var(--warning-text)]">
          Saving again confirms the earlier availability due date.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          {submitLabel ?? (mode === 'create' ? 'Save Schedule Block' : 'Save planning')}
        </Button>
      </div>
    </form>
  )
}

function PlanningCycleCard({
  cycle,
  selected,
  pendingDueDate,
  confirmEarlierDueDate,
}: {
  cycle: PlanningCycleRow
  selected: boolean
  pendingDueDate: string | null
  confirmEarlierDueDate: boolean
}) {
  const dueDate = pendingDueDate ?? availabilityDueDateKey(cycle.availability_due_at)
  const checklist = planningChecklist({
    availability_due_date: dueDate,
    preliminary_target_date: cycle.preliminary_target_date,
    final_publish_target_date: cycle.final_publish_target_date,
  })
  const missingCount = checklist.filter((item) => item.missing).length
  const editLabel = missingCount > 0 ? 'Set planning dates' : 'Edit planning dates'
  const planningLabel = missingCount > 0 ? 'Needs dates' : 'Dates set'

  return (
    <article
      id={`schedule-block-${cycle.id}`}
      className={cn(
        'rounded-lg border bg-card p-4 shadow-tw-sm',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {cycle.label?.trim() || formatHumanCycleRange(cycle.start_date, cycle.end_date)}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <PlanningBadge tone={missingCount > 0 ? 'warning' : 'success'}>
              {planningLabel}
            </PlanningBadge>
            <PlanningBadge>{scheduleBuildStatus(cycle)}</PlanningBadge>
          </div>
        </div>
        <PlanningChecklist items={checklist} />
      </div>

      <details className="group mt-3 border-t border-border pt-3" open={selected}>
        <summary className="flex cursor-pointer list-none items-center justify-end gap-2 marker:hidden">
          <span
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors',
              missingCount > 0
                ? 'border-primary bg-primary text-primary-foreground group-hover:bg-primary/90'
                : 'border-border bg-background text-foreground group-hover:bg-muted'
            )}
          >
            <Pencil
              className={cn(
                'h-4 w-4',
                missingCount > 0 ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            />
            {editLabel}
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform group-open:rotate-180',
                missingCount > 0 ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            />
          </span>
        </summary>
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <PlanningFields
            mode="update"
            includeBlockFields={false}
            submitLabel="Save planning dates"
            cycle={{
              id: cycle.id,
              label: cycle.label?.trim() || formatHumanCycleRange(cycle.start_date, cycle.end_date),
              start_date: cycle.start_date,
              end_date: cycle.end_date,
              availability_due_date: dueDate,
              preliminary_target_date: cycle.preliminary_target_date,
              final_publish_target_date: cycle.final_publish_target_date,
            }}
            confirmEarlierDueDate={confirmEarlierDueDate}
          />
        </div>
      </details>
    </article>
  )
}

function CreateNextScheduleBlockCard({
  suggestedBlock,
  suggestedDates,
}: {
  suggestedBlock: { label: string; startDate: string; endDate: string }
  suggestedDates: {
    availabilityDueDate: string
    preliminaryTargetDate: string
    finalPublishTargetDate: string
  }
}) {
  const cycle = {
    label: suggestedBlock.label,
    start_date: suggestedBlock.startDate,
    end_date: suggestedBlock.endDate,
    availability_due_date: suggestedDates.availabilityDueDate,
    preliminary_target_date: suggestedDates.preliminaryTargetDate,
    final_publish_target_date: suggestedDates.finalPublishTargetDate,
  }
  const checklist = planningChecklist(cycle)

  return (
    <section className="rounded-lg border border-primary/30 bg-card px-4 py-3 shadow-tw-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plus className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">Create next schedule block</h2>
            <p className="mt-1.5 text-xl font-bold text-foreground">
              {formatHumanCycleRange(suggestedBlock.startDate, suggestedBlock.endDate)}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Suggested 6-week block
            </p>
          </div>
        </div>
        <form
          action={createScheduleBlockPlanningAction}
          className="flex w-full flex-col gap-2 sm:w-auto sm:items-end"
        >
          <input type="hidden" name="start_date" value={cycle.start_date} />
          <input type="hidden" name="end_date" value={cycle.end_date} />
          <input type="hidden" name="label" value={cycle.label} />
          <input
            type="hidden"
            name="availability_due_date"
            value={cycle.availability_due_date ?? ''}
          />
          <input
            type="hidden"
            name="preliminary_target_date"
            value={cycle.preliminary_target_date ?? ''}
          />
          <input
            type="hidden"
            name="final_publish_target_date"
            value={cycle.final_publish_target_date ?? ''}
          />
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            Create schedule block
          </Button>
        </form>
      </div>

      <div className="mt-3">
        <PlanningChecklist items={checklist} />
      </div>

      <details className="group mt-3 border-t border-border pt-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground marker:hidden">
          <span className="inline-flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            Review or edit dates
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <PlanningFields mode="create" submitLabel="Create with edited dates" cycle={cycle} />
        </div>
      </details>
    </section>
  )
}

export default async function ScheduleBlockPlanningPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = (await searchParams) ?? {}
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()
  const profile = (profileData ?? null) as ProfileRow | null

  const access = resolveManagerToolAccess(profile, 'manage_schedule')
  if (access === 'inactive') redirect('/login?error=account_inactive')
  if (access === 'forbidden') return <ManagerToolAccessDenied toolName="Schedule Block Planning" />

  let cyclesQuery = supabase
    .from('schedule_cycles')
    .select(
      'id, label, start_date, end_date, published, status, archived_at, availability_due_at, preliminary_target_date, final_publish_target_date, site_id'
    )
    .is('archived_at', null)
    .order('start_date', { ascending: true })

  if (profile?.site_id) {
    cyclesQuery = cyclesQuery.eq('site_id', profile.site_id)
  }

  const { data: cycleData, error: cycleError } = await cyclesQuery
  const cycles = (cycleData ?? []) as PlanningCycleRow[]
  const today = todayKey()
  const grouped = classifyCycles(cycles, today)
  const suggestedBlock = suggestNextScheduleBlock(cycles) ?? fallbackSuggestedBlock(today)
  const suggestedDates = suggestPlanningDates(suggestedBlock.startDate)
  const feedback = feedbackMessage(params)
  const selectedCycleId = getSearchParam(params.cycle)
  const selectedError = getSearchParam(params.error)
  const pendingDueDate = safeDateParam(getSearchParam(params.pending_due_date))

  if (cycleError) {
    console.error('Failed to load Schedule Blocks for Planning:', cycleError)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 md:px-6">
      <ManagerWorkspaceHeader
        title="Schedule Block Planning"
        subtitle="Set up future six-week blocks and keep planning dates on track."
        summary={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {planningNeededSummary(grouped.needsPlanning.length)}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/schedule">Back to Schedule</Link>
          </Button>
        }
        compact
      />

      {feedback ? (
        <div
          className={
            feedback.tone === 'success'
              ? 'rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-3 text-sm font-medium text-[var(--success-text)]'
              : feedback.tone === 'warning'
                ? 'rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-sm font-medium text-[var(--warning-text)]'
                : 'rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]'
          }
        >
          {feedback.text}
        </div>
      ) : null}

      <CreateNextScheduleBlockCard
        suggestedBlock={suggestedBlock}
        suggestedDates={suggestedDates}
      />

      <section className="space-y-3" aria-labelledby="upcoming-schedule-blocks">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="upcoming-schedule-blocks" className="text-sm font-bold text-foreground">
              Upcoming schedule blocks
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Draft blocks that still need planning dates before publishing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PlanningBadge tone={grouped.needsPlanning.length > 0 ? 'warning' : 'success'}>
              {planningDatesNeededSummary(grouped.needsPlanning.length)}
            </PlanningBadge>
            {grouped.planned.length > 0 ? (
              <PlanningBadge>{grouped.planned.length} planned</PlanningBadge>
            ) : null}
          </div>
        </div>

        {[...grouped.needsPlanning, ...grouped.planned].length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            Upcoming Schedule Blocks will appear here after they are created.
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.needsPlanning.map((cycle) => (
              <PlanningCycleCard
                key={cycle.id}
                cycle={cycle}
                selected={selectedCycleId === cycle.id}
                pendingDueDate={selectedCycleId === cycle.id ? pendingDueDate : null}
                confirmEarlierDueDate={
                  selectedCycleId === cycle.id &&
                  selectedError === 'planning_due_earlier_requires_confirm' &&
                  Boolean(pendingDueDate)
                }
              />
            ))}
            {grouped.planned.map((cycle) => (
              <PlanningCycleCard
                key={cycle.id}
                cycle={cycle}
                selected={selectedCycleId === cycle.id}
                pendingDueDate={selectedCycleId === cycle.id ? pendingDueDate : null}
                confirmEarlierDueDate={
                  selectedCycleId === cycle.id &&
                  selectedError === 'planning_due_earlier_requires_confirm' &&
                  Boolean(pendingDueDate)
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="current-recent-context">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <h2 id="current-recent-context" className="text-sm font-bold text-foreground">
              Current & Recent Context
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Read-only reference for the blocks managers are already working from.
            </p>
          </div>
        </div>
        {grouped.currentOrRecent.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            Current and recent Schedule Blocks will appear here as the schedule moves forward.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted text-left text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Schedule Block</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Planning Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grouped.currentOrRecent.map((cycle) => {
                  const planningDatesLabel = contextPlanningDatesLabel(cycle)
                  return (
                    <tr key={cycle.id}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {cycle.label?.trim() ||
                          formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                      </td>
                      <td className="px-4 py-3">
                        <PlanningBadge>{scheduleBuildStatus(cycle)}</PlanningBadge>
                      </td>
                      <td className="px-4 py-3">
                        <PlanningBadge
                          tone={planningDatesLabel === 'Complete' ? 'success' : 'warning'}
                        >
                          {planningDatesLabel}
                        </PlanningBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
