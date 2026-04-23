import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/requests/page.tsx'), 'utf8')

describe('requests page copy', () => {
  it('uses people-specific naming in the page header', () => {
    expect(source).toContain('title="People requests"')
    expect(source).toContain('subtitle="Manage open shift requests and user access requests."')
  })
})
