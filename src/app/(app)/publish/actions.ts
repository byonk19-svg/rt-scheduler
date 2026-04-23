'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { refreshPublishEventCounts } from '@/lib/publish-events'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_publish')) {
    redirect('/dashboard')
  }

  return user
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
  revalidatePath('/publish/history')
  revalidatePath(`/publish/${publishEventId}`)

  const requeued = requeuedRows?.length ?? 0
  redirect(`/publish/${publishEventId}?success=failed_requeued&requeued=${requeued}`)
}

export async function restartPublishedCycleAction(formData: FormData) {
  await requireManagerUser()

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!cycleId) {
    redirect('/publish?error=missing_cycle')
  }

  const supabase = await createClient()
  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      console.error('Failed to initialize admin client for cycle restart:', error)
      redirect('/publish?error=cycle_restart_failed')
    }
  })()

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for restart:', cycleError)
    redirect('/publish?error=cycle_restart_failed')
  }

  const { error: cycleUpdateError } = await supabase
    .from('schedule_cycles')
    .update({ published: false })
    .eq('id', cycleId)

  if (cycleUpdateError) {
    console.error('Failed to unpublish cycle during restart:', cycleUpdateError)
    redirect('/publish?error=cycle_restart_failed')
  }

  const { data: deletedShifts, error: deleteShiftsError } = await supabase
    .from('shifts')
    .delete()
    .eq('cycle_id', cycleId)
    .select('id')

  if (deleteShiftsError) {
    console.error('Failed to clear shifts during cycle restart:', deleteShiftsError)
    redirect('/publish?error=cycle_restart_failed')
  }

  const { error: closeSnapshotError } = await admin
    .from('preliminary_snapshots')
    .update({ status: 'closed' })
    .eq('cycle_id', cycleId)
    .eq('status', 'active')

  if (closeSnapshotError) {
    console.error('Failed to close preliminary snapshot during cycle restart:', closeSnapshotError)
    redirect('/publish?error=cycle_restart_failed')
  }

  void deletedShifts

  revalidatePath('/publish')
  revalidatePath('/publish/history')
  revalidatePath('/coverage')
  revalidatePath('/schedule')
  revalidatePath('/preliminary')
  revalidatePath('/approvals')

  redirect('/publish?success=cycle_restarted')
}

/** Sets published=false without removing shifts (draft again, assignments preserved). */
export async function unpublishCycleKeepShiftsAction(formData: FormData) {
  await requireManagerUser()

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!cycleId) {
    redirect('/publish?error=missing_cycle')
  }

  const supabase = await createClient()
  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      console.error('Failed to initialize admin client for cycle unpublish:', error)
      redirect('/publish?error=unpublish_keep_shifts_failed')
    }
  })()
  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for unpublish:', cycleError)
    redirect('/publish?error=unpublish_keep_shifts_failed')
  }

  if (!cycle.published) {
    redirect('/publish?error=unpublish_not_live')
  }

  const { error: cycleUpdateError } = await supabase
    .from('schedule_cycles')
    .update({ published: false })
    .eq('id', cycleId)

  if (cycleUpdateError) {
    console.error('Failed to unpublish cycle:', cycleUpdateError)
    redirect('/publish?error=unpublish_keep_shifts_failed')
  }

  const { error: closeSnapshotError } = await admin
    .from('preliminary_snapshots')
    .update({ status: 'closed' })
    .eq('cycle_id', cycleId)
    .eq('status', 'active')

  if (closeSnapshotError) {
    console.error('Failed to close preliminary snapshot during unpublish:', closeSnapshotError)
    redirect('/publish?error=unpublish_keep_shifts_failed')
  }

  revalidatePath('/publish')
  revalidatePath('/publish/history')
  revalidatePath('/coverage')
  revalidatePath('/schedule')
  revalidatePath('/preliminary')
  revalidatePath('/approvals')

  redirect('/publish?success=unpublished_keep_shifts')
}

export async function deletePublishEventAction(formData: FormData) {
  await requireManagerUser()

  const publishEventId = String(formData.get('publish_event_id') ?? '').trim()
  if (!publishEventId) {
    redirect('/publish/history?error=missing_publish_event')
  }

  const supabase = await createClient()
  const { data: publishEvent, error: publishEventError } = await supabase
    .from('publish_events')
    .select('id, cycle_id, schedule_cycles(published)')
    .eq('id', publishEventId)
    .maybeSingle()

  if (publishEventError || !publishEvent) {
    console.error('Failed to load publish event for deletion:', publishEventError)
    redirect('/publish/history?error=delete_publish_event_failed')
  }

  if (getOne(publishEvent.schedule_cycles)?.published) {
    redirect('/publish/history?error=delete_live_publish_event')
  }

  const admin = (() => {
    try {
      return createAdminClient()
    } catch (error) {
      console.error('Failed to initialize admin client for publish event delete:', error)
      redirect('/publish/history?error=delete_publish_event_failed')
    }
  })()

  const { error: deleteError } = await admin
    .from('publish_events')
    .delete()
    .eq('id', publishEventId)

  if (deleteError) {
    console.error('Failed to delete publish event:', deleteError)
    redirect('/publish/history?error=delete_publish_event_failed')
  }

  revalidatePath('/publish')
  revalidatePath('/publish/history')
  revalidatePath('/coverage')
  revalidatePath('/schedule')

  redirect('/publish/history?success=publish_event_deleted')
}

export async function archiveCycleAction(formData: FormData) {
  await requireManagerUser()

  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  if (!cycleId) {
    redirect('/publish?error=missing_cycle')
  }

  const supabase = await createClient()
  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, published, archived_at')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    console.error('Failed to load cycle for archival:', cycleError)
    redirect('/publish?error=cycle_archive_failed')
  }

  if (cycle.published) {
    redirect('/publish?error=archive_live_cycle')
  }

  const { error: archiveError } = await supabase
    .from('schedule_cycles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', cycleId)

  if (archiveError) {
    console.error('Failed to archive cycle:', archiveError)
    redirect('/publish?error=cycle_archive_failed')
  }

  revalidatePath('/publish')
  revalidatePath('/publish/history')
  revalidatePath('/coverage')
  revalidatePath('/schedule')
  revalidatePath('/availability')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/manager')
  revalidatePath('/dashboard/staff')

  redirect('/publish?success=cycle_archived')
}
