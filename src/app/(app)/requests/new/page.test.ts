import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('requests composer route source contract', () => {
  it('sets route-specific metadata and keeps empty-state CTA wording aligned', () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/requests/new/layout.tsx'),
      'utf8'
    )
    const historySource = readFileSync(
      resolve(process.cwd(), 'src/components/requests/RequestsHistoryView.tsx'),
      'utf8'
    )
    const composerSource = readFileSync(
      resolve(process.cwd(), 'src/components/requests/RequestComposer.tsx'),
      'utf8'
    )

    expect(layoutSource).toContain("title: 'My Requests'")
    expect(layoutSource).toContain('swap, pickup, and direct requests')
    expect(historySource).toContain('New request')
    expect(historySource).not.toContain('Start request')
    expect(composerSource).toContain('Create request')
    expect(composerSource).toContain('step === 1')
    expect(composerSource).toContain('selectedShift !== null')
    expect(composerSource).toContain("requestVisibility !== 'direct' || swapWith !== null")
    expect(composerSource).toContain('disabled={!canContinue}')
    expect(composerSource).toContain(
      'This shift does not have an eligible direct-swap teammate right now.'
    )
  })
})
