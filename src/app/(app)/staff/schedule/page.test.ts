import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/staff/schedule/page.tsx'),
  'utf8'
)

describe('staff legacy schedule route', () => {
  it('redirects to the therapist-owned published schedule page', () => {
    expect(source).toContain("redirect('/therapist/schedule')")
    expect(source).not.toContain("redirect('/coverage?view=week')")
  })
})
