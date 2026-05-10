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
    expect(draftActionsSource).toContain('app_delete_unpublished_cycle_shifts')
    expect(draftActionsSource).toContain('insertUnpublishedCycleShifts')
    expect(templateActionsSource).toContain('insertUnpublishedCycleShifts')
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
    expect(publishActionsSource).toContain(".eq('published', currentlyPublished)")
    expect(publishActionsSource).toContain("error: currentlyPublished ? 'unpublish_state_changed'")
    expect(cycleActionsSource).toContain(".eq('published', false)")
    expect(templateActionsSource).not.toContain('new_cycle_start_date')
    expect(templateActionsSource).toContain('applyTemplateToCycle(templateData, cycle.start_date')
  })
})

describe('side-effect idempotency hardening', () => {
  it('adds processing claims and unique outbox/event receipts', () => {
    expect(migrationSource).toContain("status in ('queued', 'processing', 'sent', 'failed')")
    expect(migrationSource).toContain('notification_outbox_unique_email_per_event_idx')
    expect(migrationSource).toContain('notifications_unique_idempotent_event_idx')
    expect(migrationSource).toContain('resend_webhook_receipts')
  })

  it('records Resend webhook ids before background processing', () => {
    expect(resendRouteSource).toContain("request.headers.get('svix-id')")
    expect(resendRouteSource).toContain("from('resend_webhook_receipts').insert")
    expect(resendRouteSource).toContain("receiptError.code === '23505'")
    expect(resendRouteSource).toContain('update({ processed_at: new Date().toISOString() })')
  })
})
