import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createHmac } from 'node:crypto'

const envCache = new Map<string, string>()

function getEnvFromFile(key: string): string | undefined {
  if (envCache.has(key)) return envCache.get(key)
  const envPath = path.resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex <= 0) continue
      const parsedKey = trimmed.slice(0, eqIndex).trim()
      let parsedValue = trimmed.slice(eqIndex + 1).trim()
      if (
        (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
        (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
      ) {
        parsedValue = parsedValue.slice(1, -1)
      }
      envCache.set(parsedKey, parsedValue)
    }
  } catch {
    return undefined
  }
  return envCache.get(key)
}

function getEnv(key: string): string | undefined {
  return process.env[key] ?? getEnvFromFile(key)
}

function buildSignedWorkerHeaders(
  method: 'POST',
  pathname: '/api/publish/process',
  workerKey: string,
  signingKey: string
) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const payload = [method, pathname, timestamp].join('\n')
  const signature = createHmac('sha256', signingKey).update(payload).digest('hex')

  return {
    'x-publish-worker-key': workerKey,
    'x-publish-worker-timestamp': timestamp,
    'x-publish-worker-signature': signature,
  }
}

test.describe.serial('/api/publish/process auth and idempotency', () => {
  test('rejects unauthenticated requests without worker key', async ({ request }) => {
    const response = await request.post('/api/publish/process', {
      data: { batch_size: 1 },
      maxRedirects: 0,
    })

    expect([307, 401]).toContain(response.status())
    if (response.status() === 307) {
      expect(response.headers()['location'] ?? '').toContain('/login')
    } else {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      expect(body?.error).toBe('Unauthorized')
    }
  })

  test('accepts worker-key auth and is idempotent for empty event processing', async ({
    request,
  }) => {
    const workerKey = getEnv('PUBLISH_WORKER_KEY')
    const signingKey = getEnv('PUBLISH_WORKER_SIGNING_KEY')
    test.skip(
      !workerKey || !signingKey,
      'Set PUBLISH_WORKER_KEY and PUBLISH_WORKER_SIGNING_KEY to run worker-key auth test.'
    )

    const missingEventId = randomUUID()
    const headers = buildSignedWorkerHeaders(
      'POST',
      '/api/publish/process',
      workerKey!,
      signingKey!
    )

    const firstResponse = await request.post('/api/publish/process', {
      headers,
      data: { publish_event_id: missingEventId, batch_size: 1 },
      maxRedirects: 0,
    })
    expect(firstResponse.status()).toBe(200)
    const firstBody = (await firstResponse.json()) as {
      ok?: boolean
      processed?: number
      sent?: number
      failed?: number
      publishEventCounts?: { queuedCount?: number; sentCount?: number; failedCount?: number } | null
    }
    expect(firstBody.ok).toBe(true)
    expect(firstBody.processed).toBe(0)
    expect(firstBody.sent).toBe(0)
    expect(firstBody.failed).toBe(0)
    expect(firstBody.publishEventCounts?.queuedCount ?? 0).toBe(0)

    const secondResponse = await request.post('/api/publish/process', {
      headers,
      data: { publish_event_id: missingEventId, batch_size: 1 },
      maxRedirects: 0,
    })
    expect(secondResponse.status()).toBe(200)
    const secondBody = (await secondResponse.json()) as {
      ok?: boolean
      processed?: number
      sent?: number
      failed?: number
      publishEventCounts?: { queuedCount?: number; sentCount?: number; failedCount?: number } | null
    }
    expect(secondBody).toEqual(firstBody)
  })
})
