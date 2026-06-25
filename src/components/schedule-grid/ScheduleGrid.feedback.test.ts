import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from '@playwright/test'
import { build, type Plugin } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type ScheduleGridFeedbackTestState = {
  alertCalls: number
  assignCalls: number
  statusCalls: number
  leadCalls: number
  refreshCalls: number
  replaceCalls: number
  lastAssignPayload: unknown
}

type ScheduleGridFeedbackTestError = {
  code?: string
  message?: string
}

type ScheduleGridFeedbackTestScenario = {
  cellStatus: 'off' | 'staff'
  isPublished?: boolean
  errors: {
    assign?: ScheduleGridFeedbackTestError
    updateStatus?: ScheduleGridFeedbackTestError
    setDesignatedLead?: ScheduleGridFeedbackTestError
  }
}

const PLAYWRIGHT_TEST_TIMEOUT = 30_000

declare global {
  interface Window {
    __scheduleGridTestState: ScheduleGridFeedbackTestState
    __scheduleGridScenario: ScheduleGridFeedbackTestScenario
  }
}

const scheduleGridFeedbackEntry = String.raw`
  import React from 'react'
  import { createRoot } from 'react-dom/client'

  import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'

  const scenario = window.__scheduleGridScenario ?? {
    cellStatus: 'off',
    errors: {},
  }

  window.__scheduleGridTestState = {
    alertCalls: 0,
    assignCalls: 0,
    statusCalls: 0,
    leadCalls: 0,
    refreshCalls: 0,
    replaceCalls: 0,
    lastAssignPayload: null,
  }

  window.alert = () => {
    window.__scheduleGridTestState.alertCalls += 1
  }

  window.__scheduleGridRouter = {
    refresh() {
      window.__scheduleGridTestState.refreshCalls += 1
    },
    replace() {
      window.__scheduleGridTestState.replaceCalls += 1
    },
  }

  window.__scheduleGridMutator = {
    async assign(payload) {
      window.__scheduleGridTestState.assignCalls += 1
      window.__scheduleGridTestState.lastAssignPayload = payload
      return { error: scenario.errors.assign ?? null }
    },
    async unassign() {
      return { error: null }
    },
    async updateStatus() {
      window.__scheduleGridTestState.statusCalls += 1
      return { error: scenario.errors.updateStatus ?? null }
    },
    async setDesignatedLead() {
      window.__scheduleGridTestState.leadCalls += 1
      return { error: scenario.errors.setDesignatedLead ?? null }
    },
  }

  const dataset = {
    cycleId: 'cycle-1',
    shiftType: 'day',
    interactionMode: {
      kind: 'manager_edit',
      canUseManagerToolbar: true,
      canAssignShifts: true,
      canUnassignShifts: true,
      canDesignateLead: true,
      canUpdateAssignmentStatus: true,
    },
    availableCycles: [{ id: 'cycle-1', label: 'May 4 - May 5, 2026' }],
    templateOptions: [],
    cycleDates: ['2026-05-04'],
    cycleDateRangeLabel: 'May 4 - May 5, 2026',
    isPublished: scenario.isPublished ?? true,
    cycleStatus: scenario.isPublished === false ? 'draft' : 'final',
    therapistRows: [
      {
        userId: 'therapist-1',
        name: 'Alice Johnson',
        isOnFmla: false,
        isActive: true,
        employmentType: 'full_time',
        shiftType: 'day',
        cells: {
          '2026-05-04': {
            shiftId: scenario.cellStatus === 'off' ? null : 'shift-1',
            status: scenario.cellStatus,
            hasNeedsOff: false,
            isIneligible: false,
          },
        },
      },
    ],
    dailyTotals: { '2026-05-04': 0 },
    viewerUserId: 'manager-1',
    viewerRole: 'manager',
    canManageCoverage: true,
    canUpdateAssignmentStatus: true,
  }

  const preFlightSummary = {
    unfilledSlots: 1,
    missingLeadSlots: 1,
    forcedMustWorkMisses: 1,
    details: [{ date: '2026-05-04', shiftType: 'day', missingCount: 1 }],
    readinessIssues: [
      {
        id: 'unfilled-assignment:2026-05-04:day',
        severity: 'blocking',
        type: 'unfilled_assignment',
        date: '2026-05-04',
        shiftType: 'day',
        role: 'staff',
        title: 'Day shift is short 1 assignment',
        detail: 'Day shift on 2026-05-04 is projected to miss minimum staffing by 1 assignment.',
        recommendedAction: 'Assign eligible staff or adjust coverage targets before publishing.',
        target: {
          kind: 'slot',
          date: '2026-05-04',
          shiftType: 'day',
          role: 'staff',
        },
      },
      {
        id: 'missing-lead:2026-05-04:day',
        severity: 'blocking',
        type: 'missing_lead',
        date: '2026-05-04',
        shiftType: 'day',
        role: 'lead',
        title: 'Day shift needs a lead',
        detail: 'Day shift on 2026-05-04 has no lead assigned.',
        recommendedAction: 'Designate an eligible lead for this shift.',
        target: {
          kind: 'slot',
          date: '2026-05-04',
          shiftType: 'day',
          role: 'lead',
        },
      },
      {
        id: 'missing-availability-submission:therapist-2',
        severity: 'warning',
        type: 'missing_availability_submission',
        therapistId: 'therapist-2',
        therapistName: 'Blair Morgan',
        title: 'Blair Morgan has not submitted availability',
        detail:
          'Blair Morgan has no official availability submission or manager-entered availability for this Schedule Block.',
        recommendedAction:
          'Send a reminder, enter manager-confirmed availability, or review the risk before publishing with missing availability.',
        target: {
          kind: 'therapist',
          therapistId: 'therapist-2',
        },
      },
      {
        id: 'open-shift-board-request:post-1',
        severity: 'warning',
        type: 'open_shift_board_request',
        date: '2026-05-04',
        shiftType: 'day',
        title: 'Coverage request is still open',
        detail: 'Coverage request touching day shift on 2026-05-04 may change staffing after publish.',
        recommendedAction:
          'Review the request on Shift Board before publishing, or continue knowing the schedule may change.',
        target: {
          kind: 'shift_board_request',
          requestId: 'post-1',
          date: '2026-05-04',
          shiftType: 'day',
        },
      },
      {
        id: 'ineligible-assignment:shift-inactive-1',
        severity: 'blocking',
        type: 'ineligible_assignment',
        date: '2026-05-04',
        shiftType: 'day',
        therapistId: 'inactive-1',
        therapistName: 'Inactive Therapist',
        title: 'Inactive Therapist is assigned while inactive',
        detail:
          'Inactive Therapist is assigned to day shift on 2026-05-04, but this therapist is inactive.',
        recommendedAction:
          'Move the assignment to an eligible therapist before sending or publishing.',
        target: {
          kind: 'therapist_date',
          date: '2026-05-04',
          shiftType: 'day',
          therapistId: 'inactive-1',
        },
      },
    ],
  }

  createRoot(document.getElementById('root')).render(
    <ScheduleGrid
      initialDataset={dataset}
      initialShiftTab="Day"
      preFlightSummary={preFlightSummary}
    />
  )
`

function scheduleGridFeedbackPlugin(): Plugin {
  function resolveSourcePath(importPath: string) {
    const sourcePath = path.join(process.cwd(), 'src', importPath.slice(2))
    const candidates = [
      sourcePath,
      `${sourcePath}.ts`,
      `${sourcePath}.tsx`,
      `${sourcePath}.js`,
      path.join(sourcePath, 'index.ts'),
      path.join(sourcePath, 'index.tsx'),
    ]
    return candidates.find((candidate) => existsSync(candidate)) ?? sourcePath
  }

  return {
    name: 'schedule-grid-feedback-test',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^next\/navigation$/ }, (args) => ({
        path: args.path,
        namespace: 'schedule-grid-feedback-mock',
      }))
      buildApi.onResolve({ filter: /^@\/components\/ui\/popover$/ }, (args) => ({
        path: args.path,
        namespace: 'schedule-grid-feedback-mock',
      }))
      buildApi.onResolve({ filter: /^@\/lib\/coverage\/mutations$/ }, (args) => ({
        path: args.path,
        namespace: 'schedule-grid-feedback-mock',
      }))
      buildApi.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveSourcePath(args.path),
      }))
      buildApi.onLoad(
        { filter: /^next\/navigation$/, namespace: 'schedule-grid-feedback-mock' },
        () => ({
          loader: 'js',
          contents: `
            export function useRouter() {
              return window.__scheduleGridRouter
            }
            export function usePathname() {
              return '/schedule'
            }
            export function useSearchParams() {
              return new URLSearchParams()
            }
          `,
        })
      )
      buildApi.onLoad(
        { filter: /^@\/components\/ui\/popover$/, namespace: 'schedule-grid-feedback-mock' },
        () => ({
          loader: 'jsx',
          resolveDir: process.cwd(),
          contents: `
            import React from 'react'

            export function Popover({ children }) {
              return React.createElement(React.Fragment, null, children)
            }

            export function PopoverAnchor() {
              return null
            }

            export function PopoverContent({ children }) {
              return React.createElement('div', { 'data-testid': 'popover-content' }, children)
            }
          `,
        })
      )
      buildApi.onLoad(
        { filter: /^@\/lib\/coverage\/mutations$/, namespace: 'schedule-grid-feedback-mock' },
        () => ({
          loader: 'js',
          contents: `
            export function createCoverageShiftMutator() {
              return window.__scheduleGridMutator
            }
          `,
        })
      )
    },
  }
}

async function renderScheduleGridFeedbackHarness(
  page: Page,
  scenario: ScheduleGridFeedbackTestScenario = { cellStatus: 'off', errors: {} }
) {
  const bundle = await build({
    stdin: {
      contents: scheduleGridFeedbackEntry,
      loader: 'tsx',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"test"',
    },
    plugins: [scheduleGridFeedbackPlugin()],
  })

  const script = Buffer.from(bundle.outputFiles[0]?.text ?? '').toString('base64')
  const scenarioScript = Buffer.from(
    `window.__scheduleGridScenario = ${JSON.stringify(scenario)};`
  ).toString('base64')
  await page.setContent(`
    <main id="root"></main>
    <script src="data:text/javascript;base64,${scenarioScript}"></script>
    <script src="data:text/javascript;base64,${script}"></script>
  `)
}

function collectDuplicateKeyWarnings(page: Page) {
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return

    const text = message.text()
    if (text.includes('Encountered two children with the same key')) {
      warnings.push(text)
    }
  })
  return warnings
}

describe('ScheduleGrid feedback rendering', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(async () => {
    await browser.close()
  })

  it(
    'renders readiness issue rows in the pre-flight panel',
    async () => {
      const page = await browser.newPage()
      try {
        await renderScheduleGridFeedbackHarness(page, {
          cellStatus: 'off',
          isPublished: false,
          errors: {},
        })

        await page.getByRole('button', { name: 'Pre-flight' }).click()

        await page.getByText('Pre-flight summary').waitFor({ state: 'visible' })
        await page.getByText('3 blocking issues + 2 warnings').waitFor({ state: 'visible' })
        await page.getByText('1 missing availability submission').waitFor({ state: 'visible' })
        await page.getByText('1 open Shift Board request').waitFor({ state: 'visible' })
        await page.getByText('Day shift is short 1 assignment').waitFor({ state: 'visible' })
        await page.getByText('Day shift needs a lead').waitFor({ state: 'visible' })
        await page
          .getByText('Blair Morgan has not submitted availability')
          .waitFor({ state: 'visible' })
        await page.getByText('Coverage request is still open').waitFor({ state: 'visible' })
        await page
          .getByText('Inactive Therapist is assigned while inactive')
          .waitFor({ state: 'visible' })
        await page
          .getByLabel('Pre-flight readiness issues')
          .getByText('Blair Morgan', { exact: true })
          .waitFor({ state: 'visible' })
        await page
          .getByLabel('Pre-flight readiness issues')
          .getByText('2026-05-04 day shift')
          .first()
          .waitFor({ state: 'visible' })
      } finally {
        await page.close()
      }
    },
    PLAYWRIGHT_TEST_TIMEOUT
  )

  it(
    'renders readiness issue rows without duplicate React key warnings',
    async () => {
      const page = await browser.newPage()
      const duplicateKeyWarnings = collectDuplicateKeyWarnings(page)
      try {
        await renderScheduleGridFeedbackHarness(page, {
          cellStatus: 'off',
          isPublished: false,
          errors: {},
        })

        await page.getByRole('button', { name: 'Pre-flight' }).click()
        await page.getByText('Pre-flight summary').waitFor({ state: 'visible' })

        expect(duplicateKeyWarnings).toEqual([])
      } finally {
        await page.close()
      }
    },
    PLAYWRIGHT_TEST_TIMEOUT
  )

  it(
    'shows specific feedback from typed code when assignment fails on a scheduling conflict',
    async () => {
      const page = await browser.newPage()
      try {
        await renderScheduleGridFeedbackHarness(page, {
          cellStatus: 'off',
          errors: {
            assign: {
              code: 'availability_conflict',
              message: 'Availability copy changed.',
            },
          },
        })

        await page.getByTestId('cell-therapist-1-2026-05-04').click()
        await page.getByRole('button', { name: 'Assign' }).click()

        await page
          .getByRole('alert')
          .getByText(
            'This therapist has a scheduling conflict. Review their availability before assigning.'
          )
          .waitFor({ state: 'visible' })

        const state = await page.evaluate(() => window.__scheduleGridTestState)

        expect(state.assignCalls).toBe(1)
        expect(state.lastAssignPayload).toMatchObject({
          cycleId: 'cycle-1',
          userId: 'therapist-1',
          isoDate: '2026-05-04',
          shiftType: 'day',
          role: 'staff',
        })
        expect(state.alertCalls).toBe(0)
        expect(state.refreshCalls).toBe(0)
      } finally {
        await page.close()
      }
    },
    PLAYWRIGHT_TEST_TIMEOUT
  )

  it(
    'shows stale-state feedback when status update targets a read-only Schedule Block',
    async () => {
      const page = await browser.newPage()
      try {
        await renderScheduleGridFeedbackHarness(page, {
          cellStatus: 'staff',
          errors: {
            updateStatus: {
              code: 'cycle_read_only',
              message: 'Read-only copy changed.',
            },
          },
        })

        await page.getByTestId('cell-therapist-1-2026-05-04').click()
        await page.getByRole('button', { name: 'Cancelled' }).click()
        await page.getByRole('button', { name: 'Mark Cancelled' }).click()

        await page
          .getByRole('alert')
          .getByText('This Schedule Block is read-only until it is republished.')
          .waitFor({ state: 'visible' })

        const state = await page.evaluate(() => window.__scheduleGridTestState)

        expect(state.statusCalls).toBe(1)
        expect(state.alertCalls).toBe(0)
        expect(state.refreshCalls).toBe(0)
      } finally {
        await page.close()
      }
    },
    PLAYWRIGHT_TEST_TIMEOUT
  )

  it(
    'uses action-specific fallback feedback for unknown failures',
    async () => {
      const page = await browser.newPage()
      try {
        await renderScheduleGridFeedbackHarness(page, {
          cellStatus: 'staff',
          errors: {
            setDesignatedLead: {
              message: 'database timeout on relation shifts',
            },
          },
        })

        await page.getByTestId('cell-therapist-1-2026-05-04').click()
        await page.getByRole('button', { name: 'Designate as lead' }).click()

        await page
          .getByRole('alert')
          .getByText('Could not set the lead for this shift. Refresh Schedule and try again.')
          .waitFor({ state: 'visible' })

        const state = await page.evaluate(() => window.__scheduleGridTestState)

        expect(state.leadCalls).toBe(1)
        expect(state.alertCalls).toBe(0)
        expect(state.refreshCalls).toBe(0)
      } finally {
        await page.close()
      }
    },
    PLAYWRIGHT_TEST_TIMEOUT
  )
})
