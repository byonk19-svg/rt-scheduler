import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

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
import { getCommonAvailabilityFeedback, getSearchParam } from '@/lib/availability-page-helpers'
import { loadTherapistAvailabilityPageData } from '@/lib/availability-page-loaders'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Availability',
}

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
  const feedback = getCommonAvailabilityFeedback(params, {
    deleteFailedMessage: "Couldn't delete availability request.",
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  if (can(role, 'access_manager_ui')) {
    redirect('/availability')
  }

  const {
    cycles,
    selectedCycleId,
    activeCycle,
    submissionsByCycleId,
    entries,
    availabilityRows,
    initialFilters,
  } = await loadTherapistAvailabilityPageData({
    supabase: supabase as never,
    userId: user.id,
    searchParams: params,
  })

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

  const scheduledShiftsResult = await scheduledShiftsPromise
  const scheduledShifts = (scheduledShiftsResult.data ?? []) as Array<{
    date: string
    shift_type: 'day' | 'night'
  }>
  const conflicts = findScheduledConflicts(entries, scheduledShifts)

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
