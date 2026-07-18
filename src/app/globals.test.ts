import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

function readHslToken(name: string): [number, number, number] {
  const match = cssSource.match(new RegExp(`${name}:\\s*hsl\\((\\d+)\\s+(\\d+)%\\s+(\\d+)%\\)`))
  expect(match).toBeTruthy()
  return [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])]
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const saturation = s / 100
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - chroma / 2
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = chroma
    g = x
  } else if (h < 120) {
    r = x
    g = chroma
  } else if (h < 180) {
    g = chroma
    b = x
  } else if (h < 240) {
    g = x
    b = chroma
  } else if (h < 300) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  return [r + m, g + m, b + m].map((channel) => Math.round(channel * 255)) as [
    number,
    number,
    number,
  ]
}

function relativeLuminance(rgb: [number, number, number]): number {
  return rgb
    .map((channel) => {
      const value = channel / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

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
    //   --teal-btn:  #276e66  ≈ hsl(174 48% 29%)  → light-mode --primary
    //   --teal-dark: #1b3836  ≈ hsl(174 35% 16%)  → --marketing-hero-bg
    // Any drift toward the older 187° (bluer) or 203° (cobalt) hue is a brand regression.
    expect(cssSource).not.toMatch(/--primary:\s*hsl\(187\s/)
    expect(cssSource).not.toMatch(/--primary:\s*hsl\(203\s/)
    const primaryMatches = cssSource.match(/--primary:\s*hsl\((\d+)\s/g) ?? []
    // :root + .dark + @media print .dark — at least three declarations.
    expect(primaryMatches.length).toBeGreaterThanOrEqual(2)
    for (const match of primaryMatches) {
      expect(match).toMatch(/--primary:\s*hsl\(174\s/)
    }
  })

  it('declares --marketing-hero-bg as a deeper teal independent from --primary', () => {
    // The hero / auth-left-panel must use the deeper #1b3836 from the design,
    // not the mid-teal --primary used for buttons. Aliasing back to var(--primary)
    // is a regression — it produced the wrong (lighter) hero in production.
    expect(cssSource).toMatch(/--marketing-hero-bg:\s*hsl\(174\s+\d+%?\s+1[0-9]%/)
    expect(cssSource).not.toMatch(/--marketing-hero-bg:\s*var\(--primary\)/)
  })

  it('declares AA-safe semantic text colors for the deep marketing hero', () => {
    expect(cssSource).toContain('--marketing-hero-muted:')
    expect(cssSource).toContain('--marketing-hero-subtle:')
    expect(cssSource).toContain('.text-hero-muted')
    expect(cssSource).toContain('.text-hero-subtle')

    const heroBackground = hslToRgb(readHslToken('--marketing-hero-bg'))
    const heroMuted = hslToRgb(readHslToken('--marketing-hero-muted'))
    const heroSubtle = hslToRgb(readHslToken('--marketing-hero-subtle'))

    expect(contrastRatio(heroMuted, heroBackground)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(heroSubtle, heroBackground)).toBeGreaterThanOrEqual(4.5)
  })

  it('defines dark theme token overrides and forces light color-scheme in print', () => {
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('--background:')
    expect(cssSource).toContain('--foreground:')
    expect(cssSource).toContain('@media print')
    expect(cssSource).toContain('color-scheme: light;')
  })

  it('lets the full schedule grid print instead of clipping to the scroll viewport', () => {
    expect(cssSource).toContain('.schedule-grid-print-table')
    expect(cssSource).toContain('.schedule-grid-print-table-wrapper')
    expect(cssSource).toContain('max-height: none !important;')
    expect(cssSource).toContain('overflow: visible !important;')
  })

  it('reserves scroll offset for the fixed authenticated header', () => {
    expect(cssSource).toContain('scroll-padding-top: 5rem;')
  })
})
