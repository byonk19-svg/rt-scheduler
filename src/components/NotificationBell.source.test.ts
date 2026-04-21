import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const notificationBellSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/NotificationBell.tsx'),
  'utf8'
)
const notificationBellDropdownSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/NotificationBellDropdown.tsx'),
  'utf8'
)

describe('NotificationBell framing', () => {
  it('keeps dropdown rendering in a dedicated component', () => {
    expect(notificationBellDropdownSource).toContain('Notifications')
    expect(notificationBellDropdownSource).toContain('Mark all read')
    expect(notificationBellDropdownSource).toContain('You&apos;re all caught up')
    expect(notificationBellSource).toContain('NotificationBellDropdown')
  })
})
