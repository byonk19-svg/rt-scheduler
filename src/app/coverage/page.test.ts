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
    const filePath = resolve(process.cwd(), 'src/app/schedule/actions.ts')
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
    expect(source).toContain('Live schedule - edits stay enabled')
    expect(source).toContain('Publish history')
  })
})
