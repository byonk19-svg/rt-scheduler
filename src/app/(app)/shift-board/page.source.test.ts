import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('shift-board route source contract', () => {
  it('sets route-specific metadata and keeps manager navigation language aligned with schedule', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/shift-board/page.tsx'),
      'utf8'
    )
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    expect(routeSource).toContain("title: 'Shift Board'")
    expect(clientSource).toContain('Shift Board')
    expect(clientSource).toContain('Open Shifts')
    expect(clientSource).toContain('All statuses')
    expect(clientSource).toContain('Needs Action')
    expect(clientSource).toContain('Waiting')
    expect(clientSource).toContain('History')
    expect(clientSource).toContain('Manager final approval')
  })

  it('does not repeat the therapist published-schedule-only guidance in two stacked callouts', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    expect(clientSource.match(/Published schedule changes only/g)?.length ?? 0).toBe(1)
  })

  it('keeps unknown request errors user-safe instead of showing raw backend text', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    expect(clientSource).toContain('Could not save this request. Refresh the board and try again.')
    expect(clientSource).not.toContain('Could not save: ${message}')
    expect(clientSource).not.toContain('[requestId]: message')
  })

  it('does not expose seeded or test wording in production Shift Board copy', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    const visibleCopy = clientSource.replace(
      /function getRequestMessageForDisplay[\s\S]*?export function getRequestActionModel/,
      'export function getRequestActionModel'
    )

    expect(visibleCopy).not.toMatch(/seeded live data|test user|demo therapist/i)
  })

  it('does not expose claimant language in manager Shift Board production copy', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    const visibleCopy = clientSource
      .replace(
        /function getRequestMessageForDisplay[\s\S]*?export function getRequestActionModel/,
        'export function getRequestActionModel'
      )
      .replace(/action:\s*'deny_claimant'/g, '')

    expect(visibleCopy).not.toMatch(
      /current primary pending claimant|pending claimant|deny claimant|claimant/i
    )
    expect(clientSource).toContain('responder')
    expect(clientSource).toContain('first responder')
    expect(clientSource).toContain('backup responder')
  })

  it('defaults the manager queue to Needs Action', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    expect(clientSource).toContain("useState<ShiftBoardSection>('needs-action')")
  })

  it('puts the summary row before the manager decision queue cards', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    const summaryIndex = clientSource.indexOf('label="Needs Action"')
    const cardsIndex = clientSource.indexOf('<ManagerRequestCard')
    const impactIndex = clientSource.indexOf('<ScheduleImpactPreview')

    expect(summaryIndex).toBeGreaterThan(-1)
    expect(cardsIndex).toBeGreaterThan(summaryIndex)
    expect(impactIndex).toBeGreaterThan(cardsIndex)
  })
})
