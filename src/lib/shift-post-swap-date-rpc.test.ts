import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260506183000_align_swap_requests_with_trade_dates.sql'
  ),
  'utf8'
)

describe('shift post swap date RPC migration', () => {
  it('requires direct swap recipients to have a different same-shift-type assignment', () => {
    expect(migrationSource).toContain('and shift.cycle_id = actor_cycle_id')
    expect(migrationSource).toContain('and shift.date >= current_date')
    expect(migrationSource).toContain('and shift.date <> actor_shift_date')
    expect(migrationSource).toContain('and shift.shift_type = actor_shift_type')
    expect(migrationSource).toContain(
      'Swap partner must already have a different scheduled shift on the same shift type.'
    )
  })

  it('stores the selected partner shift so approval applies the actual trade', () => {
    expect(migrationSource).toContain('swap_shift_id')
    expect(migrationSource).toContain(
      "case when p_type = 'swap' then recipient_swap_shift_id else null end"
    )
  })

  it('prevents approval from swapping two people already on the same date', () => {
    expect(migrationSource).toContain('swap partner is already on the requester shift date')
    expect(migrationSource).toContain('partner shift is in a different schedule cycle')
    expect(migrationSource).toContain('and s.cycle_id = requester_cycle_id')
    expect(migrationSource).toContain('and s.date >= current_date')
    expect(migrationSource).toContain('where s.user_id = partner_id')
    expect(migrationSource).toContain('and s.date <> requester_shift_date')
  })
})
