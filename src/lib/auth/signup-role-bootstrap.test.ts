import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260413123000_add_employee_roster_and_name_match_signup.sql'
  ),
  'utf8'
)

describe('signup role bootstrap hardening', () => {
  it('does not assign account roles from public signup metadata', () => {
    expect(migrationSource).not.toContain("when requested_role in ('manager', 'therapist', 'lead')")
    expect(migrationSource).toContain('when roster_match.id is not null then roster_match.role')
  })
})
