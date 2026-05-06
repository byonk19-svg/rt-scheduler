import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260506130000_harden_lottery_rls_manager_boundaries.sql'
  ),
  'utf8'
)

describe('lottery RLS hardening migration', () => {
  it('limits request and history reads to managers or the owning therapist', () => {
    expect(migrationSource).toContain(
      "and (actor.role = 'manager' or lottery_requests.therapist_id = auth.uid())"
    )
    expect(migrationSource).toContain(
      "and (actor.role = 'manager' or lottery_history_entries.therapist_id = auth.uid())"
    )
  })

  it('removes direct owner update and delete paths for lottery requests', () => {
    expect(migrationSource).toContain(
      'drop policy if exists "Users can update allowed lottery requests"'
    )
    expect(migrationSource).toContain(
      'drop policy if exists "Users can delete allowed lottery requests"'
    )
    expect(migrationSource).toContain("and state = 'active'")
  })

  it('makes manager-only policies explicit for decisions, history, and list entries', () => {
    expect(migrationSource).toContain('create policy "Managers can manage lottery decisions"')
    expect(migrationSource).toContain('create policy "Managers can manage lottery history entries"')
    expect(migrationSource).toContain('create policy "Managers can manage lottery list entries"')
    expect(migrationSource).not.toContain("actor.role in ('manager', 'lead')")
  })
})
