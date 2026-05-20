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
      'lottery',
    ])
    expect(sections.map((section) => section.label)).toEqual([
      'Dashboard',
      'Team Schedule',
      'Availability',
      'Shift Board',
      'Lottery',
    ])
  })

  it('keeps supporting schedule routes active under Team Schedule', () => {
    const context = getShellContext({
      pathname: '/analytics',
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
