import { afterEach, describe, expect, it, vi } from 'vitest'

import { isValidPublishWorkerRequest } from '@/lib/security/worker-auth'

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toHex(signature)
}

function buildPayload(method: string, pathname: string, timestamp: number): string {
  return [method.toUpperCase(), pathname, String(timestamp)].join('\n')
}

const ORIGINAL_ENV = {
  PUBLISH_WORKER_KEY: process.env.PUBLISH_WORKER_KEY,
  PUBLISH_WORKER_SIGNING_KEY: process.env.PUBLISH_WORKER_SIGNING_KEY,
}

describe('isValidPublishWorkerRequest', () => {
  afterEach(() => {
    process.env.PUBLISH_WORKER_KEY = ORIGINAL_ENV.PUBLISH_WORKER_KEY
    process.env.PUBLISH_WORKER_SIGNING_KEY = ORIGINAL_ENV.PUBLISH_WORKER_SIGNING_KEY
    vi.useRealTimers()
  })

  it('accepts a valid signed worker request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-08T12:00:00.000Z'))

    process.env.PUBLISH_WORKER_KEY = 'worker-key'
    process.env.PUBLISH_WORKER_SIGNING_KEY = 'worker-signing-key'

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signPayload(
      'worker-signing-key',
      buildPayload('POST', '/api/publish/process', timestamp)
    )

    const request = new Request('https://app.example.com/api/publish/process', {
      method: 'POST',
      headers: {
        'x-publish-worker-key': 'worker-key',
        'x-publish-worker-timestamp': String(timestamp),
        'x-publish-worker-signature': signature,
      },
    })

    await expect(isValidPublishWorkerRequest(request)).resolves.toBe(true)
  })

  it('rejects request when signature is missing', async () => {
    process.env.PUBLISH_WORKER_KEY = 'worker-key'
    process.env.PUBLISH_WORKER_SIGNING_KEY = 'worker-signing-key'

    const request = new Request('https://app.example.com/api/publish/process', {
      method: 'POST',
      headers: {
        'x-publish-worker-key': 'worker-key',
        'x-publish-worker-timestamp': String(Math.floor(Date.now() / 1000)),
      },
    })

    await expect(isValidPublishWorkerRequest(request)).resolves.toBe(false)
  })

  it('rejects stale timestamps outside replay window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-08T12:00:00.000Z'))

    process.env.PUBLISH_WORKER_KEY = 'worker-key'
    process.env.PUBLISH_WORKER_SIGNING_KEY = 'worker-signing-key'

    const oldTimestamp = Math.floor(Date.now() / 1000) - 600
    const signature = await signPayload(
      'worker-signing-key',
      buildPayload('POST', '/api/publish/process', oldTimestamp)
    )

    const request = new Request('https://app.example.com/api/publish/process', {
      method: 'POST',
      headers: {
        'x-publish-worker-key': 'worker-key',
        'x-publish-worker-timestamp': String(oldTimestamp),
        'x-publish-worker-signature': signature,
      },
    })

    await expect(isValidPublishWorkerRequest(request)).resolves.toBe(false)
  })
})
