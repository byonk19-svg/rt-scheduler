import { describe, expect, it } from 'vitest'

import {
  APP_HEADER_HEIGHT,
  buildManagerSections,
  getShellContext,
  usesAppShell,
} from '@/components/shell/app-shell-config'

describe('app-shell-config', () => {
  it('uses a single standard authenticated header height token', () => {
    expect(APP_HEADER_HEIGHT).toBe(56)
  })

  it('maps /team into the People section with Team, Open shifts, Access requests, and Audit log local items', () => {
    const context = getShellContext({
      pathname: '/team',
      canAccessManagerUi: true,
      pendingCount: 3,
    })

    expect(context.primaryKey).toBe('people')
    expect(context.localNav?.items.map((item) => item.label)).toEqual([
      'Team',
      'Open shifts',
      'Access requests',
      'Audit log',
    ])
    expect(
      context.localNav?.items.find((item) => item.label === 'Access requests')?.badgeCount
    ).toBe(3)
  })

  it('does not return local nav for manager dashboard', () => {
    const context = getShellContext({
      pathname: '/dashboard/manager',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('inbox')
    expect(context.localNav).toBeNull()
  })

  it('keeps the manager sections grouped into Inbox, Schedule, and People', () => {
    const sections = buildManagerSections(0)
    expect(sections.map((section) => section.key)).toEqual(['inbox', 'schedule', 'people'])
  })

  it('adds Analytics under Schedule and keeps /analytics schedule-active', () => {
    const context = getShellContext({
      pathname: '/analytics',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('schedule')
    expect(context.localNav?.items.find((item) => item.label === 'Analytics')?.href).toBe(
      '/analytics'
    )
  })

  it('keeps schedule local nav focused on workflow pages inside the canonical schedule workspace', () => {
    const context = getShellContext({
      pathname: '/schedule',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('schedule')
    expect(context.localNav?.items.map((item) => item.label)).toContain('Coverage')
    expect(context.localNav?.items.map((item) => item.label)).toContain('History')
    expect(context.localNav?.items.find((item) => item.label === 'Coverage')?.href).toBe(
      '/coverage'
    )
    expect(context.localNav?.items.map((item) => item.label)).not.toContain('Roster')
  })

  it('keeps /staff child routes inside the authenticated app shell', () => {
    expect(usesAppShell('/staff/my-schedule')).toBe(true)
    expect(usesAppShell('/staff/history')).toBe(true)
  })
})
