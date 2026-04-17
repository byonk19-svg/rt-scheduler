import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('root layout theme wiring', () => {
  it('wraps app content in ThemeProvider and resolves the initial theme without inline scripts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

    expect(source).toContain('ThemeProvider')
    expect(source).toContain("from 'next/headers'")
    expect(source).toContain('await cookies()')
    expect(source).toContain('getServerThemeClass')
    expect(source).not.toContain("from 'next/script'")
    expect(source).not.toContain('<Script')
    expect(source).not.toContain('<script')
  })
})
