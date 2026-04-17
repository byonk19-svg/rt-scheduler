import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('analytics page source contract', () => {
  it('loads manager analytics data and renders the chart and tables', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/analytics/page.tsx'), 'utf8')

    expect(source).toContain('ManagerWorkspaceHeader')
    expect(source).toContain('Promise.all')
    expect(source).toContain('getCycleFillRates')
    expect(source).toContain('getSubmissionCompliance')
    expect(source).toContain('getForcedDateMisses')
    expect(source).toContain('CycleFillRateChart')
    expect(source).toContain('SubmissionComplianceTable')
    expect(source).toContain('ForcedDateMissTable')
  })
})
