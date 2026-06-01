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
    expect(navigationSource).toContain('Open coverage requests')
    expect(clientSource).toContain('All statuses')
    expect(clientSource).toContain("['expired', 'Expired']")
    expect(clientSource).toContain("['withdrawn', 'Withdrawn']")
    expect(clientSource).toContain('HISTORY_STATUSES.includes(request.status)')
    expect(clientSource).toContain('Use Need coverage when someone should cover your shift')
    expect(clientSource).toContain('Review trade requests, coverage requests, and responder offers')
    expect(clientSource).not.toContain('Team board and direct requests both live here')
    expect(navigationSource).toContain('Needs Action')
    expect(navigationSource).toContain('Waiting')
    expect(navigationSource).toContain('History')
    expect(clientSource).toContain('Manager final approval')
  })

  it('uses actor-facing request vocabulary instead of overloaded pickup/give-up labels', () => {
    const { clientSource, modelSource, requestCardSource } = readShiftBoardSources()
    const visibleCopy = [
      clientSource,
      scrubNonVisibleShiftBoardCopy(modelSource),
      requestCardSource,
    ].join('\n')

    expect(visibleCopy).toContain('Open coverage requests')
    expect(visibleCopy).toContain('Coverage request')
    expect(visibleCopy).toContain('Pick up shift')
    expect(visibleCopy).not.toContain('Give Up')
    expect(visibleCopy).not.toContain('Approve pickup')
    expect(visibleCopy).not.toContain('Open Shifts')
  })

  it('explains staff Shift Board changes as coverage and trade requests needing manager approval', () => {
    const { clientSource } = readShiftBoardSources()

    expect(clientSource).toContain(
      'Coverage and trade requests can change published schedules after manager approval.'
    )
    expect(clientSource).toContain('requests you posted or offered to pick up')
    expect(clientSource).not.toContain('Published schedule changes only')
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

  it('defaults the manager queue to Needs Action unless a notification tab is linked', () => {
    const { routeSource, clientSource, modelSource } = readShiftBoardSources()

    expect(clientSource).toContain('initialTab =')
    expect(clientSource).toContain('useState<ShiftBoardSection>(initialTab)')
    expect(modelSource).toContain(": 'needs-action'")
    expect(routeSource).toContain("initialTab === 'history' ? 'history' : 'open'")
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
