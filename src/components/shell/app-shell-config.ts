import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export const APP_HEADER_HEIGHT = 44
export const APP_PAGE_MAX_WIDTH_CLASS = 'mx-auto max-w-7xl px-4 md:px-6'

export type ShellNavItem = {
  href: string
  label: string
  active: (pathname: string) => boolean
  badgeCount?: number
}

export type ShellSection = {
  key: string
  label: string
  href: string
  isActive: (pathname: string) => boolean
  subItems: ShellNavItem[]
}

export type ShellContext = {
  primaryKey: string | null
  primaryItems: ShellNavItem[]
  localNav: { ariaLabel: string; items: ShellNavItem[] } | null
}

export type WorkflowContext = {
  workflow: string
  context: string
  state: string
  permission: string
}

const SHELL_ROUTES = [
  '/dashboard',
  '/coverage',
  '/analytics',
  '/availability',
  '/lottery',
  '/shift-board',
  '/publish',
  '/profile',
  '/approvals',
  '/preliminary',
  '/requests',
  '/notifications',
  '/swaps',
  '/staff',
  '/team',
  '/settings',
  '/therapist',
  '/schedule',
] as const

function routeFromHref(href: string): string {
  return href.split('#')[0]?.split('?')[0] ?? href
}

function isRouteActive(pathname: string, href: string): boolean {
  const route = routeFromHref(href)
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isManagerScheduleRoute(pathname: string): boolean {
  return (
    pathname === '/schedule' ||
    pathname === '/analytics' ||
    pathname === '/availability' ||
    pathname === '/lottery' ||
    pathname === '/publish' ||
    pathname.startsWith('/publish/') ||
    pathname === '/approvals'
  )
}

function isStaffScheduleRoute(pathname: string): boolean {
  return (
    pathname === '/therapist/schedule' ||
    pathname === '/staff/my-schedule' ||
    pathname === '/staff/schedule' ||
    pathname === '/coverage' ||
    pathname === '/schedule' ||
    pathname === '/preliminary' ||
    pathname === '/therapist/availability' ||
    pathname === '/availability' ||
    pathname === '/shift-board' ||
    pathname === '/therapist/swaps' ||
    pathname === '/requests/new' ||
    pathname === '/staff/requests' ||
    pathname === '/staff/history'
  )
}

export function usesAppShell(pathname: string): boolean {
  return SHELL_ROUTES.some((route) => isRouteActive(pathname, route))
}

export function buildManagerSections(pendingCount: number): readonly ShellSection[] {
  return [
    {
      key: 'today',
      label: 'Dashboard',
      href: MANAGER_WORKFLOW_LINKS.dashboard,
      isActive: (pathname) => pathname.startsWith('/dashboard/manager'),
      subItems: [],
    },
    {
      key: 'schedule',
      label: 'Schedule',
      href: '/schedule',
      isActive: (pathname) => isManagerScheduleRoute(pathname),
      subItems: [
        {
          href: '/schedule',
          label: 'Schedule',
          active: (pathname) => pathname === '/schedule',
        },
        {
          href: '/analytics',
          label: 'Analytics',
          active: (pathname) => pathname === '/analytics',
        },
        {
          href: '/availability',
          label: 'Availability',
          active: (pathname) => pathname === '/availability',
        },
        {
          href: MANAGER_WORKFLOW_LINKS.lottery,
          label: 'Lottery',
          active: (pathname) => pathname === MANAGER_WORKFLOW_LINKS.lottery,
        },
        {
          href: '/publish',
          label: 'Publish',
          active: (pathname) => pathname === '/publish' || pathname.startsWith('/publish/'),
        },
        {
          href: '/approvals',
          label: 'Approvals',
          active: (pathname) => pathname === '/approvals',
        },
      ],
    },
    {
      key: 'people',
      label: 'People',
      href: '/team',
      isActive: (pathname) =>
        pathname === '/team' ||
        pathname === '/requests' ||
        pathname.startsWith('/requests/') ||
        pathname === '/shift-board' ||
        pathname === '/settings' ||
        pathname.startsWith('/settings/'),
      subItems: [
        {
          href: '/team',
          label: 'Team',
          active: (pathname) => pathname === '/team',
        },
        {
          href: '/requests/user-access',
          label: 'Requests',
          active: (pathname) => pathname === '/requests' || pathname.startsWith('/requests/'),
          badgeCount: pendingCount > 0 ? pendingCount : undefined,
        },
        {
          href: '/shift-board',
          label: 'Shift Board',
          active: (pathname) => pathname === '/shift-board',
        },
        {
          href: '/settings/audit-log',
          label: 'Audit log',
          active: (pathname) => pathname === '/settings/audit-log',
        },
      ],
    },
  ]
}

export function getStaffNavItems(): readonly ShellNavItem[] {
  return [
    {
      href: '/dashboard/staff',
      label: 'Dashboard',
      active: (pathname) => pathname.startsWith('/dashboard/staff'),
    },
    {
      href: '/schedule',
      label: 'Schedule',
      active: (pathname) =>
        pathname === '/schedule' ||
        pathname === '/therapist/schedule' ||
        pathname === '/staff/my-schedule' ||
        pathname === '/staff/schedule' ||
        pathname === '/coverage' ||
        pathname === '/preliminary',
    },
    {
      href: '/therapist/availability',
      label: 'Availability',
      active: (pathname) => pathname === '/therapist/availability' || pathname === '/availability',
    },
    {
      href: '/shift-board',
      label: 'Shift Board',
      active: (pathname) => pathname === '/therapist/swaps' || pathname === '/shift-board',
    },
    {
      href: '/staff/history',
      label: 'History',
      active: (pathname) => pathname === '/staff/history',
    },
  ]
}

export function getShellContext(args: {
  pathname: string
  canAccessManagerUi: boolean
  canAccessLeadTools?: boolean
  pendingCount: number
}): ShellContext {
  if (args.canAccessManagerUi) {
    const managerSections = buildManagerSections(args.pendingCount)
    const activeSection = managerSections.find((section) => section.isActive(args.pathname)) ?? null

    return {
      primaryKey: activeSection?.key ?? null,
      primaryItems: managerSections.map((section) => ({
        href: section.href,
        label: section.label,
        active: section.isActive,
        badgeCount: section.key === 'people' ? args.pendingCount || undefined : undefined,
      })),
      localNav:
        activeSection && activeSection.subItems.length > 0
          ? {
              ariaLabel: `${activeSection.label} section navigation`,
              items: activeSection.subItems,
            }
          : null,
    }
  }

  const staffItems = getStaffNavItems()
  const activeItem = staffItems.find((item) => item.active(args.pathname)) ?? null

  return {
    primaryKey: activeItem?.label.toLowerCase() ?? null,
    primaryItems: [...staffItems],
    localNav: null,
  }
}

export function getMobilePrimaryItems(args: {
  canAccessManagerUi: boolean
  canAccessLeadTools?: boolean
  pendingCount: number
}): readonly ShellNavItem[] {
  if (args.canAccessManagerUi) {
    return [
      {
        href: MANAGER_WORKFLOW_LINKS.dashboard,
        label: 'Dashboard',
        active: (pathname) => pathname.startsWith('/dashboard/manager'),
      },
      {
        href: '/schedule',
        label: 'Schedule',
        active: (pathname) => pathname === '/schedule' || pathname === '/coverage',
      },
      {
        href: '/availability',
        label: 'Availability',
        active: (pathname) => pathname === '/availability',
      },
      {
        href: '/shift-board',
        label: 'Shift Board',
        active: (pathname) => pathname === '/shift-board' || pathname === '/swaps',
      },
    ]
  }

  if (args.canAccessLeadTools) {
    return [
      {
        href: '/dashboard/staff',
        label: 'Dashboard',
        active: (pathname) => pathname.startsWith('/dashboard/staff'),
      },
      {
        href: '/schedule',
        label: 'Schedule',
        active: (pathname) =>
          pathname === '/schedule' ||
          pathname === '/therapist/schedule' ||
          pathname === '/staff/my-schedule' ||
          pathname === '/staff/schedule' ||
          pathname === '/coverage' ||
          pathname === '/preliminary',
      },
      {
        href: '/shift-board',
        label: 'Shift Board',
        active: (pathname) =>
          pathname === '/shift-board' ||
          pathname === '/therapist/swaps' ||
          pathname === '/staff/requests' ||
          pathname === '/requests/new',
      },
    ]
  }

  return [
    {
      href: '/dashboard/staff',
      label: 'Dashboard',
      active: (pathname) => pathname.startsWith('/dashboard/staff'),
    },
    {
      href: '/schedule',
      label: 'Schedule',
      active: (pathname) =>
        pathname === '/schedule' ||
        pathname === '/therapist/schedule' ||
        pathname === '/staff/my-schedule' ||
        pathname === '/staff/schedule' ||
        pathname === '/coverage' ||
        pathname === '/preliminary',
    },
    {
      href: '/therapist/availability',
      label: 'Availability',
      active: (pathname) => pathname === '/therapist/availability' || pathname === '/availability',
    },
    {
      href: '/shift-board',
      label: 'Shift Board',
      active: (pathname) =>
        pathname === '/shift-board' ||
        pathname === '/therapist/swaps' ||
        pathname === '/staff/requests' ||
        pathname === '/requests/new',
    },
  ]
}

export function getWorkflowContext(args: {
  pathname: string
  canAccessManagerUi: boolean
  canAccessLeadTools?: boolean
}): WorkflowContext | null {
  const { pathname, canAccessManagerUi, canAccessLeadTools } = args

  if (canAccessManagerUi) {
    if (!isManagerScheduleRoute(pathname) && pathname !== '/shift-board' && pathname !== '/swaps') {
      return null
    }

    if (pathname === '/schedule') {
      return {
        workflow: 'Schedule',
        context: 'Unified grid workspace',
        state: 'Draft or published',
        permission: 'Manager editable',
      }
    }

    if (pathname === '/availability') {
      return {
        workflow: 'Availability',
        context: 'Team exceptions for the Schedule Block',
        state: 'Missing, submitted, manager edited',
        permission: 'Manager managed after lock',
      }
    }

    if (pathname === '/lottery') {
      return {
        workflow: 'Lottery',
        context: 'Live schedule reduction decisions',
        state: 'Recommend, apply, record',
        permission: 'Manager decision center',
      }
    }

    if (pathname === '/shift-board' || pathname === '/swaps') {
      return {
        workflow: 'Shift Board',
        context: 'Swaps, pickups, and direct requests',
        state: 'Open, waiting, approved',
        permission: 'Manager final approval',
      }
    }

    if (pathname === '/preliminary' || pathname === '/approvals') {
      return {
        workflow: 'Schedule approval',
        context: 'Preliminary schedule handoff',
        state: 'Review before publish',
        permission: 'Manager approval required',
      }
    }

    if (pathname === '/publish' || pathname.startsWith('/publish/')) {
      return {
        workflow: 'Publish',
        context: 'Schedule Block - history',
        state: 'Queued, published, offline',
        permission: 'Manager controlled',
      }
    }

    return {
      workflow: 'Schedule',
      context: 'Manager scheduling workspace',
      state: 'Block-based workflow',
      permission: 'Manager access',
    }
  }

  if (!isStaffScheduleRoute(pathname)) return null

  if (canAccessLeadTools) {
    if (pathname === '/schedule' || pathname === '/coverage') {
      return {
        workflow: 'Schedule',
        context: 'Team schedule grid',
        state: 'Working, on call, call-in, cancelled',
        permission: 'Lead status updates',
      }
    }

    if (pathname === '/shift-board' || pathname === '/therapist/swaps') {
      return {
        workflow: 'Shift Board',
        context: 'Swaps, pickups, and call-in help',
        state: 'Open, waiting, approved',
        permission: 'Lead visibility; manager approval',
      }
    }
  }

  if (
    pathname === '/therapist/schedule' ||
    pathname === '/staff/my-schedule' ||
    pathname === '/staff/schedule' ||
    pathname === '/coverage' ||
    pathname === '/schedule' ||
    pathname === '/preliminary'
  ) {
    return {
      workflow: 'Schedule',
      context: 'Your row and team grid',
      state: 'Day, night, or both shifts',
      permission: 'Read-only for staff',
    }
  }

  if (pathname === '/therapist/availability' || pathname === '/availability') {
    return {
      workflow: 'Availability',
      context: 'Need Off / Need to Work',
      state: 'Editable while the window is open',
      permission: 'Your exceptions',
    }
  }

  if (
    pathname === '/shift-board' ||
    pathname === '/therapist/swaps' ||
    pathname === '/staff/requests' ||
    pathname === '/requests/new' ||
    pathname === '/staff/history'
  ) {
    return {
      workflow: 'Shift Board',
      context: 'Swaps, pickups, and direct requests',
      state: 'Needs your action or waiting',
      permission: 'Manager approves final changes',
    }
  }

  return null
}
