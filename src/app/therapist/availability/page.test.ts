import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('therapist availability route', () => {
  it('is no longer a direct re-export of the manager availability page', () => {
    const filePath = resolve(process.cwd(), 'src/app/therapist/availability/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).not.toContain("export { default } from '../../availability/page'")
    expect(source).toContain('TherapistAvailabilityWorkspace')
  })
})
