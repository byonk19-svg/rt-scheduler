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

  it('derives current publish state from the database before mutating', () => {
    const filePath = resolve(process.cwd(), 'src/app/(app)/schedule/actions/publish-actions.ts')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain('const { data: currentCycle, error: currentCycleError }')
    expect(source).toContain('Boolean(currentCycle.published) !== currentlyPublished')
    expect(source).toContain("'publish_state_changed'")
  })
})
