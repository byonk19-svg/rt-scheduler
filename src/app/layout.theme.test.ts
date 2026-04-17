import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('root layout theme wiring', () => {
  it('resolves the initial theme server-side without inline scripts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

    expect(source).toContain("from 'next/headers'")
    expect(source).toContain('await cookies()')
    expect(source).toContain('getServerThemeClass')
    expect(source).not.toContain("from 'next/script'")
    expect(source).not.toContain('<Script')
    expect(source).not.toContain('<script')
  })

  it('ThemeProvider lives in AppShell (client-to-client, no server boundary crossing)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/AppShell.tsx'), 'utf8')

    expect(source).toContain('ThemeProvider')
  })
})
