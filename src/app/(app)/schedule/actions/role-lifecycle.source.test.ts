import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('schedule action role lifecycle guard', () => {
  it('does not authorize schedule actions from role alone', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/schedule/actions/helpers.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at')")
    expect(source).toContain(
      'if (profile?.is_active === false || profile?.archived_at) return null'
    )
  })
})
