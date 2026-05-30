import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('user access request route source', () => {
  it('keeps pending access list and review mutations inside the manager site', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/requests/user-access/route.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at, site_id')")
    expect(source).toContain('return { ok: true as const, siteId }')
    expect(source).toContain(".eq('access_status', 'pending')")
    expect(source).toContain(".eq('site_id', access.siteId)")
  })
})
