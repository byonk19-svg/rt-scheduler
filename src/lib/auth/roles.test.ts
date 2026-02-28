import { describe, expect, it } from 'vitest'

import { isRole, parseRole, toUiRole } from '@/lib/auth/roles'

describe('isRole', () => {
  it('returns true for valid roles', () => {
    expect(isRole('manager')).toBe(true)
    expect(isRole('therapist')).toBe(true)
    expect(isRole('staff')).toBe(true)
    expect(isRole('lead')).toBe(true)
  })

  it('returns false for invalid strings', () => {
    expect(isRole('admin')).toBe(false)
    expect(isRole('')).toBe(false)
    expect(isRole('MANAGER')).toBe(false)
  })

  it('returns false for non-string values', () => {
    expect(isRole(null)).toBe(false)
    expect(isRole(undefined)).toBe(false)
    expect(isRole(42)).toBe(false)
    expect(isRole({})).toBe(false)
    expect(isRole([])).toBe(false)
  })
})

describe('parseRole', () => {
  it('returns the role for valid role strings', () => {
    expect(parseRole('manager')).toBe('manager')
    expect(parseRole('therapist')).toBe('therapist')
    expect(parseRole('staff')).toBe('staff')
    expect(parseRole('lead')).toBe('lead')
  })

  it('returns null for invalid or unknown values', () => {
    expect(parseRole('admin')).toBe(null)
    expect(parseRole('')).toBe(null)
    expect(parseRole(null)).toBe(null)
    expect(parseRole(undefined)).toBe(null)
    expect(parseRole(123)).toBe(null)
  })
})

describe('toUiRole', () => {
  it('returns "manager" for manager role', () => {
    expect(toUiRole('manager')).toBe('manager')
  })

  it('returns "therapist" for all non-manager roles', () => {
    expect(toUiRole('therapist')).toBe('therapist')
    expect(toUiRole('staff')).toBe('therapist')
    expect(toUiRole('lead')).toBe('therapist')
  })

  it('returns "therapist" for invalid or unknown values', () => {
    expect(toUiRole(null)).toBe('therapist')
    expect(toUiRole(undefined)).toBe('therapist')
    expect(toUiRole('admin')).toBe('therapist')
    expect(toUiRole('')).toBe('therapist')
  })
})
