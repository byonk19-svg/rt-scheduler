import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isValidResendWebhookRequestMock, createAdminClientMock } = vi.hoisted(() => ({
  isValidResendWebhookRequestMock: vi.fn(async () => true),
  createAdminClientMock: vi.fn(),
}))

vi.mock('@/lib/security/resend-webhook', () => ({
  isValidResendWebhookRequest: isValidResendWebhookRequestMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/availability-email-intake', () => ({
  parseAvailabilityEmail: vi.fn(() => ({
    status: 'parsed',
    summary: 'Parsed OK',
    requests: [],
    unresolvedLines: [],
    matchedCycleId: 'cycle-1',
  })),
  parseSender: vi.fn((raw: string) => ({ email: raw, name: null })),
  stripHtmlToText: vi.fn((html: string) => html),
}))

vi.mock('@/lib/openai-ocr', () => ({
  extractTextFromImageAttachment: vi.fn(async () => ({
    status: 'skipped',
    text: null,
    model: null,
  })),
}))

import { POST } from '@/app/api/inbound/availability-email/route'

type SupabaseMockOptions = {
  matchedTherapistId?: string | null
  intakeError?: { message: string } | null
  savedIntakeId?: string
}

function makeAdminMock(opts: SupabaseMockOptions = {}) {
  const {
    matchedTherapistId = 'therapist-1',
    intakeError = null,
    savedIntakeId = 'intake-1',
  } = opts

  const builder = {
    select: () => builder,
    ilike: () => builder,
    eq: () => builder,
    is: () => builder,
    gte: () => builder,
    order: () => builder,
    upsert: () => builder,
    maybeSingle: vi.fn(async () => ({
      data: matchedTherapistId ? { id: matchedTherapistId } : null,
      error: null,
    })),
    single: vi.fn(async () => ({
      data: intakeError ? null : { id: savedIntakeId },
      error: intakeError ?? null,
    })),
  }

  return {
    from: () => builder,
  }
}

function makeWebhookRequest(body: object, extraHeaders: Record<string, string> = {}) {
  const rawBody = JSON.stringify(body)
  return new Request('https://www.teamwise.work/api/inbound/availability-email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'msg_test',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,fakesig',
      ...extraHeaders,
    },
    body: rawBody,
  })
}

const EMAIL_RECEIVED_PAYLOAD = {
  type: 'email.received',
  data: { email_id: 'email-abc123' },
}

describe('inbound availability-email webhook', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isValidResendWebhookRequestMock.mockResolvedValue(true)
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_testsecret')
  })

  it('returns 400 when webhook signature is invalid', async () => {
    isValidResendWebhookRequestMock.mockResolvedValue(false)
    const response = await POST(makeWebhookRequest(EMAIL_RECEIVED_PAYLOAD))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid webhook signature.' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON body', async () => {
    const request = new Request('https://www.teamwise.work/api/inbound/availability-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    })
    // signature check reads the raw body; bypass it so we reach the JSON.parse
    isValidResendWebhookRequestMock.mockResolvedValue(true)
    const response = await POST(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid webhook payload.' })
  })

  it('returns 200 ok:true with ignored:true for non-email.received events', async () => {
    const response = await POST(makeWebhookRequest({ type: 'email.bounced', data: {} }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, ignored: true })
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns 400 when email_id is missing from payload', async () => {
    const response = await POST(makeWebhookRequest({ type: 'email.received', data: {} }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing email id.' })
  })

  it('returns 500 when admin client initialization fails', async () => {
    createAdminClientMock.mockImplementation(() => {
      throw new Error('Missing service role key')
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'email-abc123', from: 'test@example.com', subject: 'Avail' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    )

    const response = await POST(makeWebhookRequest(EMAIL_RECEIVED_PAYLOAD))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Could not initialize intake processing.',
    })
    fetchSpy.mockRestore()
  })

  it('processes a valid email.received event and returns intake id', async () => {
    const admin = makeAdminMock()
    createAdminClientMock.mockReturnValue(admin)

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        // fetchReceivedEmail
        new Response(
          JSON.stringify({
            id: 'email-abc123',
            from: 'therapist@example.com',
            subject: 'My availability',
            text: 'I need off March 15',
            created_at: '2026-04-01T10:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        // listReceivedEmailAttachments
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

    // Also mock cycle lookup
    vi.spyOn(admin, 'from').mockImplementation(() => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.ilike = () => builder
      builder.eq = () => builder
      builder.is = () => builder
      builder.gte = () => builder
      builder.order = () => builder
      builder.upsert = () => builder
      builder.maybeSingle = vi.fn(async () => ({ data: { id: 'therapist-1' }, error: null }))
      builder.single = vi.fn(async () => ({ data: { id: 'intake-1' }, error: null }))
      return builder as never
    })

    const response = await POST(makeWebhookRequest(EMAIL_RECEIVED_PAYLOAD))
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toMatchObject({ ok: true, intake_id: 'intake-1' })
    fetchSpy.mockRestore()
  })

  it('returns 500 when intake DB upsert fails', async () => {
    const admin = makeAdminMock({ intakeError: { message: 'DB constraint violation' } })
    createAdminClientMock.mockReturnValue(admin)

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'email-abc123',
            from: 'therapist@example.com',
            subject: 'Avail',
            text: 'Off March 15',
            created_at: '2026-04-01T10:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

    vi.spyOn(admin, 'from').mockImplementation(() => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.ilike = () => builder
      builder.eq = () => builder
      builder.is = () => builder
      builder.gte = () => builder
      builder.order = () => builder
      builder.upsert = () => builder
      builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
      builder.single = vi.fn(async () => ({
        data: null,
        error: { message: 'DB constraint violation' },
      }))
      return builder as never
    })

    const response = await POST(makeWebhookRequest(EMAIL_RECEIVED_PAYLOAD))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Could not store intake.' })
    fetchSpy.mockRestore()
  })
})
