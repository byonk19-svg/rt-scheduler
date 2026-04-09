import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  APP_SHELL_ACTIVE_NAV_CLASS,
  APP_SHELL_PROFILE_CARD_CLASS,
  APP_SHELL_SIDEBAR_CLASS,
} from '@/components/AppShell'

const appShellSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/AppShell.tsx'),
  'utf8'
)

describe('AppShell sidebar styling', () => {
  it('keeps the sidebar present but less dominant than the content area', () => {
    expect(APP_SHELL_SIDEBAR_CLASS).toContain('border-precision-grid-line')
    expect(APP_SHELL_SIDEBAR_CLASS).toContain('shadow-none')
  })

  it('uses Precision Light active nav (emerald rail + slate fill)', () => {
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('border-precision-emerald')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('bg-precision-slate-base')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).not.toContain('shadow-sm')
  })

  it('tones down the profile block at the bottom of the sidebar', () => {
    expect(APP_SHELL_PROFILE_CARD_CLASS).toContain('bg-precision-slate-base')
    expect(APP_SHELL_PROFILE_CARD_CLASS).toContain('border-precision-grid-line')
  })

  it('uses a real button for the mobile backdrop dismiss target', () => {
    expect(appShellSource).toMatch(/<button[\s\S]*className="absolute inset-0 bg-black\/45"/)
  })

  it('contains overscroll within the mobile drawer', () => {
    expect(appShellSource).toContain('overscroll-contain')
  })

  it('routes staff future availability navigation to the therapist availability page', () => {
    expect(appShellSource).toContain("href: '/therapist/availability', label: 'Availability'")
  })

  it('uses Open shifts wording in staff shell navigation', () => {
    expect(appShellSource).toContain("label: 'Open shifts'")
    expect(appShellSource).not.toContain("label: 'Shift Swaps'")
  })

  it('uses Inbox wording in manager nav instead of Dashboard', () => {
    expect(appShellSource).toContain(
      "{ href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Inbox', icon: LayoutDashboard }"
    )
    expect(appShellSource).not.toContain(
      "{ href: MANAGER_WORKFLOW_LINKS.dashboard, label: 'Dashboard', icon: LayoutDashboard }"
    )
  })
})
