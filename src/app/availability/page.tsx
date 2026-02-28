import { revalidatePath } from 'next/cache'
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
import { can } from '@/lib/auth/can'
import { parseRole, toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
type ToastVariant = 'success' | 'error'
type AvailabilityOverrideType = 'force_off' | 'force_on'
type AvailabilityShiftType = 'day' | 'night' | 'both'
type EmploymentType = 'full_time' | 'part_time' | 'prn'

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
        'An override already exists for that date and shift scope in this cycle. It was updated.',
      variant: 'success',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: 'Could not save override. Please try again.',
      variant: 'error',
    }
  }
  if (error === 'invalid_override_type') {
    return {
      message: 'That override type is not allowed for your employment type.',
      variant: 'error',
    }
  }

  if (success === 'entry_submitted') {
    return {
      message: 'Cycle-specific override saved.',
      variant: 'success',
    }
  }

  if (success === 'entry_deleted') {
    return {
      message: 'Override deleted.',
      variant: 'success',
    }
  }

  if (error === 'delete_failed') {
    return {
      message: 'Could not delete override.',
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employment_type')
    .eq('id', user.id)
    .maybeSingle()

  const isTherapist = !can(parseRole(profile?.role), 'access_manager_ui')
  const employmentType: EmploymentType =
    profile?.employment_type === 'prn'
      ? 'prn'
      : profile?.employment_type === 'part_time'
        ? 'part_time'
        : 'full_time'

  if (
    !date ||
    !cycleId ||
    (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') ||
    (overrideType !== 'force_off' && overrideType !== 'force_on')
  ) {
    redirect('/availability?error=submit_failed')
  }

  if (isTherapist) {
    const requiredOverrideType: AvailabilityOverrideType =
      employmentType === 'prn' ? 'force_on' : 'force_off'
    if (overrideType !== requiredOverrideType) {
      redirect(`/availability?error=invalid_override_type&cycle=${cycleId}`)
    }
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
    .select('role, full_name, employment_type')
    .eq('id', user.id)
    .maybeSingle()

  const role = toUiRole(profile?.role)
  const canManageAvailability = can(role, 'access_manager_ui')
  const isPrnTherapist = role === 'therapist' && profile?.employment_type === 'prn'

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
        <CardTitle>Cycle-specific date overrides</CardTitle>
        <CardDescription>
          {canManageAvailability
            ? 'Submit overrides for one schedule cycle only. "Need off" forces off; "Available to work" forces on.'
            : isPrnTherapist
              ? 'Submit "Available to work (PRN)" for one schedule cycle only.'
              : 'Submit "Need off" for one schedule cycle only.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitAvailabilityEntry} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
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
              <p className="text-xs text-muted-foreground">No upcoming schedule cycles found.</p>
            )}
          </div>

          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="override_type">Override</Label>
            <select
              id="override_type"
              name="override_type"
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              defaultValue={isPrnTherapist ? 'force_on' : 'force_off'}
            >
              {canManageAvailability ? (
                <>
                  <option value="force_off">Need off</option>
                  <option value="force_on">Available to work</option>
                </>
              ) : isPrnTherapist ? (
                <option value="force_on">Available to work (PRN)</option>
              ) : (
                <option value="force_off">Need off</option>
              )}
            </select>
          </div>

          <div className="space-y-2 xl:col-span-1">
            <Label htmlFor="shift_type">Shift</Label>
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
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" name="note" placeholder="Optional note" />
          </div>

          <div className="xl:col-span-12">
            <FormSubmitButton type="submit" pendingText="Saving...">
              Save override
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

      <div>
        <h1 className="app-page-title">Availability</h1>
        <p className="text-muted-foreground">
          {canManageAvailability
            ? 'Review cycle-scoped therapist date overrides for schedule planning.'
            : isPrnTherapist
              ? 'Submit cycle-scoped PRN offers: Available to work (PRN).'
              : 'Submit cycle-scoped date overrides: Need off.'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild className="bg-[#d97706] text-white hover:bg-[#b45309]">
          <a href="#submit-entry">Submit override</a>
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
