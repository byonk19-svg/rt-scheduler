import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/shift-board/ShiftBoardClientPage.tsx'),
  'utf8'
)

describe('shift board pickup denial guardrails', () => {
  it('closes pending pickup interests when a manager denies the request', () => {
    expect(source).toContain("action === 'deny'")
    expect(source).toContain(".from('shift_post_interests')")
    expect(source).toContain("status: 'declined'")
    expect(source).toContain(".in('status', ['pending', 'selected'])")
  })

  it('supports denying an individual claimant while leaving the pickup request open', () => {
    expect(source).toContain('handlePickupClaimantDenial')
    expect(source).toContain('Deny claimant')
    expect(source).toContain('resolveNextPickupQueueCandidate')
  })

  it('retries queue inserts as backup interest when the selected-claim race is lost', () => {
    expect(source).toContain("insertError.code === '23505'")
    expect(source).toContain('resolvedInterestStatus =')
    expect(source).toContain('retryResult')
  })

  it('reorders pickup approval updates when a manager promotes a backup claimant', () => {
    expect(source).toContain("selectedCandidate.status !== 'selected'")
    expect(source).toContain('declineBeforeSelectionError')
  })

  it('distinguishes the current primary pickup claimant from backup therapists in the manager queue', () => {
    expect(source).toContain('Current primary pending claimant')
    expect(source).toContain('Backups / interested therapists')
  })

  it('keeps therapist-owned pickup interests visible in the mine scope', () => {
    expect(source).toContain('request.hasMyInterest')
  })
})
