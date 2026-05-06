import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260506124500_scope_designated_lead_rpc_by_site.sql'
  ),
  'utf8'
)

describe('designated lead RPC site scoping migration', () => {
  it('requires active manager site scope and updates only same-site shifts', () => {
    expect(migrationSource).toContain("p.role = 'manager'")
    expect(migrationSource).toContain('v_target_site_id is distinct from v_actor_site_id')
    expect(migrationSource).toContain('and site_id = v_actor_site_id')
    expect(migrationSource).toContain('role, site_id')
  })
})
