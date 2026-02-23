import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AvailabilityRequestsTable, type AvailabilityRequestTableRow } from '@/app/availability/availability-requests-table'
import { AttentionBar } from '@/components/AttentionBar'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'

type Role = 'manager' | 'therapist'
type ToastVariant = 'success' | 'error'

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
  reason: string | null
  created_at: string
  user_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

type AvailabilityPageSearchParams = {
  error?: string | string[]
  success?: string | string[]
  search?: string | string[]
  status?: string | string[]
  startDate?: string | string[]
  endDate?: string | string[]
  sort?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getAvailabilityFeedback(params?: AvailabilityPageSearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)

  if (error === 'duplicate_request') {
    return {
      message: 'You already submitted that availability request.',
      variant: 'error',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: 'Could not submit availability request. Please try again.',
      variant: 'error',
    }
  }

  if (success === 'request_submitted') {
    return {
      message: 'Availability request submitted.',
      variant: 'success',
    }
  }

  if (success === 'request_deleted') {
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function submitAvailabilityRequest(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const date = String(formData.get('date') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()

  if (!date) {
    redirect('/availability?error=submit_failed')
  }

  const { error } = await supabase.from('availability_requests').insert({
    user_id: user.id,
    cycle_id: cycleId || null,
    date,
    reason: reason || null,
  })

  if (error) {
    console.error('Failed to create availability request:', error)
    if (error.code === '23505') {
      redirect('/availability?error=duplicate_request')
    }
    redirect('/availability?error=submit_failed')
  }

  revalidatePath('/availability')
  redirect('/availability?success=request_submitted')
}

async function deleteAvailabilityRequest(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const requestId = String(formData.get('request_id') ?? '').trim()
  if (!requestId) {
    redirect('/availability')
  }

  const { error } = await supabase
    .from('availability_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to delete availability request:', error)
    redirect('/availability?error=delete_failed')
  }

  revalidatePath('/availability')
  redirect('/availability?success=request_deleted')
}

export default async function AvailabilityPage({
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
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'
  const managerAttention = role === 'manager' ? await getManagerAttentionSnapshot(supabase) : null

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .order('start_date', { ascending: false })

  const cycles = (cyclesData ?? []) as Cycle[]

  let requestsQuery = supabase
    .from('availability_requests')
    .select(
      'id, date, reason, created_at, user_id, profiles(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (role !== 'manager') {
    requestsQuery = requestsQuery.eq('user_id', user.id)
  }

  const { data: requestsData } = await requestsQuery
  const requests = (requestsData ?? []) as AvailabilityRow[]
  const hasCycles = cycles.length > 0
  const availabilityRows: AvailabilityRequestTableRow[] = requests.map((request) => {
    const cycle = getOne(request.schedule_cycles)
    const requester = getOne(request.profiles)
    return {
      id: request.id,
      date: request.date,
      reason: request.reason,
      createdAt: request.created_at,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})` : 'Unassigned',
      status: 'pending',
      canDelete: request.user_id === user.id,
    }
  })
  const requestsCard = (
    <AvailabilityRequestsTable
      role={role}
      rows={availabilityRows}
      deleteAvailabilityRequestAction={deleteAvailabilityRequest}
      initialFilters={initialFilters}
    />
  )
  const submitRequestCard = (
    <Card id="submit-request">
      <CardHeader>
        <CardTitle>Submit Request</CardTitle>
        <CardDescription>Select a date and optional cycle.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitAvailabilityRequest} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-2 xl:col-span-3">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <div className="space-y-2 xl:col-span-4">
            <Label htmlFor="cycle_id">Schedule Cycle</Label>
            <select
              id="cycle_id"
              name="cycle_id"
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="">No specific cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label} ({cycle.start_date} to {cycle.end_date})
                  {cycle.published ? '' : ' [draft]'}
                </option>
              ))}
            </select>
            {!hasCycles && (
              <p className="text-xs text-muted-foreground">
                No schedule cycles found yet. You can still submit requests.
              </p>
            )}
          </div>

          <div className="space-y-2 xl:col-span-5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              name="reason"
              placeholder="Family event, appointment, vacation, etc."
            />
          </div>

          <div className="xl:col-span-12">
            <FormSubmitButton type="submit" pendingText="Submitting...">Submit availability request</FormSubmitButton>
          </div>
        </form>
        {feedback?.variant === 'error' && (
          <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
            {feedback.message}
          </p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div>
        <h1 className="app-page-title">Availability Requests</h1>
        <p className="text-muted-foreground">
          {role === 'manager'
            ? 'Review all submitted blackout dates.'
            : 'Submit days you cannot work for upcoming schedules.'}
        </p>
      </div>

      {role === 'manager' && managerAttention && (
        <AttentionBar snapshot={managerAttention} variant="compact" context="approvals" />
      )}

      <div className="flex items-center gap-2">
        <Button asChild>
          <a href="#submit-request">Submit Request</a>
        </Button>
        <MoreActionsMenu>
          <a href="/api/availability/export" className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary">
            Export CSV
          </a>
          <PrintMenuItem />
        </MoreActionsMenu>
      </div>

      {role === 'manager' ? (
        <>
          {requestsCard}
          {submitRequestCard}
        </>
      ) : (
        <>
          {submitRequestCard}
          {requestsCard}
        </>
      )}
    </div>
  )
}
