import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('availability export route source', () => {
  it('site-scopes manager-wide availability exports through the cycle join', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/availability/export/route.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at, site_id')")
    expect(source).toContain('isManager && !actorProfile?.site_id')
    expect(source).toContain('schedule_cycles!inner(label, start_date, end_date, site_id)')
    expect(source).toContain(".eq('schedule_cycles.site_id', actorSiteId)")
  })
})
