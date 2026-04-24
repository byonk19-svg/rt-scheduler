import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const therapistSwapsSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/swaps/page.tsx'),
  'utf8'
)

describe('therapist swaps route', () => {
  it('stays on a therapist-owned page instead of re-exporting the generic shift-board route', () => {
    expect(therapistSwapsSource).toContain('ShiftBoardClientPage')
    expect(therapistSwapsSource).toContain('loadShiftBoardSnapshot')
    expect(therapistSwapsSource).not.toContain("export { default } from '../../shift-board/page'")
  })
})
