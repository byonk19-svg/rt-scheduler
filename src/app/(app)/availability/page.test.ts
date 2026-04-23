import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'), 'utf8')

describe('availability manager page', () => {
  it('uses explicit export naming instead of the generic utilities label', () => {
    expect(source).toContain('label="Exports"')
    expect(source).not.toContain('label="Utilities"')
  })

  it('uses a planning-focused primary action label for managers', () => {
    expect(source).toContain("? 'Plan coverage dates' : 'Add availability'")
    expect(source).not.toContain("? 'Open planner' : 'Add availability'")
  })
})
