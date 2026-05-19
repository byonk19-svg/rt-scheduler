import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarClock, CalendarDays, Eye, EyeOff } from 'lucide-react'

import {
  createScheduleBlockPlanningAction,
  updateScheduleBlockPlanningAction,
} from '@/app/schedule/actions'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
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
  isTherapistVisibleForAvailability,
  sortVisibleAvailabilityCycles,
  suggestNextScheduleBlock,
  suggestPlanningDates,
  validateScheduleBlockPlanning,
  type ScheduleBlockPlanningCycle,
} from '@/lib/schedule-block-planning'
import { createClient } from '@/lib/supabase/server'

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

  if (success === 'planning_created') {
    return { tone: 'success', text: 'Schedule Block Planning saved.' }
  }
  if (success === 'planning_saved') {
    return { tone: 'success', text: 'Planning dates updated.' }
  }
  if (warning === 'compressed_timeline') {
    return {
      tone: 'warning',
      text: 'Planning dates are close together. Review the timeline before relying on it.',
    }
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
  }

  return {
    tone: 'error',
    text: copy[error] ?? 'Could not save Schedule Block Planning. Refresh and try again.',
  }
}

function planningStatus(cycle: PlanningCycleRow, today: string) {
  const visible = isTherapistVisibleForAvailability(cycle, today)
  if (visible) return { label: 'Visible to therapists', icon: Eye }
  return { label: 'Manager draft', icon: EyeOff }
}

function hasPlanningGap(cycle: PlanningCycleRow, today: string): boolean {
  if (cycle.start_date < today) return false
  return (
    !cycle.availability_due_at || !cycle.preliminary_target_date || !cycle.final_publish_target_date
  )
}

function classifyCycles(cycles: PlanningCycleRow[], today: string) {
  const future = cycles.filter((cycle) => cycle.end_date >= today && cycle.status !== 'archived')
  const needsPlanning = future.filter((cycle) => hasPlanningGap(cycle, today))
  const planned = sortVisibleAvailabilityCycles(
    future.filter((cycle) => !hasPlanningGap(cycle, today))
  )
  const currentOrRecent = cycles
    .filter((cycle) => cycle.end_date < today || cycle.start_date <= today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .slice(0, 3)

  return { needsPlanning, planned, currentOrRecent }
}

function PlanningFields({
  cycle,
  mode,
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
          Send Preliminary target
          <input
            name="preliminary_target_date"
            type="date"
            defaultValue={cycle.preliminary_target_date ?? ''}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Final Publish target
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
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          {mode === 'create' ? 'Save Schedule Block' : 'Save planning'}
        </Button>
      </div>
    </form>
  )
}

function PlanningCycleCard({ cycle, today }: { cycle: PlanningCycleRow; today: string }) {
  const dueDate = availabilityDueDateKey(cycle.availability_due_at)
  const status = planningStatus(cycle, today)
  const StatusIcon = status.icon

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-tw-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {cycle.label?.trim() || formatHumanCycleRange(cycle.start_date, cycle.end_date)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>
      <dl className="mb-4 grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-muted-foreground">Availability due</dt>
          <dd className="mt-0.5 text-foreground">{formatMaybeDate(dueDate)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Preliminary target</dt>
          <dd className="mt-0.5 text-foreground">
            {formatMaybeDate(cycle.preliminary_target_date)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Final Publish target</dt>
          <dd className="mt-0.5 text-foreground">
            {formatMaybeDate(cycle.final_publish_target_date)}
          </dd>
        </div>
      </dl>
      <PlanningFields
        mode="update"
        cycle={{
          id: cycle.id,
          label: cycle.label?.trim() || formatHumanCycleRange(cycle.start_date, cycle.end_date),
          start_date: cycle.start_date,
          end_date: cycle.end_date,
          availability_due_date: dueDate,
          preliminary_target_date: cycle.preliminary_target_date,
          final_publish_target_date: cycle.final_publish_target_date,
        }}
      />
    </article>
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

  if (
    !can(parseRole(profile?.role), 'manage_schedule', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard/staff')
  }

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

  if (cycleError) {
    console.error('Failed to load Schedule Blocks for Planning:', cycleError)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 md:px-6">
      <ManagerWorkspaceHeader
        title="Schedule Block Planning"
        subtitle="Plan upcoming Schedule Blocks, availability deadlines, and manager target dates."
        summary={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {grouped.needsPlanning.length} need planning
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

      <section className="rounded-lg border border-border bg-card p-4 shadow-tw-sm">
        <div className="mb-4 flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Next suggested Schedule Block</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This is a preview. It is not saved until you confirm the dates.
            </p>
          </div>
        </div>
        <PlanningFields
          mode="create"
          cycle={{
            label: suggestedBlock.label,
            start_date: suggestedBlock.startDate,
            end_date: suggestedBlock.endDate,
            availability_due_date: suggestedDates.availabilityDueDate,
            preliminary_target_date: suggestedDates.preliminaryTargetDate,
            final_publish_target_date: suggestedDates.finalPublishTargetDate,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Needs planning</h2>
        {grouped.needsPlanning.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            No future Schedule Blocks need planning dates right now.
          </p>
        ) : (
          grouped.needsPlanning.map((cycle) => (
            <PlanningCycleCard key={cycle.id} cycle={cycle} today={today} />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Planned</h2>
        {grouped.planned.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            Planned future Schedule Blocks will appear here.
          </p>
        ) : (
          grouped.planned.map((cycle) => (
            <PlanningCycleCard key={cycle.id} cycle={cycle} today={today} />
          ))
        )}
      </section>

      {grouped.currentOrRecent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Current and recent context</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Schedule Block</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grouped.currentOrRecent.map((cycle) => (
                  <tr key={cycle.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{cycle.label}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cycle.published || cycle.status === 'final'
                        ? 'Published'
                        : cycle.status === 'preliminary'
                          ? 'Preliminary'
                          : 'Draft'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
