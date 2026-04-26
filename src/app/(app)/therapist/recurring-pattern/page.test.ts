import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/recurring-pattern/page.tsx'),
  'utf8'
)

describe('therapist recurring-pattern route', () => {
  it('exposes a dedicated recurring-pattern page with therapist-specific copy', () => {
    expect(source).toContain('Recurring Work Pattern')
    expect(source).toContain('future availability cycles will use first')
    expect(source).toContain('RecurringPatternEditor')
    expect(source).toContain('saveRecurringPatternAction')
  })
})
