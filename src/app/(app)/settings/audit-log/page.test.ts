import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('audit log page source contract', () => {
  it('sets route-specific metadata and hides lower-priority columns on mobile', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/settings/audit-log/page.tsx'),
      'utf8'
    )

    expect(source).toContain("title: 'Audit Log'")
    expect(source).toContain('Manager-visible history for scheduling and staffing actions')
    expect(source).toContain('getAuditLogActionDisplay(row.action)')
    expect(source).toContain('getAuditLogTargetTypeLabel(row.target_type)')
    expect(source).toContain('title={row.action}')
    expect(source).toContain('hidden px-4 py-3 md:table-cell')
    expect(source).toContain('hidden px-4 py-2.5 text-sm text-foreground md:table-cell')
    expect(source).not.toContain("return action.replaceAll('_', ' ')")
  })

  it('keeps audit timestamp formatting out of table row render work', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/settings/audit-log/page.tsx'),
      'utf8'
    )

    expect(source).toContain('const auditLogDateFormatter = new Intl.DateTimeFormat')
    expect(source).toContain('function formatAuditLogTime(value: string): string')
    expect(source).toContain('{formatAuditLogTime(row.created_at)}')
    expect(source).not.toContain('new Date(row.created_at).toLocaleString')
  })
})
