import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  APP_SHELL_ACTIVE_NAV_CLASS,
  APP_SHELL_PROFILE_CARD_CLASS,
  APP_SHELL_SIDEBAR_CLASS,
  buildManagerSections,
} from '@/components/AppShell'

const appShellSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/AppShell.tsx'),
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
  it('uses a real button for the mobile backdrop dismiss target', () => {
    expect(appShellSource).toMatch(/<button[\s\S]*className="absolute inset-0 bg-black\/45"/)
  })

  it('contains overscroll within the mobile drawer', () => {
    expect(appShellSource).toContain('overscroll-contain')
  })
})

describe('AppShell navigation structure', () => {
  it('routes staff availability navigation to the therapist availability page', () => {
    expect(appShellSource).toContain("'/therapist/availability'")
    expect(appShellSource).toContain("label: 'Availability'")
  })

  it('keeps the manager Schedule section active on the legacy /schedule route', () => {
    const scheduleSection = buildManagerSections(0).find((section) => section.key === 'schedule')

    expect(scheduleSection).toBeDefined()
    expect(scheduleSection?.isActive('/schedule', null as never)).toBe(true)
  })

  it('uses Open shifts wording in staff shell navigation', () => {
    expect(appShellSource).toContain("label: 'Open shifts'")
    expect(appShellSource).not.toContain("label: 'Shift Swaps'")
  })

  it('includes staff swap history in the flat staff nav', () => {
    expect(appShellSource).toContain("href: '/staff/history'")
    expect(appShellSource).toContain("label: 'History'")
  })

  it('includes personal schedule in the flat staff nav', () => {
    expect(appShellSource).toContain("href: '/staff/my-schedule'")
    expect(appShellSource).toContain("label: 'My Schedule'")
  })

  it('routes manager Today section to the manager dashboard', () => {
    expect(appShellSource).toContain("label: 'Today'")
    expect(appShellSource).toContain('MANAGER_WORKFLOW_LINKS.dashboard')
  })

  it('groups manager workflow into Today, Schedule, and People sections', () => {
    expect(appShellSource).toContain("key: 'today'")
    expect(appShellSource).toContain("key: 'schedule'")
    expect(appShellSource).toContain("key: 'people'")
  })

  it('puts Coverage, Availability, Publish, and Approvals under the Schedule section', () => {
    expect(appShellSource).toContain("label: 'Coverage'")
    expect(appShellSource).toContain("label: 'Availability'")
    expect(appShellSource).toContain("label: 'Publish'")
    expect(appShellSource).toContain("label: 'Approvals'")
  })

  it('allows the fixed secondary nav to scroll horizontally on narrow screens', () => {
    expect(appShellSource).toContain('overflow-x-auto')
  })

  it('merges Team and Requests under the People section', () => {
    expect(appShellSource).toContain("label: 'Team'")
    expect(appShellSource).toContain("label: 'Requests'")
    // User Access Requests is no longer a separate top-level nav item
    expect(appShellSource).not.toContain("label: 'User Access Requests'")
  })

  it('shows pending badge on Requests sub-item when there are pending access requests', () => {
    expect(appShellSource).toContain('showBadge: pendingCount > 0')
  })
})
