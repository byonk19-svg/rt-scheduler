import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('homepage luminous visual system', () => {
  it('defines the homepage-specific glow tokens', () => {
    expect(cssSource).toContain('--home-glow-warm: rgba(241, 190, 105, 0.22);')
    expect(cssSource).toContain('--home-glow-cool: rgba(32, 122, 128, 0.16);')
    expect(cssSource).toContain('--home-panel: rgba(255, 251, 245, 0.78);')
    expect(cssSource).toContain('--home-panel-border: rgba(255, 255, 255, 0.72);')
    expect(cssSource).toContain('--home-shadow: rgba(15, 23, 42, 0.18);')
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
