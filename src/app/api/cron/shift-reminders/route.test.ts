import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClientMock, queueAndSendShiftRemindersMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  queueAndSendShiftRemindersMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/shift-reminders', () => ({
  queueAndSendShiftReminders: queueAndSendShiftRemindersMock,
}))

import { GET } from '@/app/api/cron/shift-reminders/route'

function makeCronRequest(token?: string) {
  const headers = new Headers()
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  return new Request('https://example.test/api/cron/shift-reminders', {
    method: 'GET',
    headers,
  })
}

describe('GET /api/cron/shift-reminders', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 500 when CRON_SECRET is missing and does not call the worker', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(makeCronRequest('unused-token'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Cron not configured.' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(queueAndSendShiftRemindersMock).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('[cron/shift-reminders] CRON_SECRET is not configured')
  })

  it('returns 401 when the Authorization header is missing and does not call the worker', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'

    const response = await GET(makeCronRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized.' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(queueAndSendShiftRemindersMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the bearer token is wrong and does not call the worker', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'

    const response = await GET(makeCronRequest('wrong-token'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized.' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(queueAndSendShiftRemindersMock).not.toHaveBeenCalled()
  })

  it('creates the admin client, runs the worker, and returns the worker result for a valid token', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    const adminClient = { kind: 'admin-client' }
    const workerResult = {
      queued: 2,
      sent: 1,
      failed: 0,
    }
    createAdminClientMock.mockReturnValue(adminClient)
    queueAndSendShiftRemindersMock.mockResolvedValue(workerResult)

    const response = await GET(makeCronRequest('test-cron-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(workerResult)
    expect(createAdminClientMock).toHaveBeenCalledOnce()
    expect(queueAndSendShiftRemindersMock).toHaveBeenCalledWith(adminClient, expect.any(Date))
  })

  it('returns a generic 500 response when the worker throws', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const adminClient = { kind: 'admin-client' }
    const internalError = new Error('shift reminder RPC failed with internal detail')
    createAdminClientMock.mockReturnValue(adminClient)
    queueAndSendShiftRemindersMock.mockRejectedValue(internalError)

    const response = await GET(makeCronRequest('test-cron-secret'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'Failed to process shift reminders.' })
    expect(JSON.stringify(payload)).not.toContain(internalError.message)
    expect(createAdminClientMock).toHaveBeenCalledOnce()
    expect(queueAndSendShiftRemindersMock).toHaveBeenCalledWith(adminClient, expect.any(Date))
    expect(errorSpy).toHaveBeenCalledWith(
      '[cron/shift-reminders] Failed to process reminders:',
      internalError
    )
  })
})

describe('shift reminders cron schedule contract', () => {
  it('adds the shift reminders cron schedule to vercel.json', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }

    expect(config.crons).toContainEqual({
      path: '/api/cron/shift-reminders',
      schedule: '0 6 * * *',
    })
  })
})
