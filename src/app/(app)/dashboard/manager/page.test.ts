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

  it('checks manager access before loading manager dashboard work queues', () => {
    const accessCheckIndex = source.indexOf('resolveManagerToolAccess(profile)')
    const managerQueueIndex = source.indexOf(".from('preliminary_requests')")

    expect(accessCheckIndex).toBeGreaterThan(-1)
    expect(managerQueueIndex).toBeGreaterThan(-1)
    expect(accessCheckIndex).toBeLessThan(managerQueueIndex)
    expect(source).toContain('ManagerToolAccessDenied')
  })

  it('uses the shared notification route resolver for recent activity links', () => {
    expect(source).toContain('resolveNotificationHref(row,')
    expect(source).toContain('target_id, created_at')
    expect(source).not.toContain('function getNotificationHref')
  })

  it('uses shared notification display copy and target details for recent activity', () => {
    expect(source).toContain('getRecentActivityCopy(row,')
    expect(source).toContain('getNotificationDisplayCopy(row,')
    expect(source).toContain('message, target_type, target_id, created_at')
    expect(source).toContain('requester:profiles!shift_posts_posted_by_fkey(full_name)')
    expect(source).toContain('shift:shifts!shift_posts_shift_id_fkey(date, shift_type)')
    expect(source).not.toContain('const title = row.title?.trim()')
  })

  it('uses the shared Schedule Block lifecycle label on the manager dashboard', () => {
    expect(source).toContain('getScheduleBlockLifecycleLabel')
    expect(source).toContain('status: activeCycle.status')
    expect(source).toContain('currentCycleHasNoShifts={activeCycleHasNoShifts}')
    expect(source).not.toContain("? 'Published'")
    expect(source).not.toContain("'Draft Schedule Block'")
  })
})
