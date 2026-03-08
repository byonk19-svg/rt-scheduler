import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  AvailabilityEntriesTable,
  type AvailabilityEntryTableRow,
} from '@/app/availability/availability-requests-table'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
type ToastVariant = 'success' | 'error'
type AvailabilityOverrideType = 'force_off' | 'force_on'
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
  override_type: AvailabilityOverrideType
  note: string | null
  created_at: string
  therapist_id: string
  cycle_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

type AvailabilityPageSearchParams = {
  cycle?: string | string[]
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
      message:
        'You already had an availability request for that date and shift in this cycle. We updated it.',
      variant: 'success',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: 'Could not save your availability request. Please try again.',
      variant: 'error',
    }
  }
  if (success === 'entry_submitted') {
    return {
      message: 'Availability request saved for this cycle.',
      variant: 'success',
    }
  }

  if (success === 'entry_deleted') {
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
  const overrideType = String(
    formData.get('override_type') ?? ''
  ).trim() as AvailabilityOverrideType
  const note = String(formData.get('note') ?? '').trim()

  if (
    !date ||
    !cycleId ||
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') ||
    (overrideType !== 'force_off' && overrideType !== 'force_on')
  ) {
    redirect('/availability?error=submit_failed')
  }

  const { error } = await supabase.from('availability_overrides').upsert(
    {
      therapist_id: user.id,
      cycle_id: cycleId,
      date,
      shift_type: shiftType,
      override_type: overrideType,
      note: note || null,
      created_by: user.id,
      source: 'therapist',
    },
    { onConflict: 'cycle_id,therapist_id,date,shift_type' }
  )

  if (error) {
    console.error('Failed to save availability override:', error)
    redirect(`/availability?error=submit_failed&cycle=${cycleId}`)
  }

  revalidatePath('/availability')
  redirect(`/availability?success=entry_submitted&cycle=${cycleId}`)
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
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!entryId) {
    redirect('/availability')
  }

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', entryId)
    .eq('therapist_id', user.id)

  if (error) {
    console.error('Failed to delete availability override:', error)
    redirect(`/availability?error=delete_failed${cycleId ? `&cycle=${cycleId}` : ''}`)
  }

  revalidatePath('/availability')
  redirect(`/availability?success=entry_deleted${cycleId ? `&cycle=${cycleId}` : ''}`)
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  const canManageAvailability = can(role, 'access_manager_ui')

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: cyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = (cyclesData ?? []) as Cycle[]
  const selectedCycleIdFromParams = getSearchParam(params?.cycle)
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null
  const selectedCycleId = selectedCycle?.id ?? ''

  let entriesQuery = supabase
    .from('availability_overrides')
    .select(
      'id, date, shift_type, override_type, note, created_at, therapist_id, cycle_id, profiles(full_name), schedule_cycles(label, start_date, end_date)'
    )
    .order('date', { ascending: true })
    .order('created_at', { ascending: false })

  if (selectedCycleId) {
    entriesQuery = entriesQuery.eq('cycle_id', selectedCycleId)
  }

  if (!canManageAvailability) {
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
      cycleId: entry.cycle_id,
      date: entry.date,
      reason: entry.note,
      createdAt: entry.created_at,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle
        ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`
        : 'Unknown cycle',
      entryType: entry.override_type,
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

  const submitEntryCard = (
    <Card id="submit-entry">
      <CardHeader>
        <CardTitle>Submit availability for an upcoming cycle</CardTitle>
        <CardDescription>
          {canManageAvailability
            ? 'Record staff availability for one cycle. Need off means unavailable. Available to work means available.'
            : 'Use this before publish. First choose a date and cycle, then choose Need off or Available to work.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitAvailabilityEntry} className="space-y-5">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Step 1: Pick cycle and date
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cycle_id">Schedule Cycle</Label>
                <select
                  id="cycle_id"
                  name="cycle_id"
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue={selectedCycleId}
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
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Step 2: Choose request details
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="override_type">Request type</Label>
                <select
                  id="override_type"
                  name="override_type"
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue="force_off"
                >
                  <option value="force_off">Need off</option>
                  <option value="force_on">Available to work</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift_type">Shift</Label>
                <select
                  id="shift_type"
                  name="shift_type"
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue="both"
                >
                  <option value="both">Both</option>
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" name="note" placeholder="Vacation, appointment, childcare, etc." />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Need off means you cannot work. Available to work means you are open for shifts.
            </p>
            <FormSubmitButton type="submit" pendingText="Saving...">
              Save request
            </FormSubmitButton>
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

      <PageHeader
        title={canManageAvailability ? 'Availability Planning' : 'Future Availability'}
        subtitle={
          canManageAvailability
            ? 'Use this page for upcoming-cycle planning before publish. Shift Board is for published schedule changes.'
            : 'Use this page before publish to submit availability for the next cycle.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild>
              <a href="#submit-entry">Add availability</a>
            </Button>
            <MoreActionsMenu>
              <a
                href="/api/availability/export"
                className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary"
              >
                Export CSV
              </a>
              <PrintMenuItem />
            </MoreActionsMenu>
          </div>
        }
      />

      <section className="rounded-xl border border-border bg-card p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Use the right page
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">This page: Future Availability</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Use before the schedule is published, for upcoming cycle planning.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">Other page: Shift Board</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Use after schedule publish to swap or pick up shifts.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/shift-board">Open Shift Board (published schedule)</Link>
          </Button>
        </div>
      </section>

      {canManageAvailability ? (
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
