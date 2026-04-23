import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

export const APP_HEADER_HEIGHT = 56
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

const SHELL_ROUTES = [
  '/dashboard',
  '/coverage',
  '/analytics',
  '/availability',
  '/shift-board',
  '/publish',
  '/profile',
  '/approvals',
  '/preliminary',
  '/requests',
  '/notifications',
  '/swaps',
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
    pathname === '/coverage' ||
    pathname === '/analytics' ||
    pathname === '/schedule' ||
    pathname === '/availability' ||
    pathname === '/publish' ||
    pathname.startsWith('/publish/') ||
    pathname === '/approvals'
  )
}

export function usesAppShell(pathname: string): boolean {
  return SHELL_ROUTES.some((route) => isRouteActive(pathname, route))
}

export function buildManagerSections(pendingCount: number): readonly ShellSection[] {
  return [
    {
      key: 'today',
      label: 'Today',
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
          label: 'Roster',
          active: (pathname) => pathname === '/schedule',
        },
        {
          href: '/coverage',
          label: 'Coverage',
          active: (pathname) => pathname === '/coverage',
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
          href: '/requests',
          label: 'People requests',
          active: (pathname) =>
            pathname === '/requests' ||
            pathname.startsWith('/requests/') ||
            pathname === '/shift-board',
          badgeCount: pendingCount > 0 ? pendingCount : undefined,
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
      href: '/coverage',
      label: 'Schedule',
      active: (pathname) =>
        pathname === '/coverage' || pathname === '/schedule' || pathname === '/preliminary',
    },
    {
      href: '/staff/my-schedule',
      label: 'My Schedule',
      active: (pathname) => pathname === '/staff/my-schedule',
    },
    {
      href: '/therapist/availability',
      label: 'Availability',
      active: (pathname) => pathname === '/therapist/availability' || pathname === '/availability',
    },
    {
      href: '/shift-board',
      label: 'Open shifts',
      active: (pathname) => pathname === '/shift-board',
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
