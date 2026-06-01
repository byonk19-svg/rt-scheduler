import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260601090000_prevent_availability_override_source_rewrites.sql'
  ),
  'utf8'
)

const rollbackSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/rollback/20260601090000_prevent_availability_override_source_rewrites.rollback.sql'
  ),
  'utf8'
)

describe('availability overwrite migration', () => {
  it('blocks source ownership rewrites at the availability override row boundary', () => {
    expect(migrationSource).toContain('prevent_availability_override_source_rewrite')
    expect(migrationSource).toContain('old.source is distinct from new.source')
    expect(migrationSource).toContain('availability_override_source_rewrite_blocked')
    expect(migrationSource).toContain('before update on public.availability_overrides')
    expect(migrationSource).toContain(
      'revoke all on function public.prevent_availability_override_source_rewrite()'
    )
  })

  it('keeps a rollback path for the source rewrite trigger', () => {
    expect(rollbackSource).toContain(
      'drop trigger if exists availability_overrides_prevent_source_rewrite'
    )
    expect(rollbackSource).toContain(
      'drop function if exists public.prevent_availability_override_source_rewrite()'
    )
  })
})
