import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260506015325_harden_schedule_lifecycle_and_side_effects.sql'
  ),
  'utf8'
)
const rpcGrantMigrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260510010205_restrict_schedule_mutating_rpc_execution.sql'
  ),
  'utf8'
)
const preliminaryHardeningMigrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260511001059_finish_preliminary_workflow_hardening.sql'
  ),
  'utf8'
)
const preliminaryNotificationMigrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260511013000_fix_preliminary_notification_events.sql'
  ),
  'utf8'
)
const blockRuleMigrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260512024915_allow_final_bypass_and_block_rules.sql'
  ),
  'utf8'
)
const atomicPreliminaryMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260512133013_atomic_preliminary_send.sql'),
  'utf8'
)
const activeLeadPublishMigrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260512135018_active_designated_lead_publish_check.sql'
  ),
  'utf8'
)
const standingPrnMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260512140625_allow_standing_prn_patterns.sql'),
  'utf8'
)
const publishActionsSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts'),
  'utf8'
)
const cycleActionsSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/schedule/actions/cycle-actions.ts'),
  'utf8'
)
const draftActionsSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/schedule/actions/draft-actions.ts'),
  'utf8'
)
const templateActionsSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/schedule/actions/template-actions.ts'),
  'utf8'
)
const assignmentStatusRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/schedule/assignment-status/route.ts'),
  'utf8'
)
const lotteryApplyRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/lottery/apply/route.ts'),
  'utf8'
)
const resendRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/inbound/availability-email/route.ts'),
  'utf8'
)

describe('schedule lifecycle hardening', () => {
  it('site-scopes raw schedule table RLS policies', () => {
    expect(migrationSource).toContain('add column if not exists site_id text not null')
    expect(migrationSource).toContain('Managers can insert same-site cycles')
    expect(migrationSource).toContain('Managers can update same-site shifts')
    expect(migrationSource).toContain('actor.site_id = schedule_cycles.site_id')
    expect(migrationSource).toContain('actor.site_id = shifts.site_id')
    expect(migrationSource).toContain('actor.site_id = shift.site_id')
  })

  it('uses database RPCs for unpublished-cycle draft mutations', () => {
    expect(migrationSource).toContain('app_insert_unpublished_cycle_shifts')
    expect(migrationSource).toContain('app_delete_unpublished_cycle_shifts')
    expect(migrationSource).toContain('for update')
    expect(migrationSource).toContain('Published cycles cannot receive draft mutations.')
    expect(blockRuleMigrationSource).toContain(
      'Only Draft Schedule Blocks can receive auto-draft mutations.'
    )
    expect(blockRuleMigrationSource).toContain('app_start_schedule_cycle_over')
    expect(draftActionsSource).toContain('app_delete_unpublished_cycle_shifts')
    expect(draftActionsSource).toContain('app_start_schedule_cycle_over')
    expect(draftActionsSource).toContain('insertUnpublishedCycleShifts')
    expect(templateActionsSource).toContain('insertUnpublishedCycleShifts')
  })

  it('uses an atomic RPC for Send Preliminary schedule creation and refresh', () => {
    expect(atomicPreliminaryMigrationSource).toContain('app_send_preliminary_schedule')
    expect(atomicPreliminaryMigrationSource).toContain('for update')
    expect(atomicPreliminaryMigrationSource).toContain('generate_series(v_cycle.start_date')
    expect(atomicPreliminaryMigrationSource).toContain(
      'delete from public.preliminary_shift_states'
    )
    expect(atomicPreliminaryMigrationSource).toContain(
      "set status = 'preliminary'::public.schedule_cycle_status"
    )
    expect(atomicPreliminaryMigrationSource).toContain(
      'grant execute on function public.app_send_preliminary_schedule(uuid, uuid) to service_role'
    )
  })

  it('restricts schedule-mutating security definer RPCs to server execution', () => {
    expect(rpcGrantMigrationSource).toContain(
      'revoke all on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb)'
    )
    expect(rpcGrantMigrationSource).toContain('from public, anon, authenticated')
    expect(rpcGrantMigrationSource).toContain(
      'grant execute on function public.app_insert_unpublished_cycle_shifts(uuid, uuid, jsonb)'
    )
    expect(rpcGrantMigrationSource).toContain(
      'grant execute on function public.update_assignment_status('
    )
    expect(rpcGrantMigrationSource).toContain('to service_role')
    expect(rpcGrantMigrationSource).toContain(
      'revoke all on function public.apply_approved_shift_post()'
    )
    expect(draftActionsSource).toContain('createAdminClient')
    expect(templateActionsSource).toContain('createAdminClient')
    expect(assignmentStatusRouteSource).toContain('rpc: admin.rpc.bind(admin)')
    expect(lotteryApplyRouteSource).toContain('rpc: admin.rpc.bind(admin)')
  })

  it('does not trust client-passed cycle publication or template dates', () => {
    expect(publishActionsSource).toContain("rpc('app_publish_schedule_cycle'")
    expect(publishActionsSource).toContain('p_actor_id: user.id')
    expect(publishActionsSource).toContain(".eq('published', true)")
    expect(publishActionsSource).toContain("error: currentlyPublished ? 'unpublish_state_changed'")
    expect(cycleActionsSource).toContain(".eq('published', false)")
    expect(templateActionsSource).not.toContain('new_cycle_start_date')
    expect(templateActionsSource).toContain('applyTemplateToCycle(templateData, cycle.start_date')
  })

  it('models cycle lifecycle explicitly and allows final publish from draft or preliminary', () => {
    expect(preliminaryHardeningMigrationSource).toContain('schedule_cycle_status')
    expect(preliminaryHardeningMigrationSource).toContain(
      "'draft', 'preliminary', 'final', 'archived'"
    )
    expect(blockRuleMigrationSource).toContain(
      "v_cycle.status not in ('draft'::public.schedule_cycle_status, 'preliminary'::public.schedule_cycle_status)"
    )
    expect(blockRuleMigrationSource).toContain('Resolve preliminary requests before publishing.')
    expect(blockRuleMigrationSource).toContain(
      'Final publish requires exactly one lead-capable assigned Designated Lead for every date and shift.'
    )
    expect(activeLeadPublishMigrationSource).toContain(
      'Final publish requires exactly one active lead-capable assigned Designated Lead for every date and shift.'
    )
    expect(activeLeadPublishMigrationSource).toContain(
      "active_entry.code in ('on_call', 'call_in', 'cancelled', 'left_early')"
    )
    expect(publishActionsSource).not.toContain("error: 'publish_requires_preliminary'")
    expect(publishActionsSource).toContain("'publish_invalid_state'")
  })

  it('keeps operational entries authoritative and hardens lead and PRN assignments', () => {
    expect(preliminaryHardeningMigrationSource).toContain(
      'reconcile_shift_legacy_operational_status'
    )
    expect(preliminaryHardeningMigrationSource).toContain(
      'shift_operational_entries_sync_shift_legacy_status'
    )
    expect(preliminaryHardeningMigrationSource).toContain('shifts_designated_lead_assigned_check')
    expect(preliminaryHardeningMigrationSource).toContain('enforce_prn_shift_assignment_rule')
    expect(preliminaryHardeningMigrationSource).toContain(
      'PRN staff require manager force-on or an approved preliminary pencil mark'
    )
    expect(standingPrnMigrationSource).toContain('work_pattern_allows_date')
    expect(standingPrnMigrationSource).toContain('PRN staff cannot be scheduled on a Need Off date')
    expect(standingPrnMigrationSource).toContain(
      'PRN staff require a standing work pattern, manager force-on, or an approved preliminary pencil mark'
    )
    expect(blockRuleMigrationSource).toContain('promote_next_designated_lead_for_shift')
    expect(blockRuleMigrationSource).toContain(
      "new.active = true and new.code in ('call_in', 'cancelled')"
    )
    expect(activeLeadPublishMigrationSource).toContain(
      "new.active = true and new.code in ('on_call', 'call_in', 'cancelled', 'left_early')"
    )
    expect(activeLeadPublishMigrationSource).toContain(
      'create or replace function public.promote_next_designated_lead_for_shift'
    )
    expect(blockRuleMigrationSource).toContain("candidate.role = 'staff'")
  })

  it('enforces Schedule Blocks as non-overlapping six-week Sunday-start ranges', () => {
    expect(blockRuleMigrationSource).toContain('enforce_schedule_cycle_block_rules')
    expect(blockRuleMigrationSource).toContain('new.end_date <> new.start_date + 41')
    expect(blockRuleMigrationSource).toContain('extract(dow from new.start_date) <> 0')
    expect(blockRuleMigrationSource).toContain('schedule_cycles_enforce_block_rules')
    expect(blockRuleMigrationSource).toContain('Active Schedule Blocks cannot overlap')
    expect(cycleActionsSource).toContain('create_cycle_invalid_block_shape')
  })
})

describe('side-effect idempotency hardening', () => {
  it('adds processing claims and unique outbox/event receipts', () => {
    expect(migrationSource).toContain("status in ('queued', 'processing', 'sent', 'failed')")
    expect(migrationSource).toContain('notification_outbox_unique_email_per_event_idx')
    expect(migrationSource).toContain('notifications_unique_idempotent_event_idx')
    expect(migrationSource).toContain('resend_webhook_receipts')
  })

  it('keeps preliminary notification event names inside the database constraint', () => {
    expect(preliminaryNotificationMigrationSource).toContain("'preliminary_sent'")
    expect(preliminaryNotificationMigrationSource).toContain("'preliminary_refreshed'")
    expect(assignmentStatusRouteSource).toContain('await notifyUsers(admin as never')
  })

  it('records Resend webhook ids before background processing', () => {
    expect(resendRouteSource).toContain("request.headers.get('svix-id')")
    expect(resendRouteSource).toContain("from('resend_webhook_receipts').insert")
    expect(resendRouteSource).toContain("receiptError.code === '23505'")
    expect(resendRouteSource).toContain('update({ processed_at: new Date().toISOString() })')
  })
})
