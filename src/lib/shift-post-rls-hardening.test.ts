import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260506002228_harden_shift_post_update_policies.sql'
)

describe('shift post RLS hardening migration', () => {
  it('removes broad authenticated manager update paths for request lifecycle tables', () => {
    const source = fs.readFileSync(migrationPath, 'utf8')

    expect(source).toContain('drop policy if exists "Managers can update shift posts"')
    expect(source).toContain('drop policy if exists "Managers can update shift post interests"')
    expect(source).not.toContain('create policy "Managers can update shift posts"')
    expect(source).not.toContain('create policy "Managers can update shift post interests"')
  })
})
