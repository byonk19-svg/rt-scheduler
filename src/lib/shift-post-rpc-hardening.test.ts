import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260506121500_harden_pickup_interest_rpc.sql'),
  'utf8'
)

describe('shift post RPC hardening migration', () => {
  it('removes direct authenticated inserts for shift posts and pickup interests', () => {
    expect(migrationSource).toContain(
      'drop policy if exists "Users can create their own shift posts" on public.shift_posts'
    )
    expect(migrationSource).toContain(
      'drop policy if exists "Therapists can create their own shift post interest" on public.shift_post_interests'
    )
    expect(migrationSource).toContain(
      'revoke insert on table public.shift_posts from anon, authenticated'
    )
    expect(migrationSource).toContain(
      'revoke insert on table public.shift_post_interests from anon, authenticated'
    )
  })

  it('checks pickup claimant eligibility at the database boundary', () => {
    expect(migrationSource).toContain(
      'create or replace function public.app_express_shift_post_interest'
    )
    expect(migrationSource).toContain('perform public.app_assert_pickup_claimant_eligible')
    expect(migrationSource).toContain('claimant_site_id is distinct from post_shift_site_id')
    expect(migrationSource).toContain('claimant_shift_type is distinct from post_shift_type')
    expect(migrationSource).toContain('claimant_shift.user_id = p_claimant_id')
  })

  it('revalidates direct pickup recipients during manager approval', () => {
    expect(migrationSource).toContain(
      'perform public.app_assert_pickup_claimant_eligible(locked_post.id, locked_post.claimed_by, true)'
    )
  })
})
