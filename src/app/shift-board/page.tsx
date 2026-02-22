import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
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

  if (!shiftId || !message || (type !== 'swap' && type !== 'pickup')) {
    redirect('/shift-board')
  }

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, user_id')
    .eq('id', shiftId)
    .maybeSingle()

  if (!shift) {
    redirect('/shift-board')
  }

  if (role !== 'manager' && shift.user_id !== user.id) {
    redirect('/shift-board')
  }

  const { error } = await supabase.from('shift_posts').insert({
    shift_id: shiftId,
    posted_by: user.id,
    message,
    type,
  })

  if (error) {
    console.error('Failed to create shift post:', error)
  }

  revalidatePath('/shift-board')
  redirect('/shift-board')
}

async function deleteShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user } = await getAuthContext()
  const postId = String(formData.get('post_id') ?? '').trim()

  if (!postId) {
    redirect('/shift-board')
  }

  const { error } = await supabase.from('shift_posts').delete().eq('id', postId).eq('posted_by', user.id)

  if (error) {
    console.error('Failed to delete shift post:', error)
  }

  revalidatePath('/shift-board')
  redirect('/shift-board')
}

async function claimShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user } = await getAuthContext()

  const postId = String(formData.get('post_id') ?? '').trim()
  const swapShiftId = String(formData.get('swap_shift_id') ?? '').trim() || null

  if (!postId) redirect('/shift-board')

  const { data: post } = await supabase
    .from('shift_posts')
    .select('id, posted_by, type, claimed_by, status')
    .eq('id', postId)
    .maybeSingle()

  // Only pending, unclaimed posts that the user didn't create can be claimed
  if (!post || post.status !== 'pending' || post.claimed_by || post.posted_by === user.id) {
    redirect('/shift-board')
  }

  // Swap claims require the claimer to nominate one of their own shifts
  if (post.type === 'swap') {
    if (!swapShiftId) redirect('/shift-board')
    const { data: swapShift } = await supabase
      .from('shifts')
      .select('id, user_id')
      .eq('id', swapShiftId)
      .maybeSingle()
    if (!swapShift || swapShift.user_id !== user.id) redirect('/shift-board')
  }

  const { error } = await supabase
    .from('shift_posts')
    .update({ claimed_by: user.id, swap_shift_id: swapShiftId })
    .eq('id', postId)

  if (error) console.error('Failed to claim shift post:', error)

  revalidatePath('/shift-board')
  redirect('/shift-board')
}

async function unclaimShiftPostAction(formData: FormData) {
  'use server'

  const { supabase, user } = await getAuthContext()
  const postId = String(formData.get('post_id') ?? '').trim()

  if (!postId) redirect('/shift-board')

  // Only the claimer can unclaim, and only while still pending
  const { data: post } = await supabase
    .from('shift_posts')
    .select('id, claimed_by, status')
    .eq('id', postId)
    .maybeSingle()

  if (!post || post.claimed_by !== user.id || post.status !== 'pending') {
    redirect('/shift-board')
  }

  const { error } = await supabase
    .from('shift_posts')
    .update({ claimed_by: null, swap_shift_id: null })
    .eq('id', postId)

  if (error) console.error('Failed to unclaim shift post:', error)

  revalidatePath('/shift-board')
  redirect('/shift-board')
}

async function updateShiftPostStatusAction(formData: FormData) {
  'use server'

  const { supabase, role } = await getAuthContext()

  if (role !== 'manager') {
    redirect('/shift-board')
  }

  const postId = String(formData.get('post_id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as PostStatus

  if (!postId || (status !== 'pending' && status !== 'approved' && status !== 'denied')) {
    redirect('/shift-board')
  }

  if (status === 'approved') {
    const { data: post } = await supabase
      .from('shift_posts')
      .select('shift_id, type, claimed_by, swap_shift_id')
      .eq('id', postId)
      .maybeSingle()

    if (post?.claimed_by) {
      if (post.type === 'pickup') {
        // Transfer the shift to the claimer
        const { error: transferError } = await supabase
          .from('shifts')
          .update({ user_id: post.claimed_by })
          .eq('id', post.shift_id)

        if (transferError) {
          console.error('Failed to transfer shift on pickup approval:', transferError)
          redirect('/shift-board')
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
          redirect('/shift-board')
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
          redirect('/shift-board')
        }
      }
    }
  }

  const { error } = await supabase.from('shift_posts').update({ status }).eq('id', postId)
  if (error) {
    console.error('Failed to update shift post status:', error)
  }

  revalidatePath('/shift-board')
  redirect('/shift-board')
}

export default async function ShiftBoardPage() {
  const { supabase, user, role } = await getAuthContext()

  const { data: shiftOptionsData } = await supabase
    .from('shifts')
    .select('id, date, shift_type, status, user_id, schedule_cycles(label, published)')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  const shiftOptions = (shiftOptionsData ?? []) as ShiftOption[]

  const { data: postsData } = await supabase
    .from('shift_posts')
    .select('id, shift_id, posted_by, message, type, status, created_at, claimed_by, swap_shift_id')
    .order('created_at', { ascending: false })

  const posts = (postsData ?? []) as ShiftPost[]

  const shiftIds = [...new Set(posts.map((post) => post.shift_id))]

  // Collect all profile IDs we need names for: posters + claimers
  const profileIds = [
    ...new Set([
      ...posts.map((post) => post.posted_by),
      ...posts.filter((p) => p.claimed_by).map((p) => p.claimed_by as string),
    ]),
  ]

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

  const profileNamesById = new Map<string, string>()
  if (profileIds.length > 0) {
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    for (const profile of profilesData ?? []) {
      profileNamesById.set(profile.id, profile.full_name)
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <TeamwiseLogo size="small" className="mb-2" />
            <h1 className="text-3xl font-bold text-foreground">Shift Board</h1>
            <p className="text-muted-foreground">
              {role === 'manager'
                ? 'Review and approve posted swap and pickup requests.'
                : 'Post swap or pickup requests for your shifts.'}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Post</CardTitle>
            <CardDescription>Choose one of your assigned shifts and post a request.</CardDescription>
          </CardHeader>
          <CardContent>
            {shiftOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible shifts found for your account yet. Ask a manager to assign shifts first.
              </p>
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
                  <Button type="submit">Post to Shift Board</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Posts</CardTitle>
            <CardDescription>
              {role === 'manager'
                ? 'Approve or deny requests from the team.'
                : 'Track active requests and your own submissions.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Posted By</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      No shift posts yet.
                    </TableCell>
                  </TableRow>
                )}

                {posts.map((post) => {
                  const shift = shiftDetailsById.get(post.shift_id)
                  const cycle = shift ? getOne(shift.schedule_cycles) : null
                  const offeredShift = post.swap_shift_id ? shiftDetailsById.get(post.swap_shift_id) : null
                  const submittedBy =
                    post.posted_by === user.id
                      ? 'You'
                      : profileNamesById.get(post.posted_by) ?? 'Another therapist'
                  const claimerName = post.claimed_by
                    ? post.claimed_by === user.id
                      ? 'You'
                      : (profileNamesById.get(post.claimed_by) ?? 'Another therapist')
                    : null
                  const isOwnPost = post.posted_by === user.id
                  const isClaimedByMe = post.claimed_by === user.id
                  const canClaim =
                    !isOwnPost && post.status === 'pending' && !post.claimed_by && role === 'therapist'

                  return (
                    <TableRow key={post.id}>
                      <TableCell>{shift ? formatDate(shift.date) : 'Unavailable'}</TableCell>
                      <TableCell>
                        {shift ? (
                          <>
                            <div className="capitalize">{shift.shift_type}</div>
                            <div className="text-xs text-muted-foreground">
                              {cycle ? cycle.label : 'No cycle'} - {shift.status}
                            </div>
                            {offeredShift && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Offered: {formatDate(offeredShift.date)} ({offeredShift.shift_type})
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Shift details unavailable</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{post.type}</TableCell>
                      <TableCell>{submittedBy}</TableCell>
                      <TableCell>{post.message}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            post.status === 'approved'
                              ? 'default'
                              : post.status === 'denied'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {post.status}
                        </Badge>
                        {claimerName && post.status === 'pending' && (
                          <div className="mt-1 text-xs text-muted-foreground">Claimed by {claimerName}</div>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(post.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {isOwnPost && post.status === 'pending' && (
                            <form action={deleteShiftPostAction}>
                              <input type="hidden" name="post_id" value={post.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Delete
                              </Button>
                            </form>
                          )}

                          {/* Therapist claim actions */}
                          {canClaim && post.type === 'pickup' && (
                            <form action={claimShiftPostAction}>
                              <input type="hidden" name="post_id" value={post.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Claim shift
                              </Button>
                            </form>
                          )}

                          {canClaim && post.type === 'swap' && shiftOptions.length > 0 && (
                            <form action={claimShiftPostAction} className="flex items-center gap-2">
                              <input type="hidden" name="post_id" value={post.id} />
                              <select
                                name="swap_shift_id"
                                required
                                className="h-8 rounded-md border border-border bg-white px-2 text-xs"
                              >
                                <option value="">My shift…</option>
                                {shiftOptions.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {formatDate(s.date)} ({s.shift_type})
                                  </option>
                                ))}
                              </select>
                              <Button type="submit" variant="outline" size="sm">
                                Offer swap
                              </Button>
                            </form>
                          )}

                          {isClaimedByMe && post.status === 'pending' && (
                            <form action={unclaimShiftPostAction}>
                              <input type="hidden" name="post_id" value={post.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Unclaim
                              </Button>
                            </form>
                          )}

                          {role === 'manager' && (
                            <>
                              {post.status !== 'approved' && (
                                <form action={updateShiftPostStatusAction}>
                                  <input type="hidden" name="post_id" value={post.id} />
                                  <input type="hidden" name="status" value="approved" />
                                  <Button type="submit" size="sm">
                                    Approve
                                  </Button>
                                </form>
                              )}
                              {post.status !== 'denied' && (
                                <form action={updateShiftPostStatusAction}>
                                  <input type="hidden" name="post_id" value={post.id} />
                                  <input type="hidden" name="status" value="denied" />
                                  <Button type="submit" variant="destructive" size="sm">
                                    Deny
                                  </Button>
                                </form>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
