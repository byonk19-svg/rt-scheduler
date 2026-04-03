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
    expect(APP_SHELL_SIDEBAR_CLASS).toContain('border-sidebar-border/70')
    expect(APP_SHELL_SIDEBAR_CLASS).toContain('shadow-none')
  })

  it('uses a calmer active nav state without the old heavy shadow treatment', () => {
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('bg-sidebar-accent/60')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).toContain('ring-1')
    expect(APP_SHELL_ACTIVE_NAV_CLASS).not.toContain('shadow-sm')
  })

  it('tones down the profile block at the bottom of the sidebar', () => {
    expect(APP_SHELL_PROFILE_CARD_CLASS).toContain('bg-sidebar-accent/15')
    expect(APP_SHELL_PROFILE_CARD_CLASS).toContain('border-sidebar-border/70')
  })

  it('uses a real button for the mobile backdrop dismiss target', () => {
    expect(appShellSource).toMatch(/<button[\s\S]*className="absolute inset-0 bg-black\/45"/)
  })

  it('contains overscroll within the mobile drawer', () => {
    expect(appShellSource).toContain('overscroll-contain')
  })

  it('routes staff future availability navigation to the therapist availability page', () => {
    expect(appShellSource).toContain(
      "href: '/therapist/availability', label: 'Future Availability'"
    )
  })

  it('uses Shift Board wording in shell navigation instead of Shift Swaps', () => {
    expect(appShellSource).toContain("label: 'Shift Board'")
    expect(appShellSource).not.toContain("label: 'Shift Swaps'")
  })
})
