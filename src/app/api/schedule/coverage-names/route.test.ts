import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('coverage names route permissions', () => {
  it('uses lead-tools permission context instead of raw role checks for draft coverage names', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/schedule/coverage-names/route.ts'),
      'utf8'
    )

    expect(source).toContain("select('role, is_active, archived_at')")
    expect(source).toContain("can(role, 'manage_coverage', permissionContext)")
    expect(source).toContain("can(role, 'access_lead_tools', permissionContext)")
    expect(source).not.toContain("role === 'lead'")
  })
})
