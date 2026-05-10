import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('pickup interest promotion migration', () => {
  it('centralizes selected-backup promotion behind one RPC helper', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260509120000_extract_pickup_interest_promotion.sql'
      ),
      'utf8'
    )

    expect(source).toContain('app_promote_next_shift_post_interest')
    expect(source).toContain("and interest.status = 'pending'")
    expect(source).toContain('order by interest.created_at asc, interest.id asc')
    expect(source).toContain('for update skip locked')
    expect(source.match(/app_promote_next_shift_post_interest/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
