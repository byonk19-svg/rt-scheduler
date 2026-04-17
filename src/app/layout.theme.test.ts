import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('root layout theme wiring', () => {
  it('wraps app content in ThemeProvider and injects flash-prevention script', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

    expect(source).toContain('ThemeProvider')
    expect(source).toContain("localStorage.getItem('tw-theme')")
    expect(source).toContain('prefers-color-scheme: dark')
    expect(source).toContain("document.documentElement.classList.add('dark')")
  })
})
