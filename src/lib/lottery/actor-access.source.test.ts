import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('Lottery actor access source contract', () => {
  it('rejects inactive or archived actors before exposing lottery routes and actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/lottery/service.ts'), 'utf8')

    expect(source).toContain(
      "select('id, full_name, role, site_id, shift_type, is_active, archived_at')"
    )
    expect(source).toContain('if (profile.is_active === false || profile.archived_at) return null')
  })
})
