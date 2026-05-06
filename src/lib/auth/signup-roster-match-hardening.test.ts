import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260506120000_require_roster_phone_match_for_signup_roles.sql'
  ),
  'utf8'
)

describe('signup roster match hardening', () => {
  it('requires phone plus name before a roster row can assign a staff role', () => {
    expect(migrationSource).toContain('and signup_phone is not null')
    expect(migrationSource).toContain("and role in ('therapist', 'lead')")
    expect(migrationSource).toContain('and normalized_full_name = normalized_name')
    expect(migrationSource).toContain('and phone_number = signup_phone')
  })

  it('does not allow manager roster rows or public metadata to bootstrap roles', () => {
    expect(migrationSource).not.toContain("new.raw_user_meta_data->>'role'")
    expect(migrationSource).not.toContain("'manager'")
  })
})
