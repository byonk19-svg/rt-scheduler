import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('publish actions immediate email processing', () => {
  it('processes queued publish emails immediately after publish', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('import { getPublishEmailConfig, processQueuedPublishEmails }')
    expect(source).toContain('const admin = createAdminClient()')
    expect(source).toContain('await processQueuedPublishEmails(admin, {')
  })

  it('validates availability blockers before final publish', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('summarizeAvailabilityPublishIssues')
    expect(source).toContain("'publish_availability_rule_violation'")
    expect(source).toContain("'publish_missing_availability_warning'")
    expect(source).toContain("from('therapist_availability_submissions')")
  })

  it('uses Schedule Block language in final publish notifications', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain("title: 'Schedule Block published'")
    expect(source).not.toContain("title: 'Cycle published'")
  })

  it('scopes publish validation and notifications to the Schedule Block site', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source.match(/\.eq\('site_id', cycle\.site_id\)/g)?.length ?? 0).toBeGreaterThanOrEqual(
      2
    )
    expect(source).toContain(".eq('site_id', currentCycle.site_id)")
    expect(source).toContain(".is('archived_at', null)")
  })

  it('does not convert full active roster minimums into final publish blockers', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('const minWorkDaysByTherapist = new Map<string, number>()')
    expect(source).not.toContain('getWeeklyMinimumForEmploymentType')
  })

  it('derives current publish state from the database before mutating', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('const { data: currentCycle, error: currentCycleError }')
    expect(source).toContain('Boolean(currentCycle.published) !== currentlyPublished')
    expect(source).toContain("'publish_state_changed'")
  })
})
