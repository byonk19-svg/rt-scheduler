import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('schedule pre-flight route', () => {
  it('loads real existing shifts and runs the pure pre-flight summary', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/pre-flight/route.ts'),
      'utf8'
    )

    expect(source).toContain(".from('shifts')")
    expect(source).toContain(".eq('cycle_id', cycleId)")
    expect(source).toContain('existingShifts')
    expect(source).toContain('runPreFlight')
    expect(source).toContain('summarizePreFlight')
  })

  it('matches the coverage page therapist-eligibility filters for pre-flight calculations', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/pre-flight/route.ts'),
      'utf8'
    )

    expect(source).toContain(".eq('is_active', true)")
    expect(source).toContain(".eq('on_fmla', false)")
  })
})
