import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const authenticatedLayoutSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/layout.tsx'),
  'utf8'
)
const notificationBellSource = readFileSync(
  resolve(process.cwd(), 'src/components/NotificationBell.tsx'),
  'utf8'
)
const notificationsRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/notifications/route.ts'),
  'utf8'
)

describe('authenticated layout performance contract', () => {
  it('does not force every authenticated route dynamic via an explicit layout flag', () => {
    expect(authenticatedLayoutSource).not.toContain("export const dynamic = 'force-dynamic'")
  })

  it('does not query notifications from the authenticated layout', () => {
    expect(authenticatedLayoutSource).not.toContain(".from('notifications')")
    expect(authenticatedLayoutSource).not.toContain('unreadNotificationCount')
  })

  it('does not query pending access requests from the authenticated layout', () => {
    expect(authenticatedLayoutSource).not.toContain(".is('role', null)")
    expect(authenticatedLayoutSource).not.toContain('pendingAccessRequests')
  })

  it('primes the notification badge from a non-blocking summary request instead', () => {
    expect(notificationBellSource).toContain('?summary=1')
    expect(notificationsRouteSource).toContain("searchParams.get('summary')")
  })
})
