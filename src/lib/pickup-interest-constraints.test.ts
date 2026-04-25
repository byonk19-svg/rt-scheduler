import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260425143000_add_shift_post_interest_selected_guard.sql'
  ),
  'utf8'
)

describe('pickup interest selected-claim guard migration', () => {
  it('prevents multiple selected claimants for the same pickup post', () => {
    expect(source).toContain('row_number() over')
    expect(source).toContain('selected_rank > 1')
    expect(source).toContain('shift_post_interests_one_selected_per_post_idx')
    expect(source).toContain("where status = 'selected'")
  })

  it('adds a deterministic queue-order index for pending and selected interests', () => {
    expect(source).toContain('shift_post_interests_queue_order_idx')
    expect(source).toContain('(shift_post_id, status, created_at asc, id asc)')
    expect(source).toContain("where status in ('pending', 'selected')")
  })
})
