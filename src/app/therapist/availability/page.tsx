import { redirect } from 'next/navigation'

import {
  AvailabilityEntriesTable,
  type AvailabilityEntryTableRow,
} from '@/app/availability/availability-requests-table'
import {
  deleteAvailabilityEntryAction,
  submitTherapistAvailabilityGridAction,
} from '@/app/availability/actions'
import { AvailabilityOverviewHeader } from '@/components/availability/AvailabilityOverviewHeader'
import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
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
}

type AvailabilityRow = {
  id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
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
      message: 'Could not save your availability request. Please try again.',
      variant: 'error',
    }
  }
  if (success === 'entry_submitted') {
    return {
      message: 'Availability request saved for this cycle.',
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
      message: 'Could not delete availability request.',
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
    .select('id, label, start_date, end_date, published')
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = (cyclesData ?? []) as Cycle[]
  const selectedCycleIdFromParams = getSearchParam(params?.cycle)
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null
  const selectedCycleId = selectedCycle?.id ?? ''

  let entriesQuery = supabase
    .from('availability_overrides')
    .select(
      'id, date, shift_type, override_type, note, created_at, therapist_id, cycle_id, profiles!availability_overrides_therapist_id_fkey(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .eq('therapist_id', user.id)
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (selectedCycleId) {
    entriesQuery = entriesQuery.eq('cycle_id', selectedCycleId)
  }

  const { data: entriesData } = await entriesQuery
  const entries = (entriesData ?? []) as AvailabilityRow[]

  const availabilityRows: AvailabilityEntryTableRow[] = entries.map((entry) => {
    const cycle = getOne(entry.schedule_cycles)
    const requester = getOne(entry.profiles)
    return {
      id: entry.id,
      cycleId: entry.cycle_id,
      date: entry.date,
      reason: entry.note,
      createdAt: entry.created_at,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle
        ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`
        : 'Unknown cycle',
      entryType: entry.override_type,
      shiftType: entry.shift_type,
      canDelete: true,
    }
  })

  const totalRequests = availabilityRows.length
  const needOffRequests = availabilityRows.filter((row) => row.entryType === 'force_off').length
  const availableToWorkRequests = availabilityRows.filter(
    (row) => row.entryType === 'force_on'
  ).length

  return (
    <div className="space-y-7">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <AvailabilityOverviewHeader
        canManageAvailability={false}
        title="Future Availability"
        subtitle={
          selectedCycle
            ? `${selectedCycle.label} - ${selectedCycle.start_date} to ${selectedCycle.end_date}`
            : 'No upcoming cycle selected'
        }
        totalRequests={totalRequests}
        needOffRequests={needOffRequests}
        availableToWorkRequests={availableToWorkRequests}
        responseRatio={null}
      />

      <TherapistAvailabilityWorkspace
        cycles={cycles}
        availabilityRows={availabilityRows}
        initialCycleId={selectedCycleId}
        submitTherapistAvailabilityGridAction={submitTherapistAvailabilityGridAction}
        returnToPath="/therapist/availability"
      />

      <AvailabilityEntriesTable
        role={role}
        rows={availabilityRows}
        deleteAvailabilityEntryAction={deleteAvailabilityEntryAction}
        initialFilters={initialFilters}
        returnToPath="/therapist/availability"
      />
    </div>
  )
}
