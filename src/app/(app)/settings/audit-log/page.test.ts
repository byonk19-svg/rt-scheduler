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
    expect(source).toContain('hidden px-4 py-3 md:table-cell')
    expect(source).toContain('hidden px-4 py-2.5 text-sm text-foreground md:table-cell')
  })
})
