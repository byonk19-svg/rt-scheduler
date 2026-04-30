import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const routes = [
  ['src/app/(app)/dashboard/page.tsx', "title: 'Dashboard'"],
  ['src/app/(app)/dashboard/manager/page.tsx', "title: 'Inbox'"],
  ['src/app/(app)/dashboard/staff/page.tsx', "title: 'Dashboard'"],
  ['src/app/(app)/availability/page.tsx', "title: 'Availability Planning'"],
  ['src/app/(app)/pending-setup/page.tsx', "title: 'Waiting for approval'"],
  ['src/app/(app)/publish/page.tsx', "title: 'Publish History'"],
  ['src/app/(app)/requests/page.tsx', "title: 'Requests'"],
  ['src/app/(app)/requests/user-access/page.tsx', "title: 'User Access Requests'"],
  ['src/app/(app)/team/page.tsx', "title: 'Team'"],
] as const

describe('app route metadata sweep', () => {
  it('sets route-specific titles on the remaining high-traffic server pages', () => {
    for (const [filePath, titleSnippet] of routes) {
      const source = readFileSync(resolve(process.cwd(), filePath), 'utf8')
      expect(source).toContain(titleSnippet)
    }
  })
})
