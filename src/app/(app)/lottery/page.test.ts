import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, createClientMock, loadLotteryActorMock, loadLotterySnapshotMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    createClientMock: vi.fn(),
    loadLotteryActorMock: vi.fn(),
    loadLotterySnapshotMock: vi.fn(),
  }))

const LOTTERY_PAGE_SOURCE_PATH = 'src/app/(app)/lottery/page.tsx'

type LotteryPageTestDeps = {
  nextNavigation: {
    redirect: typeof redirectMock
  }
  supabaseServer: {
    createClient: typeof createClientMock
  }
  lotteryService: {
    loadLotteryActor: typeof loadLotteryActorMock
    loadLotterySnapshot: typeof loadLotterySnapshotMock
  }
  createElement: typeof createElement
  LotteryClientPage: ({
    initialSnapshot,
  }: {
    initialSnapshot: { actor: { userId: string }; selectedShift: 'day' | 'night' }
  }) => ReturnType<typeof createElement>
}

declare global {
  var __lotteryPageTestDeps: LotteryPageTestDeps
}

function replaceOrThrow(source: string, label: string, pattern: RegExp, replacement: string) {
  const matches = [
    ...source.matchAll(
      new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    ),
  ]
  if (matches.length !== 1) {
    throw new Error(
      `Lottery page test harness rewrite failed for ${label}: expected 1 match in ${LOTTERY_PAGE_SOURCE_PATH}, found ${matches.length}`
    )
  }

  const nextSource = source.replace(pattern, replacement)
  if (nextSource === source) {
    throw new Error(
      `Lottery page test harness rewrite failed for ${label}: replacement did not apply`
    )
  }

  return nextSource
}

async function loadLotteryPage() {
  let source = readFileSync(resolve(process.cwd(), LOTTERY_PAGE_SOURCE_PATH), 'utf8')
  source = replaceOrThrow(
    source,
    'next Metadata import',
    /import type \{ Metadata \} from 'next'\r?\n/,
    'type Metadata = unknown\n'
  )
  source = replaceOrThrow(
    source,
    'next/navigation redirect import',
    /import \{ redirect \} from 'next\/navigation'\r?\n/,
    'const { redirect } = globalThis.__lotteryPageTestDeps.nextNavigation\n'
  )
  source = replaceOrThrow(
    source,
    'LotteryClientPage import',
    /import LotteryClientPage from '@\/components\/lottery\/LotteryClientPage'\r?\n/,
    'const LotteryClientPage = globalThis.__lotteryPageTestDeps.LotteryClientPage\n'
  )
  source = replaceOrThrow(
    source,
    'lottery service import',
    /import \{ loadLotteryActor, loadLotterySnapshot \} from '@\/lib\/lottery\/service'\r?\n/,
    'const { loadLotteryActor, loadLotterySnapshot } = globalThis.__lotteryPageTestDeps.lotteryService\n'
  )
  source = replaceOrThrow(
    source,
    'supabase server import',
    /import \{ createClient \} from '@\/lib\/supabase\/server'\r?\n/,
    'const { createClient } = globalThis.__lotteryPageTestDeps.supabaseServer\n'
  )

  const transformed = await transform(source, {
    loader: 'tsx',
    format: 'esm',
    target: 'es2020',
    jsx: 'transform',
    jsxFactory: 'globalThis.__lotteryPageTestDeps.createElement',
  })

  globalThis.__lotteryPageTestDeps = {
    nextNavigation: { redirect: redirectMock },
    supabaseServer: { createClient: createClientMock },
    lotteryService: {
      loadLotteryActor: loadLotteryActorMock,
      loadLotterySnapshot: loadLotterySnapshotMock,
    },
    createElement,
    LotteryClientPage: ({
      initialSnapshot,
    }: {
      initialSnapshot: { actor: { userId: string }; selectedShift: 'day' | 'night' }
    }) =>
      createElement(
        'div',
        null,
        `Lottery for ${initialSnapshot.actor.userId} (${initialSnapshot.selectedShift})`
      ),
  }

  return import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`)
}

describe('lottery page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    })
  })

  it('loads the lottery snapshot and renders the shared client page for managers', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'manager-1',
            },
          },
        }),
      },
    }

    createClientMock.mockResolvedValue(supabase)
    loadLotteryActorMock.mockResolvedValue({
      userId: 'manager-1',
      role: 'manager',
      fullName: 'Manager One',
      siteId: 'site-1',
      shiftType: 'day',
    })
    loadLotterySnapshotMock.mockResolvedValue({
      actor: { userId: 'manager-1' },
      selectedShift: 'night',
    })

    const { default: LotteryPage } = await loadLotteryPage()

    const html = renderToStaticMarkup(
      await LotteryPage({
        searchParams: Promise.resolve({
          date: ['2026-05-03'],
          shift: ['night'],
        }),
      })
    )

    expect(loadLotteryActorMock).toHaveBeenCalledWith('manager-1')
    expect(loadLotterySnapshotMock).toHaveBeenCalledWith({
      actor: {
        userId: 'manager-1',
        role: 'manager',
        fullName: 'Manager One',
        siteId: 'site-1',
        shiftType: 'day',
      },
      shiftDate: '2026-05-03',
      shiftType: 'night',
    })
    expect(html).toContain('Lottery for manager-1 (night)')
  })

  it('redirects to /dashboard/staff when loadLotteryActor returns null', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'staff-1',
            },
          },
        }),
      },
    })
    loadLotteryActorMock.mockResolvedValue(null)

    const { default: LotteryPage } = await loadLotteryPage()

    await expect(LotteryPage({})).rejects.toThrow('REDIRECT:/dashboard/staff')
  })

  it('redirects unauthenticated users to /login', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
        }),
      },
    })

    const { default: LotteryPage } = await loadLotteryPage()

    await expect(LotteryPage({})).rejects.toThrow('REDIRECT:/login')
    expect(loadLotteryActorMock).not.toHaveBeenCalled()
    expect(loadLotterySnapshotMock).not.toHaveBeenCalled()
  })
})
