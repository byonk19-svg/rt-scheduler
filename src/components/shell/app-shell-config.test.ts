import { describe, expect, it } from 'vitest'

import {
  APP_HEADER_HEIGHT,
  buildManagerSections,
  getMobilePrimaryItems,
  getShellContext,
  getStaffNavItems,
  getWorkflowContext,
  usesAppShell,
} from '@/components/shell/app-shell-config'

describe('app-shell-config', () => {
  it('uses a single standard authenticated header height token', () => {
    expect(APP_HEADER_HEIGHT).toBe(44)
  })

  it('maps /team into the People section with Team, Requests, Shift Board, and Audit log local items', () => {
    const context = getShellContext({
      pathname: '/team',
      canAccessManagerUi: true,
      pendingCount: 3,
    })

    expect(context.primaryKey).toBe('people')
    expect(context.localNav?.items.map((item) => item.label)).toEqual([
      'Team',
      'Requests',
      'Shift Board',
      'Audit log',
    ])
    const requestsItem = context.localNav?.items.find((item) => item.label === 'Requests')
    expect(requestsItem?.href).toBe('/requests/user-access')
    expect(requestsItem?.badgeCount).toBe(3)
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

  it('keeps the manager sections grouped into Dashboard, Schedule, and People', () => {
    const sections = buildManagerSections(0)
    expect(sections.map((section) => section.key)).toEqual(['today', 'schedule', 'people'])
    expect(sections.map((section) => section.label)).toEqual(['Dashboard', 'Schedule', 'People'])
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

  it('collapses Coverage and Roster View into one manager Schedule tab', () => {
    const sections = buildManagerSections(0)
    const scheduleSection = sections.find((section) => section.key === 'schedule')

    expect(scheduleSection?.href).toBe('/schedule')
    expect(scheduleSection?.subItems.map((item) => item.label)).toEqual([
      'Schedule',
      'Analytics',
      'Availability',
      'Lottery',
      'Publish',
      'Approvals',
    ])
    expect(scheduleSection?.subItems.find((item) => item.label === 'Schedule')?.href).toBe(
      '/schedule'
    )
  })

  it('exposes /lottery as a first-class Schedule navigation item', () => {
    const context = getShellContext({
      pathname: '/lottery',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('schedule')
    expect(usesAppShell('/lottery')).toBe(true)
    expect(context.localNav?.items.map((item) => item.label)).toEqual([
      'Schedule',
      'Analytics',
      'Availability',
      'Lottery',
      'Publish',
      'Approvals',
    ])
    const lotteryItem = context.localNav?.items.find((item) => item.label === 'Lottery')
    expect(lotteryItem?.href).toBe('/lottery')
    expect(lotteryItem?.active('/lottery')).toBe(true)
  })

  it('/shift-board is active under a direct manager Shift Board sub-nav item', () => {
    const context = getShellContext({
      pathname: '/shift-board',
      canAccessManagerUi: true,
      pendingCount: 0,
    })
    expect(context.primaryKey).toBe('people')
    const requestsItem = context.localNav?.items.find((item) => item.label === 'Requests')
    expect(requestsItem?.active('/shift-board')).toBe(false)
    expect(requestsItem?.href).toBe('/requests/user-access')
    expect(requestsItem?.active('/requests')).toBe(true)

    const shiftBoardItem = context.localNav?.items.find((item) => item.label === 'Shift Board')
    expect(shiftBoardItem?.href).toBe('/shift-board')
    expect(shiftBoardItem?.active('/shift-board')).toBe(true)
  })

  it('links manager Requests directly to user access while preserving active state and badge', () => {
    const context = getShellContext({
      pathname: '/requests/user-access',
      canAccessManagerUi: true,
      pendingCount: 2,
    })
    expect(context.primaryKey).toBe('people')
    const requestsItem = context.localNav?.items.find((item) => item.label === 'Requests')
    expect(requestsItem?.href).toBe('/requests/user-access')
    expect(requestsItem?.active('/requests/user-access')).toBe(true)
    expect(requestsItem?.active('/requests')).toBe(true)
    expect(requestsItem?.badgeCount).toBe(2)
  })

  it('uses explicit manager mobile workflow destinations instead of a generic action slot', () => {
    const items = getMobilePrimaryItems({ canAccessManagerUi: true, pendingCount: 0 })

    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'Schedule',
      'Availability',
      'Shift Board',
    ])
    expect(items.map((item) => item.href)).toEqual([
      '/dashboard/manager',
      '/schedule',
      '/availability',
      '/shift-board',
    ])
  })

  it('returns manager workflow context for schedule routes', () => {
    expect(getWorkflowContext({ pathname: '/schedule', canAccessManagerUi: true })).toEqual({
      workflow: 'Schedule',
      context: 'Unified grid workspace',
      state: 'Draft or published',
      permission: 'Manager editable',
    })
    expect(getWorkflowContext({ pathname: '/coverage', canAccessManagerUi: true })).toBeNull()
    expect(getWorkflowContext({ pathname: '/settings', canAccessManagerUi: true })).toBeNull()
  })
})

describe('staff nav items', () => {
  it('exposes the expected labels in order', () => {
    const items = getStaffNavItems()
    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'Schedule',
      'Availability',
      'Shift Board',
      'History',
    ])
  })

  it('"Schedule" routes to /schedule', () => {
    const items = getStaffNavItems()
    const schedule = items.find((item) => item.label === 'Schedule')
    expect(schedule?.href).toBe('/schedule')
  })

  it('"Schedule" is active for legacy personal and team schedule URLs', () => {
    const items = getStaffNavItems()
    const schedule = items.find((item) => item.label === 'Schedule')
    expect(schedule?.active('/staff/my-schedule')).toBe(true)
    expect(schedule?.active('/therapist/schedule')).toBe(true)
    expect(schedule?.active('/coverage')).toBe(true)
  })

  it('"Shift Board" routes to /shift-board and remains active for the legacy therapist swaps URL', () => {
    const items = getStaffNavItems()
    const shiftBoard = items.find((item) => item.label === 'Shift Board')
    expect(shiftBoard?.href).toBe('/shift-board')
    expect(shiftBoard?.active('/shift-board')).toBe(true)
    expect(shiftBoard?.active('/therapist/swaps')).toBe(true)
  })

  it('staff shell context has no local nav', () => {
    const context = getShellContext({
      pathname: '/therapist/schedule',
      canAccessManagerUi: false,
      pendingCount: 0,
    })
    expect(context.localNav).toBeNull()
  })

  it('"Schedule" item is active on /therapist/schedule', () => {
    const context = getShellContext({
      pathname: '/therapist/schedule',
      canAccessManagerUi: false,
      pendingCount: 0,
    })
    const schedule = context.primaryItems.find((item) => item.label === 'Schedule')
    expect(schedule?.active('/therapist/schedule')).toBe(true)
  })

  it('uses explicit staff mobile workflow destinations', () => {
    const items = getMobilePrimaryItems({ canAccessManagerUi: false, pendingCount: 0 })

    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'Schedule',
      'Availability',
      'Shift Board',
    ])
  })

  it('uses lead mobile workflow destinations without manager-only tools', () => {
    const items = getMobilePrimaryItems({
      canAccessManagerUi: false,
      canAccessLeadTools: true,
      pendingCount: 0,
    })

    expect(items.map((item) => item.label)).toEqual(['Dashboard', 'Schedule', 'Shift Board'])
    expect(items.map((item) => item.href)).toEqual([
      '/dashboard/staff',
      '/schedule',
      '/shift-board',
    ])
  })

  it('returns staff workflow context for schedule routes', () => {
    expect(
      getWorkflowContext({ pathname: '/therapist/schedule', canAccessManagerUi: false })
    ).toEqual({
      workflow: 'Schedule',
      context: 'Your row and team grid',
      state: 'Day, night, or both shifts',
      permission: 'Read-only for staff',
    })
    expect(getWorkflowContext({ pathname: '/profile', canAccessManagerUi: false })).toBeNull()
  })

  it('returns lead workflow context for operational schedule tools', () => {
    expect(
      getWorkflowContext({
        pathname: '/coverage',
        canAccessManagerUi: false,
        canAccessLeadTools: true,
      })
    ).toEqual({
      workflow: 'Schedule',
      context: 'Team schedule grid',
      state: 'Working, on call, call-in, cancelled',
      permission: 'Lead status updates',
    })

    expect(
      getWorkflowContext({
        pathname: '/shift-board',
        canAccessManagerUi: false,
        canAccessLeadTools: true,
      })?.permission
    ).toBe('Lead visibility; manager approval')
  })
})
