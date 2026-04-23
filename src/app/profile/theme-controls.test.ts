import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('profile theme controls source contract', () => {
  it('adds an Appearance section with light/system/dark options', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/profile/page.tsx'), 'utf8')

    expect(source).toContain('Appearance')
    expect(source).toContain('ThemePreferenceControl')
  })

  it('renders theme choices through an announced segmented control', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ThemeProvider.tsx'), 'utf8')

    expect(source).toContain('Theme preference')
    expect(source).toContain('<SegmentedControl')
  })
})
