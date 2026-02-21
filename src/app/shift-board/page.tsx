import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    .select('id, shift_id, posted_by, message, type, status, created_at')
    .order('created_at', { ascending: false })

  const posts = (postsData ?? []) as ShiftPost[]

  const shiftIds = [...new Set(posts.map((post) => post.shift_id))]
  const posterIds = [...new Set(posts.map((post) => post.posted_by))]

  const shiftDetailsById = new Map<string, ShiftDetails>()
  if (shiftIds.length > 0) {
    const { data: shiftDetailsData } = await supabase
      .from('shifts')
      .select('id, date, shift_type, status, user_id, profiles(full_name), schedule_cycles(label, published)')
      .in('id', shiftIds)

    for (const shift of (shiftDetailsData ?? []) as ShiftDetails[]) {
      shiftDetailsById.set(shift.id, shift)
    }
  }

  const posterNamesById = new Map<string, string>()
  if (posterIds.length > 0) {
    const { data: postersData } = await supabase.from('profiles').select('id, full_name').in('id', posterIds)
    for (const profile of postersData ?? []) {
      posterNamesById.set(profile.id, profile.full_name)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Shift Board</h1>
            <p className="text-slate-500">
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
              <p className="text-sm text-slate-500">
                No eligible shifts found for your account yet. Ask a manager to assign shifts first.
              </p>
            ) : (
              <form action={createShiftPostAction} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="shift_id">Shift</Label>
                  <select
                    id="shift_id"
                    name="shift_id"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
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
                    <TableCell colSpan={8} className="py-6 text-center text-slate-500">
                      No shift posts yet.
                    </TableCell>
                  </TableRow>
                )}

                {posts.map((post) => {
                  const shift = shiftDetailsById.get(post.shift_id)
                  const cycle = shift ? getOne(shift.schedule_cycles) : null
                  const submittedBy =
                    post.posted_by === user.id
                      ? 'You'
                      : posterNamesById.get(post.posted_by) ?? 'Another therapist'
                  const isOwnPost = post.posted_by === user.id

                  return (
                    <TableRow key={post.id}>
                      <TableCell>{shift ? formatDate(shift.date) : 'Unavailable'}</TableCell>
                      <TableCell>
                        {shift ? (
                          <>
                            <div className="capitalize">{shift.shift_type}</div>
                            <div className="text-xs text-slate-500">
                              {cycle ? cycle.label : 'No cycle'} - {shift.status}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">Shift details unavailable</span>
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
                      </TableCell>
                      <TableCell>{formatDateTime(post.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {isOwnPost && (
                            <form action={deleteShiftPostAction}>
                              <input type="hidden" name="post_id" value={post.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Delete
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
