import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readShiftBoardSource(fileName: string): string {
  return readFileSync(resolve(process.cwd(), fileName), 'utf8')
}

function readShiftBoardSources(): {
  routeSource: string
  clientSource: string
  modelSource: string
  requestCardSource: string
} {
  return {
    routeSource: readShiftBoardSource('src/app/(app)/shift-board/page.tsx'),
    clientSource: readShiftBoardSource('src/components/shift-board/ShiftBoardClientPage.tsx'),
    modelSource: readShiftBoardSource('src/components/shift-board/shift-board-model.ts'),
    requestCardSource: readShiftBoardSource('src/components/shift-board/ShiftBoardRequestCard.tsx'),
  }
}

function scrubNonVisibleShiftBoardCopy(source: string): string {
  return source.replace(
    /function getRequestMessageForDisplay[\s\S]*?export function getRequestActionModel/,
    'export function getRequestActionModel'
  )
}

describe('shift-board route source contract', () => {
  it('sets route-specific metadata and keeps manager navigation language aligned with schedule', () => {
    const { routeSource, clientSource, modelSource } = readShiftBoardSources()
    const navigationSource = `${clientSource}\n${modelSource}`

    expect(routeSource).toContain("title: 'Shift Board'")
    expect(clientSource).toContain('Shift Board')
    expect(navigationSource).toContain('Open Shifts')
    expect(clientSource).toContain('All statuses')
    expect(navigationSource).toContain('Needs Action')
    expect(navigationSource).toContain('Waiting')
    expect(navigationSource).toContain('History')
    expect(clientSource).toContain('Manager final approval')
  })

  it('does not repeat the therapist published-schedule-only guidance in two stacked callouts', () => {
    const { clientSource } = readShiftBoardSources()

    expect(clientSource.match(/Published schedule changes only/g)?.length ?? 0).toBe(1)
  })

  it('keeps unknown request errors user-safe instead of showing raw backend text', () => {
    const { clientSource, modelSource } = readShiftBoardSources()

    expect(modelSource).toContain('Could not save this request. Refresh the board and try again.')
    expect(clientSource).not.toContain('Could not save: ${message}')
    expect(clientSource).not.toContain('[requestId]: message')
  })

  it('does not expose seeded or test wording in production Shift Board copy', () => {
    const { clientSource, modelSource, requestCardSource } = readShiftBoardSources()

    const visibleCopy = [
      clientSource,
      scrubNonVisibleShiftBoardCopy(modelSource),
      requestCardSource,
    ].join('\n')

    expect(visibleCopy).not.toMatch(/seeded live data|test user|demo therapist/i)
  })

  it('does not expose claimant language in manager Shift Board production copy', () => {
    const { clientSource, modelSource, requestCardSource } = readShiftBoardSources()

    const visibleCopy = [
      clientSource,
      scrubNonVisibleShiftBoardCopy(modelSource),
      requestCardSource,
    ]
      .join('\n')
      .replace(/action:\s*'deny_claimant'/g, '')

    expect(visibleCopy).not.toMatch(
      /current primary pending claimant|pending claimant|deny claimant|claimant/i
    )
    expect(visibleCopy).toContain('responder')
    expect(visibleCopy).toMatch(/first responder/i)
    expect(visibleCopy).toMatch(/backup responder/i)
  })

  it('defaults the manager queue to Needs Action', () => {
    const { clientSource } = readShiftBoardSources()

    expect(clientSource).toContain("useState<ShiftBoardSection>('needs-action')")
  })

  it('puts the summary row before the manager decision queue cards', () => {
    const { clientSource, requestCardSource } = readShiftBoardSources()

    const summaryIndex = clientSource.indexOf('label="Needs Action"')
    const cardsIndex = clientSource.indexOf('<ManagerRequestCard')

    expect(summaryIndex).toBeGreaterThan(-1)
    expect(cardsIndex).toBeGreaterThan(summaryIndex)
    expect(requestCardSource).toContain('<ScheduleImpactPreview')
  })
})
