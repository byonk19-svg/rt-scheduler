import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AvailabilityEntriesTable, type AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getAvailabilityEntryTypeForEmploymentType,
  normalizeEmploymentType,
} from '@/lib/availability-policy'
import { createClient } from '@/lib/supabase/server'

type Role = 'manager' | 'therapist'
type ToastVariant = 'success' | 'error'
type AvailabilityEntryType = 'unavailable' | 'available'
type AvailabilityShiftType = 'day' | 'night' | 'both'

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
  shift_type: AvailabilityShiftType
  entry_type: AvailabilityEntryType
  reason: string | null
  created_at: string
  therapist_id: string
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

  if (error === 'duplicate_entry') {
    return {
      message: 'You already submitted availability for that date and shift scope in this cycle.',
      variant: 'error',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: 'Could not submit availability. Please try again.',
      variant: 'error',
    }
  }

  if (success === 'entry_submitted') {
    return {
      message: 'Availability saved.',
      variant: 'success',
    }
  }

  if (success === 'entry_deleted') {
    return {
      message: 'Availability entry deleted.',
      variant: 'success',
    }
  }

  if (error === 'delete_failed') {
    return {
      message: 'Could not delete availability entry.',
      variant: 'error',
    }
  }

  return null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function submitAvailabilityEntry(formData: FormData) {
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
  const shiftType = String(formData.get('shift_type') ?? 'both').trim() as AvailabilityShiftType
  const reason = String(formData.get('reason') ?? '').trim()

  if (!date || !cycleId || (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both')) {
    redirect('/availability?error=submit_failed')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('employment_type')
    .eq('id', user.id)
    .maybeSingle()

  const entryType = getAvailabilityEntryTypeForEmploymentType(
    normalizeEmploymentType(profile?.employment_type)
  )

  const { error } = await supabase.from('availability_entries').insert({
    therapist_id: user.id,
    cycle_id: cycleId,
    date,
    shift_type: shiftType,
    entry_type: entryType,
    reason: reason || null,
    created_by: user.id,
  })

  if (error) {
    console.error('Failed to create availability entry:', error)
    if (error.code === '23505') {
      redirect('/availability?error=duplicate_entry')
    }
    redirect('/availability?error=submit_failed')
  }

  revalidatePath('/availability')
  redirect('/availability?success=entry_submitted')
}

async function deleteAvailabilityEntry(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const entryId = String(formData.get('entry_id') ?? '').trim()
  if (!entryId) {
    redirect('/availability')
  }

  const { error } = await supabase
    .from('availability_entries')
    .delete()
    .eq('id', entryId)
    .eq('therapist_id', user.id)

  if (error) {
    console.error('Failed to delete availability entry:', error)
    redirect('/availability?error=delete_failed')
  }

  revalidatePath('/availability')
  redirect('/availability?success=entry_deleted')
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
    .select('role, full_name, employment_type')
    .eq('id', user.id)
    .maybeSingle()

  const role: Role = profile?.role === 'manager' ? 'manager' : 'therapist'
  const employmentType = normalizeEmploymentType(profile?.employment_type)
  const userEntryType = getAvailabilityEntryTypeForEmploymentType(employmentType)

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const cyclesQuery = supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const { data: cyclesData } = await cyclesQuery
  const cycles = (cyclesData ?? []) as Cycle[]

  let entriesQuery = supabase
    .from('availability_entries')
    .select(
      'id, date, shift_type, entry_type, reason, created_at, therapist_id, profiles(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (role !== 'manager') {
    entriesQuery = entriesQuery.eq('therapist_id', user.id)
  }

  const { data: entriesData } = await entriesQuery
  const entries = (entriesData ?? []) as AvailabilityRow[]
  const hasCycles = cycles.length > 0
  const availabilityRows: AvailabilityEntryTableRow[] = entries.map((entry) => {
    const cycle = getOne(entry.schedule_cycles)
    const requester = getOne(entry.profiles)
    return {
      id: entry.id,
      date: entry.date,
      reason: entry.reason,
      createdAt: entry.created_at,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})` : 'Unknown cycle',
      entryType: entry.entry_type,
      shiftType: entry.shift_type,
      canDelete: entry.therapist_id === user.id,
    }
  })
  const entriesCard = (
    <AvailabilityEntriesTable
      role={role}
      rows={availabilityRows}
      deleteAvailabilityEntryAction={deleteAvailabilityEntry}
      initialFilters={initialFilters}
    />
  )

  const inputTitle = userEntryType === 'available' ? 'Days I can work' : 'Days I cannot work'
  const inputDescription =
    userEntryType === 'available'
      ? 'PRN workflow: submit days you can work for the next cycle. No approval required.'
      : 'Submit unavailable days for the next cycle. No approval required.'

  const submitEntryCard = (
    <Card id="submit-entry">
      <CardHeader>
        <CardTitle>{inputTitle}</CardTitle>
        <CardDescription>{inputDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitAvailabilityEntry} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-2 xl:col-span-3">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <div className="space-y-2 xl:col-span-5">
            <Label htmlFor="cycle_id">Schedule Cycle</Label>
            <select
              id="cycle_id"
              name="cycle_id"
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select cycle
              </option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label} ({cycle.start_date} to {cycle.end_date})
                  {cycle.published ? '' : ' [draft]'}
                </option>
              ))}
            </select>
            {!hasCycles && (
              <p className="text-xs text-muted-foreground">
                No upcoming schedule cycles found.
              </p>
            )}
          </div>

          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="shift_type">Shift scope</Label>
            <select
              id="shift_type"
              name="shift_type"
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              defaultValue="both"
            >
              <option value="both">Both</option>
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          </div>

          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              name="reason"
              placeholder="Optional note"
            />
          </div>

          <div className="xl:col-span-12">
            <FormSubmitButton type="submit" pendingText="Submitting...">Save availability</FormSubmitButton>
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
        <h1 className="app-page-title">Availability</h1>
        <p className="text-muted-foreground">
          {role === 'manager'
            ? 'Review submitted availability constraints for schedule planning.'
            : userEntryType === 'available'
              ? 'PRN: submit the days you can work in the next cycle.'
              : 'Submit the days you cannot work in the next cycle.'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild>
          <a href="#submit-entry">Submit availability</a>
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
          {entriesCard}
          {submitEntryCard}
        </>
      ) : (
        <>
          {submitEntryCard}
          {entriesCard}
        </>
      )}
    </div>
  )
}
