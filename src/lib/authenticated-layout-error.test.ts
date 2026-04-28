import { describe, expect, it } from 'vitest'

import { shouldIgnoreAuthenticatedLayoutError } from '@/lib/authenticated-layout-error'

describe('shouldIgnoreAuthenticatedLayoutError', () => {
  it('ignores Next dynamic server usage noise', async () => {
    const { DynamicServerError } = await import('next/dist/client/components/hooks-server-context')

    expect(shouldIgnoreAuthenticatedLayoutError(new DynamicServerError('used cookies'))).toBe(true)
  })

  it('keeps unexpected layout failures visible', () => {
    expect(shouldIgnoreAuthenticatedLayoutError(new Error('boom'))).toBe(false)
  })
})
