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

  it('uses Schedule Block terminology for visible analytics copy', () => {
    const analyticsPageSource = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/analytics/page.tsx'),
      'utf8'
    )
    const fillRateChartSource = readFileSync(
      resolve(process.cwd(), 'src/components/analytics/CycleFillRateChart.tsx'),
      'utf8'
    )
    const complianceTableSource = readFileSync(
      resolve(process.cwd(), 'src/components/analytics/SubmissionComplianceTable.tsx'),
      'utf8'
    )
    const summaryStripSource = readFileSync(
      resolve(process.cwd(), 'src/components/analytics/AnalyticsSummaryStrip.tsx'),
      'utf8'
    )
    const needToWorkMissTableSource = readFileSync(
      resolve(process.cwd(), 'src/components/analytics/ForcedDateMissTable.tsx'),
      'utf8'
    )
    const visibleCopySource = [
      analyticsPageSource,
      fillRateChartSource,
      complianceTableSource,
      summaryStripSource,
      needToWorkMissTableSource,
    ].join('\n')

    expect(visibleCopySource).toContain('Schedule Block fill rates')
    expect(visibleCopySource).toContain('No Schedule Blocks found.')
    expect(visibleCopySource).toContain('Therapist availability submissions per Schedule Block.')
    expect(visibleCopySource).toContain('Schedule Blocks fully submitted')
    expect(visibleCopySource).toContain('Need to Work misses')
    expect(visibleCopySource).toContain('Need to Work miss patterns')
    expect(visibleCopySource).toContain('No Need to Work requests found.')
    expect(visibleCopySource).not.toContain('Cycle fill rates')
    expect(visibleCopySource).not.toContain('No cycles found.')
    expect(visibleCopySource).not.toContain('per cycle.')
    expect(visibleCopySource).not.toContain('cycles fully submitted')
    expect(visibleCopySource).not.toContain('Force-on')
    expect(visibleCopySource).not.toContain('force-on')
  })
})
