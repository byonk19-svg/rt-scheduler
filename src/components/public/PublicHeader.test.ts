import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/public/PublicHeader.tsx'),
  'utf8'
)

describe('PublicHeader', () => {
  it('uses the same signup label as the homepage hero', () => {
    expect(source).toContain("ctaLabel: 'Create account'")
    expect(source).not.toMatch(/ctaLabel:\s*'Get started'/)
  })

  it('exposes an accessible home control for the brand link', () => {
    expect(source).toContain('aria-label="Teamwise home"')
  })
})
