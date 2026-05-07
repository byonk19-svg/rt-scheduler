import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAvailabilityReminderEmails } from './availability-reminders'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const baseConfig = {
  resendApiKey: 'test-key',
  fromEmail: 'Teamwise <noreply@mail.teamwise.work>',
  resendApiUrl: 'https://api.resend.com/emails',
}

const baseInput = {
  cycleDateRange: 'Apr 28 – May 25',
  availabilityUrl: 'https://www.teamwise.work/availability',
  emailConfig: baseConfig,
}

function makeRecipient(overrides?: Partial<{ id: string; email: string; name: string | null }>) {
  return {
    therapistId: overrides?.id ?? 'therapist-1',
    email: overrides?.email ?? 'therapist@test.com',
    name: overrides && 'name' in overrides ? (overrides.name ?? null) : 'Jane Doe',
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({ ok: true, status: 200 })
})

describe('sendAvailabilityReminderEmails', () => {
  it('sends one email per recipient and returns correct counts', async () => {
    const recipients = [makeRecipient({ id: '1' }), makeRecipient({ id: '2', email: 'b@test.com' })]
    const result = await sendAvailabilityReminderEmails({ ...baseInput, recipients })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ sent: 2, failed: 0 })
  })

  it('returns { sent: 0, failed: 0 } when recipients list is empty', async () => {
    const result = await sendAvailabilityReminderEmails({ ...baseInput, recipients: [] })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, failed: 0 })
  })

  it('counts a failed Resend call and continues to remaining recipients', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 422 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const recipients = [makeRecipient({ id: '1' }), makeRecipient({ id: '2', email: 'b@test.com' })]
    const result = await sendAvailabilityReminderEmails({ ...baseInput, recipients })

    expect(result).toEqual({ sent: 1, failed: 1 })
  })

  it('includes the cycle date range in the email subject', async () => {
    await sendAvailabilityReminderEmails({ ...baseInput, recipients: [makeRecipient()] })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.subject).toContain('Apr 28 – May 25')
  })

  it('includes the availability URL in the email body', async () => {
    await sendAvailabilityReminderEmails({ ...baseInput, recipients: [makeRecipient()] })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.html).toContain('https://www.teamwise.work/availability')
    expect(body.text).toContain('https://www.teamwise.work/availability')
  })

  it('uses the recipient name in the greeting when available', async () => {
    await sendAvailabilityReminderEmails({
      ...baseInput,
      recipients: [makeRecipient({ name: 'Jane Doe' })],
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.html).toContain('Jane Doe')
  })

  it('falls back to a generic greeting when name is null', async () => {
    await sendAvailabilityReminderEmails({
      ...baseInput,
      recipients: [makeRecipient({ name: null })],
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.html).toContain('Hi there')
  })

  it('sends emails sequentially (not in parallel)', async () => {
    const callOrder: number[] = []
    let resolveFirst!: () => void
    mockFetch
      .mockImplementationOnce(
        () =>
          new Promise<{ ok: boolean; status: number }>((resolve) => {
            resolveFirst = () => {
              callOrder.push(1)
              resolve({ ok: true, status: 200 })
            }
          })
      )
      .mockImplementationOnce(() => {
        callOrder.push(2)
        return Promise.resolve({ ok: true, status: 200 })
      })

    const promise = sendAvailabilityReminderEmails({
      ...baseInput,
      recipients: [makeRecipient({ id: '1' }), makeRecipient({ id: '2', email: 'b@test.com' })],
    })

    // Second call should not have fired yet — first is still pending
    expect(mockFetch).toHaveBeenCalledTimes(1)
    resolveFirst()
    await promise
    expect(callOrder).toEqual([1, 2])
  })
})
