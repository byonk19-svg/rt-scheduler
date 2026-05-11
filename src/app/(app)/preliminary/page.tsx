import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  cancelPreliminaryCellMarkAction,
  cancelPreliminaryRequestAction,
  claimPreliminaryShiftAction,
  createPreliminaryCellMarkAction,
  requestPreliminaryChangeAction,
  reviewPreliminaryCellMarkAction,
} from '@/app/preliminary/actions'
import { PreliminaryScheduleView } from '@/components/preliminary/PreliminaryScheduleView'
import {
  toPreliminaryShiftCard,
  toTherapistPreliminaryHistory,
} from '@/lib/preliminary-schedule/selectors'
import type {
  PreliminaryRequestRow,
  PreliminaryCellMarkStatus,
  PreliminaryCellMarkType,
  PreliminaryCellMarkView,
  PreliminaryShiftRow,
  PreliminaryShiftStateRow,
  PreliminarySnapshotRow,
  PreliminaryTeamScheduleShift,
} from '@/lib/preliminary-schedule/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Preliminary Schedule',
  description: 'Review tentative shifts, claims, and change requests before publish.',
}

type PreliminarySearchParams = Record<string, string | string[] | undefined>

type PreliminaryProfileRow = {
  id: string
  role: string | null
  shift_type: 'day' | 'night' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  archived_at: string | null
}

type CycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
}

type ProfileNameRow = {
  id: string
  full_name: string | null
  shift_type?: 'day' | 'night' | null
}

type PreliminaryCellMarkRow = {
  id: string
  group_id: string | null
  requester_id: string
  mark_type: PreliminaryCellMarkType
  status: PreliminaryCellMarkStatus
  shift_id: string | null
  date: string
  shift_type: 'day' | 'night'
  note: string | null
  created_at: string
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
  if (value === 'preliminary_mark_saved') {
    return 'Your pencil mark was saved for manager review.'
  }
  if (value === 'preliminary_mark_cancelled') {
    return 'Your pencil mark was removed.'
  }
  if (value === 'preliminary_mark_reviewed') {
    return 'Preliminary pencil mark reviewed.'
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
  if (value === 'preliminary_mark_failed') {
    return 'Could not update the preliminary pencil mark. Please try again.'
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
  const highlightedShiftId = getSearchParam(params?.shift) ?? null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, shift_type, is_lead_eligible, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  const currentProfile = (profile ?? null) as PreliminaryProfileRow | null
  if (!currentProfile?.is_active || currentProfile.archived_at) {
    redirect('/login?error=account_inactive')
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
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center shadow-tw-sm">
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

  const [
    { data: cycleData },
    { data: shiftStatesData },
    { data: requestsData },
    { data: marksData },
  ] = await Promise.all([
    supabase
      .from('schedule_cycles')
      .select('id, label, start_date, end_date')
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
    supabase
      .from('preliminary_cell_marks')
      .select(
        'id, group_id, requester_id, mark_type, status, shift_id, date, shift_type, note, created_at'
      )
      .eq('snapshot_id', snapshot.id)
      .order('created_at', { ascending: false }),
  ])

  const shiftStates = (shiftStatesData ?? []) as PreliminaryShiftStateRow[]
  const cellMarks = (marksData ?? []) as PreliminaryCellMarkRow[]
  const shiftIds = Array.from(
    new Set(
      shiftStates
        .map((state) => state.shift_id)
        .concat(cellMarks.map((mark) => mark.shift_id).filter((id): id is string => Boolean(id)))
    )
  )
  const profileIds = Array.from(
    new Set(
      shiftStates
        .map((state) => state.reserved_by)
        .concat(
          ((requestsData ?? []) as PreliminaryRequestRow[]).map((request) => request.requester_id)
        )
        .concat(cellMarks.map((mark) => mark.requester_id))
        .filter((value): value is string => Boolean(value))
    )
  )

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

  const profileNamesById = new Map<string, string>()
  const profileShiftTypesById = new Map<string, 'day' | 'night' | null>()
  if (profileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, shift_type')
      .in('id', profileIds)

    for (const row of (profileRows ?? []) as ProfileNameRow[]) {
      profileNamesById.set(row.id, row.full_name ?? 'Unknown')
      profileShiftTypesById.set(row.id, row.shift_type ?? null)
    }
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
        reservedByName: state.reserved_by
          ? (profileNamesById.get(state.reserved_by) ?? null)
          : null,
        currentUserId: user.id,
        currentUserShiftType: currentProfile.shift_type ?? null,
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
        card.directAction != null ||
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

  const shiftStateByShiftId = new Map(shiftStates.map((state) => [state.shift_id, state]))
  const teamShifts: PreliminaryTeamScheduleShift[] = Array.from(shiftsById.values())
    .map((shift) => {
      const shiftState = shiftStateByShiftId.get(shift.id)
      return {
        shiftId: shift.id,
        shiftDate: shift.date,
        shiftType: shift.shift_type,
        shiftRole: shift.role,
        assignedName:
          shiftState?.state === 'pending_claim' && shiftState.reserved_by
            ? (profileNamesById.get(shiftState.reserved_by) ?? shift.full_name)
            : shift.full_name,
        state: shiftState?.state ?? (shift.user_id ? 'tentative_assignment' : 'open'),
        isCurrentUser: shift.user_id === user.id,
        pendingApproval: shiftState?.state === 'pending_claim',
      } satisfies PreliminaryTeamScheduleShift
    })
    .sort((left, right) => {
      if (left.shiftDate === right.shiftDate) {
        return left.shiftType.localeCompare(right.shiftType)
      }
      return left.shiftDate.localeCompare(right.shiftDate)
    })

  const markViews: PreliminaryCellMarkView[] = cellMarks
    .filter((mark) => mark.status === 'pending')
    .map((mark) => ({
      id: mark.id,
      groupId: mark.group_id,
      requesterId: mark.requester_id,
      requesterName: profileNamesById.get(mark.requester_id) ?? 'Unknown',
      markType: mark.mark_type,
      status: mark.status,
      shiftId: mark.shift_id,
      shiftDate: mark.date,
      shiftType: mark.shift_type,
      note: mark.note,
      createdAt: mark.created_at,
      isCurrentUser: mark.requester_id === user.id,
      canReview: currentProfile.role === 'manager',
      canCancel: mark.requester_id === user.id,
    }))
    .sort((left, right) => {
      if (left.shiftDate === right.shiftDate) {
        return left.shiftType.localeCompare(right.shiftType)
      }
      return left.shiftDate.localeCompare(right.shiftDate)
    })

  const history = toTherapistPreliminaryHistory(
    (requestsData ?? []) as PreliminaryRequestRow[],
    shiftsById,
    profileShiftTypesById
  )

  return (
    <PreliminaryScheduleView
      snapshotId={snapshot.id}
      cycleLabel={(cycleData as CycleRow | null)?.label ?? 'Preliminary schedule'}
      cycleStartDate={(cycleData as CycleRow | null)?.start_date ?? null}
      cycleEndDate={(cycleData as CycleRow | null)?.end_date ?? null}
      snapshotSentAt={snapshot.sent_at}
      currentUserId={user.id}
      currentUserRole={currentProfile.role ?? null}
      currentUserShiftType={currentProfile.shift_type ?? null}
      highlightedShiftId={highlightedShiftId}
      cards={cards}
      historyItems={history}
      teamShifts={teamShifts}
      claimAction={claimPreliminaryShiftAction}
      requestChangeAction={requestPreliminaryChangeAction}
      createCellMarkAction={createPreliminaryCellMarkAction}
      cancelCellMarkAction={cancelPreliminaryCellMarkAction}
      reviewCellMarkAction={reviewPreliminaryCellMarkAction}
      cancelAction={cancelPreliminaryRequestAction}
      successMessage={success}
      errorMessage={error}
      cellMarks={markViews}
    />
  )
}
