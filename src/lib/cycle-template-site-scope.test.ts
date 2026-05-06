import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260506123000_scope_cycle_templates_by_site.sql'),
  'utf8'
)

describe('cycle template site scoping migration', () => {
  it('adds a site id and scopes template management RLS to manager site', () => {
    expect(migrationSource).toContain('add column if not exists site_id text not null')
    expect(migrationSource).toContain('actor.site_id = cycle_templates.site_id')
    expect(migrationSource).toContain("actor.role = 'manager'")
    expect(migrationSource).toContain('cycle_templates_site_created_at_idx')
  })
})
