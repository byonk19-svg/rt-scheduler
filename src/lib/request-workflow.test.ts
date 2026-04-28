import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  defaultRequestMessage,
  formatRequestShiftLabel,
  mutateShiftPost,
  requestInitials,
  requestSlotKey,
  toInterestRequestStatus,
  toRequestUiStatus,
} from '@/lib/request-workflow'

describe('request workflow helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('expires old pending requests while keeping other statuses intact', () => {
    expect(toRequestUiStatus('pending', '2026-04-26T11:59:59.000Z')).toBe('expired')
    expect(toRequestUiStatus('pending', '2026-04-27T18:00:00.000Z')).toBe('pending')
    expect(toRequestUiStatus('approved', '2026-04-20T12:00:00.000Z')).toBe('approved')
  })

  it('maps pickup interest states into the request status vocabulary', () => {
    expect(toInterestRequestStatus('selected')).toBe('selected')
    expect(toInterestRequestStatus('withdrawn')).toBe('withdrawn')
    expect(toInterestRequestStatus('declined')).toBe('denied')
    expect(toInterestRequestStatus('pending')).toBe('pending')
  })

  it('formats request defaults consistently', () => {
    expect(defaultRequestMessage('swap')).toBe('Requesting a swap for this shift.')
    expect(defaultRequestMessage('pickup')).toBe('Requesting pickup coverage for this shift.')
    expect(formatRequestShiftLabel('2026-04-30', 'day')).toBe('Thu, Apr 30 - Day')
    expect(requestSlotKey('2026-04-30', 'night')).toBe('2026-04-30:night')
    expect(requestInitials('Barbara C.')).toBe('BC')
  })

  it('surfaces server-side request mutation errors', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'Denied by policy' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(mutateShiftPost({ action: 'noop' })).rejects.toThrow('Denied by policy')
  })
})
