import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const uiFiles = [
  'src/components/ui/badge.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/label.tsx',
  'src/components/ui/popover.tsx',
  'src/components/ui/progress.tsx',
]

describe('ui primitive import boundaries', () => {
  it('avoids the radix-ui umbrella package in shared primitives', () => {
    for (const relativePath of uiFiles) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8')
      expect(source).not.toContain("from 'radix-ui'")
    }
  })
})
