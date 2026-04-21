import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

describe('schedule route', () => {
  it('redirects to the roster mode inside the canonical schedule workspace', () => {
    expect(source).toContain("nextParams.set('view', 'roster')")
    expect(source).toContain('redirect(`/coverage?${nextParams.toString()}`)')
  })

  it('preserves cycle and shift params when redirecting to coverage', () => {
    expect(source).toContain("if (cycle) nextParams.set('cycle', cycle)")
    expect(source).toContain("if (shift) nextParams.set('shift', shift)")
  })
})
