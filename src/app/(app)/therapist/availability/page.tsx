import { redirect } from 'next/navigation'

import {
  AvailabilityEntriesTable,
  type AvailabilityEntryTableRow,
} from '@/app/availability/availability-requests-table'
import {
  deleteAvailabilityEntryAction,
  submitTherapistAvailabilityGridAction,
} from '@/app/availability/actions'
import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { can } from '@/lib/auth/can'
import { findScheduledConflicts } from '@/lib/availability-scheduled-conflict'
import { toUiRole } from '@/lib/auth/roles'
import { resolveTherapistAvailabilityCycleId } from '@/lib/therapist-workflow'
import { createClient } from '@/lib/supabase/server'

type ToastVariant = 'success' | 'error'
type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  error?: string | string[]
  success?: string | string[]
  search?: string | string[]
  status?: string | string[]
  startDate?: string | string[]
  endDate?: string | string[]
  sort?: string | string[]
}

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  archived_at?: string | null
  availability_due_at?: string | null
}

type AvailabilityRow = {
  id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  updated_at: string
  therapist_id: string
  cycle_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getAvailabilityFeedback(params?: AvailabilityPageSearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)

  if (error === 'duplicate_entry') {
    return {
      message:
        'You already had an availability request for that date and shift in this cycle. We updated it.',
      variant: 'success',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: "Couldn't save availability. Try again.",
      variant: 'error',
    }
  }
  if (error === 'submission_closed') {
    return {
      message: 'Availability changes are closed for this cycle.',
      variant: 'error',
    }
  }
  if (success === 'entry_submitted') {
    return {
      message: 'Availability submitted for this cycle.',
      variant: 'success',
    }
  }

  if (success === 'draft_saved') {
    return {
      message: "Draft saved. Submit availability when you're ready.",
      variant: 'success',
    }
  }

  if (success === 'entry_deleted') {
    return {
      message: 'Availability request deleted.',
      variant: 'success',
    }
  }

  if (error === 'delete_failed') {
    return {
      message: "Couldn't delete availability request.",
      variant: 'error',
    }
  }

  return null
}

export default async function TherapistAvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<AvailabilityPageSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  const feedback = getAvailabilityFeedback(params)
  const initialStatus = getSearchParam(params?.status)
  const initialSort = getSearchParam(params?.sort)
  const initialFilters: Partial<TableToolbarFilters> = {
    search: getSearchParam(params?.search) ?? '',
    status: initialStatus ?? undefined,
    startDate: getSearchParam(params?.startDate) ?? '',
    endDate: getSearchParam(params?.endDate) ?? '',
    sort: initialSort === 'oldest' ? 'oldest' : 'newest',
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  if (can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, archived_at, availability_due_at')
    .is('archived_at', null)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = (cyclesData ?? []) as Cycle[]
  const selectedCycleIdFromParams = getSearchParam(params?.cycle)
  const { data: preliminarySnapshotsData } =
    cycles.length > 0
      ? await supabase
          .from('preliminary_snapshots')
          .select('cycle_id, status')
          .eq('status', 'active')
          .in(
            'cycle_id',
            cycles.map((cycle) => cycle.id)
          )
      : { data: [] }
  const workflowCycleId = resolveTherapistAvailabilityCycleId({
    todayKey,
    cycles,
    preliminarySnapshots:
      ((preliminarySnapshotsData ?? []) as Array<{
        cycle_id: string
        status: 'active' | 'superseded' | 'closed'
      }>) ?? [],
  })
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.id === workflowCycleId) ??
    cycles[0] ??
    null
  const selectedCycleId = selectedCycle?.id ?? ''
  const activeCycle =
    cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ?? null

  const { data: submissionRowsData } =
    cycles.length > 0
      ? await supabase
          .from('therapist_availability_submissions')
          .select('schedule_cycle_id, submitted_at, last_edited_at')
          .eq('therapist_id', user.id)
          .in(
            'schedule_cycle_id',
            cycles.map((c) => c.id)
          )
      : { data: [] }

  const submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }> = {}
  for (const row of submissionRowsData ?? []) {
    const r = row as { schedule_cycle_id: string; submitted_at: string; last_edited_at: string }
    submissionsByCycleId[r.schedule_cycle_id] = {
      submittedAt: r.submitted_at,
      lastEditedAt: r.last_edited_at,
    }
  }

  let entriesQuery = supabase
    .from('availability_overrides')
    .select(
      'id, date, shift_type, override_type, note, created_at, updated_at, therapist_id, cycle_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .eq('therapist_id', user.id)
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (selectedCycleId) {
    entriesQuery = entriesQuery.eq('cycle_id', selectedCycleId)
  }

  const scheduledShiftsPromise =
    activeCycle && selectedCycleId === activeCycle.id
      ? supabase
          .from('shifts')
          .select('date, shift_type')
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .gte('date', activeCycle.start_date)
          .lte('date', activeCycle.end_date)
      : Promise.resolve({ data: [] })

  const [entriesResult, scheduledShiftsResult] = await Promise.all([
    entriesQuery,
    scheduledShiftsPromise,
  ])
  const entriesData = entriesResult.data
  const entries = (entriesData ?? []) as AvailabilityRow[]
  const scheduledShifts = (scheduledShiftsResult.data ?? []) as Array<{
    date: string
    shift_type: 'day' | 'night'
  }>
  const conflicts = findScheduledConflicts(entries, scheduledShifts)

  const availabilityRows: AvailabilityEntryTableRow[] = entries.map((entry) => {
    const cycle = getOne(entry.schedule_cycles)
    const requester = getOne(entry.profiles)
    return {
      id: entry.id,
      therapistId: entry.therapist_id,
      cycleId: entry.cycle_id,
      date: entry.date,
      reason: entry.note,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle
        ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`
        : 'Unknown cycle',
      entryType: entry.override_type,
      shiftType: entry.shift_type,
      canDelete: true,
    }
  })

  return (
    <div className="space-y-7">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <TherapistAvailabilityWorkspace
        cycles={cycles}
        availabilityRows={availabilityRows}
        conflicts={conflicts}
        initialCycleId={selectedCycleId}
        submissionsByCycleId={submissionsByCycleId}
        submitTherapistAvailabilityGridAction={submitTherapistAvailabilityGridAction}
        returnToPath="/therapist/availability"
      />

      <AvailabilityEntriesTable
        role={role}
        rows={availabilityRows}
        deleteAvailabilityEntryAction={deleteAvailabilityEntryAction}
        initialFilters={initialFilters}
        returnToPath="/therapist/availability"
        titleOverride="Submitted Availability"
        descriptionOverride="Day-level availability entries for the selected cycle."
        emptyMessageOverride="No day-level entries yet for this cycle."
      />
    </div>
  )
}
