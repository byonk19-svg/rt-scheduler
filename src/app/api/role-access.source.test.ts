import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const EXPORT_ROUTES = [
  'src/app/api/availability/export/route.ts',
  'src/app/api/schedule/export/route.ts',
  'src/app/api/team/roster/export/route.ts',
] as const

describe('API role access lifecycle guards', () => {
  it('keeps broad export endpoints lifecycle-aware', () => {
    for (const route of EXPORT_ROUTES) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf8')

      expect(source).toContain("select('role, is_active, archived_at, site_id')")
      expect(source).toContain('isActive:')
      expect(source).toContain('archivedAt:')
      expect(source).toContain('site_id')
    }
  })
})
