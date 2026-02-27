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
