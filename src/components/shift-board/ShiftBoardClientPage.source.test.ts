import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const shiftBoardClientPageSource = readFileSync(
  resolve(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
  'utf8'
)
const shiftBoardSummaryBannerSource = readFileSync(
  resolve(process.cwd(), 'src/components/shift-board/ShiftBoardSummaryBanner.tsx'),
  'utf8'
)
const shiftBoardPrnCandidateSlotsSource = readFileSync(
  resolve(process.cwd(), 'src/components/shift-board/ShiftBoardPrnCandidateSlots.tsx'),
  'utf8'
)
const shiftBoardRequestListSource = readFileSync(
  resolve(process.cwd(), 'src/components/shift-board/ShiftBoardRequestList.tsx'),
  'utf8'
)

describe('ShiftBoardClientPage framing', () => {
  it('keeps the summary banner in a dedicated component', () => {
    expect(shiftBoardSummaryBannerSource).toContain('Review approvals')
    expect(shiftBoardSummaryBannerSource).toContain('Published schedule changes only')
    expect(shiftBoardClientPageSource).toContain('ShiftBoardSummaryBanner')
  })

  it('keeps the PRN multi-candidate review block in a dedicated component', () => {
    expect(shiftBoardPrnCandidateSlotsSource).toContain('PRN Interest - Multiple Candidates')
    expect(shiftBoardPrnCandidateSlotsSource).toContain('Selecting...')
    expect(shiftBoardRequestListSource).toContain('ShiftBoardPrnCandidateSlots')
    expect(shiftBoardClientPageSource).toContain('ShiftBoardRequestList')
  })

  it('keeps request list rendering in a dedicated component', () => {
    expect(shiftBoardRequestListSource).toContain('EmptyState')
    expect(shiftBoardRequestListSource).toContain('ShiftBoardRequestCard')
    expect(shiftBoardClientPageSource).toContain('ShiftBoardRequestList')
  })
})
