import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260510015047_harden_schema_constraints.sql'),
  'utf8'
)
const rlsPerformanceSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260510023115_remediate_rls_performance_advisors.sql'
  ),
  'utf8'
)
const rollbackSource = readFileSync(
  resolve(process.cwd(), 'supabase/rollback/20260510015047_harden_schema_constraints.rollback.sql'),
  'utf8'
)

describe('schema constraint remediation migration', () => {
  it('locks down legacy nullable fields and duplicate-prone identifiers', () => {
    expect(migrationSource).toContain('alter column role set not null')
    expect(migrationSource).toContain('alter column published set not null')
    expect(migrationSource).toContain('alter column user_id set not null')
    expect(migrationSource).toContain('profiles_email_lower_unique_idx')
    expect(migrationSource).toContain('employee_roster_matched_profile_unique_idx')
    expect(migrationSource).toContain('schedule_cycles_site_date_range_unique_idx')
    expect(migrationSource).toContain('shift_posts_one_pending_standard_per_shift_type_idx')
  })

  it('turns soft site and intake references into validated relationships', () => {
    expect(migrationSource).toContain('create table if not exists public.sites')
    expect(migrationSource).toContain('profiles_site_id_fkey')
    expect(migrationSource).toContain('schedule_cycles_site_id_fkey')
    expect(migrationSource).toContain('shifts_site_id_fkey')
    expect(migrationSource).toContain('lottery_requests_site_id_fkey')
    expect(migrationSource).toContain('availability_overrides_source_intake_id_fkey')
    expect(migrationSource).toContain('availability_overrides_source_intake_item_id_fkey')
    expect(migrationSource).toContain('validate constraint profiles_site_id_fkey')
  })

  it('adds lifecycle and status invariants for stateful tables', () => {
    expect(migrationSource).toContain('schedule_cycles_date_range_check')
    expect(migrationSource).toContain('work_patterns_shift_preference_check')
    expect(migrationSource).toContain('shift_status_changes_from_status_check')
    expect(migrationSource).toContain('shift_posts_direct_recipient_state_check')
    expect(migrationSource).toContain('shift_post_interests_responded_at_state_check')
    expect(migrationSource).toContain('shifts_availability_override_metadata_check')
    expect(migrationSource).toContain('preliminary_requests_approval_metadata_check')
    expect(migrationSource).toContain('lottery_requests_suppression_metadata_check')
    expect(migrationSource).toContain('lottery_history_entries_invalidation_metadata_check')
  })

  it('addresses Supabase advisor findings without removing app auth helpers', () => {
    expect(migrationSource).toContain('set search_path = public')
    expect(migrationSource).toContain(
      'revoke all on function public.notify_on_shift_post_change() from public, anon, authenticated'
    )
    expect(migrationSource).toContain(
      'revoke all on function public.restrict_profile_staffing_field_updates() from public, anon, authenticated'
    )
    expect(migrationSource).toContain('availability_email_intake_items_attachment_id_idx')
    expect(migrationSource).toContain('availability_email_intake_items_applied_by_idx')
    expect(migrationSource).toContain('profiles_site_id_idx')
    expect(migrationSource).toContain('shift_operational_entry_audit_entry_id_idx')
    expect(migrationSource).toContain('Authenticated users can read allowed work patterns')
    expect(migrationSource).not.toContain('revoke all on function public.is_manager()')
    expect(migrationSource).not.toContain('revoke all on function public.is_lead()')
  })

  it('keeps a rollback path for the added constraints and policy changes', () => {
    expect(rollbackSource).toContain(
      'drop constraint if exists shift_posts_direct_recipient_state_check'
    )
    expect(rollbackSource).toContain('drop constraint if exists profiles_site_id_fkey')
    expect(rollbackSource).toContain('drop table if exists public.sites')
    expect(rollbackSource).toContain('drop index if exists public.profiles_email_lower_unique_idx')
    expect(rollbackSource).toContain('Managers can modify all work patterns')
  })

  it('remediates the remaining RLS performance advisor classes', () => {
    expect(rlsPerformanceSource).toContain(
      'Authenticated users can read allowed availability entries'
    )
    expect(rlsPerformanceSource).toContain('Authenticated users can view allowed same-site cycles')
    expect(rlsPerformanceSource).toContain('Authenticated users can read allowed shift posts')
    expect(rlsPerformanceSource).toContain('Managers can insert lottery decisions')
    expect(rlsPerformanceSource).toContain('Managers can insert preliminary shift states')
    expect(rlsPerformanceSource).toContain(
      "replace(next_qual, 'auth.uid()', '(select auth.uid())')"
    )
    expect(rlsPerformanceSource).toContain(
      "replace(next_check, 'auth.role()', '(select auth.role())')"
    )
  })
})
