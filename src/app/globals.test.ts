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

  it('keeps dark-mode primary in the same teal hue family as light mode', () => {
    // Light: hsl(187 55% 28%); dark must stay in the 187°/cyan-teal family, not flip to blue.
    // Regression guard: the previous dark palette used hsl(203 …) which broke brand identity.
    expect(cssSource).not.toMatch(/--primary:\s*hsl\(203\s/)
    const primaryMatches = cssSource.match(/--primary:\s*hsl\((\d+)\s/g) ?? []
    expect(primaryMatches.length).toBeGreaterThanOrEqual(2) // :root + .dark
    for (const match of primaryMatches) {
      expect(match).toMatch(/--primary:\s*hsl\(187\s/)
    }
  })

  it('defines dark theme token overrides and forces light color-scheme in print', () => {
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('--background:')
    expect(cssSource).toContain('--foreground:')
    expect(cssSource).toContain('@media print')
    expect(cssSource).toContain('color-scheme: light;')
  })
})
