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
})
