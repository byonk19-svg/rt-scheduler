import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const finalizeSchedulePageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/publish/page.tsx'),
  'utf8'
)
const finalizeScheduleHeaderSource = readFileSync(
  resolve(process.cwd(), 'src/components/manager/FinalizeScheduleHeader.tsx'),
  'utf8'
)
const finalizeScheduleBlocksTableSource = readFileSync(
  resolve(process.cwd(), 'src/components/manager/FinalizeScheduleBlocksTable.tsx'),
  'utf8'
)

describe('FinalizeSchedulePage framing', () => {
  it('keeps the finalize header in a dedicated component', () => {
    expect(finalizeScheduleHeaderSource).toContain('Finalize schedule')
    expect(finalizeScheduleHeaderSource).toContain('Delivery history')
    expect(finalizeSchedulePageSource).toContain('FinalizeScheduleHeader')
  })

  it('keeps schedule blocks table in a dedicated component', () => {
    expect(finalizeScheduleBlocksTableSource).toContain('Schedule blocks to finalize')
    expect(finalizeScheduleBlocksTableSource).toContain('Delete draft')
    expect(finalizeSchedulePageSource).toContain('FinalizeScheduleBlocksTable')
  })
})
