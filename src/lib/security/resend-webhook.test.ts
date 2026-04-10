import { afterEach, describe, expect, it, vi } from 'vitest'

import { isValidResendWebhookRequest } from '@/lib/security/resend-webhook'

const ORIGINAL_SECRET = process.env.RESEND_WEBHOOK_SECRET

function base64(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64')
}

async function sign(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(Buffer.from(secret, 'base64')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Buffer.from(signature).toString('base64')
}

describe('isValidResendWebhookRequest', () => {
  afterEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = ORIGINAL_SECRET
    vi.useRealTimers()
  })

  it('accepts a valid signed webhook request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T18:00:00.000Z'))

    const secret = base64('resend-webhook-secret')
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${secret}`

    const body = JSON.stringify({ type: 'email.received', data: { email_id: 'email-1' } })
    const timestamp = Math.floor(Date.now() / 1000)
    const messageId = 'msg_123'
    const signature = await sign(secret, `${messageId}.${timestamp}.${body}`)

    const request = new Request('https://teamwise.work/api/inbound/availability-email', {
      method: 'POST',
      headers: {
        'svix-id': messageId,
        'svix-timestamp': String(timestamp),
        'svix-signature': `v1,${signature}`,
      },
    })

    await expect(isValidResendWebhookRequest(request, body)).resolves.toBe(true)
  })

  it('rejects stale timestamps', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T18:00:00.000Z'))

    const secret = base64('resend-webhook-secret')
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${secret}`

    const body = JSON.stringify({ type: 'email.received', data: { email_id: 'email-1' } })
    const timestamp = Math.floor(Date.now() / 1000) - 900
    const messageId = 'msg_123'
    const signature = await sign(secret, `${messageId}.${timestamp}.${body}`)

    const request = new Request('https://teamwise.work/api/inbound/availability-email', {
      method: 'POST',
      headers: {
        'svix-id': messageId,
        'svix-timestamp': String(timestamp),
        'svix-signature': `v1,${signature}`,
      },
    })

    await expect(isValidResendWebhookRequest(request, body)).resolves.toBe(false)
  })
})
