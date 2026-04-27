import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/RecurringPatternEditor.tsx'),
  'utf8'
)

describe('RecurringPatternEditor', () => {
  it('uses simpler therapist-facing labels and a shorter preview rail', () => {
    expect(source).toContain("title: 'No repeating schedule'")
    expect(source).toContain('Which days do you usually work?')
    expect(source).toContain('This can vary sometimes')
    expect(source).toContain('<CardTitle>What this saves</CardTitle>')
    expect(source).toContain('<CardTitle>Quick preview</CardTitle>')
    expect(source).toContain('Next 2 weeks')
    expect(source).toContain("'Not set'")
    expect(source).toContain("toLocaleDateString('en-US', { month: 'short', day: 'numeric' })")
  })
})
