import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

import {
  approvePreliminaryRequestAction,
  denyPreliminaryRequestAction,
} from '@/app/approvals/actions'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { toManagerPreliminaryQueue } from '@/lib/preliminary-schedule/selectors'
import type { PreliminaryRequestRow, PreliminaryShiftRow } from '@/lib/preliminary-schedule/types'
import { createClient } from '@/lib/supabase/server'

type ApprovalsSearchParams = Record<string, string | string[] | undefined>

type ProfileNameRow = {
  id: string
  full_name: string | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatShiftLabel(date: string, shiftType: 'day' | 'night') {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return `${date} - ${shiftType === 'day' ? 'Day' : 'Night'}`
  }

  return (
    parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) + ` - ${shiftType === 'day' ? 'Day' : 'Night'}`
  )
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<ApprovalsSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

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

  if (!can(parseRole(profile?.role), 'manage_schedule')) {
    redirect('/dashboard')
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from('preliminary_requests')
    .select(
      'id, snapshot_id, shift_id, requester_id, type, status, note, decision_note, approved_by, approved_at, created_at'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (requestsError) {
    return (
      <div className="space-y-4">
        <ManagerWorkspaceHeader
          title="Preliminary approvals"
          subtitle="Review live claims and schedule change requests before final publish."
          summary={
            <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 font-medium text-foreground">
              Unable to load queue
            </span>
          }
        />
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          Could not load preliminary approvals. Please refresh.
        </div>
      </div>
    )
  }

  const requests = (requestsData ?? []) as PreliminaryRequestRow[]
  const shiftIds = Array.from(new Set(requests.map((request) => request.shift_id)))
  const requesterIds = Array.from(new Set(requests.map((request) => request.requester_id)))

  const [{ data: shiftsData }, { data: requesterProfilesData }] = await Promise.all([
    shiftIds.length
      ? supabase
          .from('shifts')
          .select(
            'id, cycle_id, user_id, date, shift_type, status, role, profiles:profiles!shifts_user_id_fkey(full_name)'
          )
          .in('id', shiftIds)
      : Promise.resolve({ data: [] }),
    requesterIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', requesterIds)
      : Promise.resolve({ data: [] }),
  ])

  const shiftsById = new Map(
    (
      (shiftsData ?? []) as Array<
        PreliminaryShiftRow & {
          profiles: { full_name: string | null } | { full_name: string | null }[] | null
        }
      >
    ).map((shift) => [
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

  const requesterNames = new Map(
    ((requesterProfilesData ?? []) as ProfileNameRow[]).map((row) => [
      row.id,
      row.full_name ?? 'Unknown',
    ])
  )

  const queue = toManagerPreliminaryQueue(
    requests.map((request) => ({
      ...request,
      requester_name: requesterNames.get(request.requester_id) ?? 'Unknown',
    })),
    shiftsById
  )

  return (
    <div className="space-y-6">
      <ManagerWorkspaceHeader
        title="Preliminary approvals"
        subtitle="Review live claims and schedule change requests before final publish."
        summary={
          <>
            <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 font-medium text-foreground">
              {queue.length} pending
            </span>
            {success === 'preliminary_request_approved' && (
              <>
                <span className="text-border/90">/</span>
                <span className="text-[var(--success-text)]">Request approved</span>
              </>
            )}
            {success === 'preliminary_request_denied' && (
              <>
                <span className="text-border/90">/</span>
                <span className="text-[var(--warning-text)]">Request denied</span>
              </>
            )}
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/coverage?view=week">
              <CalendarDays className="h-3.5 w-3.5" />
              Back to schedule
            </Link>
          </Button>
        }
      />

      {error === 'preliminary_review_failed' && (
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          Could not review that preliminary request. Please try again.
        </div>
      )}

      {queue.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-background/70 px-6 py-14 text-center shadow-none">
          <p className="text-sm font-semibold text-foreground">No pending preliminary requests</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Claims and change requests will appear here while the preliminary schedule is live.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 px-6 pb-6">
          {queue.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border border-border/70 bg-card/85 px-4 py-4 shadow-none"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{request.requesterName}</p>
                    <StatusBadge variant="warning" dot={false} className="text-[10px]">
                      {request.requestType === 'claim_open_shift'
                        ? 'Claim open shift'
                        : 'Request change'}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatShiftLabel(request.shiftDate, request.shiftType)}
                  </p>
                  {request.note && (
                    <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-sm text-foreground">
                      {request.note}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <form action={approvePreliminaryRequestAction}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <Button type="submit" size="sm" className="text-xs">
                      Approve
                    </Button>
                  </form>
                  <form action={denyPreliminaryRequestAction}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <Button type="submit" size="sm" variant="outline" className="text-xs">
                      Deny
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
