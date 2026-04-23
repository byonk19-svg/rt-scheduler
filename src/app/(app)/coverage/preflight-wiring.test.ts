import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const coverageClientSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx'),
  'utf8'
)
const overlaysSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CoverageWorkspaceOverlays.tsx'),
  'utf8'
)

describe('coverage pre-flight wiring', () => {
  it('lazy-loads the pre-flight dialog and uses it before auto-draft submit', () => {
    expect(coverageClientSource).toContain('openPreflightDialog')
    expect(overlaysSource).toContain("import('@/components/coverage/PreFlightDialog')")
    expect(overlaysSource).toContain('onConfirm={applyAutoDraft}')
  })
})
