import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('team roster export route', () => {
  it('exports only the manager site roster', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/team/roster/export/route.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at, site_id')")
    expect(source).toContain('actorProfile?.site_id')
    expect(source).toContain(".eq('site_id', actorProfile.site_id)")
  })
})
