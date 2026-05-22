import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from '@playwright/test'
import { build, type Plugin } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type ScheduleGridFeedbackTestState = {
  alertCalls: number
  assignCalls: number
  refreshCalls: number
  replaceCalls: number
  lastAssignPayload: unknown
}

declare global {
  interface Window {
    __scheduleGridTestState: ScheduleGridFeedbackTestState
  }
}

const scheduleGridFeedbackEntry = String.raw`
  import React from 'react'
  import { createRoot } from 'react-dom/client'

  import { ScheduleGrid } from '@/components/schedule-grid/ScheduleGrid'

  window.__scheduleGridTestState = {
    alertCalls: 0,
    assignCalls: 0,
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
      return { error: new Error('assign failed') }
    },
    async unassign() {
      return { error: null }
    },
    async updateStatus() {
      return { error: null }
    },
    async setDesignatedLead() {
      return { error: null }
    },
  }

  const dataset = {
    cycleId: 'cycle-1',
    shiftType: 'day',
    availableCycles: [{ id: 'cycle-1', label: 'May 4 - May 5, 2026' }],
    cycleDates: ['2026-05-04'],
    cycleDateRangeLabel: 'May 4 - May 5, 2026',
    isPublished: true,
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
            shiftId: null,
            status: 'off',
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

  createRoot(document.getElementById('root')).render(
    <ScheduleGrid initialDataset={dataset} initialShiftTab="Day" />
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

async function renderScheduleGridFeedbackHarness(page: Page) {
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
  await page.setContent(`
    <main id="root"></main>
    <script src="data:text/javascript;base64,${script}"></script>
  `)
}

describe('ScheduleGrid feedback rendering', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(async () => {
    await browser.close()
  })

  it('shows non-blocking feedback when assignment fails without refreshing the schedule', async () => {
    const page = await browser.newPage()
    try {
      await renderScheduleGridFeedbackHarness(page)

      await page.getByTestId('cell-therapist-1-2026-05-04').click()
      await page.getByRole('button', { name: 'Assign' }).click()

      await page
        .getByRole('alert')
        .getByText('Could not assign this shift. Refresh Schedule and try again.')
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
  }, 15_000)
})
