import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const coverageClientPath = resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx')
const coverageServerDataPath = resolve(
  process.cwd(),
  'src/app/(app)/coverage/coverage-page-data.ts'
)
const publishActionsPath = resolve(
  process.cwd(),
  'src/app/(app)/schedule/actions/publish-actions.ts'
)

describe('coverage publish override affordance', () => {
  it('renders a weekly-rule override publish action when weekly validation blocks publish', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain("errorParam === 'publish_weekly_rule_violation'")
    expect(source).toContain("weekly: 'true'")
    expect(source).toContain('name="override_weekly_rules"')
    expect(source).toContain('Publish with weekly override')
  })

  it('preserves a weekly override when shift validation fails afterward', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain("const overrideWeeklyRulesParam = search.get('override_weekly_rules')")
    expect(source).toContain("const overrideShiftRulesParam = search.get('override_shift_rules')")
    expect(source).toContain("weekly: overrideWeeklyRulesParam === 'true' ? 'true' : 'false'")
    expect(source).toContain("shift: overrideShiftRulesParam === 'true' ? 'true' : 'false'")
  })

  it('keeps override flags in publish validation redirects', () => {
    const source = readFileSync(publishActionsPath, 'utf8')

    expect(source).toContain("override_weekly_rules: overrideWeeklyRules ? 'true' : undefined")
    expect(source).toContain("override_shift_rules: overrideShiftRules ? 'true' : undefined")
  })

  it('surfaces cycle workflow controls in the coverage workspace', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain('New 6-week block')
    expect(source).toContain('ClearDraftConfirmDialog')
    expect(source).toContain('CycleManagementDialog')
    expect(source).toContain('formatHumanCycleRange')
    expect(source).toContain('Schedule cycle')
    expect(source).toContain('Publish history')
  })

  it('defaults schedule shift tab from profile shift_type and honors ?shift= query', () => {
    const client = readFileSync(coverageClientPath, 'utf8')
    const server = readFileSync(coverageServerDataPath, 'utf8')

    expect(server).toContain('parseCoverageShiftSearchParam')
    expect(server).toContain('normalizeActorShiftType')
    expect(server).toContain('defaultCoverageShiftTabFromProfileShift')
    expect(server).toContain('getCoveragePageServerData')
    expect(server).toContain('shiftTabLockedFromUrl')
    expect(client).toContain('initialShiftTab')
    expect(client).toContain('COVERAGE_SHIFT_QUERY_KEY')
    expect(client).toContain('router.replace')
    expect(client).toContain('handleTabSwitch')
  })

  it('shows an explicit empty state instead of a synthetic 6-week window when no cycle exists', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain('No open 6-week block')
    expect(source).toContain('No open 6-week block — create a new draft block to start staffing.')
    expect(source).not.toContain('Current 6-week window')
  })

  it('shows an explicit empty-draft state when a cycle exists but has no staffing rows yet', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain('No staffing drafted yet.')
    expect(source).toContain('No shifts assigned yet. Run Auto-draft or click a day to assign manually.')
  })

  it('calls out live operational status badges on the published schedule', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain('Operational updates visible to everyone:')
    expect(source).toContain('<StatusPill status="oncall" />')
    expect(source).toContain('<StatusPill status="cancelled" />')
    expect(source).toContain('<StatusPill status="call_in" />')
  })

  it('lazy-loads coverage dialogs instead of bundling closed overlays into first paint', () => {
    const source = readFileSync(coverageClientPath, 'utf8')

    expect(source).toContain("const ShiftEditorDialog = dynamic(")
    expect(source).toContain("const AutoDraftConfirmDialog = dynamic(")
    expect(source).toContain("const ClearDraftConfirmDialog = dynamic(")
    expect(source).toContain("const CycleManagementDialog = dynamic(")
    expect(source).toContain('{selectedDay ? (')
    expect(source).toContain('{autoDraftDialogOpen ? (')
    expect(source).toContain('{clearDraftDialogOpen ? (')
    expect(source).toContain('{cycleDialogOpen ? (')
  })
})
