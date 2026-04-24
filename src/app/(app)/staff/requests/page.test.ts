import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/staff/requests/page.tsx'),
  'utf8'
)

describe('staff legacy requests route', () => {
  it('redirects to the therapist-owned swaps page', () => {
    expect(source).toContain("redirect('/therapist/swaps')")
    expect(source).not.toContain("redirect('/requests/new')")
  })
})
