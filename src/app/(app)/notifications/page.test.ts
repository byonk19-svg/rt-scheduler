import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const notificationsPageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/notifications/page.tsx'),
  'utf8'
)

describe('notifications page copy guardrails', () => {
  it('keeps the header subtitle distinct from the caught-up empty state', () => {
    expect(notificationsPageSource).toContain(
      'Schedule, request, and preliminary updates in one place.'
    )
    expect(notificationsPageSource).toContain('You&apos;re all caught up')
  })
})
