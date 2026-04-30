import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const notificationsPageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/notifications/page.tsx'),
  'utf8'
)

describe('notifications page copy guardrails', () => {
  it('sets route-specific notifications metadata', () => {
    expect(notificationsPageSource).toContain("title: 'Notifications'")
    expect(notificationsPageSource).toContain(
      'Schedule, request, and preliminary updates in one place.'
    )
  })

  it('keeps the header subtitle distinct from the caught-up empty state', () => {
    expect(notificationsPageSource).toContain(
      'Schedule, request, and preliminary updates in one place.'
    )
    expect(notificationsPageSource).toContain('You&apos;re all caught up')
  })

  it('uses specific empty-state copy for each notifications filter', () => {
    expect(notificationsPageSource).toContain(
      "if (filter === 'unread') return 'No unread notifications right now.'"
    )
    expect(notificationsPageSource).toContain(
      "if (filter === 'schedule') return 'No schedule notifications right now.'"
    )
    expect(notificationsPageSource).toContain(
      "if (filter === 'requests') return 'No request notifications right now.'"
    )
    expect(notificationsPageSource).toContain(
      "if (filter === 'preliminary') return 'No preliminary notifications right now.'"
    )
  })

  it('classifies call-in help alerts with the request workflow filter', () => {
    expect(notificationsPageSource).toContain("eventType === 'call_in_help_available'")
    expect(notificationsPageSource).toContain("item.event_type === 'call_in_help_available'")
  })
})
