import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { isValidPublishWorkerRequest } from '@/lib/security/worker-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { processQueuedPublishEmails } from '@/lib/publish-events'
import { createClient } from '@/lib/supabase/server'

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
      .select('role, is_active, archived_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: 'Could not verify manager role.' }, { status: 500 })
    }

    if (
      !can(parseRole(profile?.role), 'manage_publish', {
        isActive: profile?.is_active !== false,
        archivedAt: profile?.archived_at ?? null,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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

  let admin: SupabaseClient
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Failed to initialize admin client for publish processing:', error)
    return NextResponse.json({ error: 'Could not initialize publish processing.' }, { status: 500 })
  }

  try {
    const result = await processQueuedPublishEmails(admin, {
      publishEventId,
      batchSize,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to process queued publish emails:', error)
    return NextResponse.json({ error: 'Could not process publish notifications.' }, { status: 500 })
  }
}
