import { describe, expect, it } from 'vitest'

import { can, type Permission } from '@/lib/auth/can'

const MANAGER_ONLY_PERMISSIONS: Permission[] = [
  'access_manager_ui',
  'manage_schedule',
  'manage_publish',
  'manage_directory',
  'manage_coverage',
  'review_shift_posts',
  'export_all_availability',
]

describe('can - manager-only permissions', () => {
  it.each(MANAGER_ONLY_PERMISSIONS)('%s: grants access to manager', (permission) => {
    expect(can('manager', permission)).toBe(true)
  })

  it.each(MANAGER_ONLY_PERMISSIONS)('%s: denies access to therapist', (permission) => {
    expect(can('therapist', permission)).toBe(false)
  })

  it.each(MANAGER_ONLY_PERMISSIONS)('%s: denies access to lead', (permission) => {
    expect(can('lead', permission)).toBe(false)
  })

  it.each(MANAGER_ONLY_PERMISSIONS)('%s: denies access to null role', (permission) => {
    expect(can(null, permission)).toBe(false)
  })

  it.each(MANAGER_ONLY_PERMISSIONS)('%s: denies access to unknown role string', (permission) => {
    expect(can('admin', permission)).toBe(false)
  })

  it.each(MANAGER_ONLY_PERMISSIONS)('%s: denies access to inactive managers', (permission) => {
    expect(can('manager', permission, { isActive: false })).toBe(false)
  })

  it.each(MANAGER_ONLY_PERMISSIONS)('%s: denies access to archived managers', (permission) => {
    expect(can('manager', permission, { archivedAt: '2026-03-19T08:00:00.000Z' })).toBe(false)
  })
})

describe('can - update_assignment_status', () => {
  it('grants access to manager without context', () => {
    expect(can('manager', 'update_assignment_status')).toBe(true)
  })

  it('grants access to lead without context', () => {
    expect(can('lead', 'update_assignment_status')).toBe(true)
  })

  it('denies access to therapist with isLeadEligible: true', () => {
    expect(can('therapist', 'update_assignment_status', { isLeadEligible: true })).toBe(false)
  })

  it('denies access to therapist with isLeadEligible: false', () => {
    expect(can('therapist', 'update_assignment_status', { isLeadEligible: false })).toBe(false)
  })

  it('denies access to therapist with no context', () => {
    expect(can('therapist', 'update_assignment_status')).toBe(false)
  })

  it('denies access when role is null', () => {
    expect(can(null, 'update_assignment_status')).toBe(false)
  })

  it('denies access for unknown role string', () => {
    expect(can('admin', 'update_assignment_status')).toBe(false)
  })

  it('denies access to inactive leads', () => {
    expect(can('lead', 'update_assignment_status', { isActive: false })).toBe(false)
  })
})

describe('can - raw string role input', () => {
  it('accepts a raw string role value and resolves it', () => {
    expect(can('manager', 'manage_schedule')).toBe(true)
    expect(can('therapist', 'manage_schedule')).toBe(false)
  })

  it('rejects non-string values gracefully', () => {
    expect(can(undefined, 'manage_schedule')).toBe(false)
    expect(can(42, 'manage_schedule')).toBe(false)
    expect(can({}, 'manage_schedule')).toBe(false)
  })
})
