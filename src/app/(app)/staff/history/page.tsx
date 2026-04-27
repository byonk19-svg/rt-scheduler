import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { getOne } from '@/lib/csv-utils'
import { getPickupInterestTherapistCopy } from '@/lib/pickup-interest-presentation'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 25

type HistorySearchParams = {
  page?: string | string[]
}

type ShiftPostHistoryRow = {
  id: string
  status: string
  visibility: 'team' | 'direct' | null
  recipient_response: 'pending' | 'accepted' | 'declined' | null
  request_kind: 'standard' | 'call_in' | null
  message: string
  created_at: string
  shift_id: string | null
  posted_by: string | null
  claimed_by: string | null
  shifts: { date: string; shift_type: string } | { date: string; shift_type: string }[] | null
  poster: { full_name: string | null } | { full_name: string | null }[] | null
  claimer: { full_name: string | null } | { full_name: string | null }[] | null
}

type ShiftPostInterestRow = {
  id: string
  shift_post_id: string
  therapist_id: string
  status: 'pending' | 'selected' | 'declined' | 'withdrawn'
  created_at: string
}

type ProfileNameRow = {
  id: string
  full_name: string | null
}

type HistoryItem = {
  id: string
  created_at: string
  shiftDate: string | null
  shiftType: string | null
  roleLabel:
    | 'Posted'
    | 'Received'
    | 'Claimed'
    | 'Interested'
    | 'Primary claimant'
    | 'Backup interest'
  partnerName: string | null
  status: string
  visibilityLabel: 'Direct' | 'Team'
  requestKind: 'standard' | 'call_in'
  recipientResponse: 'pending' | 'accepted' | 'declined' | null
  message: string
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function statusChipMeta(status: string): {
  label: string
  color: string
  bg: string
  border: string
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: 'var(--warning-text)',
        bg: 'var(--warning-subtle)',
        border: 'var(--warning-border)',
      }
    case 'approved':
      return {
        label: 'Approved',
        color: 'var(--success-text)',
        bg: 'var(--success-subtle)',
        border: 'var(--success-border)',
      }
    case 'denied':
      return {
        label: 'Denied',
        color: 'var(--error-text)',
        bg: 'var(--error-subtle)',
        border: 'var(--error-border)',
      }
    case 'selected':
      return {
        label: 'Selected',
        color: 'var(--success-text)',
        bg: 'var(--success-subtle)',
        border: 'var(--success-border)',
      }
    case 'withdrawn':
      return {
        label: 'Withdrawn',
        color: 'var(--muted-foreground)',
        bg: 'var(--muted)',
        border: 'var(--border)',
      }
    case 'expired':
      return {
        label: 'Expired',
        color: 'var(--muted-foreground)',
        bg: 'var(--muted)',
        border: 'var(--border)',
      }
    default:
      return {
        label: status,
        color: 'var(--muted-foreground)',
        bg: 'var(--muted)',
        border: 'var(--border)',
      }
  }
}

function formatDisplayDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function historyHref(page: number): string {
  if (page <= 0) return '/staff/history'
  return `/staff/history?page=${page}`
}

export default async function StaffSwapHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<HistorySearchParams>
}) {
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

  if (can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  const params = searchParams ? await searchParams : undefined
  const pageRaw = getSearchParam(params?.page)
  const parsed = parseInt(pageRaw ?? '0', 10)
  const page = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0

  const filter = `posted_by.eq.${user.id},claimed_by.eq.${user.id}`

  const [
    { data: postRowsData, error: postRowsError },
    { data: interestRowsData, error: interestRowsError },
  ] = await Promise.all([
    supabase
      .from('shift_posts')
      .select(
        'id, status, visibility, recipient_response, request_kind, message, created_at, shift_id, posted_by, claimed_by, shifts!shift_posts_shift_id_fkey(date, shift_type), poster:profiles!shift_posts_posted_by_fkey(full_name), claimer:profiles!shift_posts_claimed_by_fkey(full_name)'
      )
      .or(filter)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('shift_post_interests')
      .select('id, shift_post_id, therapist_id, status, created_at')
      .eq('therapist_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ])

  if (postRowsError) {
    console.error('Failed to load shift post history:', postRowsError)
  }
  if (interestRowsError) {
    console.error('Failed to load shift post interests for history:', interestRowsError)
  }

  const postRows = (postRowsData ?? []) as ShiftPostHistoryRow[]
  const interestRows = (interestRowsData ?? []) as ShiftPostInterestRow[]
  const visiblePostIds = new Set(postRows.map((row) => row.id))
  const interestOnlyPostIds = Array.from(
    new Set(
      interestRows
        .map((row) => row.shift_post_id)
        .filter((shiftPostId) => !visiblePostIds.has(shiftPostId))
    )
  )

  let interestPostRows: ShiftPostHistoryRow[] = []
  if (interestOnlyPostIds.length > 0) {
    const { data: interestPostsData, error: interestPostsError } = await supabase
      .from('shift_posts')
      .select(
        'id, status, visibility, recipient_response, request_kind, message, created_at, shift_id, posted_by, claimed_by, shifts!shift_posts_shift_id_fkey(date, shift_type), poster:profiles!shift_posts_posted_by_fkey(full_name), claimer:profiles!shift_posts_claimed_by_fkey(full_name)'
      )
      .in('id', interestOnlyPostIds)

    if (interestPostsError) {
      console.error('Failed to load history rows for pickup interests:', interestPostsError)
    } else {
      interestPostRows = (interestPostsData ?? []) as ShiftPostHistoryRow[]
    }
  }

  const allPostRows = [...postRows, ...interestPostRows]
  const postById = new Map(allPostRows.map((row) => [row.id, row]))

  const extraProfileIds = Array.from(
    new Set(
      interestPostRows
        .map((row) => row.posted_by)
        .filter((value): value is string => Boolean(value))
    )
  )

  const postedByNames = new Map<string, string>()
  if (extraProfileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', extraProfileIds)

    for (const row of (profileRows ?? []) as ProfileNameRow[]) {
      postedByNames.set(row.id, row.full_name ?? 'Unknown')
    }
  }

  const historyItems: HistoryItem[] = [
    ...postRows.map<HistoryItem>((row) => {
      const shift = getOne(row.shifts)
      const poster = getOne(row.poster)
      const claimer = getOne(row.claimer)
      const iPosted = row.posted_by === user.id
      const roleLabel: HistoryItem['roleLabel'] = iPosted
        ? 'Posted'
        : row.visibility === 'direct'
          ? 'Received'
          : 'Claimed'
      const visibilityLabel: HistoryItem['visibilityLabel'] =
        row.visibility === 'direct' ? 'Direct' : 'Team'

      return {
        id: row.id,
        created_at: row.created_at,
        shiftDate: shift?.date ?? null,
        shiftType: shift?.shift_type ?? null,
        roleLabel,
        partnerName: iPosted ? (claimer?.full_name ?? null) : (poster?.full_name ?? null),
        status: row.status,
        visibilityLabel,
        requestKind: row.request_kind ?? 'standard',
        recipientResponse: row.recipient_response ?? null,
        message: row.message ?? '',
      }
    }),
    ...interestRows
      .filter((row) => !visiblePostIds.has(row.shift_post_id))
      .map<HistoryItem>((row) => {
        const post = postById.get(row.shift_post_id) ?? null
        const shift = getOne(post?.shifts) as { date: string; shift_type: string } | null
        const pickupInterestCopy =
          row.status === 'selected' || row.status === 'pending'
            ? getPickupInterestTherapistCopy(row.status)
            : null
        const visibilityLabel: HistoryItem['visibilityLabel'] =
          post?.visibility === 'direct' ? 'Direct' : 'Team'

        return {
          id: row.id,
          created_at: row.created_at,
          shiftDate: shift?.date ?? null,
          shiftType: shift?.shift_type ?? null,
          roleLabel: pickupInterestCopy?.roleLabel ?? 'Interested',
          partnerName: post?.posted_by ? (postedByNames.get(post.posted_by) ?? null) : null,
          status:
            row.status === 'selected'
              ? 'selected'
              : row.status === 'withdrawn'
                ? 'withdrawn'
                : row.status === 'declined'
                  ? 'denied'
                  : 'pending',
          visibilityLabel,
          requestKind: post?.request_kind ?? 'standard',
          recipientResponse: post?.recipient_response ?? null,
          message: post?.message ?? 'Pickup interest submitted.',
        }
      }),
  ].sort((left, right) => {
    const createdAtComparison = right.created_at.localeCompare(left.created_at)
    if (createdAtComparison !== 0) {
      return createdAtComparison
    }

    return right.id.localeCompare(left.id)
  })

  const total = historyItems.length
  const rows = historyItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const hasPrev = page > 0
  const hasNext = (page + 1) * PAGE_SIZE < total

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="rounded-2xl border border-border/70 bg-card px-6 pb-4 pt-5 shadow-tw-float">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Shift Swaps & Pickups History
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Posts you created, direct requests, claims, and pickup interests, newest first.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/therapist/swaps">Back to Shift Swaps & Pickups</Link>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/70 bg-card px-6 py-10 text-center shadow-tw-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No history yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            When you post, claim, or express pickup interest, it will show up here.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-2 text-xs">
            <Link href="/therapist/swaps">Go to Shift Swaps & Pickups</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-tw-sm">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">My role</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const st = row.shiftType ?? ''
                  const chip = statusChipMeta(row.status)
                  const snippet =
                    row.message.length > 60 ? `${row.message.slice(0, 60)}…` : row.message

                  return (
                    <tr key={row.id} className="hover:bg-secondary/15">
                      <td className="whitespace-nowrap px-4 py-2.5 text-foreground">
                        {row.shiftDate ? formatDisplayDate(row.shiftDate) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {st === 'day' || st === 'night' ? (
                          <span
                            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              borderColor:
                                st === 'day' ? 'var(--info-border)' : 'var(--warning-border)',
                              backgroundColor:
                                st === 'day' ? 'var(--info-subtle)' : 'var(--warning-subtle)',
                              color: st === 'day' ? 'var(--info-text)' : 'var(--warning-text)',
                            }}
                          >
                            {st}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{row.roleLabel}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.partnerName ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              borderColor: chip.border,
                              backgroundColor: chip.bg,
                              color: chip.color,
                            }}
                          >
                            {chip.label}
                          </span>
                          <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {row.visibilityLabel}
                          </span>
                          {row.requestKind === 'call_in' ? (
                            <span className="inline-flex rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warning-text)]">
                              Call-in help
                            </span>
                          ) : null}
                          {row.visibilityLabel === 'Direct' && row.recipientResponse ? (
                            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              {row.recipientResponse}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[14rem] px-4 py-2.5 text-muted-foreground">
                        {snippet || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total > 0 ? (
                <>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{' '}
                  {total}
                </>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href={historyHref(page - 1)}>Previous</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-xs" disabled>
                  Previous
                </Button>
              )}
              {hasNext ? (
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href={historyHref(page + 1)}>Next</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-xs" disabled>
                  Next
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
