import type { createClient } from '@/lib/supabase/server'

import { notifyUsers } from '@/lib/notifications'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type PublishedShiftBase = {
  cyclePublished: boolean
  userId: string | null | undefined
  targetId: string
}

type PublishedShiftAddedParams = PublishedShiftBase & {
  date: string
  shiftType: 'day' | 'night'
}

type PublishedShiftRemovedParams = PublishedShiftBase & {
  date: string
  shiftType: 'day' | 'night'
}

type PublishedShiftMovedParams = PublishedShiftBase & {
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

async function notifyPublishedShiftChange(
  supabase: ServerSupabaseClient,
  params: PublishedShiftBase & { message: string }
) {
  if (!params.cyclePublished || !params.userId) return

  await notifyUsers(supabase, {
    userIds: [params.userId],
    eventType: 'published_schedule_changed',
    title: 'Published schedule updated',
    message: params.message,
    targetType: 'shift',
    targetId: params.targetId,
  })
}

export async function notifyPublishedShiftAdded(
  supabase: ServerSupabaseClient,
  params: PublishedShiftAddedParams
) {
  await notifyPublishedShiftChange(supabase, {
    ...params,
    message: `Your published schedule changed: you were added to a ${params.shiftType} shift on ${formatShortDate(params.date)}.`,
  })
}

export async function notifyPublishedShiftRemoved(
  supabase: ServerSupabaseClient,
  params: PublishedShiftRemovedParams
) {
  await notifyPublishedShiftChange(supabase, {
    ...params,
    message: `Your published schedule changed: your ${params.shiftType} shift on ${formatShortDate(params.date)} was removed.`,
  })
}

export async function notifyPublishedShiftMoved(
  supabase: ServerSupabaseClient,
  params: PublishedShiftMovedParams
) {
  await notifyPublishedShiftChange(supabase, {
    ...params,
    message: `Your published schedule changed: your shift moved from ${formatShortDate(params.fromDate)} ${params.fromShiftType} to ${formatShortDate(params.toDate)} ${params.toShiftType}.`,
  })
}
