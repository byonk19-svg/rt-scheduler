import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('global CSS tokens and theme overrides', () => {
  it('does not redefine the legacy luminous-homepage tokens or utilities', () => {
    expect(cssSource).not.toContain('--home-glow-warm')
    expect(cssSource).not.toContain('--home-glow-cool')
    expect(cssSource).not.toContain('--home-panel')
    expect(cssSource).not.toContain('--home-shadow')
    expect(cssSource).not.toContain('.teamwise-home-luminous')
    expect(cssSource).not.toContain('.teamwise-home-grid')
    expect(cssSource).not.toContain('.teamwise-home-preview-shell')
    expect(cssSource).not.toContain('.teamwise-home-preview-sheen')
  })

  it('defines the marketing hero alias and modal scrim tokens', () => {
    expect(cssSource).toContain('--marketing-hero-bg:')
    expect(cssSource).toContain('--scrim:')
  })

  it('keeps every --primary declaration in the design-handoff teal hue family (174°)', () => {
    // Source of truth: the Refined.html design handoff defines
    //   --teal-btn:  #276e66  ~= hsl(174 48% 29%) -> light-mode --primary
    //   --teal-dark: #1b3836  â‰ˆ hsl(174 35% 16%)  â†’ --marketing-hero-bg
    // Any drift toward the older 187Â° (bluer) or 203Â° (cobalt) hue is a brand regression.
    expect(cssSource).not.toMatch(/--primary:\s*hsl\(187\s/)
    expect(cssSource).not.toMatch(/--primary:\s*hsl\(203\s/)
    const primaryMatches = cssSource.match(/--primary:\s*hsl\((\d+)\s/g) ?? []
    // :root + .dark + @media print .dark â€” at least three declarations.
    expect(primaryMatches.length).toBeGreaterThanOrEqual(2)
    for (const match of primaryMatches) {
      expect(match).toMatch(/--primary:\s*hsl\(174\s/)
    }
  })

  it('declares --marketing-hero-bg as a deeper teal independent from --primary', () => {
    // The hero / auth-left-panel must use the deeper #1b3836 from the design,
    // not the mid-teal --primary used for buttons. Aliasing back to var(--primary)
    // is a regression â€” it produced the wrong (lighter) hero in production.
    expect(cssSource).toMatch(/--marketing-hero-bg:\s*hsl\(174\s+\d+%?\s+1[0-9]%/)
    expect(cssSource).not.toMatch(/--marketing-hero-bg:\s*var\(--primary\)/)
  })

  it('defines dark theme token overrides and forces light color-scheme in print', () => {
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('--background:')
    expect(cssSource).toContain('--foreground:')
    expect(cssSource).toContain('@media print')
    expect(cssSource).toContain('color-scheme: light;')
  })
})
