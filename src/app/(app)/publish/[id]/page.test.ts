import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const publishDetailSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/publish/[id]/page.tsx'),
  'utf8'
)
const publishEventSummaryCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/manager/PublishEventSummaryCard.tsx'),
  'utf8'
)
const publishEventRecipientPanelsSource = readFileSync(
  resolve(process.cwd(), 'src/components/manager/PublishEventRecipientPanels.tsx'),
  'utf8'
)

describe('PublishEventDetailPage framing', () => {
  it('keeps the event summary in a dedicated component', () => {
    expect(publishEventSummaryCardSource).toContain('Event summary')
    expect(publishEventSummaryCardSource).toContain('Delivery history')
    expect(publishDetailSource).toContain('PublishEventSummaryCard')
  })

  it('keeps queued and failed recipient panels in a dedicated component', () => {
    expect(publishEventRecipientPanelsSource).toContain('Queued recipients')
    expect(publishEventRecipientPanelsSource).toContain('Failed recipients')
    expect(publishEventRecipientPanelsSource).toContain('Re-send failed')
    expect(publishDetailSource).toContain('PublishEventRecipientPanels')
  })
})
