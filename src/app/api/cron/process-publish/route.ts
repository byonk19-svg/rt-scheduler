import { NextResponse } from 'next/server'

import { hmacSha256Hex } from '@/lib/security/worker-auth'

const WORKER_KEY_HEADER = 'x-publish-worker-key'
const WORKER_TIMESTAMP_HEADER = 'x-publish-worker-timestamp'
const WORKER_SIGNATURE_HEADER = 'x-publish-worker-signature'

export async function GET(request: Request) {
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/process-publish] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron not configured.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const workerKey = process.env.PUBLISH_WORKER_KEY
  const signingKey = process.env.PUBLISH_WORKER_SIGNING_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!workerKey || !signingKey || !appUrl) {
    console.error(
      '[cron/process-publish] Missing PUBLISH_WORKER_KEY, PUBLISH_WORKER_SIGNING_KEY, or NEXT_PUBLIC_APP_URL'
    )
    return NextResponse.json({ error: 'Worker not configured.' }, { status: 500 })
  }

  const processUrl = `${appUrl.replace(/\/$/, '')}/api/publish/process`
  const timestamp = Math.floor(Date.now() / 1000)
  const signaturePayload = ['POST', '/api/publish/process', String(timestamp)].join('\n')
  const signature = await hmacSha256Hex(signingKey, signaturePayload)

  try {
    const response = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [WORKER_KEY_HEADER]: workerKey,
        [WORKER_TIMESTAMP_HEADER]: String(timestamp),
        [WORKER_SIGNATURE_HEADER]: signature,
      },
      body: JSON.stringify({ batch_size: 25 }),
    })

    const result = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      console.error('[cron/process-publish] Publish process returned error:', result)
      return NextResponse.json(
        { error: 'Publish process failed.', detail: result },
        { status: 502 }
      )
    }

    console.log('[cron/process-publish] Processed:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron/process-publish] Failed to call publish/process:', error)
    return NextResponse.json({ error: 'Failed to trigger publish process.' }, { status: 500 })
  }
}
