import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('coverage template wiring source contract', () => {
  it('wires save/start template dialogs into the coverage workspace', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx'),
      'utf8'
    )

    expect(source).toContain('SaveAsTemplateDialog')
    expect(source).toContain('StartFromTemplateDialog')
    expect(source).toContain('Save as template')
    expect(source).toContain('Start from template')
  })

  it('lets the cycle dialog surface a template-start affordance for draft cycles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/coverage/CycleManagementDialog.tsx'),
      'utf8'
    )

    expect(source).toContain('Start from template')
  })
})
