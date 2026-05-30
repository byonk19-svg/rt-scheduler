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
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/requests/new/page.tsx'),
      'utf8'
    )

    expect(layoutSource).toContain("title: 'My Requests'")
    expect(layoutSource).toContain('trade, coverage, and direct requests')
    expect(historySource).toContain('New request')
    expect(historySource).not.toContain('Start request')
    expect(composerSource).toContain('Trade shift')
    expect(composerSource).toContain('Need coverage')
    expect(composerSource).toContain('step === 1')
    expect(composerSource).toContain('selectedShift !== null')
    expect(composerSource).toContain('!showsTeammateStep || swapWith !== null')
    expect(composerSource).toContain('disabled={!canContinue}')
    expect(composerSource).toContain('getRequestComposerDisplayState')
    expect(composerSource).toContain('StepRail')
    expect(composerSource).toContain('Request preview')
    expect(composerSource).toContain('Choose your shift')
    expect(composerSource).toContain('Ask a specific teammate')
    expect(composerSource).toContain('Suggest teammate')
    expect(composerSource).toContain('Post to the board with a suggested teammate')
    expect(composerSource).toContain('Post an open trade request instead')
    expect(composerSource).toContain('Open coverage request')
    expect(pageSource).toContain("searchParams.get('type') === 'pickup' ? 'pickup' : 'swap'")
    expect(pageSource).toContain('setRequestType(requestTypeFromQuery)')
    expect(pageSource).toContain(
      "setRequestVisibility(requestTypeFromQuery === 'pickup' ? 'team' : 'direct')"
    )
    expect(composerSource).toContain('No strong direct trade options for this shift right now.')
    expect(historySource).toContain('Direct requests wait for teammate response first')
    expect(historySource).toContain('Trade & Coverage Requests')
    expect(historySource).toContain('Trade requested by')
    expect(historySource).toContain('Suggested by')
    expect(historySource).toContain('Next step')
    expect(historySource).toContain('You are the suggested partner')
  })
})
