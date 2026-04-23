import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  archiveCycleAction,
  restartPublishedCycleAction,
  unpublishCycleKeepShiftsAction,
} from '@/app/publish/actions'
import { deleteCycleAction } from '@/app/schedule/actions'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { fetchScheduleCyclesForCoverage } from '@/lib/coverage/fetch-schedule-cycles'
import { FinalizeScheduleBlocksTable } from '@/components/manager/FinalizeScheduleBlocksTable'
import { FinalizeScheduleHeader } from '@/components/manager/FinalizeScheduleHeader'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Finalize Schedule',
}

type FinalizeSchedulePageProps = {
  searchParams?: Promise<{
    success?: string
    error?: string
  }>
}

export default async function FinalizeSchedulePage(props: FinalizeSchedulePageProps) {
  const resolvedSearchParams = (await props.searchParams) ?? {}
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_publish')) {
    redirect('/dashboard')
  }

  const { data: activeCycles, error: cyclesLoadError } =
    await fetchScheduleCyclesForCoverage(supabase)

  const cycles = activeCycles ?? []
  const liveCount = cycles.filter((cycle) => cycle.published).length
  const draftCount = cycles.length - liveCount

  return (
    <div className="space-y-5">
      <FinalizeScheduleHeader draftCount={draftCount} liveCount={liveCount} />

      {resolvedSearchParams.success === 'cycle_restarted' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--warning-border)',
            backgroundColor: 'var(--warning-subtle)',
            color: 'var(--warning-text)',
          }}
        >
          Cycle restarted. The block is draft again, published shifts were cleared, and any active
          preliminary snapshot was closed.
        </div>
      )}

      {resolvedSearchParams.success === 'unpublished_keep_shifts' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Block unpublished. Assignments stay on the draft grid; staff no longer see it as a
          published schedule until you publish again.
        </div>
      )}

      {resolvedSearchParams.success === 'cycle_archived' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Cycle archived. It will no longer appear in Schedule or availability views.
        </div>
      )}

      {resolvedSearchParams.success === 'cycle_deleted' && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--success-border)',
            backgroundColor: 'var(--success-subtle)',
            color: 'var(--success-text)',
          }}
        >
          Draft schedule block deleted.
        </div>
      )}

      {(resolvedSearchParams.error === 'missing_cycle' ||
        resolvedSearchParams.error === 'cycle_restart_failed' ||
        resolvedSearchParams.error === 'unpublish_keep_shifts_failed' ||
        resolvedSearchParams.error === 'unpublish_not_live' ||
        resolvedSearchParams.error === 'archive_live_cycle' ||
        resolvedSearchParams.error === 'cycle_archive_failed' ||
        resolvedSearchParams.error === 'delete_cycle_unauthorized' ||
        resolvedSearchParams.error === 'delete_cycle_not_found' ||
        resolvedSearchParams.error === 'delete_cycle_published' ||
        resolvedSearchParams.error === 'delete_cycle_failed') && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: 'var(--error-border)',
            backgroundColor: 'var(--error-subtle)',
            color: 'var(--error-text)',
          }}
        >
          {resolvedSearchParams.error === 'missing_cycle'
            ? 'Could not restart that cycle because no cycle was selected.'
            : resolvedSearchParams.error === 'cycle_restart_failed'
              ? 'Could not restart that published cycle. Please try again.'
              : resolvedSearchParams.error === 'unpublish_keep_shifts_failed'
                ? 'Could not unpublish that block while keeping shifts. Please try again.'
                : resolvedSearchParams.error === 'unpublish_not_live'
                  ? 'That block is already a draft.'
                  : resolvedSearchParams.error === 'archive_live_cycle'
                    ? 'Live blocks must be unpublished or cleared with Start over before they can be archived.'
                    : resolvedSearchParams.error === 'cycle_archive_failed'
                      ? 'Could not archive that cycle. Please try again.'
                      : resolvedSearchParams.error === 'delete_cycle_unauthorized'
                        ? 'You do not have permission to delete that schedule block.'
                        : resolvedSearchParams.error === 'delete_cycle_not_found'
                          ? 'That schedule block was not found.'
                          : resolvedSearchParams.error === 'delete_cycle_published'
                            ? 'Published blocks cannot be deleted. Unpublish or restart them first.'
                            : resolvedSearchParams.error === 'delete_cycle_failed'
                              ? 'Could not delete that draft block. Please try again.'
                              : 'Something went wrong.'}
        </div>
      )}

      <FinalizeScheduleBlocksTable
        archiveCycleAction={archiveCycleAction}
        cycles={cycles}
        cyclesLoadError={cyclesLoadError}
        deleteCycleAction={deleteCycleAction}
        restartPublishedCycleAction={restartPublishedCycleAction}
        unpublishCycleKeepShiftsAction={unpublishCycleKeepShiftsAction}
      />
    </div>
  )
}
