import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClientMock, isValidResendWebhookRequestMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  isValidResendWebhookRequestMock: vi.fn(async () => true),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/security/resend-webhook', () => ({
  isValidResendWebhookRequest: isValidResendWebhookRequestMock,
}))

import { POST } from '@/app/api/inbound/availability-email/route'

const ONE_PAGE_PDF_BYTES = Uint8Array.from(
  Buffer.from(
    'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDQgPj4Kc3RhcnR4cmVmCjE4NgolJUVPRg==',
    'base64'
  )
)

function createAdminMock() {
  const state = {
    intakeUpserts: [] as Array<Record<string, unknown>>,
    attachmentUpserts: [] as Array<Record<string, unknown>>,
    itemInserts: [] as Array<Array<Record<string, unknown>>>,
    overrideUpserts: [] as Array<Array<Record<string, unknown>>>,
  }

  return {
    state,
    from(table: string) {
      const filters = new Map<string, unknown>()
      const builder = {
        select() {
          return builder
        },
        in(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        is(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        gte(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        order() {
          return builder
        },
        upsert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          if (table === 'availability_email_intakes') {
            state.intakeUpserts.push(payload as Record<string, unknown>)
            return {
              select() {
                return {
                  single: async () => ({ data: { id: 'intake-1' }, error: null }),
                }
              },
            }
          }

          if (table === 'availability_email_attachments') {
            state.attachmentUpserts.push(payload as Record<string, unknown>)
            return Promise.resolve({ error: null })
          }

          if (table === 'availability_overrides') {
            state.overrideUpserts.push(payload as Array<Record<string, unknown>>)
            return Promise.resolve({ error: null })
          }

          return Promise.resolve({ error: null })
        },
        insert(payload: Array<Record<string, unknown>>) {
          if (table === 'availability_email_intake_items') {
            state.itemInserts.push(payload)
          }
          return Promise.resolve({ error: null })
        },
        maybeSingle: async () => {
          if (table === 'profiles') {
            return { data: null, error: null }
          }
          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === 'profiles') {
            return Promise.resolve(
              resolve({
                data: [
                  { id: 'therapist-1', full_name: 'Brianna Brown', is_active: true },
                  { id: 'therapist-2', full_name: 'Brian Brown', is_active: true },
                ],
                error: null,
              })
            )
          }

          if (table === 'schedule_cycles') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'cycle-1',
                    label: 'Block 1',
                    start_date: '2026-03-22',
                    end_date: '2026-05-02',
                  },
                ],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: null, error: null }))
        },
      }

      return builder
    },
  }
}

function createWebhookRequest(emailId = 'email-1') {
  return new Request('https://example.test/api/inbound/availability-email', {
    method: 'POST',
    body: JSON.stringify({
      type: 'email.received',
      data: { email_id: emailId },
    }),
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('POST /api/inbound/availability-email', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.RESEND_API_KEY = 'resend-test'
    process.env.OPENAI_API_KEY = 'openai-test'
  })

  it('creates batch items and auto-applies only high-confidence sources', async () => {
    const admin = createAdminMock()
    createAdminClientMock.mockReturnValue(admin)

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith('/email-1/attachments')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'attachment-1',
                filename: 'form-1.jpg',
                content_type: 'image/jpeg',
                url: 'https://download.test/form-1.jpg',
              },
            ],
          }),
        }
      }

      if (input.endsWith('/email-1')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'email-1',
              from: { email: 'manager@example.com', name: 'Manager' },
              subject: 'Batch request',
              text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
              created_at: '2026-03-20T12:00:00Z',
              message_id: 'msg-1',
            },
          }),
        }
      }

      if (input === 'https://download.test/form-1.jpg') {
        return {
          ok: true,
          arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        }
      }

      if (input === 'https://api.openai.com/v1/responses') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          input?: Array<{ content?: Array<{ type: string }> }>
        }
        const firstContentType = body.input?.[0]?.content?.[1]?.type
        return {
          ok: true,
          json: async () => ({
            output_text:
              firstContentType === 'input_image'
                ? 'Employee Name: Brown\nNeed off Mar 25'
                : 'Employee Name: Brianna Brown\nNeed off Mar 24',
          }),
        }
      }

      throw new Error(`Unhandled fetch: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createWebhookRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      intake_id: 'intake-1',
      parse_status: 'needs_review',
      item_count: 2,
    })
    expect(admin.state.intakeUpserts[0]).toMatchObject({
      item_count: 2,
      auto_applied_count: 1,
      needs_review_count: 1,
      failed_count: 0,
    })
    expect(admin.state.itemInserts[0]).toHaveLength(2)
    expect(admin.state.overrideUpserts[0]).toEqual([
      expect.objectContaining({
        therapist_id: 'therapist-1',
        cycle_id: 'cycle-1',
        date: '2026-03-24',
      }),
    ])
  })

  it('treats generic pdf attachments as PDFs and auto-applies when confidence is high', async () => {
    const admin = createAdminMock()
    createAdminClientMock.mockReturnValue(admin)

    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith('/email-1/attachments')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'attachment-1',
                filename: 'request-form.pdf',
                content_type: 'application/octet-stream',
                url: 'https://download.test/request-form.pdf',
              },
            ],
          }),
        }
      }

      if (input.endsWith('/email-1')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'email-1',
              from: { email: 'manager@example.com', name: 'Manager' },
              subject: 'PDF request',
              text: '',
              created_at: '2026-03-20T12:00:00Z',
              message_id: 'msg-1',
            },
          }),
        }
      }

      if (input === 'https://download.test/request-form.pdf') {
        return {
          ok: true,
          arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        }
      }

      if (input === 'https://api.openai.com/v1/responses') {
        return {
          ok: true,
          json: async () => ({
            output_text: 'Employee Name: Brianna Brown\nNeed off Mar 24',
          }),
        }
      }

      throw new Error(`Unhandled fetch: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createWebhookRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      item_count: 2,
    })
    expect(admin.state.overrideUpserts[0]).toEqual([
      expect.objectContaining({
        therapist_id: 'therapist-1',
        cycle_id: 'cycle-1',
        date: '2026-03-24',
      }),
    ])
  })

  it('keeps processing when one attachment download fails', async () => {
    const admin = createAdminMock()
    createAdminClientMock.mockReturnValue(admin)

    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith('/email-1/attachments')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'attachment-1',
                filename: 'broken.pdf',
                content_type: 'application/pdf',
                url: 'https://download.test/broken.pdf',
              },
              {
                id: 'attachment-2',
                filename: 'form-2.jpg',
                content_type: 'image/jpeg',
                url: 'https://download.test/form-2.jpg',
              },
            ],
          }),
        }
      }

      if (input.endsWith('/email-1')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'email-1',
              from: { email: 'manager@example.com', name: 'Manager' },
              subject: null,
              text: '',
              created_at: '2026-03-20T12:00:00Z',
              message_id: 'msg-1',
            },
          }),
        }
      }

      if (input === 'https://download.test/broken.pdf') {
        return { ok: false, status: 500, text: async () => 'broken' }
      }

      if (input === 'https://download.test/form-2.jpg') {
        return {
          ok: true,
          arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        }
      }

      if (input === 'https://api.openai.com/v1/responses') {
        return {
          ok: true,
          json: async () => ({
            output_text: 'Employee Name: Brianna Brown\nNeed off Mar 26',
          }),
        }
      }

      throw new Error(`Unhandled fetch: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createWebhookRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      item_count: 2,
    })
    expect(admin.state.intakeUpserts[0]).toMatchObject({
      failed_count: 1,
      auto_applied_count: 1,
    })
    expect(admin.state.itemInserts[0]).toHaveLength(2)
  })

  it('falls back to image OCR when PDF extraction returns NO_TEXT', async () => {
    const admin = createAdminMock()
    createAdminClientMock.mockReturnValue(admin)

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith('/email-1/attachments')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'attachment-1',
                filename: 'scan.pdf',
                content_type: 'application/pdf',
                url: 'https://download.test/scan.pdf',
              },
            ],
          }),
        }
      }

      if (input.endsWith('/email-1')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'email-1',
              from: { email: 'manager@example.com', name: 'Manager' },
              subject: null,
              text: '',
              created_at: '2026-03-20T12:00:00Z',
              message_id: 'msg-1',
            },
          }),
        }
      }

      if (input === 'https://download.test/scan.pdf') {
        return {
          ok: true,
          arrayBuffer: async () => ONE_PAGE_PDF_BYTES.buffer.slice(0),
        }
      }

      if (input === 'https://api.openai.com/v1/responses') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          input?: Array<{ content?: Array<{ type: string }> }>
        }
        const content = body.input?.[0]?.content ?? []
        const isPdfRequest = content.some((part) => part.type === 'input_file')

        return {
          ok: true,
          json: async () => ({
            output_text: isPdfRequest ? 'NO_TEXT' : 'Employee Name: Brianna Brown\nNeed off Mar 24',
          }),
        }
      }

      throw new Error(`Unhandled fetch: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createWebhookRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      parse_status: 'applied',
      item_count: 1,
    })
    expect(admin.state.intakeUpserts[0]).toMatchObject({
      auto_applied_count: 1,
      needs_review_count: 0,
      failed_count: 0,
    })
    expect(admin.state.overrideUpserts[0]).toEqual([
      expect.objectContaining({
        therapist_id: 'therapist-1',
        cycle_id: 'cycle-1',
        date: '2026-03-24',
      }),
    ])
  })

  it('stores the OCR failure reason when pdf extraction fails before parsing', async () => {
    const admin = createAdminMock()
    createAdminClientMock.mockReturnValue(admin)

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith('/email-1/attachments')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'attachment-1',
                filename: 'scan.pdf',
                content_type: 'application/pdf',
                url: 'https://download.test/scan.pdf',
              },
            ],
          }),
        }
      }

      if (input.endsWith('/email-1')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'email-1',
              from: { email: 'manager@example.com', name: 'Manager' },
              subject: null,
              text: '',
              created_at: '2026-03-20T12:00:00Z',
              message_id: 'msg-1',
            },
          }),
        }
      }

      if (input === 'https://download.test/scan.pdf') {
        return {
          ok: true,
          arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        }
      }

      if (input === 'https://api.openai.com/v1/responses') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          input?: Array<{ content?: Array<{ type: string }> }>
        }
        const content = body.input?.[0]?.content ?? []
        const isPdfRequest = content.some((part) => part.type === 'input_file')

        return {
          ok: true,
          json: async () => ({
            output_text: isPdfRequest ? 'NO_TEXT' : 'NO_TEXT',
          }),
        }
      }

      throw new Error(`Unhandled fetch: ${input}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createWebhookRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      parse_status: 'needs_review',
      item_count: 1,
    })
    expect(admin.state.itemInserts[0]?.[0]).toMatchObject({
      source_label: 'scan.pdf',
      ocr_status: 'failed',
      ocr_error: expect.stringContaining('PDF'),
    })
  })
})
