import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('coverage pre-flight wiring', () => {
  it('lazy-loads the pre-flight dialog and uses it before auto-draft submit', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/coverage/CoverageClientPage.tsx'),
      'utf8'
    )

    expect(source).toContain("import('@/components/coverage/PreFlightDialog')")
    expect(source).toContain('setPreFlightDialogOpen(true)')
    expect(source).toContain('onConfirm={() => autoDraftFormRef.current?.requestSubmit()}')
  })
})
