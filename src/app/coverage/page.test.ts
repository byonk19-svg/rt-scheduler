import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('coverage publish override affordance', () => {
  it('renders a weekly-rule override publish action when weekly validation blocks publish', () => {
    const filePath = resolve(process.cwd(), 'src/app/coverage/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain("errorParam === 'publish_weekly_rule_violation'")
    expect(source).toContain("weekly: 'true'")
    expect(source).toContain('name="override_weekly_rules"')
    expect(source).toContain('Publish with weekly override')
  })

  it('preserves a weekly override when shift validation fails afterward', () => {
    const filePath = resolve(process.cwd(), 'src/app/coverage/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain("const overrideWeeklyRulesParam = search.get('override_weekly_rules')")
    expect(source).toContain("const overrideShiftRulesParam = search.get('override_shift_rules')")
    expect(source).toContain("weekly: overrideWeeklyRulesParam === 'true' ? 'true' : 'false'")
    expect(source).toContain("shift: overrideShiftRulesParam === 'true' ? 'true' : 'false'")
  })

  it('keeps override flags in publish validation redirects', () => {
    const filePath = resolve(process.cwd(), 'src/app/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain("override_weekly_rules: overrideWeeklyRules ? 'true' : undefined")
    expect(source).toContain("override_shift_rules: overrideShiftRules ? 'true' : undefined")
  })

  it('surfaces cycle workflow controls in the coverage workspace', () => {
    const filePath = resolve(process.cwd(), 'src/app/coverage/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('New 6-week block')
    expect(source).toContain('ClearDraftConfirmDialog')
    expect(source).toContain('CycleManagementDialog')
    expect(source).toContain('formatHumanCycleRange')
    expect(source).toContain('Updates publish to staff as you save.')
    expect(source).toContain('Publish history')
  })

  it('shows an explicit empty state instead of a synthetic 6-week window when no cycle exists', () => {
    const filePath = resolve(process.cwd(), 'src/app/coverage/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('No open 6-week block')
    expect(source).toContain('Create the next 6-week block to start staffing this calendar.')
    expect(source).not.toContain('Current 6-week window')
  })

  it('shows an explicit empty-draft state when a cycle exists but has no staffing rows yet', () => {
    const filePath = resolve(process.cwd(), 'src/app/coverage/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('No staffing drafted yet')
    expect(source).toContain(
      'This block exists, but it does not have any shift rows yet. Auto-draft it or click a day to start assigning the first shifts manually.'
    )
  })
})
