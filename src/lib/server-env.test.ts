import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { requireEnv } from './server-env'

const ORIGINAL_ENV = process.env.TEST_REQUIRED_ENV
const ORIGINAL_SECRET_ENV = process.env.SECRET_ENV

describe('requireEnv', () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.TEST_REQUIRED_ENV
    } else {
      process.env.TEST_REQUIRED_ENV = ORIGINAL_ENV
    }

    if (ORIGINAL_SECRET_ENV === undefined) {
      delete process.env.SECRET_ENV
    } else {
      process.env.SECRET_ENV = ORIGINAL_SECRET_ENV
    }
  })

  it('returns a present value', () => {
    process.env.TEST_REQUIRED_ENV = 'present-value'

    expect(requireEnv('TEST_REQUIRED_ENV')).toBe('present-value')
  })

  it('throws for a missing value', () => {
    delete process.env.TEST_REQUIRED_ENV

    expect(() => requireEnv('TEST_REQUIRED_ENV')).toThrow(
      'Missing required environment variable: TEST_REQUIRED_ENV'
    )
  })

  it('throws for a blank or whitespace value', () => {
    for (const value of ['', '   ', '\n\t']) {
      process.env.TEST_REQUIRED_ENV = value

      expect(() => requireEnv('TEST_REQUIRED_ENV')).toThrow(
        'Missing required environment variable: TEST_REQUIRED_ENV'
      )
    }
  })

  it('includes the variable name but not the secret value in the error', () => {
    process.env.TEST_REQUIRED_ENV = 'super-secret-value'
    delete process.env.SECRET_ENV

    try {
      requireEnv('SECRET_ENV')
      throw new Error('Expected requireEnv to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('SECRET_ENV')
      expect((error as Error).message).not.toContain('super-secret-value')
    }
  })
})
