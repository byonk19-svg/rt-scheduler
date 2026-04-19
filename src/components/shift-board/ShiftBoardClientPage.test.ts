import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const shiftBoardSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
  'utf8'
)

describe('ShiftBoardClientPage manager actions', () => {
  it('routes manager-facing action chrome back into the manager workflow instead of the request form', () => {
    expect(shiftBoardSource).toContain('Open schedule home')
    expect(shiftBoardSource).not.toContain('New request')
  })
})
