import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('homepage luminous visual system', () => {
  it('defines the homepage-specific glow tokens', () => {
    expect(cssSource).toContain('--home-glow-warm:')
    expect(cssSource).toContain('--home-glow-cool:')
    expect(cssSource).toContain('--home-panel:')
    expect(cssSource).toContain('--home-panel-border:')
    expect(cssSource).toContain('--home-shadow:')
  })

  it('defines the homepage background and preview-shell utilities', () => {
    expect(cssSource).toContain('.teamwise-home-luminous {')
    expect(cssSource).toContain('.teamwise-home-grid {')
    expect(cssSource).toContain('.teamwise-home-preview-shell {')
    expect(cssSource).toContain('.teamwise-home-preview-sheen {')
  })

  it('defines dark theme token overrides and forces light color-scheme in print', () => {
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('--background:')
    expect(cssSource).toContain('--foreground:')
    expect(cssSource).toContain('@media print')
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('color-scheme: light;')
  })
})
