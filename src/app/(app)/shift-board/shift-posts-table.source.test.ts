import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const shiftPostsTableSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/shift-board/shift-posts-table.tsx'),
  'utf8'
)
const shiftPostsTableRowsSource = readFileSync(
  resolve(process.cwd(), 'src/components/shift-board/ShiftPostsTableRows.tsx'),
  'utf8'
)

describe('ShiftPostsTable framing', () => {
  it('keeps mobile and desktop row rendering in a dedicated component', () => {
    expect(shiftPostsTableRowsSource).toContain('Claimed by')
    expect(shiftPostsTableRowsSource).toContain('No shift posts match these filters.')
    expect(shiftPostsTableRowsSource).toContain('Message')
    expect(shiftPostsTableSource).toContain('ShiftPostsTableRows')
  })
})
