import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('therapist schedule route', () => {
  it('redirects to the canonical coverage schedule (shared UI, permission-gated actions)', () => {
    const filePath = resolve(process.cwd(), 'src/app/therapist/schedule/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).toContain("redirect('/coverage?view=week')")
    expect(source).not.toContain("export { default } from '../../staff/schedule/page'")
  })
})
