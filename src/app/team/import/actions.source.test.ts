import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('team import actions source contract', () => {
  it('adds a bulkImportRosterAction using requireManager and employee_roster upsert', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/team/import/actions.ts'),
      'utf8'
    )

    expect(source).toContain('export async function bulkImportRosterAction')
    expect(source).toContain('requireManager')
    expect(source).toContain('normalizeRosterFullName')
    expect(source).toContain("from('employee_roster')")
    expect(source).toContain('success=imported')
    expect(source).toContain('count=${payload.length}')
  })
})
