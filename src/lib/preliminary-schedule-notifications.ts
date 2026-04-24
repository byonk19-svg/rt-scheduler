import type { createClient } from '@/lib/supabase/server'

import { notifyUsers } from '@/lib/notifications'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type PreliminaryShiftBase = {
  preliminaryActive: boolean
  userId: string | null | undefined
  targetId: string
}

type PreliminaryShiftAddedParams = PreliminaryShiftBase & {
  date: string
  shiftType: 'day' | 'night'
}

type PreliminaryShiftRemovedParams = PreliminaryShiftBase & {
  date: string
  shiftType: 'day' | 'night'
}

type PreliminaryShiftMovedParams = PreliminaryShiftBase & {
  fromDate: string
  fromShiftType: 'day' | 'night'
  toDate: string
  toShiftType: 'day' | 'night'
}

function formatShortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

async function notifyPreliminaryShiftChange(
  supabase: ServerSupabaseClient,
  params: PreliminaryShiftBase & { message: string }
) {
  if (!params.preliminaryActive || !params.userId) return

  await notifyUsers(supabase, {
    userIds: [params.userId],
    eventType: 'preliminary_schedule_changed',
    title: 'Preliminary schedule updated',
    message: params.message,
    targetType: 'shift',
    targetId: params.targetId,
  })
}

export async function notifyPreliminaryShiftAdded(
  supabase: ServerSupabaseClient,
  params: PreliminaryShiftAddedParams
) {
  await notifyPreliminaryShiftChange(supabase, {
    ...params,
    message: `Your preliminary schedule changed: you were added to a ${params.shiftType} shift on ${formatShortDate(params.date)}.`,
  })
}

export async function notifyPreliminaryShiftRemoved(
  supabase: ServerSupabaseClient,
  params: PreliminaryShiftRemovedParams
) {
  await notifyPreliminaryShiftChange(supabase, {
    ...params,
    message: `Your preliminary schedule changed: your ${params.shiftType} shift on ${formatShortDate(params.date)} was removed.`,
  })
}

export async function notifyPreliminaryShiftMoved(
  supabase: ServerSupabaseClient,
  params: PreliminaryShiftMovedParams
) {
  await notifyPreliminaryShiftChange(supabase, {
    ...params,
    message: `Your preliminary schedule changed: your shift moved from ${formatShortDate(params.fromDate)} ${params.fromShiftType} to ${formatShortDate(params.toDate)} ${params.toShiftType}.`,
  })
}
