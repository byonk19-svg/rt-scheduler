import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/requests/page.tsx'), 'utf8')

describe('requests landing page', () => {
  it('uses People requests naming instead of the broader Requests label', () => {
    expect(source).toContain('title="People requests"')
    expect(source).toContain('subtitle="Manage open shifts and account access requests."')
    expect(source).not.toContain('title="Requests"')
  })

  it('keeps the two direct request destinations visible on the landing surface', () => {
    expect(source).toContain('Open shifts')
    expect(source).toContain('User Access Requests')
    expect(source).toContain('href="/shift-board"')
    expect(source).toContain('href="/requests/user-access"')
  })
})
