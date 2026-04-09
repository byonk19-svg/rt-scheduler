import { redirect } from 'next/navigation'

import {
  cancelPreliminaryRequestAction,
  claimPreliminaryShiftAction,
  requestPreliminaryChangeAction,
} from '@/app/preliminary/actions'
import { PreliminaryScheduleView } from '@/components/preliminary/PreliminaryScheduleView'
import {
  toPreliminaryShiftCard,
  toTherapistPreliminaryHistory,
} from '@/lib/preliminary-schedule/selectors'
import type {
  PreliminaryRequestRow,
  PreliminaryShiftRow,
  PreliminaryShiftStateRow,
  PreliminarySnapshotRow,
} from '@/lib/preliminary-schedule/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type PreliminarySearchParams = Record<string, string | string[] | undefined>

type PreliminaryProfileRow = {
  id: string
  role: string | null
  is_active: boolean | null
  archived_at: string | null
}

type CycleRow = {
  id: string
  label: string
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toSuccessMessage(value: string | undefined) {
  if (value === 'preliminary_claim_requested') {
    return 'Your shift claim is pending manager approval.'
  }
  if (value === 'preliminary_change_requested') {
    return 'Your change request is pending manager approval.'
  }
  if (value === 'preliminary_request_cancelled') {
    return 'Your preliminary request was cancelled.'
  }
  return null
}

function toErrorMessage(value: string | undefined) {
  if (value === 'slot_already_reserved') {
    return 'That slot already has a pending claim.'
  }
  if (value === 'not_shift_owner') {
    return 'Only your own tentative assignment can be changed.'
  }
  if (value === 'not_request_owner') {
    return 'Only the requester can cancel that item.'
  }
  if (value === 'request_not_pending') {
    return 'That request is no longer pending.'
  }
  if (value) {
    return 'Could not update the preliminary schedule. Please try again.'
  }
  return null
}

export default async function PreliminaryPage({
  searchParams,
}: {
  searchParams?: Promise<PreliminarySearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const success = toSuccessMessage(getSearchParam(params?.success))
  const error = toErrorMessage(getSearchParam(params?.error))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  const currentProfile = (profile ?? null) as PreliminaryProfileRow | null
  if (!currentProfile?.is_active || currentProfile.archived_at) {
    redirect('/?error=account_inactive')
  }

  const { data: snapshotData } = await supabase
    .from('preliminary_snapshots')
    .select('id, cycle_id, created_by, sent_at, status, created_at')
    .eq('status', 'active')
    .order('sent_at', { ascending: false })
    .maybeSingle()

  const snapshot = (snapshotData ?? null) as PreliminarySnapshotRow | null

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border bg-card px-6 pb-4 pt-5">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Preliminary Schedule
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No manager preview is live right now.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-semibold text-foreground">
            No preliminary schedule has been sent yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            When managers send a draft preview, your tentative shifts and open help-needed slots
            will show up here.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: cycleData }, { data: shiftStatesData }, { data: requestsData }] =
    await Promise.all([
      supabase
        .from('schedule_cycles')
        .select('id, label')
        .eq('id', snapshot.cycle_id)
        .maybeSingle(),
      supabase
        .from('preliminary_shift_states')
        .select('id, snapshot_id, shift_id, state, reserved_by, active_request_id, updated_at')
        .eq('snapshot_id', snapshot.id),
      supabase
        .from('preliminary_requests')
        .select(
          'id, snapshot_id, shift_id, requester_id, type, status, note, decision_note, approved_by, approved_at, created_at'
        )
        .eq('snapshot_id', snapshot.id)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  const shiftStates = (shiftStatesData ?? []) as PreliminaryShiftStateRow[]
  const shiftIds = Array.from(new Set(shiftStates.map((state) => state.shift_id)))

  let shiftsData: Array<
    PreliminaryShiftRow & {
      profiles: { full_name: string | null } | { full_name: string | null }[] | null
    }
  > | null = []

  if (shiftIds.length) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('shifts')
      .select(
        'id, cycle_id, user_id, date, shift_type, status, role, profiles:profiles!shifts_user_id_fkey(full_name)'
      )
      .in('id', shiftIds)
    shiftsData =
      (data as Array<
        PreliminaryShiftRow & {
          profiles: { full_name: string | null } | { full_name: string | null }[] | null
        }
      > | null) ?? []
  }

  const shiftsById = new Map(
    (shiftsData ?? []).map((shift) => [
      shift.id,
      {
        id: shift.id,
        cycle_id: shift.cycle_id,
        user_id: shift.user_id,
        date: shift.date,
        shift_type: shift.shift_type,
        status: shift.status,
        role: shift.role,
        full_name: getOne(shift.profiles)?.full_name ?? null,
      } satisfies PreliminaryShiftRow,
    ])
  )

  const cards = shiftStates
    .map((state) => {
      const shift = shiftsById.get(state.shift_id)
      if (!shift) return null

      return toPreliminaryShiftCard({
        shift,
        shiftState: state,
        currentUserId: user.id,
      })
    })
    .filter((card): card is NonNullable<typeof card> => Boolean(card))
    .filter((card) => {
      if (currentProfile.role === 'manager') {
        return card.state !== 'tentative_assignment' || card.assignedUserId === user.id
      }

      return (
        card.canClaim ||
        card.canRequestChange ||
        card.assignedUserId === user.id ||
        card.reservedById === user.id
      )
    })
    .sort((left, right) => {
      if (left.shiftDate === right.shiftDate) {
        return left.shiftType.localeCompare(right.shiftType)
      }
      return left.shiftDate.localeCompare(right.shiftDate)
    })

  const history = toTherapistPreliminaryHistory(
    (requestsData ?? []) as PreliminaryRequestRow[],
    shiftsById
  )

  return (
    <PreliminaryScheduleView
      snapshotId={snapshot.id}
      cycleLabel={(cycleData as CycleRow | null)?.label ?? 'Preliminary schedule'}
      snapshotSentAt={snapshot.sent_at}
      currentUserId={user.id}
      cards={cards}
      historyItems={history}
      claimAction={claimPreliminaryShiftAction}
      requestChangeAction={requestPreliminaryChangeAction}
      cancelAction={cancelPreliminaryRequestAction}
      successMessage={success}
      errorMessage={error}
    />
  )
}
