import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260414163000_add_employee_roster_phone_and_signup_fallback.sql'
)

describe('employee roster signup fallback migration contract', () => {
  it('adds roster phone storage and recreates handle_new_user() with signup-to-roster fallback', () => {
    expect(existsSync(migrationPath)).toBe(true)

    if (!existsSync(migrationPath)) {
      return
    }

    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/alter table public\.employee_roster\s+add column if not exists phone_number text;/i)
    expect(sql).toMatch(/create or replace function public\.handle_new_user\(\)/i)
    expect(sql).toMatch(
      /coalesce\s*\(\s*nullif\(new\.raw_user_meta_data->>'phone_number', ''\)\s*,\s*roster_match\.phone_number\s*\)/i
    )
    expect(sql).toMatch(/matched_profile_id = new\.id/i)
    expect(sql).toMatch(/matched_email = coalesce\(new\.email, ''\)/i)
  })
})
