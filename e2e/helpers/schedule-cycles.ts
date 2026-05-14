import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, formatDateKey } from './env'

type ScheduleCycleStatus = 'draft' | 'preliminary' | 'final' | 'offline' | 'archived'

type CreateScheduleCycleInput = {
  label: string
  startDate?: Date
  align?: 'on-or-before' | 'on-or-after'
  published?: boolean
  status?: ScheduleCycleStatus
  siteId?: string
  availabilityDueAt?: string
}

type ScheduleCycleRow = {
  id: string
  start_date: string
  end_date: string
}

type ExistingScheduleCycleRange = {
  start_date: string
  end_date: string
}

function cloneDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function sundayOnOrBefore(value: Date): Date {
  return addDays(cloneDate(value), -cloneDate(value).getDay())
}

export function sundayOnOrAfter(value: Date): Date {
  const date = cloneDate(value)
  return addDays(date, (7 - date.getDay()) % 7)
}

export function scheduleBlockEnd(startDate: Date): Date {
  return addDays(startDate, 41)
}

function overlaps(start: Date, end: Date, range: ExistingScheduleCycleRange): boolean {
  const rangeStart = parseDateKey(range.start_date)
  const rangeEnd = parseDateKey(range.end_date)
  return start <= rangeEnd && end >= rangeStart
}

function findAvailableBlockStart(requestedStart: Date, ranges: ExistingScheduleCycleRange[]): Date {
  let start = sundayOnOrAfter(requestedStart)

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const end = scheduleBlockEnd(start)
    const conflict = ranges.find((range) => overlaps(start, end, range))

    if (!conflict) {
      return start
    }

    start = sundayOnOrAfter(addDays(parseDateKey(conflict.end_date), 1))
  }

  throw new Error('Could not find an available non-overlapping Schedule Block window.')
}

async function listActiveScheduleRanges(
  supabase: SupabaseClient,
  siteId?: string
): Promise<ExistingScheduleCycleRange[]> {
  let query = supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .is('archived_at', null)
    .order('start_date', { ascending: true })

  if (siteId) {
    query = query.eq('site_id', siteId)
  }

  const result = await query

  if (result.error) {
    throw new Error(result.error.message)
  }

  return (result.data ?? []) as ExistingScheduleCycleRange[]
}

export async function createScheduleCycle(
  supabase: SupabaseClient,
  input: CreateScheduleCycleInput
): Promise<ScheduleCycleRow> {
  const align = input.align ?? 'on-or-after'
  let start =
    align === 'on-or-before'
      ? sundayOnOrBefore(input.startDate ?? new Date())
      : sundayOnOrAfter(input.startDate ?? new Date())
  const published = input.published ?? false
  const status = input.status ?? (published ? 'final' : 'draft')

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const activeRanges = await listActiveScheduleRanges(supabase, input.siteId)
    start = findAvailableBlockStart(start, activeRanges)
    const end = scheduleBlockEnd(start)
    const insert = await supabase
      .from('schedule_cycles')
      .insert({
        label: input.label,
        start_date: formatDateKey(start),
        end_date: formatDateKey(end),
        published,
        status,
        ...(input.siteId ? { site_id: input.siteId } : {}),
        ...(input.availabilityDueAt ? { availability_due_at: input.availabilityDueAt } : {}),
      })
      .select('id, start_date, end_date')
      .single()

    if (!insert.error && insert.data) {
      return insert.data as ScheduleCycleRow
    }

    const message = insert.error?.message ?? 'Could not create schedule cycle.'
    if (!message.includes('Active Schedule Blocks cannot overlap')) {
      throw new Error(message)
    }

    start = addDays(end, 1)
  }

  throw new Error('Could not create a non-overlapping Schedule Block after 50 attempts.')
}
