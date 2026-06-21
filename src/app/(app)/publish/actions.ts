'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { refreshPublishEventCounts } from '@/lib/publish-events'
import {
  archiveScheduleBlockLifecycle,
  takeScheduleBlockOfflineLifecycle,
} from '@/lib/schedule-block-lifecycle'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Publish event/history operations. The primary schedule publish toggle lives
// in `src/app/(app)/schedule/actions/publish-actions.ts`.

async function requireManagerUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, site_id')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_publish', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard')
  }

  return { user, siteId: profile?.site_id ?? null }
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function requeueFailedPublishEmailsAction(formData: FormData) {
  await requireManagerUser()

  const publishEventId = String(formData.get('publish_event_id') ?? '').trim()
  if (!publishEventId) {
    redirect('/publish?error=missing_publish_event')
  }

  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      console.error('Failed to initialize admin client for publish requeue:', error)
      redirect(`/publish/${publishEventId}?error=requeue_failed`)
    }
  })()

  const { data: requeuedRows, error: requeueError } = await admin
    .from('notification_outbox')
    .update({
      status: 'queued',
      last_error: null,
      sent_at: null,
    })
    .eq('publish_event_id', publishEventId)
    .eq('status', 'failed')
    .select('id')

  if (requeueError) {
    console.error('Failed to re-queue failed publish emails:', requeueError)
    redirect(`/publish/${publishEventId}?error=requeue_failed`)
  }

  await refreshPublishEventCounts(admin, [publishEventId])

  revalidatePath('/publish')
  revalidatePath(`/publish/${publishEventId}`)

  const requeued = requeuedRows?.length ?? 0
  redirect(`/publish/${publishEventId}?success=failed_requeued&requeued=${requeued}`)
}

export async function takeScheduleBlockOfflineAction(formData: FormData) {
  const { user } = await requireManagerUser()

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!cycleId) {
    redirect('/publish?error=missing_cycle')
  }

  const supabase = await createClient()
  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      console.error('Failed to initialize admin client for take offline:', error)
      redirect('/publish?error=take_offline_failed')
    }
  })()

  const lifecycle = await takeScheduleBlockOfflineLifecycle({
    supabase,
    mutationClient: admin,
    actorId: user.id,
    cycleId,
  })
  if (!lifecycle.ok) {
    if (lifecycle.reason === 'not_live') {
      redirect('/publish?error=take_offline_not_live')
    }
    if (lifecycle.reason === 'state_changed') {
      redirect('/publish?error=take_offline_state_changed')
    }
    if (lifecycle.reason === 'cycle_lookup_failed') {
      console.error('Failed to load cycle for take offline:', lifecycle.error)
    } else if (lifecycle.reason === 'mutation_failed') {
      console.error('Failed to take schedule block offline:', lifecycle.error)
    }
    redirect('/publish?error=take_offline_failed')
  }

  revalidatePath('/publish')
  revalidatePath('/schedule')
  revalidatePath('/preliminary')
  revalidatePath('/approvals')
  revalidatePath('/requests')
  revalidatePath('/shift-board')
  revalidatePath('/staff/history')

  redirect('/publish?success=cycle_taken_offline')
}

export async function deletePublishEventAction(formData: FormData) {
  await requireManagerUser()

  const publishEventId = String(formData.get('publish_event_id') ?? '').trim()
  if (!publishEventId) {
    redirect('/publish?error=missing_publish_event')
  }

  const supabase = await createClient()
  const { data: publishEvent, error: publishEventError } = await supabase
    .from('publish_events')
    .select('id, cycle_id, schedule_cycles(published)')
    .eq('id', publishEventId)
    .maybeSingle()

  if (publishEventError || !publishEvent) {
    console.error('Failed to load publish event for deletion:', publishEventError)
    redirect('/publish?error=delete_publish_event_failed')
  }

  if (getOne(publishEvent.schedule_cycles)?.published) {
    redirect('/publish?error=delete_live_publish_event')
  }

  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      console.error('Failed to initialize admin client for publish event delete:', error)
      redirect('/publish?error=delete_publish_event_failed')
    }
  })()

  const { error: deleteError } = await admin
    .from('publish_events')
    .delete()
    .eq('id', publishEventId)

  if (deleteError) {
    console.error('Failed to delete publish event:', deleteError)
    redirect('/publish?error=delete_publish_event_failed')
  }

  revalidatePath('/publish')
  revalidatePath('/schedule')

  redirect('/publish?success=publish_event_deleted')
}

export async function archiveCycleAction(formData: FormData) {
  const { user, siteId } = await requireManagerUser()

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!cycleId) {
    redirect('/publish?error=missing_cycle')
  }

  const supabase = await createClient()
  const lifecycle = await archiveScheduleBlockLifecycle({
    supabase,
    actorId: user.id,
    managerSiteId: siteId,
    cycleId,
  })
  if (!lifecycle.ok) {
    if (lifecycle.reason === 'live') {
      redirect('/publish?error=archive_live_cycle')
    }
    if (lifecycle.reason === 'cycle_lookup_failed') {
      console.error('Failed to load cycle for archival:', lifecycle.error)
    } else if (lifecycle.reason === 'mutation_failed') {
      console.error('Failed to archive cycle:', lifecycle.error)
    }
    redirect('/publish?error=cycle_archive_failed')
  }

  revalidatePath('/publish')
  revalidatePath('/schedule')
  revalidatePath('/availability')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/manager')
  revalidatePath('/dashboard/staff')

  redirect('/publish?success=cycle_archived')
}
