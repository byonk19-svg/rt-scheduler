import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/team/work-patterns/[therapistId]/page.tsx'),
  'utf8'
)

describe('manager advanced work-pattern route', () => {
  it('renders a dedicated manager editor for advanced recurring patterns', () => {
    expect(source).toContain('Edit Work Pattern')
    expect(source).toContain('RecurringPatternEditor')
    expect(source).toContain('saveManagerRecurringPatternAction')
    expect(source).toContain('/team/work-patterns')
  })
})
