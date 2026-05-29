import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260529143000_harden_availability_submission_rls.sql'
  ),
  'utf8'
)

describe('availability submission RLS hardening migration', () => {
  it('limits manager and lead submission reads to their active same-site roster', () => {
    expect(migrationSource).toContain('actor.is_active = true')
    expect(migrationSource).toContain('actor.archived_at is null')
    expect(migrationSource).toContain("actor.role = any (array['manager'::text, 'lead'::text])")
    expect(migrationSource).toContain('actor.site_id = therapist.site_id')
    expect(migrationSource).toContain('actor.site_id = cycle.site_id')
  })

  it('keeps therapist writes same-site and active without allowing direct submission deletion', () => {
    expect(migrationSource).toContain(
      'Therapists can insert own same-site availability submissions'
    )
    expect(migrationSource).toContain(
      'Therapists can update own same-site availability submissions'
    )
    expect(migrationSource).toContain('therapist.is_active = true')
    expect(migrationSource).toContain('therapist.archived_at is null')
    expect(migrationSource).toContain('therapist.site_id = cycle.site_id')
    expect(migrationSource).toContain(
      'drop policy if exists "Therapists can delete own availability submissions"'
    )
    expect(migrationSource).not.toContain(
      'create policy "Therapists can delete own availability submissions"'
    )
    expect(migrationSource).not.toMatch(/for\s+delete\s+to\s+authenticated/i)
  })
})
