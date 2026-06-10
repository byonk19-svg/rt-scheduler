import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { isValidPublishWorkerRequest } from '@/lib/security/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { processQueuedPublishEmails } from '@/lib/publish-events'
import { createClient } from '@/lib/supabase/server'
import { captureSafeException, logStructuredEvent } from '@/lib/observability'

type PublishProcessorActorProfile = {
  role: string | null
  is_active: boolean | null
  archived_at: string | null
  site_id: string | null
}

type PublishEventSiteRow = {
  id: string
  schedule_cycles: { site_id: string | null } | Array<{ site_id: string | null }> | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parseBatchSize(value: unknown): number {
  if (typeof value !== 'number') return 25
  if (!Number.isFinite(value)) return 25
  const rounded = Math.floor(value)
  if (rounded < 1) return 1
  if (rounded > 100) return 100
  return rounded
}

export async function POST(request: Request) {
  const allowWorkerRequest = await isValidPublishWorkerRequest(request)
  let browserActorSiteId: string | null = null

  if (!allowWorkerRequest) {
    if (!isTrustedMutationRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active, archived_at, site_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: 'Could not verify manager role.' }, { status: 500 })
    }

    const actorProfile = (profile ?? null) as PublishProcessorActorProfile | null
    if (
      !can(parseRole(actorProfile?.role), 'manage_publish', {
        isActive: actorProfile?.is_active !== false,
        archivedAt: actorProfile?.archived_at ?? null,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!actorProfile?.site_id) {
      return NextResponse.json({ error: 'Actor site is missing.' }, { status: 403 })
    }
    browserActorSiteId = actorProfile.site_id
  }

  const body = (await request.json().catch(() => ({}))) as {
    publish_event_id?: unknown
    batch_size?: unknown
  }

  const publishEventId =
    typeof body.publish_event_id === 'string' && body.publish_event_id.trim().length > 0
      ? body.publish_event_id.trim()
      : null
  const batchSize = parseBatchSize(body.batch_size)

  if (!allowWorkerRequest && !publishEventId) {
    return NextResponse.json(
      { error: 'publish_event_id is required for browser-triggered publish processing.' },
      { status: 400 }
    )
  }

  let admin: SupabaseClient
  try {
    admin = createAdminClient()
  } catch {
    const context = {
      worker_request: allowWorkerRequest,
      publish_event_id: publishEventId,
      batch_size: batchSize,
    }
    logStructuredEvent('error', 'publish.process.admin_client_failed', context)
    captureSafeException('publish.process.admin_client_failed', context)
    return NextResponse.json({ error: 'Could not initialize publish processing.' }, { status: 500 })
  }

  if (!allowWorkerRequest && publishEventId) {
    const { data: publishEvent, error: publishEventError } = await admin
      .from('publish_events')
      .select('id, schedule_cycles!inner(site_id)')
      .eq('id', publishEventId)
      .maybeSingle()

    const eventRow = (publishEvent ?? null) as PublishEventSiteRow | null
    const eventSiteId = getOne(eventRow?.schedule_cycles)?.site_id ?? null

    if (publishEventError || !eventRow) {
      return NextResponse.json({ error: 'Publish event not found.' }, { status: 404 })
    }
    if (eventSiteId !== browserActorSiteId) {
      return NextResponse.json(
        { error: 'Publish event is outside your site scope.' },
        { status: 403 }
      )
    }
  }

  try {
    logStructuredEvent('info', 'publish.process.requested', {
      worker_request: allowWorkerRequest,
      publish_event_id: publishEventId,
      batch_size: batchSize,
    })
    const result = await processQueuedPublishEmails(admin, {
      publishEventId,
      batchSize,
    })
    logStructuredEvent('info', 'publish.process.completed', {
      worker_request: allowWorkerRequest,
      publish_event_id: publishEventId,
      batch_size: batchSize,
    })
    return NextResponse.json(result)
  } catch {
    const context = {
      worker_request: allowWorkerRequest,
      publish_event_id: publishEventId,
      batch_size: batchSize,
    }
    logStructuredEvent('error', 'publish.process.failed', context)
    captureSafeException('publish.process.failed', context)
    return NextResponse.json({ error: 'Could not process publish notifications.' }, { status: 500 })
  }
}
