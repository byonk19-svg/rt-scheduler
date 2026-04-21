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
const headerSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/CoverageWorkspaceHeader.tsx'),
  'utf8'
)

describe('coverage template wiring source contract', () => {
  it('wires save/start template dialogs into the coverage workspace', () => {
    expect(coverageClientSource).toContain('CoverageWorkspaceOverlays')
    expect(overlaysSource).toContain('SaveAsTemplateDialog')
    expect(overlaysSource).toContain('StartFromTemplateDialog')
    expect(headerSource).toContain('Save as template')
  })

  it('lets the cycle dialog surface a template-start affordance for draft cycles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/coverage/CycleManagementDialog.tsx'),
      'utf8'
    )

    expect(source).toContain('Start from template')
  })
})
