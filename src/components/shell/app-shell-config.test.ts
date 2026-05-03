import { describe, expect, it } from 'vitest'

import {
  APP_HEADER_HEIGHT,
  buildManagerSections,
  getShellContext,
  getStaffNavItems,
  usesAppShell,
} from '@/components/shell/app-shell-config'

describe('app-shell-config', () => {
  it('uses a single standard authenticated header height token', () => {
    expect(APP_HEADER_HEIGHT).toBe(44)
  })

  it('maps /team into the People section with Team, Requests, and Audit log local items', () => {
    const context = getShellContext({
      pathname: '/team',
      canAccessManagerUi: true,
      pendingCount: 3,
    })

    expect(context.primaryKey).toBe('people')
    expect(context.localNav?.items.map((item) => item.label)).toEqual([
      'Team',
      'Requests',
      'Audit log',
    ])
    expect(context.localNav?.items.find((item) => item.label === 'Requests')?.badgeCount).toBe(3)
  })

  it('does not return local nav for manager dashboard', () => {
    const context = getShellContext({
      pathname: '/dashboard/manager',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('today')
    expect(context.localNav).toBeNull()
  })

  it('keeps the manager sections grouped into Today, Schedule, and People', () => {
    const sections = buildManagerSections(0)
    expect(sections.map((section) => section.key)).toEqual(['today', 'schedule', 'people'])
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

  it('separates the editable schedule workspace from the read-only roster view', () => {
    const sections = buildManagerSections(0)
    const scheduleSection = sections.find((section) => section.key === 'schedule')

    expect(scheduleSection?.href).toBe('/coverage')
    expect(scheduleSection?.subItems.map((item) => item.label)).toEqual([
      'Schedule workspace',
      'Roster view',
      'Analytics',
      'Availability',
      'Lottery',
      'Publish',
      'Approvals',
      'Lottery',
    ])
    expect(
      scheduleSection?.subItems.find((item) => item.label === 'Schedule workspace')?.href
    ).toBe('/coverage')
    expect(scheduleSection?.subItems.find((item) => item.label === 'Roster view')?.href).toBe(
      '/schedule'
    )
  })

  it('treats /lottery as a manager Schedule workflow with a local Lottery item', () => {
    const sections = buildManagerSections(0)
    const scheduleSection = sections.find((section) => section.key === 'schedule')
    const context = getShellContext({
      pathname: '/lottery',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(scheduleSection?.subItems.map((item) => item.label)).toEqual([
      'Schedule workspace',
      'Roster view',
      'Analytics',
      'Availability',
      'Publish',
      'Approvals',
      'Lottery',
    ])
    expect(scheduleSection?.subItems.find((item) => item.label === 'Lottery')?.href).toBe(
      '/lottery'
    )
    expect(context.primaryKey).toBe('schedule')
    expect(
      context.localNav?.items.find((item) => item.label === 'Lottery')?.active('/lottery')
    ).toBe(true)
  })

  it('includes /lottery in the shared app shell allowlist', () => {
    expect(usesAppShell('/lottery')).toBe(true)
  })

  it('/shift-board is active under the manager Requests sub-nav item', () => {
    const context = getShellContext({
      pathname: '/shift-board',
      canAccessManagerUi: true,
      pendingCount: 0,
    })
    expect(context.primaryKey).toBe('people')
    const requestsItem = context.localNav?.items.find((item) => item.label === 'Requests')
    expect(requestsItem?.active('/shift-board')).toBe(true)
  })

  it('promotes /lottery into the manager schedule section and highlights it locally', () => {
    const context = getShellContext({
      pathname: '/lottery',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('schedule')
    expect(usesAppShell('/lottery')).toBe(true)
    const lotteryItem = context.localNav?.items.find((item) => item.label === 'Lottery')
    expect(lotteryItem?.href).toBe('/lottery')
    expect(lotteryItem?.active('/lottery')).toBe(true)
  })
})

describe('staff nav items', () => {
  it('exposes the expected labels in order', () => {
    const items = getStaffNavItems()
    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'My Shifts',
      'Future Availability',
      'Team Schedule',
      'Shift Swaps & Pickups',
      'History',
    ])
  })

  it('"My Shifts" routes to /therapist/schedule', () => {
    const items = getStaffNavItems()
    const myShifts = items.find((item) => item.label === 'My Shifts')
    expect(myShifts?.href).toBe('/therapist/schedule')
  })

  it('"My Shifts" is also active for the /staff/my-schedule compat URL', () => {
    const items = getStaffNavItems()
    const myShifts = items.find((item) => item.label === 'My Shifts')
    expect(myShifts?.active('/staff/my-schedule')).toBe(true)
  })

  it('"Shift Swaps & Pickups" routes to /therapist/swaps and is also active for /shift-board', () => {
    const items = getStaffNavItems()
    const swaps = items.find((item) => item.label === 'Shift Swaps & Pickups')
    expect(swaps?.href).toBe('/therapist/swaps')
    expect(swaps?.active('/shift-board')).toBe(true)
  })

  it('"Team Schedule" links to /coverage (the shared schedule workspace)', () => {
    const items = getStaffNavItems()
    const teamSchedule = items.find((item) => item.label === 'Team Schedule')
    expect(teamSchedule?.href).toBe('/coverage')
  })

  it('staff shell context has no local nav', () => {
    const context = getShellContext({
      pathname: '/therapist/schedule',
      canAccessManagerUi: false,
      pendingCount: 0,
    })
    expect(context.localNav).toBeNull()
  })

  it('"My Shifts" item is active on /therapist/schedule', () => {
    const context = getShellContext({
      pathname: '/therapist/schedule',
      canAccessManagerUi: false,
      pendingCount: 0,
    })
    const myShifts = context.primaryItems.find((item) => item.label === 'My Shifts')
    expect(myShifts?.active('/therapist/schedule')).toBe(true)
  })
})
