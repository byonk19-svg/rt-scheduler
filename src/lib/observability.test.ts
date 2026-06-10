import { beforeEach, describe, expect, it, vi } from 'vitest'

const { captureExceptionMock, setContextMock, setTagMock, withScopeMock } = vi.hoisted(() => {
  const setContext = vi.fn()
  const setTag = vi.fn()
  return {
    captureExceptionMock: vi.fn(),
    setContextMock: setContext,
    setTagMock: setTag,
    withScopeMock: vi.fn(
      (callback: (scope: { setContext: typeof setContext; setTag: typeof setTag }) => void) => {
        callback({ setContext, setTag })
      }
    ),
  }
})

vi.mock('@sentry/core', () => ({
  captureException: captureExceptionMock,
  withScope: withScopeMock,
}))

import {
  buildStructuredLogEntry,
  captureSafeException,
  logStructuredEvent,
} from '@/lib/observability'

describe('observability helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds structured log entries with stable event names and safe context only', () => {
    expect(
      buildStructuredLogEntry({
        level: 'error',
        event: 'assignment_status.update.failed',
        now: new Date('2026-06-10T18:00:00.000Z'),
        context: {
          assignment_id: 'shift-1',
          code: 'XX000',
          omitted: undefined,
        },
      })
    ).toEqual({
      ts: '2026-06-10T18:00:00.000Z',
      level: 'error',
      event: 'assignment_status.update.failed',
      assignment_id: 'shift-1',
      code: 'XX000',
    })
  })

  it('writes structured JSON without adding raw secret-like values by itself', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logStructuredEvent('error', 'publish.process.failed', {
      publish_event_id: 'publish-1',
      worker_request: true,
    })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(String(errorSpy.mock.calls[0][0])) as Record<string, unknown>
    expect(logged).toMatchObject({
      level: 'error',
      event: 'publish.process.failed',
      publish_event_id: 'publish-1',
      worker_request: true,
    })
  })

  it('captures a generic Sentry exception with safe context instead of raw error text', () => {
    captureSafeException('assignment_status.update.failed', {
      assignment_id: 'shift-1',
      code: 'XX000',
    })

    expect(setTagMock).toHaveBeenCalledWith('event', 'assignment_status.update.failed')
    expect(setContextMock).toHaveBeenCalledWith('assignment_id', { value: 'shift-1' })
    expect(setContextMock).toHaveBeenCalledWith('code', { value: 'XX000' })
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error))
    const capturedError = captureExceptionMock.mock.calls[0][0] as Error
    expect(capturedError.message).toBe('assignment_status.update.failed')
  })
})
