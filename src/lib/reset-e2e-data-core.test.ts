import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildTeamwiseTestAuthDeletionPlan,
  loadResetSchemaPlan,
} from '../../scripts/lib/reset-e2e-data-core.mjs'

describe('loadResetSchemaPlan', () => {
  it('derives the current public-table reset order from repo migrations', () => {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const plan = loadResetSchemaPlan(migrationsDir)

    expect(plan.tables.map((table) => table.name)).toContain('therapist_availability_submissions')
    expect(plan.tables.map((table) => table.name)).toContain('availability_overrides')
    expect(plan.tables.map((table) => table.name)).toContain('shift_operational_entries')
    expect(plan.tables.map((table) => table.name)).toContain('shifts')
    expect(plan.tables.map((table) => table.name)).toContain('work_patterns')
    expect(plan.tables.map((table) => table.name)).toContain('schedule_cycles')
    expect(plan.tables.map((table) => table.name)).toContain('profiles')
    expect(plan.tables.map((table) => table.name)).not.toContain('users')

    expect(plan.deleteOrder.indexOf('therapist_availability_submissions')).toBeLessThan(
      plan.deleteOrder.indexOf('schedule_cycles')
    )
    expect(plan.deleteOrder.indexOf('availability_overrides')).toBeLessThan(
      plan.deleteOrder.indexOf('profiles')
    )
    expect(plan.deleteOrder.indexOf('work_patterns')).toBeLessThan(
      plan.deleteOrder.indexOf('profiles')
    )
    expect(plan.deleteOrder.indexOf('shift_post_interests')).toBeLessThan(
      plan.deleteOrder.indexOf('shift_posts')
    )
    expect(plan.deleteOrder.indexOf('shift_posts')).toBeLessThan(plan.deleteOrder.indexOf('shifts'))
    expect(plan.deleteOrder.indexOf('shifts')).toBeLessThan(
      plan.deleteOrder.indexOf('schedule_cycles')
    )
    expect(plan.deleteOrder.at(-1)).toBe('profiles')
  })
})

describe('buildTeamwiseTestAuthDeletionPlan', () => {
  it('matches only auth users in the teamwise.test domain', () => {
    const plan = buildTeamwiseTestAuthDeletionPlan([
      { id: '1', email: 'demo-manager@teamwise.test' },
      { id: '2', email: 'demo-therapist01@TEAMWISE.TEST' },
      { id: '3', email: 'manager@hospital.org' },
      { id: '4', email: 'demo-support@teamwise.dev' },
      { id: '5', email: null },
    ])

    expect(plan.summary).toEqual({
      total: 5,
      matched: 2,
      skipped: 3,
    })
    expect(plan.matches.map((entry) => entry.email)).toEqual([
      'demo-manager@teamwise.test',
      'demo-therapist01@teamwise.test',
    ])
  })
})
