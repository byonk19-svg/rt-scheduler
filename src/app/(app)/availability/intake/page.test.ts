import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const intakePageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/availability/intake/page.tsx'),
  'utf8'
)
const intakePageDataSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/availability/intake/availability-intake-page-data.ts'),
  'utf8'
)

describe('AvailabilityIntakePage framing', () => {
  it('keeps intake data shaping in a dedicated helper module', () => {
    expect(intakePageDataSource).toContain('buildEmailIntakePanelRows')
    expect(intakePageDataSource).toContain('selectAvailabilityIntakeCycle')
    expect(intakePageDataSource).toContain('stripStoredEmailSubject')
    expect(intakePageSource).toContain('buildEmailIntakePanelRows')
  })
})
