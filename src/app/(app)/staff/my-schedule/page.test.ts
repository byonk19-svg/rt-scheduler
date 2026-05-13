import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/staff/my-schedule/page.tsx'),
  'utf8'
)

describe('staff my-schedule legacy route', () => {
  it('redirects to the unified schedule page', () => {
    expect(source).toContain("redirect('/schedule')")
    expect(source).not.toContain('PublishedSchedulePage')
    expect(source).not.toContain('My Shifts')
  })
})
