import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/dashboard/manager/page.tsx'),
  'utf8'
)

describe('manager dashboard Schedule Block Planning cues', () => {
  it('routes missing planning dates to Planning and real workflow milestones to their action pages', () => {
    expect(source).toContain('ctaHref: `/schedule/planning?cycle=${cycle.id}`')
    expect(source).toContain('ctaHref: `/availability?cycle=${cycle.id}`')
    expect(source).toContain('ctaHref: `/schedule?cycle=${cycle.id}`')
  })

  it('distinguishes availability due and past-due cues from preliminary and final target cues', () => {
    expect(source).toContain('Availability past due')
    expect(source).toContain('Availability due')
    expect(source).toContain('Preliminary target')
    expect(source).toContain('Final Publish target')
  })

  it('derives manager review work from unresolved workflow rows instead of unread notifications', () => {
    expect(source).toContain('countManagerActionableShiftPosts')
    expect(source).toContain('buildManagerReviewSummary')
    expect(source).toContain(".from('shift_posts')")
    expect(source).toContain(".from('shift_post_interests')")
    expect(source).toContain('reviewHref={reviewHref}')
    expect(source).not.toContain('MANAGER_ACTIONABLE_REVIEW_EVENTS')
  })
})
