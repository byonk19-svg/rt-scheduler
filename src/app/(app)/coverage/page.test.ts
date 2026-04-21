import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const coverageClientPath = resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx')
const coverageHeaderPath = resolve(
  process.cwd(),
  'src/components/coverage/CoverageWorkspaceHeader.tsx'
)
const coverageBannersPath = resolve(
  process.cwd(),
  'src/components/coverage/CoverageWorkspaceBanners.tsx'
)
const coverageWorkspaceStatePath = resolve(
  process.cwd(),
  'src/lib/coverage/coverage-workspace-state.ts'
)
const coverageWorkspaceUiStatePath = resolve(
  process.cwd(),
  'src/components/coverage/useCoverageWorkspaceUiState.ts'
)
const coverageWorkspaceSnapshotStatePath = resolve(
  process.cwd(),
  'src/components/coverage/useCoverageWorkspaceSnapshotState.ts'
)
const coverageWorkspaceViewModelPath = resolve(
  process.cwd(),
  'src/components/coverage/useCoverageWorkspaceViewModel.ts'
)
const coverageSelectedDayContextPath = resolve(
  process.cwd(),
  'src/components/coverage/useCoverageSelectedDayContext.ts'
)
const coverageWorkspaceSearchStatePath = resolve(
  process.cwd(),
  'src/components/coverage/useCoverageWorkspaceSearchState.ts'
)
const coverageWorkspaceOverlaysPath = resolve(
  process.cwd(),
  'src/components/coverage/CoverageWorkspaceOverlays.tsx'
)
const coverageWorkspaceActionFormsPath = resolve(
  process.cwd(),
  'src/components/coverage/CoverageWorkspaceActionForms.tsx'
)
const coveragePagePath = resolve(process.cwd(), 'src/app/(app)/coverage/page.tsx')
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
    const bannerSource = readFileSync(coverageBannersPath, 'utf8')
    const viewModelSource = readFileSync(coverageWorkspaceViewModelPath, 'utf8')

    expect(viewModelSource).toContain("errorParam === 'publish_weekly_rule_violation'")
    expect(viewModelSource).toContain("weekly: 'true'")
    expect(bannerSource).toContain('name="override_weekly_rules"')
    expect(bannerSource).toContain('Override publish block')
    expect(source).toContain('useCoverageWorkspaceViewModel')
  })

  it('preserves a weekly override when shift validation fails afterward', () => {
    const source = readFileSync(coverageWorkspaceViewModelPath, 'utf8')

    expect(source).toContain('overrideWeeklyRulesParam,')
    expect(source).toContain('overrideShiftRulesParam,')
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
    const bannerSource = readFileSync(coverageBannersPath, 'utf8')
    const overlaysSource = readFileSync(coverageWorkspaceOverlaysPath, 'utf8')
    const viewModelSource = readFileSync(coverageWorkspaceViewModelPath, 'utf8')

    expect(bannerSource).toContain('New 6-week block')
    expect(overlaysSource).toContain('ClearDraftConfirmDialog')
    expect(overlaysSource).toContain('CycleManagementDialog')
    expect(viewModelSource).toContain('formatHumanCycleRange')
    expect(bannerSource).toContain('Delivery history')
    expect(source).toContain('useCoverageWorkspaceViewModel')
  })

  it('promotes the workflow sequence before secondary cycle tools', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const headerSource = readFileSync(coverageHeaderPath, 'utf8')

    expect(headerSource).toContain('1 Draft')
    expect(headerSource).toContain('2 Review')
    expect(headerSource).toContain('3 Send preliminary')
    expect(headerSource).toContain('4 Publish')
    expect(headerSource).toContain('label="Cycle tools"')
    expect(headerSource).not.toContain('label="More"')
    expect(source).toContain('<CoverageWorkspaceHeader')
  })

  it('keeps snapshot hydration and shift-profile sync in a dedicated hook', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const snapshotStateSource = readFileSync(coverageWorkspaceSnapshotStatePath, 'utf8')

    expect(snapshotStateSource).toContain('useCoverageWorkspaceSnapshotState')
    expect(snapshotStateSource).toContain('setDayDays(initialSnapshot.dayDays)')
    expect(snapshotStateSource).toContain("const shiftType = shiftTab === 'Day' ? 'day' : 'night'")
    expect(source).toContain('useCoverageWorkspaceSnapshotState')
  })

  it('keeps publish and workspace view-model derivation in a dedicated hook', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const viewModelSource = readFileSync(coverageWorkspaceViewModelPath, 'utf8')

    expect(viewModelSource).toContain('useCoverageWorkspaceViewModel')
    expect(viewModelSource).toContain("label: 'Publish with weekly override'")
    expect(viewModelSource).toContain("days.find((day) => day.constraintBlocked || !day.leadShift || countActive(day) < 3)")
    expect(source).toContain('useCoverageWorkspaceViewModel')
  })

  it('makes the review step jump to the first issue day in the current cycle', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const uiStateSource = readFileSync(coverageWorkspaceUiStatePath, 'utf8')
    const viewModelSource = readFileSync(coverageWorkspaceViewModelPath, 'utf8')

    expect(viewModelSource).toContain('const reviewTargetDay = useMemo(')
    expect(viewModelSource).toContain('const reviewTargetIndex = useMemo(() => {')
    expect(viewModelSource).toContain('return days.findIndex((day) => day.id === reviewTargetDay.id)')
    expect(viewModelSource).toContain("day.constraintBlocked || !day.leadShift || countActive(day) < 3")
    expect(uiStateSource).toContain('setSelectedId(reviewTargetDay.id)')
    expect(uiStateSource).toContain('setWeekOffset(Math.floor(reviewTargetIndex / 7))')
    expect(source).toContain('useCoverageWorkspaceViewModel')
  })

  it('keeps selected-day operational context and weekly counts in a dedicated hook', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const selectedDayContextSource = readFileSync(coverageSelectedDayContextPath, 'utf8')

    expect(selectedDayContextSource).toContain('useCoverageSelectedDayContext')
    expect(selectedDayContextSource).toContain('const selectedDayBase = useMemo(')
    expect(selectedDayContextSource).toContain('const weeklyTherapistCounts = useMemo((): Map<string, number> => {')
    expect(source).toContain('useCoverageSelectedDayContext')
  })

  it('keeps hidden action forms in a dedicated component', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const actionFormsSource = readFileSync(coverageWorkspaceActionFormsPath, 'utf8')

    expect(actionFormsSource).toContain('generateDraftScheduleAction')
    expect(actionFormsSource).toContain('resetDraftScheduleAction')
    expect(actionFormsSource).toContain('name="return_to" value="coverage"')
    expect(source).toContain('CoverageWorkspaceActionForms')
  })

  it('keeps search-param parsing and feedback shaping in a dedicated hook', () => {
    const source = readFileSync(coverageClientPath, 'utf8')
    const searchStateSource = readFileSync(coverageWorkspaceSearchStatePath, 'utf8')

    expect(searchStateSource).toContain('useCoverageWorkspaceSearchState')
    expect(searchStateSource).toContain("const successParam = search.get('success')")
    expect(searchStateSource).toContain('const scheduleFeedbackParams = useMemo<ScheduleSearchParams>(')
    expect(source).toContain('useCoverageWorkspaceSearchState')
  })

  it('defaults schedule shift tab from profile shift_type and honors ?shift= query', () => {
    const client = readFileSync(coverageClientPath, 'utf8')
    const server = readFileSync(coverageServerDataPath, 'utf8')
    const uiStateSource = readFileSync(coverageWorkspaceUiStatePath, 'utf8')
    const searchStateSource = readFileSync(coverageWorkspaceSearchStatePath, 'utf8')

    expect(server).toContain('parseCoverageShiftSearchParam')
    expect(server).toContain('normalizeActorShiftType')
    expect(server).toContain('defaultCoverageShiftTabFromProfileShift')
    expect(server).toContain('getCoveragePageServerData')
    expect(server).toContain('shiftTabLockedFromUrl')
    expect(client).toContain('initialShiftTab')
    expect(searchStateSource).toContain('COVERAGE_SHIFT_QUERY_KEY')
    expect(uiStateSource).toContain('router.replace')
    expect(uiStateSource).toContain('handleTabSwitch')
  })

  it('shows an explicit empty state instead of a synthetic 6-week window when no cycle exists', () => {
    const source = readFileSync(coverageWorkspaceStatePath, 'utf8')

    expect(source).toContain('No open 6-week block')
    expect(source).toContain('No open 6-week block — create a new draft block to start staffing.')
    expect(source).not.toContain('Current 6-week window')
  })

  it('shows an explicit empty-draft state when a cycle exists but has no staffing rows yet', () => {
    const source = readFileSync(coverageWorkspaceStatePath, 'utf8')
    const bannerSource = readFileSync(coverageBannersPath, 'utf8')

    expect(source).toContain('No staffing drafted yet.')
    expect(bannerSource).toContain(
      'No shifts assigned yet. Run Auto-draft or click a day to assign manually.'
    )
  })

  it('calls out live operational status badges on the published schedule', () => {
    const bannerSource = readFileSync(coverageBannersPath, 'utf8')

    expect(bannerSource).toContain('Operational updates visible to everyone:')
    expect(bannerSource).toContain('<StatusPill status="oncall" />')
    expect(bannerSource).toContain('<StatusPill status="cancelled" />')
    expect(bannerSource).toContain('<StatusPill status="call_in" />')
  })

  it('lazy-loads coverage dialogs instead of bundling closed overlays into first paint', () => {
    const source = readFileSync(coverageWorkspaceOverlaysPath, 'utf8')

    expect(source).toContain("const ShiftEditorDialog = dynamic(")
    expect(source).toContain("const PreFlightDialog = dynamic(")
    expect(source).toContain("const ClearDraftConfirmDialog = dynamic(")
    expect(source).toContain("const CycleManagementDialog = dynamic(")
    expect(source).toContain('{selectedDay ? (')
    expect(source).toContain('{preFlightDialogOpen ? (')
    expect(source).toContain('{clearDraftDialogOpen ? (')
    expect(source).toContain('{cycleDialogOpen ? (')
  })

  it('imports the live coverage client page directly from the route-group entry', () => {
    const source = readFileSync(coveragePagePath, 'utf8')

    expect(source).toContain("import { CoverageClientPage } from '@/app/(app)/coverage/CoverageClientPage'")
    expect(source).not.toContain("import { CoverageClientPage } from '@/app/coverage/CoverageClientPage'")
  })
})
