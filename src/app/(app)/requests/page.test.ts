import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/requests/page.tsx'), 'utf8')

describe('requests landing page', () => {
  it('treats /requests as a compatibility redirect for managers', () => {
    expect(source).toContain("redirect('/shift-board')")
    expect(source).not.toContain('Manage open-shift activity and access approvals.')
  })

  it('still routes staff users into the request composer', () => {
    expect(source).toContain("redirect('/requests/new')")
  })
})
