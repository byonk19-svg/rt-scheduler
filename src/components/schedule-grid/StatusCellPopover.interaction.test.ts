import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from '@playwright/test'
import { build, type Plugin } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PLAYWRIGHT_TEST_TIMEOUT = 30_000

const statusPopoverResetEntry = String.raw`
  import React, { useState } from 'react'
  import { createRoot } from 'react-dom/client'

  import { StatusCellPopover } from '@/components/schedule-grid/StatusCellPopover'

  const targets = [
    {
      userId: 'user-1',
      therapistName: 'Alice Johnson',
      date: '2026-05-04',
      cell: {
        shiftId: 'shift-1',
        status: 'staff',
        hasNeedsOff: false,
        isIneligible: false,
      },
    },
    {
      userId: 'user-2',
      therapistName: 'Bob Stone',
      date: '2026-05-05',
      cell: {
        shiftId: 'shift-2',
        status: 'staff',
        hasNeedsOff: false,
        isIneligible: false,
      },
    },
  ]

  function Harness() {
    const [targetIndex, setTargetIndex] = useState(0)
    const target = targets[targetIndex]

    return (
      <main>
        <button type="button" onClick={() => setTargetIndex(1)}>
          Switch target
        </button>
        <StatusCellPopover
          key={target.userId + ':' + target.date + ':' + (target.cell.shiftId ?? 'unassigned')}
          open
          onOpenChange={() => {}}
          anchorEl={null}
          therapistName={target.therapistName}
          date={target.date}
          cell={target.cell}
          allowStatusChange
          canUnassign
          canDesignateLead
          isCurrentlyLead={false}
          onStatusChange={async () => {}}
          onUnassign={async () => {}}
          onDesignateLead={async () => {}}
          isPending={false}
        />
      </main>
    )
  }

  createRoot(document.getElementById('root')).render(<Harness />)
`

function statusPopoverResetPlugin(): Plugin {
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
    name: 'status-popover-reset-test',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@\/components\/ui\/popover$/ }, (args) => ({
        path: args.path,
        namespace: 'status-popover-reset-mock',
      }))
      buildApi.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveSourcePath(args.path),
      }))
      buildApi.onLoad(
        { filter: /^@\/components\/ui\/popover$/, namespace: 'status-popover-reset-mock' },
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

            export function PopoverContent({ children, ...props }) {
              return React.createElement('div', { ...props, 'data-testid': 'popover-content' }, children)
            }
          `,
        })
      )
    },
  }
}

async function renderStatusPopoverHarness(page: Page) {
  const bundle = await build({
    stdin: {
      contents: statusPopoverResetEntry,
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
    plugins: [statusPopoverResetPlugin()],
  })

  const script = Buffer.from(bundle.outputFiles[0]?.text ?? '').toString('base64')
  await page.setContent(`
    <main id="root"></main>
    <script src="data:text/javascript;base64,${script}"></script>
  `)
}

describe('StatusCellPopover target reset behavior', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(async () => {
    await browser.close()
  }, PLAYWRIGHT_TEST_TIMEOUT)

  it(
    'clears pending confirmation, note, and left-early time when retargeted',
    async () => {
      const page = await browser.newPage()
      try {
        await renderStatusPopoverHarness(page)

        await page.getByRole('button', { name: 'Left early' }).click()
        await page.getByLabel('Left at').fill('14:05')
        await page.getByLabel('Note').fill('First cell note')

        await page.getByText('Mark Left Early?').waitFor({ state: 'visible' })
        await page.getByRole('button', { name: 'Switch target' }).click()
        await page.getByText('Bob Stone - May 5, 2026').waitFor({ state: 'visible' })
        await page.getByText('Mark Left Early?').waitFor({ state: 'detached' })

        await page.getByRole('button', { name: 'Left early' }).click()
        expect(await page.getByLabel('Left at').inputValue()).toBe('')
        expect(await page.getByLabel('Note').inputValue()).toBe('')
      } finally {
        await page.close()
      }
    },
    PLAYWRIGHT_TEST_TIMEOUT
  )
})
