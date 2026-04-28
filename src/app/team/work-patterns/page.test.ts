import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('team work-patterns page source contract', () => {
  it('requires manager auth, queries therapist/lead patterns, and renders grouped edit cards', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/team/work-patterns/page.tsx'),
      'utf8'
    )

    expect(source).toContain("from('profiles')")
    expect(source).toContain(".in('role', ['therapist', 'lead'])")
    expect(source).toContain(".eq('is_active', true)")
    expect(source).toContain('WorkPatternCard')
    expect(source).toContain('Open editor')
    expect(source).toContain('No pattern set')
  })
})
