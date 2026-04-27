import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/staff/history/page.tsx'),
  'utf8'
)

describe('staff history page', () => {
  it('shows direct vs team visibility, received roles, and pickup interest history', () => {
    expect(source).toContain('visibilityLabel')
    expect(source).toContain("const roleLabel: HistoryItem['roleLabel']")
    expect(source).toContain("'Received'")
    expect(source).toContain("const visibilityLabel: HistoryItem['visibilityLabel']")
    expect(source).toContain("'Direct'")
    expect(source).toContain("row.requestKind === 'call_in'")
    expect(source).toContain('Primary claimant')
    expect(source).toContain('Backup interest')
    expect(source).toContain('shift_post_interests')
  })

  it('includes pickup-interest lifecycle statuses in history rows', () => {
    expect(source).toContain("case 'selected'")
    expect(source).toContain("case 'withdrawn'")
    expect(source).toContain('getPickupInterestTherapistCopy(row.status)')
  })

  it('keeps merged history rows sorted deterministically when timestamps match', () => {
    expect(source).toContain(".order('id', { ascending: false })")
    expect(source).toContain('right.created_at.localeCompare(left.created_at)')
    expect(source).toContain('right.id.localeCompare(left.id)')
  })

  it('routes therapist history back to the therapist-facing swaps page', () => {
    expect(source).toContain('href="/therapist/swaps"')
    expect(source).not.toContain('href="/shift-board">Back to Shift Swaps & Pickups</Link>')
  })
})
