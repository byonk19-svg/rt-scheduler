import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getInitialTeamTab } from '@/app/(app)/team/team-page-tabs'

describe('getInitialTeamTab', () => {
  it('defaults the Team page to Directory when no tab is requested', () => {
    expect(getInitialTeamTab()).toBe('directory')
    expect(getInitialTeamTab({})).toBe('directory')
  })

  it('honors explicit Directory and Employee roster tab requests', () => {
    expect(getInitialTeamTab({ tab: 'directory' })).toBe('directory')
    expect(getInitialTeamTab({ tab: 'roster' })).toBe('roster')
  })

  it('uses the first tab value when duplicate tab params are provided', () => {
    expect(getInitialTeamTab({ tab: ['roster', 'directory'] })).toBe('roster')
    expect(getInitialTeamTab({ tab: ['directory', 'roster'] })).toBe('directory')
  })

  it('falls back to Directory for unsupported tab values', () => {
    expect(getInitialTeamTab({ tab: 'unknown' })).toBe('directory')
  })
})

describe('Team page source contract', () => {
  it('uses clear actions for import and roster export scopes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/team/page.tsx'), 'utf8')

    expect(source).toContain("import Link from 'next/link'")
    expect(source).toContain('<Link')
    expect(source).toContain('href="/team/import"')
    expect(source).not.toContain('<a\n            href="/team/import"')
    expect(source).toContain('href="/api/team/roster/export?scope=active"')
    expect(source).toContain('Export active roster')
    expect(source).toContain('href="/api/team/roster/export?scope=all"')
    expect(source).toContain('Export all roster')
  })
})
