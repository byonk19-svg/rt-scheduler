import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('global theme tokens', () => {
  it('defines dark theme token overrides and forces light color-scheme in print', () => {
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('--background:')
    expect(cssSource).toContain('--foreground:')
    expect(cssSource).toContain('@media print')
    expect(cssSource).toContain('.dark {')
    expect(cssSource).toContain('color-scheme: light;')
  })

  it('keeps shared grid and atmospheric utilities used across authenticated screens', () => {
    expect(cssSource).toContain('.teamwise-grid-bg {')
    expect(cssSource).toContain('.teamwise-grid-bg-subtle {')
    expect(cssSource).toContain('.teamwise-aurora-bg {')
  })
})
