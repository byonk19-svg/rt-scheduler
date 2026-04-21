import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const publishHistoryPageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/publish/history/page.tsx'),
  'utf8'
)
const publishHistoryHeaderSource = readFileSync(
  resolve(process.cwd(), 'src/components/manager/PublishHistoryHeader.tsx'),
  'utf8'
)
const publishHistoryTableSource = readFileSync(
  resolve(process.cwd(), 'src/components/manager/PublishHistoryTable.tsx'),
  'utf8'
)

describe('PublishHistoryPage framing', () => {
  it('keeps the history header in a dedicated component', () => {
    expect(publishHistoryHeaderSource).toContain('Delivery history')
    expect(publishHistoryHeaderSource).toContain('Back to finalize schedule')
    expect(publishHistoryPageSource).toContain('PublishHistoryHeader')
  })

  it('keeps the publish history table in a dedicated component', () => {
    expect(publishHistoryTableSource).toContain('Publish delivery history')
    expect(publishHistoryTableSource).toContain('Delete history')
    expect(publishHistoryPageSource).toContain('PublishHistoryTable')
  })
})
