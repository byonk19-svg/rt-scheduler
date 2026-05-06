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
    expect(composerSource).toContain('Find the best way to swap this shift')
    expect(composerSource).toContain('step === 1')
    expect(composerSource).toContain('selectedShift !== null')
    expect(composerSource).toContain('!showsTeammateStep || swapWith !== null')
    expect(composerSource).toContain('disabled={!canContinue}')
    expect(composerSource).toContain('getRequestComposerDisplayState')
    expect(composerSource).toContain(
      'Step {stepState.currentStep.displayStep} of {stepState.totalSteps}'
    )
    expect(composerSource).toContain('Find the best way to swap this shift')
    expect(composerSource).toContain('Ask a specific teammate')
    expect(composerSource).toContain('Suggest a teammate on the board')
    expect(composerSource).toContain('Post to the team board with a suggested teammate')
    expect(composerSource).toContain('Post an open swap instead')
    expect(composerSource).toContain('No strong direct swap options for this shift right now.')
    expect(historySource).toContain('Direct swaps move through teammate response first')
    expect(historySource).toContain('Shift Swaps & Pickups')
    expect(historySource).toContain('Swap requested by')
    expect(historySource).toContain('Suggested by')
  })
})
