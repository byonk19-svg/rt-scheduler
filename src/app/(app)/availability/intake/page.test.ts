import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('availability intake page feedback', () => {
  it('uses explicit feedback when an email import would overwrite therapist availability', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/intake/page.tsx'),
      'utf8'
    )

    expect(source).toContain("error === 'email_intake_availability_conflict'")
    expect(source).toContain('already have therapist-submitted availability')
  })
})
