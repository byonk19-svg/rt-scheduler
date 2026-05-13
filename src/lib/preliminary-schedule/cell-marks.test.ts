import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  cancelPreliminaryCellMark,
  createPreliminaryCellMark,
  createPreliminaryMarkGroup,
  reviewPreliminaryCellMark,
} from './cell-marks'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260511001059_finish_preliminary_workflow_hardening.sql'
  ),
  'utf8'
)

describe('preliminary cell marks', () => {
  it('wraps the server-side RPCs used by the preliminary pencil workflow', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'group-1' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'mark-1', group_id: 'group-1' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'mark-1', status: 'approved' }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'mark-1' }], error: null })
    const client = { rpc } as never

    await expect(
      createPreliminaryMarkGroup(client, {
        actorId: 'staff-1',
        snapshotId: 'snapshot-1',
        note: 'trade',
      })
    ).resolves.toEqual({ data: { id: 'group-1' }, error: null })

    await expect(
      createPreliminaryCellMark(client, {
        actorId: 'staff-1',
        snapshotId: 'snapshot-1',
        markType: 'add_work',
        date: '2026-05-01',
        shiftType: 'day',
        groupId: 'group-1',
      })
    ).resolves.toEqual({ data: { id: 'mark-1', groupId: 'group-1' }, error: null })

    await expect(
      reviewPreliminaryCellMark(client, {
        actorId: 'manager-1',
        markId: 'mark-1',
        decision: 'approved',
      })
    ).resolves.toEqual({ data: { id: 'mark-1', status: 'approved' }, error: null })

    await expect(
      cancelPreliminaryCellMark(client, { actorId: 'staff-1', markId: 'mark-1' })
    ).resolves.toEqual({ data: { id: 'mark-1' }, error: null })

    expect(rpc).toHaveBeenNthCalledWith(1, 'app_create_preliminary_mark_group', {
      p_actor_id: 'staff-1',
      p_snapshot_id: 'snapshot-1',
      p_note: 'trade',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_create_preliminary_cell_mark', {
      p_actor_id: 'staff-1',
      p_snapshot_id: 'snapshot-1',
      p_mark_type: 'add_work',
      p_mark_date: '2026-05-01',
      p_shift_type: 'day',
      p_shift_id: null,
      p_group_id: 'group-1',
      p_note: null,
    })
  })

  it('defines the database lifecycle for linked pencil marks', () => {
    expect(migrationSource).toContain('preliminary_mark_groups')
    expect(migrationSource).toContain('preliminary_cell_marks')
    expect(migrationSource).toContain('app_create_preliminary_cell_mark')
    expect(migrationSource).toContain('app_review_preliminary_cell_mark')
    expect(migrationSource).toContain("order by case when reviewed_mark.mark_type = 'mark_off'")
    expect(migrationSource).toContain('shifts_designated_lead_assigned_check')
  })
})
