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

  it('uses a real button for the mobile backdrop dismiss target', () => {
    expect(appShellSource).toMatch(/<button[\s\S]*className="absolute inset-0 bg-black\/45"/)
  })

  it('contains overscroll within the mobile drawer', () => {
    expect(appShellSource).toContain('overscroll-contain')
  })

  it('renders the authenticated shell through shared header primitives', () => {
    expect(appShellSource).toContain('<AppHeader')
    expect(appShellSource).toContain('<LocalSectionNav')
  })

  it('does not keep a second fixed shell bar under the main header', () => {
    expect(appShellSource).not.toContain('app-shell-chrome-secondary fixed top-14')
  })
})

describe('AppShell navigation structure', () => {
  it('routes staff availability navigation to the therapist availability page', () => {
    expect(shellConfigSource).toContain("'/therapist/availability'")
    expect(shellConfigSource).toContain("label: 'Availability'")
  })

  it('keeps the manager Schedule section active on the legacy /schedule route', () => {
    const scheduleSection = buildManagerSections(0).find((section) => section.key === 'schedule')

    expect(scheduleSection).toBeDefined()
    expect(scheduleSection?.isActive('/schedule')).toBe(true)
  })

  it('sends the manager Schedule entry to the mock roster screen while leaving live coverage routable', () => {
    const scheduleSection = buildManagerSections(0).find((section) => section.key === 'schedule')

    expect(scheduleSection?.href).toBe('/schedule')
    expect(scheduleSection?.subItems.find((item) => item.label === 'Coverage')?.href).toBe(
      '/schedule'
    )
  })

  it('uses Open shifts wording in staff shell navigation', () => {
    expect(shellConfigSource).toContain("label: 'Open shifts'")
    expect(shellConfigSource).not.toContain("label: 'Shift Swaps'")
  })

  it('includes staff swap history in the flat staff nav', () => {
    expect(shellConfigSource).toContain("href: '/staff/history'")
    expect(shellConfigSource).toContain("label: 'History'")
  })

  it('includes personal schedule in the flat staff nav', () => {
    expect(shellConfigSource).toContain("href: '/staff/my-schedule'")
    expect(shellConfigSource).toContain("label: 'My Schedule'")
  })

  it('routes manager Today section to the manager dashboard', () => {
    expect(shellConfigSource).toContain("label: 'Today'")
    expect(shellConfigSource).toContain('MANAGER_WORKFLOW_LINKS.dashboard')
  })

  it('groups manager workflow into Today, Schedule, and People sections', () => {
    expect(shellConfigSource).toContain("key: 'today'")
    expect(shellConfigSource).toContain("key: 'schedule'")
    expect(shellConfigSource).toContain("key: 'people'")
  })

  it('puts Coverage, Availability, Publish, and Approvals under the Schedule section', () => {
    expect(shellConfigSource).toContain("label: 'Coverage'")
    expect(shellConfigSource).toContain("label: 'Availability'")
    expect(shellConfigSource).toContain("label: 'Publish'")
    expect(shellConfigSource).toContain("label: 'Approvals'")
  })

  it('allows the shared local section nav to scroll horizontally on narrow screens', () => {
    expect(localSectionNavSource).toContain('overflow-x-auto')
  })

  it('merges Team and Requests under the People section', () => {
    expect(shellConfigSource).toContain("label: 'Team'")
    expect(shellConfigSource).toContain("label: 'Requests'")
    // User Access Requests is no longer a separate top-level nav item
    expect(shellConfigSource).not.toContain("label: 'User Access Requests'")
  })

  it('shows pending badge on Requests sub-item when there are pending access requests', () => {
    expect(shellConfigSource).toContain('badgeCount: pendingCount > 0 ? pendingCount : undefined')
  })
})
