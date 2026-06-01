import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('schedule export route', () => {
  it('site-scopes export authorization and schedule rows', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/export/route.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at, site_id')")
    expect(source).toContain("'export_schedule'")
    expect(source).not.toContain("'export_all_availability'")
    expect(source).toContain("select('id, label, site_id')")
    expect(source).toContain('cycleRow.site_id !== actorProfile.site_id')
    expect(source).toContain(".eq('site_id', actorProfile.site_id)")
  })
})
