import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  APP_SHELL_ACTIVE_NAV_CLASS,
  APP_SHELL_PROFILE_CARD_CLASS,
  APP_SHELL_SIDEBAR_CLASS,
} from '@/components/AppShell'
import { buildManagerSections } from '@/components/shell/app-shell-config'

const appShellSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/AppShell.tsx'),
  'utf8'
)
const shellConfigSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/shell/app-shell-config.ts'),
  'utf8'
)
const localSectionNavSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/shell/LocalSectionNav.tsx'),
  'utf8'
)

describe('AppShell exported constants', () => {
  it('keeps legacy sidebar class export for test compatibility', () => {
    expect(APP_SHELL_SIDEBAR_CLASS).toContain('border-sidebar-border/70')
    expect(APP_SHELL_SIDEBAR_CLASS).toContain('shadow-none')
  })

  it('uses a high-contrast active nav pill with attention ring for shell wayfinding', () => {
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('bg-sidebar-accent/85')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('ring-2')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('ring-sidebar-ring')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).not.toContain('shadow-sm')
  })

  it('tones down the profile block', () => {
    expect(APP_SHELL_PROFILE_CARD_CLASS).toContain('bg-sidebar-accent/15')
    expect(APP_SHELL_PROFILE_CARD_CLASS).toContain('border-sidebar-border/70')
  })
})

describe('AppShell mobile menu', () => {
  it('does not subscribe to useSearchParams in the shell (pathname is enough for nav active state)', () => {
    expect(appShellSource).not.toMatch(/useSearchParams/)
  })

  it('defers notification bell logic behind a lightweight shell wrapper', () => {
    expect(appShellSource).toContain('DeferredNotificationBell')
    expect(appShellSource).not.toContain(
      "import { NotificationBell } from '@/components/NotificationBell'"
    )
  })

  it('uses the shared dialog primitive for the mobile drawer so focus is trapped and restored', () => {
    expect(appShellSource).toMatch(
      /import\s*\{[\s\S]*Dialog,[\s\S]*DialogContent,[\s\S]*DialogDescription,[\s\S]*DialogHeader,[\s\S]*DialogTitle,[\s\S]*\}\s*from\s*'@\/components\/ui\/dialog'/
    )
    expect(appShellSource).toContain(
      '<Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>'
    )
    expect(appShellSource).toContain('<DialogContent')
    expect(appShellSource).toContain('<DialogTitle>Navigation menu</DialogTitle>')
    expect(appShellSource).toContain('Browse the main Teamwise sections')
  })

  it('contains overscroll within the mobile drawer', () => {
    expect(appShellSource).toContain('overscroll-contain')
  })

  it('renders the authenticated shell through shared header primitives', () => {
    expect(appShellSource).toContain('<AppHeader')
    expect(appShellSource).toContain('<LocalSectionNav')
  })

  it('suppresses the local section nav only where the page layout owns the space', () => {
    expect(appShellSource).toContain(
      "const hideLocalSectionNav = pathname.startsWith('/availability')"
    )
    expect(appShellSource).toContain('shellContext.localNav && !hideLocalSectionNav')
  })

  it('lets the read-only schedule surface use the full authenticated workspace width', () => {
    expect(appShellSource).toContain("const isSchedulePage = pathname === '/schedule'")
    expect(appShellSource).toContain("const isAvailabilityPage = pathname === '/availability'")
    expect(appShellSource).toContain('isCoveragePage || isSchedulePage || isAvailabilityPage')
  })

  it('does not keep a second fixed shell bar under the main header', () => {
    expect(appShellSource).not.toContain('app-shell-chrome-secondary fixed top-14')
  })

  it('offsets main-content anchor scrolling below the fixed header', () => {
    expect(appShellSource).toContain('scroll-mt-20')
  })

  it('suppresses the workflow context strip on the unified schedule page', () => {
    expect(appShellSource).toContain("pathname === '/schedule'")
    expect(appShellSource).toContain('workflowContext && !hideWorkflowContext')
  })

  it('keeps optional access-request summary fetch failures out of the dev overlay', () => {
    expect(appShellSource).toContain(
      "fetch('/api/requests/user-access?summary=1', { cache: 'no-store' })"
    )
    expect(appShellSource).toContain('} catch {')
    expect(appShellSource).toContain('setFetchedPendingCount(0)')
  })
})

describe('AppShell navigation structure', () => {
  it('routes staff availability navigation to the therapist availability page', () => {
    expect(shellConfigSource).toContain("'/therapist/availability'")
    expect(shellConfigSource).toContain("label: 'Availability'")
  })

  it('keeps the manager Schedule section active on the legacy /schedule route', () => {
    const scheduleSection = buildManagerSections(0).find(
      (section) => section.key === 'team-schedule'
    )

    expect(scheduleSection).toBeDefined()
    expect(scheduleSection?.isActive('/schedule')).toBe(true)
  })

  it('sends the manager Schedule entry to the unified schedule grid', () => {
    const scheduleSection = buildManagerSections(0).find(
      (section) => section.key === 'team-schedule'
    )

    expect(scheduleSection?.href).toBe('/schedule')
    expect(scheduleSection?.label).toBe('Team Schedule')
    expect(scheduleSection?.subItems).toEqual([])
    expect(scheduleSection?.subItems.find((item) => item.label === 'Roster View')).toBeUndefined()
  })

  it('uses Shift Board wording in staff shell navigation', () => {
    expect(shellConfigSource).toContain("label: 'Shift Board'")
    expect(shellConfigSource).not.toContain("label: 'Shift Swaps & Pickups'")
    expect(shellConfigSource).not.toContain("label: 'Open shifts'")
  })

  it('includes staff swap history in the flat staff nav', () => {
    expect(shellConfigSource).toContain("href: '/staff/history'")
    expect(shellConfigSource).toContain("label: 'History'")
  })

  it('includes the unified schedule route in the flat staff nav', () => {
    expect(shellConfigSource).toContain("href: '/schedule'")
    expect(shellConfigSource).toContain("label: 'Schedule'")
    expect(shellConfigSource).not.toContain("label: 'My Shifts'")
  })

  it('routes manager Dashboard section to the manager dashboard', () => {
    expect(shellConfigSource).toContain("label: 'Dashboard'")
    expect(shellConfigSource).toContain('MANAGER_WORKFLOW_LINKS.dashboard')
  })

  it('groups manager workflow into direct top-level operational sections', () => {
    expect(shellConfigSource).toContain("key: 'dashboard'")
    expect(shellConfigSource).toContain("key: 'team-schedule'")
    expect(shellConfigSource).toContain("key: 'availability'")
    expect(shellConfigSource).toContain("key: 'shift-board'")
    expect(shellConfigSource).toContain("key: 'lottery'")
    expect(shellConfigSource).not.toContain("key: 'coverage'")
    expect(shellConfigSource).not.toContain("key: 'people'")
  })

  it('puts Team Schedule, Availability, Shift Board, and Lottery in manager top navigation', () => {
    expect(buildManagerSections(0).map((section) => section.label)).toEqual([
      'Dashboard',
      'Team Schedule',
      'Availability',
      'Shift Board',
      'Lottery',
    ])
    expect(shellConfigSource).toContain("label: 'Team Schedule'")
    expect(shellConfigSource).not.toContain("label: 'Roster View'")
    expect(shellConfigSource).toContain("label: 'Availability'")
    expect(shellConfigSource).toContain("label: 'Shift Board'")
    expect(shellConfigSource).toContain("label: 'Lottery'")
  })

  it('allows the shared local section nav to scroll horizontally on narrow screens', () => {
    expect(localSectionNavSource).toContain('overflow-x-auto')
  })

  it('shows Shift Board as its own active manager section', () => {
    const shiftBoardSection = buildManagerSections(0).find(
      (section) => section.key === 'shift-board'
    )

    expect(shiftBoardSection?.href).toBe('/shift-board')
    expect(shiftBoardSection?.label).toBe('Shift Board')
    expect(shiftBoardSection?.isActive('/shift-board')).toBe(true)
  })

  it('does not show People as the active manager section for Shift Board', () => {
    expect(buildManagerSections(2).map((section) => section.label)).not.toContain('People')
  })
})
