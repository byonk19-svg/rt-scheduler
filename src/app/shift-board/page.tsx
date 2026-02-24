import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { StaffShiftPostComposer } from '@/app/shift-board/staff-shift-post-composer'
import { ShiftPostsTable, type ShiftPostTableRow } from '@/app/shift-board/shift-posts-table'
import { AttentionBar } from '@/components/AttentionBar'
import { EmptyState } from '@/components/EmptyState'
import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { notifyUsers } from '@/lib/notifications'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'

type Role = 'manager' | 'therapist'
type PostType = 'swap' | 'pickup'
type PostStatus = 'pending' | 'approved' | 'denied'

type ShiftOption = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  user_id: string
  schedule_cycles:
    | { label: string; published: boolean }
    | { label: string; published: boolean }[]
    | null
}

type ShiftPost = {
  id: string
  shift_id: string
  posted_by: string
  message: string
  type: PostType
  status: PostStatus
  created_at: string
  claimed_by: string | null
  swap_shift_id: string | null
}

type ShiftDetails = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  user_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; published: boolean }
    | { label: string; published: boolean }[]
    | null
}

type ShiftBoardSearchParams = {
  success?: string | string[]
  error?: string | string[]
  published_only?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function buildShiftBoardUrl(params?: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
  }
  const query = search.toString()
  return query ? `/shift-board?${query}` : '/shift-board'
}

function getShiftBoardFeedback(params?: ShiftBoardSearchParams): {
  message: string
  variant: 'success' | 'error'
} | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'post_created') return { message: 'Shift post created.', variant: 'success' }
  if (success === 'post_deleted') return { message: 'Shift post deleted.', variant: 'success' }
  if (success === 'post_claimed') return { message: 'Shift claim submitted.', variant: 'success' }
  if (success === 'post_unclaimed') return { message: 'Shift claim removed.', variant: 'success' }
  if (success === 'post_status_updated') return { message: 'Shift post status updated.', variant: 'success' }

  if (error === 'post_invalid') return { message: 'Please complete all required shift post fields.', variant: 'error' }
  if (error === 'post_create_failed') return { message: 'Could not create shift post.', variant: 'error' }
  if (error === 'post_delete_failed') return { message: 'Could not delete shift post.', variant: 'error' }
  if (error === 'post_claim_failed') return { message: 'Could not claim this shift post.', variant: 'error' }
  if (error === 'post_unclaim_failed') return { message: 'Could not unclaim this shift post.', variant: 'error' }
  if (error === 'post_update_failed') return { message: 'Could not update shift post status.', variant: 'error' }

  return null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'

  return { supabase, user, role }
}

async function createShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user, role } = await getAuthContext()

  const shiftId = String(formData.get('shift_id') ?? '').trim()
  const type = String(formData.get('type') ?? '').trim() as PostType
  const message = String(formData.get('message') ?? '').trim()

  if (!shiftId || (type !== 'swap' && type !== 'pickup')) {
    redirect(buildShiftBoardUrl({ error: 'post_invalid' }))
  }
  const finalMessage =
    message || (type === 'swap' ? 'Requesting a swap for this shift.' : 'Requesting pickup coverage for this shift.')

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, user_id')
    .eq('id', shiftId)
    .maybeSingle()

  if (!shift) {
    redirect(buildShiftBoardUrl({ error: 'post_create_failed' }))
  }

  if (role !== 'manager' && shift.user_id !== user.id) {
    redirect(buildShiftBoardUrl({ error: 'post_create_failed' }))
  }

  const { error } = await supabase.from('shift_posts').insert({
    shift_id: shiftId,
    posted_by: user.id,
    message: finalMessage,
    type,
  })

  if (error) {
    console.error('Failed to create shift post:', error)
    redirect(buildShiftBoardUrl({ error: 'post_create_failed' }))
  }

  revalidatePath('/shift-board')
  redirect(buildShiftBoardUrl({ success: 'post_created' }))
}

async function deleteShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user } = await getAuthContext()
  const postId = String(formData.get('post_id') ?? '').trim()

  if (!postId) {
    redirect(buildShiftBoardUrl({ error: 'post_delete_failed' }))
  }

  const { error } = await supabase.from('shift_posts').delete().eq('id', postId).eq('posted_by', user.id)

  if (error) {
    console.error('Failed to delete shift post:', error)
    redirect(buildShiftBoardUrl({ error: 'post_delete_failed' }))
  }

  revalidatePath('/shift-board')
  redirect(buildShiftBoardUrl({ success: 'post_deleted' }))
}

async function claimShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user } = await getAuthContext()

  const postId = String(formData.get('post_id') ?? '').trim()
  const swapShiftId = String(formData.get('swap_shift_id') ?? '').trim() || null

  if (!postId) redirect(buildShiftBoardUrl({ error: 'post_claim_failed' }))

  const { data: post } = await supabase
    .from('shift_posts')
    .select('id, posted_by, type, claimed_by, status')
    .eq('id', postId)
    .maybeSingle()

  // Only pending, unclaimed posts that the user didn't create can be claimed
  if (!post || post.status !== 'pending' || post.claimed_by || post.posted_by === user.id) {
    redirect(buildShiftBoardUrl({ error: 'post_claim_failed' }))
  }

  // Swap claims require the claimer to nominate one of their own shifts
  if (post.type === 'swap') {
    if (!swapShiftId) redirect(buildShiftBoardUrl({ error: 'post_claim_failed' }))
    const { data: swapShift } = await supabase
      .from('shifts')
      .select('id, user_id')
      .eq('id', swapShiftId)
      .maybeSingle()
    if (!swapShift || swapShift.user_id !== user.id) redirect(buildShiftBoardUrl({ error: 'post_claim_failed' }))
  }

  const { error } = await supabase
    .from('shift_posts')
    .update({ claimed_by: user.id, swap_shift_id: swapShiftId })
    .eq('id', postId)

  if (error) {
    console.error('Failed to claim shift post:', error)
    redirect(buildShiftBoardUrl({ error: 'post_claim_failed' }))
  }

  revalidatePath('/shift-board')
  redirect(buildShiftBoardUrl({ success: 'post_claimed' }))
}

async function unclaimShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user } = await getAuthContext()
  const postId = String(formData.get('post_id') ?? '').trim()

  if (!postId) redirect(buildShiftBoardUrl({ error: 'post_unclaim_failed' }))

  // Only the claimer can unclaim, and only while still pending
  const { data: post } = await supabase
    .from('shift_posts')
    .select('id, claimed_by, status')
    .eq('id', postId)
    .maybeSingle()

  if (!post || post.claimed_by !== user.id || post.status !== 'pending') {
    redirect(buildShiftBoardUrl({ error: 'post_unclaim_failed' }))
  }

  const { error } = await supabase
    .from('shift_posts')
    .update({ claimed_by: null, swap_shift_id: null })
    .eq('id', postId)

  if (error) {
    console.error('Failed to unclaim shift post:', error)
    redirect(buildShiftBoardUrl({ error: 'post_unclaim_failed' }))
  }

  revalidatePath('/shift-board')
  redirect(buildShiftBoardUrl({ success: 'post_unclaimed' }))
}

async function updateShiftPostStatusAction(formData: FormData) {
  'use server'

  const { supabase, role } = await getAuthContext()

  if (role !== 'manager') {
    redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
  }

  const postId = String(formData.get('post_id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as PostStatus

  if (!postId || (status !== 'pending' && status !== 'approved' && status !== 'denied')) {
    redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
  }

  const { data: post } = await supabase
    .from('shift_posts')
    .select('id, shift_id, posted_by, type, claimed_by, swap_shift_id')
    .eq('id', postId)
    .maybeSingle()

  if (!post) {
    redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
  }

  if (status === 'approved') {
    if (post?.claimed_by) {
      if (post.type === 'pickup') {
        // Transfer the shift to the claimer
        const { error: transferError } = await supabase
          .from('shifts')
          .update({ user_id: post.claimed_by })
          .eq('id', post.shift_id)

        if (transferError) {
          console.error('Failed to transfer shift on pickup approval:', transferError)
          redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
        }
      } else if (post.type === 'swap' && post.swap_shift_id) {
        // Fetch both shifts to get current owners
        const { data: originalShift } = await supabase
          .from('shifts')
          .select('id, user_id')
          .eq('id', post.shift_id)
          .maybeSingle()

        const { data: offeredShift } = await supabase
          .from('shifts')
          .select('id, user_id')
          .eq('id', post.swap_shift_id)
          .maybeSingle()

        if (!originalShift || !offeredShift) {
          console.error('Could not load shifts for swap approval')
          redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
        }

        // Swap user_ids on both shifts
        const { error: e1 } = await supabase
          .from('shifts')
          .update({ user_id: offeredShift.user_id })
          .eq('id', post.shift_id)

        const { error: e2 } = await supabase
          .from('shifts')
          .update({ user_id: originalShift.user_id })
          .eq('id', post.swap_shift_id)

        if (e1 || e2) {
          console.error('Failed to swap shifts on approval:', e1 ?? e2)
          redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
        }
      }
    }
  }

  const { error } = await supabase.from('shift_posts').update({ status }).eq('id', postId)
  if (error) {
    console.error('Failed to update shift post status:', error)
    redirect(buildShiftBoardUrl({ error: 'post_update_failed' }))
  }

  const notificationTitle = status === 'approved' ? 'Shift request approved' : 'Shift request denied'
  const notificationMessage = status === 'approved'
    ? 'Your shift board request was approved by a manager.'
    : 'Your shift board request was denied by a manager.'

  await notifyUsers(supabase, {
    userIds: [post.posted_by, post.claimed_by ?? ''].filter(Boolean),
    eventType: status === 'approved' ? 'shift_request_approved' : 'shift_request_denied',
    title: notificationTitle,
    message: notificationMessage,
    targetType: 'shift_post',
    targetId: postId,
  })

  revalidatePath('/shift-board')
  redirect(buildShiftBoardUrl({ success: 'post_status_updated' }))
}

export default async function ShiftBoardPage({
  searchParams,
}: {
  searchParams?: Promise<ShiftBoardSearchParams>
}) {
  const { supabase, user, role } = await getAuthContext()
  const params = searchParams ? await searchParams : undefined
  const feedback = getShiftBoardFeedback(params)
  const publishedOnly = getSearchParam(params?.published_only) === 'true'
  const managerAttention = role === 'manager' ? await getManagerAttentionSnapshot(supabase) : null
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  let shiftOptionsQuery = supabase
    .from('shifts')
    .select('id, date, shift_type, status, user_id, schedule_cycles(label, published)')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  if (role === 'therapist') {
    shiftOptionsQuery = shiftOptionsQuery
      .gte('date', todayKey)
      .in('status', ['scheduled', 'on_call'])
  }

  const { data: shiftOptionsData } = await shiftOptionsQuery

  const shiftOptions = (shiftOptionsData ?? []) as ShiftOption[]

  const { data: postsData } = await supabase
    .from('shift_posts')
    .select('id, shift_id, posted_by, message, type, status, created_at, claimed_by, swap_shift_id')
    .order('created_at', { ascending: false })

  const posts = (postsData ?? []) as ShiftPost[]

  const shiftIds = [...new Set(posts.map((post) => post.shift_id))]

  // Collect swap shift IDs for display
  const swapShiftIds = [...new Set(posts.filter((p) => p.swap_shift_id).map((p) => p.swap_shift_id as string))]

  const shiftDetailsById = new Map<string, ShiftDetails>()
  const allShiftIds = [...new Set([...shiftIds, ...swapShiftIds])]
  if (allShiftIds.length > 0) {
    const { data: shiftDetailsData } = await supabase
      .from('shifts')
      .select('id, date, shift_type, status, user_id, profiles(full_name), schedule_cycles(label, published)')
      .in('id', allShiftIds)

    for (const shift of (shiftDetailsData ?? []) as ShiftDetails[]) {
      shiftDetailsById.set(shift.id, shift)
    }
  }

  const visiblePosts = publishedOnly
    ? posts.filter((post) => {
        const shift = shiftDetailsById.get(post.shift_id)
        const cycle = shift ? getOne(shift.schedule_cycles) : null
        return Boolean(cycle?.published)
      })
    : posts

  const profileNamesById = new Map<string, string>()
  const visibleProfileIds = [
    ...new Set([
      ...visiblePosts.map((post) => post.posted_by),
      ...visiblePosts.filter((p) => p.claimed_by).map((p) => p.claimed_by as string),
    ]),
  ]
  if (visibleProfileIds.length > 0) {
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name').in('id', visibleProfileIds)
    for (const profile of profilesData ?? []) {
      profileNamesById.set(profile.id, profile.full_name)
    }
  }
  const shiftOptionsForClaims = shiftOptions.map((shift) => ({
    id: shift.id,
    label: `${formatDate(shift.date)} (${shift.shift_type})`,
  }))
  const staffPostShifts = shiftOptions.map((shift) => {
    const cycle = getOne(shift.schedule_cycles)
    return {
      id: shift.id,
      date: shift.date,
      shiftType: shift.shift_type,
      status: shift.status,
      cycleLabel: cycle ? cycle.label : 'No cycle',
    } as const
  })
  const postRows: ShiftPostTableRow[] = visiblePosts.map((post) => {
    const shift = shiftDetailsById.get(post.shift_id)
    const cycle = shift ? getOne(shift.schedule_cycles) : null
    const offeredShift = post.swap_shift_id ? shiftDetailsById.get(post.swap_shift_id) : null
    const postedBy =
      post.posted_by === user.id ? 'You' : profileNamesById.get(post.posted_by) ?? 'Another therapist'
    const claimerName = post.claimed_by
      ? post.claimed_by === user.id
        ? 'You'
        : (profileNamesById.get(post.claimed_by) ?? 'Another therapist')
      : null
    const isOwnPost = post.posted_by === user.id
    const isClaimedByMe = post.claimed_by === user.id
    const canClaim = !isOwnPost && post.status === 'pending' && !post.claimed_by && role === 'therapist'

    return {
      id: post.id,
      hasShiftDetails: Boolean(shift),
      shiftDate: shift?.date ?? '',
      shiftType: shift?.shift_type ?? 'day',
      shiftStatus: shift?.status ?? 'scheduled',
      cycleLabel: cycle ? cycle.label : 'No cycle',
      offeredShiftLabel: offeredShift ? `${formatDate(offeredShift.date)} (${offeredShift.shift_type})` : null,
      type: post.type,
      postedBy,
      message: post.message,
      status: post.status,
      createdAt: post.created_at,
      claimerName,
      isOwnPost,
      isClaimedByMe,
      canClaim,
    }
  })
  const createPostCard =
    role === 'manager' ? (
      <Card id="create-post">
        <CardHeader>
          <CardTitle>Create Post</CardTitle>
          <CardDescription>Choose one of your assigned shifts and post a request.</CardDescription>
        </CardHeader>
        <CardContent>
          {shiftOptions.length === 0 ? (
            <EmptyState
              title="No shifts available to post yet"
              description="Ask your manager to assign shifts, or view your schedule."
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/schedule">View my schedule</Link>
                </Button>
              }
            />
          ) : (
            <form action={createShiftPostAction} className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shift_id">Shift</Label>
                <select
                  id="shift_id"
                  name="shift_id"
                  className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Select shift
                  </option>
                  {shiftOptions.map((shift) => {
                    const cycle = getOne(shift.schedule_cycles)
                    return (
                      <option key={shift.id} value={shift.id}>
                        {formatDate(shift.date)} - {shift.shift_type} - {shift.status}
                        {cycle ? ` (${cycle.label}${cycle.published ? '' : ', draft'})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Request Type</Label>
                <select
                  id="type"
                  name="type"
                  className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                  defaultValue="swap"
                >
                  <option value="swap">Swap</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  required
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  placeholder="Example: Need coverage for family event."
                />
              </div>
              <div className="md:col-span-3">
                <FormSubmitButton type="submit" pendingText="Posting...">Post to Shift Board</FormSubmitButton>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    ) : (
      <StaffShiftPostComposer
        shifts={staffPostShifts}
        createShiftPostAction={createShiftPostAction}
      />
    )
  const openPostsCard = (
    <ShiftPostsTable
      role={role}
      rows={postRows}
      shiftOptions={shiftOptionsForClaims}
      deleteShiftPostAction={deleteShiftPostAction}
      claimShiftPostAction={claimShiftPostAction}
      unclaimShiftPostAction={unclaimShiftPostAction}
      updateShiftPostStatusAction={updateShiftPostStatusAction}
    />
  )

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div>
        <h1 className="app-page-title">Shift Board</h1>
        <p className="text-muted-foreground">
          {role === 'manager'
            ? 'Review and approve posted swap and pickup requests.'
            : 'Post swap or pickup requests for your shifts.'}
        </p>
        {feedback?.variant === 'error' && (
          <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
            {feedback.message}
          </p>
        )}
      </div>

      {role === 'manager' && managerAttention && (
        <AttentionBar snapshot={managerAttention} variant="compact" context="shiftboard" />
      )}

      <div className="flex items-center gap-2">
        {role === 'manager' ? (
          <Button asChild>
            <a href="#open-posts">Approve Requests</a>
          </Button>
        ) : (
          <Button asChild>
            <a href="#create-post">Create Post</a>
          </Button>
        )}

        <MoreActionsMenu>
          {role === 'manager' ? (
            <a href="#create-post" className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary">
              Create Post
            </a>
          ) : (
            <a href="#open-posts" className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary">
              Review Open Posts
            </a>
          )}
        </MoreActionsMenu>
      </div>

      {role === 'manager' ? (
        <>
          {openPostsCard}
          <details className="rounded-md border border-border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
              Staff tools
            </summary>
            <div className="border-t border-border p-4">{createPostCard}</div>
          </details>
        </>
      ) : (
        <>
          {createPostCard}
          {openPostsCard}
        </>
      )}
    </div>
  )
}
