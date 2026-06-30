import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const publicHeroFiles = [
  'src/app/(public)/page.tsx',
  'src/app/(public)/login/page.tsx',
  'src/app/(public)/signup/page.tsx',
  'src/app/(public)/reset-password/page.tsx',
]

const lowOpacityWhiteText = /\btext-white\/(?:\d+|\[[^\]]+\])/

describe('public and auth hero contrast', () => {
  it('keeps support copy on semantic high-contrast hero text classes', () => {
    for (const file of publicHeroFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')

      expect(source, file).toContain('bg-[var(--marketing-hero-bg)]')
      expect(source, file).toMatch(/\btext-hero-(?:muted|subtle)\b/)
      expect(source, file).not.toMatch(lowOpacityWhiteText)
    }
  })
})
