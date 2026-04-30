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

    expect(routeSource).toContain("title: 'Shift Swaps & Pickups'")
    expect(clientSource).toContain('>Open schedule<')
  })

  it('does not repeat the therapist published-schedule-only guidance in two stacked callouts', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
      'utf8'
    )

    expect(clientSource.match(/Published schedule changes only/g)?.length ?? 0).toBe(1)
  })
})
