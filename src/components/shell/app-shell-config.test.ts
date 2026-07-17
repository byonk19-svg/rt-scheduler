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
    expect(APP_HEADER_HEIGHT).toBe(64)
  })

  it('uses direct manager workflow nav without local section tabs', () => {
    const context = getShellContext({
      pathname: '/shift-board',
      canAccessManagerUi: true,
      pendingCount: 3,
    })

    expect(context.primaryKey).toBe('shift-board')
    expect(context.localNav).toBeNull()
  })

  it('does not return local nav for manager dashboard', () => {
    const context = getShellContext({
      pathname: '/dashboard/manager',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('dashboard')
    expect(context.localNav).toBeNull()
  })

  it('keeps manager top navigation aligned to primary workflows', () => {
    const sections = buildManagerSections(0)
    expect(sections.map((section) => section.key)).toEqual([
      'dashboard',
      'team-schedule',
      'availability',
      'shift-board',
      'access',
      'publish',
      'analytics',
      'audit',
      'lottery',
    ])
    expect(sections.map((section) => section.label)).toEqual([
      'Dashboard',
      'Team Schedule',
      'Availability',
      'Shift Board',
      'Access',
      'Publish',
      'Analytics',
      'Audit',
      'Lottery',
    ])
  })

  it('surfaces pending user access work as a manager Access navigation badge', () => {
    const context = getShellContext({
      pathname: '/requests/user-access',
      canAccessManagerUi: true,
      pendingCount: 4,
    })

    const accessItem = context.primaryItems.find((item) => item.label === 'Access')
    expect(context.primaryKey).toBe('access')
    expect(accessItem?.href).toBe('/requests/user-access')
    expect(accessItem?.badgeCount).toBe(4)
    expect(accessItem?.active('/requests/user-access')).toBe(true)
  })

  it('keeps zero pending user access work visible without a badge', () => {
    const sections = buildManagerSections(0)
    const accessSection = sections.find((section) => section.key === 'access')

    expect(accessSection?.label).toBe('Access')
    expect(accessSection?.href).toBe('/requests/user-access')
    expect(accessSection?.badgeCount).toBeUndefined()
  })

  it('keeps planning and coverage routes active under Team Schedule', () => {
    const context = getShellContext({
      pathname: '/coverage',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('team-schedule')
    expect(context.localNav).toBeNull()

    const planningContext = getShellContext({
      pathname: '/schedule/planning',
      canAccessManagerUi: true,
      pendingCount: 0,
    })
    expect(planningContext.primaryKey).toBe('team-schedule')
  })

  it('promotes publish, analytics, and audit routes as manager navigation destinations', () => {
    const sections = buildManagerSections(0)

    expect(sections.find((section) => section.key === 'publish')?.href).toBe('/publish')
    expect(sections.find((section) => section.key === 'analytics')?.href).toBe('/analytics')
    expect(sections.find((section) => section.key === 'audit')?.href).toBe('/settings/audit-log')

    expect(
      getShellContext({ pathname: '/publish/abc', canAccessManagerUi: true, pendingCount: 0 })
        .primaryKey
    ).toBe('publish')
    expect(
      getShellContext({ pathname: '/preliminary', canAccessManagerUi: true, pendingCount: 0 })
        .primaryKey
    ).toBe('publish')
    expect(
      getShellContext({ pathname: '/analytics', canAccessManagerUi: true, pendingCount: 0 })
        .primaryKey
    ).toBe('analytics')
    expect(
      getShellContext({
        pathname: '/settings/audit-log',
        canAccessManagerUi: true,
        pendingCount: 0,
      }).primaryKey
    ).toBe('audit')
  })

  it('routes Team Schedule to the unified schedule grid', () => {
    const sections = buildManagerSections(0)
    const scheduleSection = sections.find((section) => section.key === 'team-schedule')

    expect(scheduleSection?.href).toBe('/schedule')
    expect(scheduleSection?.label).toBe('Team Schedule')
    expect(scheduleSection?.subItems).toEqual([])
  })

  it('exposes /lottery as a first-class manager navigation item', () => {
    const context = getShellContext({
      pathname: '/lottery',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('lottery')
    expect(usesAppShell('/lottery')).toBe(true)
    expect(context.localNav).toBeNull()
    const lotteryItem = context.primaryItems.find((item) => item.label === 'Lottery')
    expect(lotteryItem?.href).toBe('/lottery')
    expect(lotteryItem?.active('/lottery')).toBe(true)
  })

  it('/shift-board is active as the manager Shift Board top navigation item', () => {
    const context = getShellContext({
      pathname: '/shift-board',
      canAccessManagerUi: true,
      pendingCount: 0,
    })

    expect(context.primaryKey).toBe('shift-board')
    const shiftBoardItem = context.primaryItems.find((item) => item.label === 'Shift Board')
    expect(shiftBoardItem?.href).toBe('/shift-board')
    expect(shiftBoardItem?.active('/shift-board')).toBe(true)
  })

  it('does not make People active on the manager Shift Board route', () => {
    const context = getShellContext({
      pathname: '/shift-board',
      canAccessManagerUi: true,
      pendingCount: 2,
    })

    expect(context.primaryItems.map((item) => item.label)).not.toContain('People')
    expect(context.primaryKey).toBe('shift-board')
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
    expect(items.map((item) => item.label)).not.toContain('Access')
  })

  it('promotes pending manager Access work into the mobile quick navigation', () => {
    const items = getMobilePrimaryItems({ canAccessManagerUi: true, pendingCount: 3 })

    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'Schedule',
      'Availability',
      'Access',
    ])
    const accessItem = items.find((item) => item.label === 'Access')
    expect(accessItem?.href).toBe('/requests/user-access')
    expect(accessItem?.badgeCount).toBe(3)
    expect(accessItem?.active('/requests/user-access')).toBe(true)
  })

  it('does not expose manager Access navigation to staff shell context', () => {
    const context = getShellContext({
      pathname: '/therapist/schedule',
      canAccessManagerUi: false,
      pendingCount: 5,
    })

    expect(context.primaryItems.map((item) => item.label)).not.toContain('Access')
    expect(context.primaryItems.map((item) => item.label)).not.toContain('Publish')
    expect(context.primaryItems.map((item) => item.label)).not.toContain('Analytics')
    expect(context.primaryItems.map((item) => item.label)).not.toContain('Audit')
    expect(context.primaryItems.some((item) => item.href === '/requests/user-access')).toBe(false)
  })

  it('returns manager workflow context for user access routes', () => {
    expect(
      getWorkflowContext({ pathname: '/requests/user-access', canAccessManagerUi: true })
    ).toEqual({
      workflow: 'Access',
      context: 'Pending account requests',
      state: 'Pending, approved, declined',
      permission: 'Manager controlled',
    })
  })

  it('returns manager workflow context for schedule routes', () => {
    expect(getWorkflowContext({ pathname: '/schedule', canAccessManagerUi: true })).toEqual({
      workflow: 'Team Schedule',
      context: 'Schedule grid and coverage review',
      state: 'Draft, review, publish',
      permission: 'Manager editable',
    })
    expect(getWorkflowContext({ pathname: '/coverage', canAccessManagerUi: true })).toEqual({
      workflow: 'Team Schedule',
      context: 'Schedule grid and coverage review',
      state: 'Draft, review, publish',
      permission: 'Manager editable',
    })
    expect(
      getWorkflowContext({ pathname: '/schedule/planning', canAccessManagerUi: true })
    ).toEqual({
      workflow: 'Planning',
      context: 'Future blocks',
      state: 'Planning',
      permission: 'Manager edit',
    })
    expect(getWorkflowContext({ pathname: '/settings', canAccessManagerUi: true })).toBeNull()
  })

  it('returns manager workflow context for publish, analytics, and audit routes', () => {
    expect(getWorkflowContext({ pathname: '/publish', canAccessManagerUi: true })).toEqual({
      workflow: 'Publish',
      context: 'Schedule Block history',
      state: 'Queued, published, offline',
      permission: 'Manager controlled',
    })
    expect(getWorkflowContext({ pathname: '/preliminary', canAccessManagerUi: true })).toEqual({
      workflow: 'Publish',
      context: 'Preliminary schedule handoff',
      state: 'Review before final publish',
      permission: 'Manager approval required',
    })
    expect(getWorkflowContext({ pathname: '/analytics', canAccessManagerUi: true })).toEqual({
      workflow: 'Analytics',
      context: 'Schedule and staffing trends',
      state: 'Review metrics',
      permission: 'Manager visibility',
    })
    expect(
      getWorkflowContext({ pathname: '/settings/audit-log', canAccessManagerUi: true })
    ).toEqual({
      workflow: 'Audit',
      context: 'Operational change history',
      state: 'Review events',
      permission: 'Manager visibility',
    })
  })

  it('returns manager workflow context for availability', () => {
    expect(getWorkflowContext({ pathname: '/availability', canAccessManagerUi: true })).toEqual({
      workflow: 'Availability',
      context: 'Team availability exceptions',
      state: 'Missing, submitted, manager edited',
      permission: 'Manager-managed after lock',
    })
  })
})

describe('staff nav items', () => {
  it('exposes the expected labels in order', () => {
    const items = getStaffNavItems()
    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'My Shifts',
      'Availability',
      'Shift Board',
      'History',
    ])
  })

  it('"My Shifts" routes to /schedule', () => {
    const items = getStaffNavItems()
    const schedule = items.find((item) => item.label === 'My Shifts')
    expect(schedule?.href).toBe('/schedule')
  })

  it('"My Shifts" is active for legacy personal and team schedule URLs', () => {
    const items = getStaffNavItems()
    const schedule = items.find((item) => item.label === 'My Shifts')
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

  it('"My Shifts" item is active on /therapist/schedule', () => {
    const context = getShellContext({
      pathname: '/therapist/schedule',
      canAccessManagerUi: false,
      pendingCount: 0,
    })
    const schedule = context.primaryItems.find((item) => item.label === 'My Shifts')
    expect(schedule?.active('/therapist/schedule')).toBe(true)
  })

  it('uses explicit staff mobile workflow destinations', () => {
    const items = getMobilePrimaryItems({ canAccessManagerUi: false, pendingCount: 0 })

    expect(items.map((item) => item.label)).toEqual([
      'Dashboard',
      'My Shifts',
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

    expect(items.map((item) => item.label)).toEqual(['Dashboard', 'My Shifts', 'Shift Board'])
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
