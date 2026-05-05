import { describe, expect, it } from 'vitest'

import {
  getRequestComposerDisplayState,
  getRequestComposerSteps,
} from '@/components/requests/request-composer-steps'

describe('request composer steps', () => {
  it('shows a two-step team-board path without a hidden teammate step', () => {
    const steps = getRequestComposerSteps('team', 'swap')
    const displayState = getRequestComposerDisplayState('team', 'swap', 3)

    expect(steps.map((step) => step.id)).toEqual([1, 3])
    expect(steps.map((step) => step.displayStep)).toEqual([1, 2])
    expect(steps.map((step) => step.label)).toEqual(['Request details', 'Final message / review'])
    expect(displayState.currentStep.id).toBe(3)
    expect(displayState.currentStep.displayStep).toBe(2)
    expect(displayState.currentStepTitle).toBe('Step 2: Final message / review')
    expect(displayState.totalSteps).toBe(2)
  })

  it('keeps the choose-teammate step for direct requests', () => {
    const steps = getRequestComposerSteps('direct', 'pickup')
    const displayState = getRequestComposerDisplayState('direct', 'pickup', 2)

    expect(steps.map((step) => step.id)).toEqual([1, 2, 3])
    expect(steps.map((step) => step.displayStep)).toEqual([1, 2, 3])
    expect(steps.map((step) => step.label)).toEqual([
      'Request details',
      'Choose teammate',
      'Final message / review',
    ])
    expect(displayState.currentStep.id).toBe(2)
    expect(displayState.currentStep.displayStep).toBe(2)
    expect(displayState.currentStepTitle).toBe('Step 2: Choose teammate')
    expect(displayState.totalSteps).toBe(3)
  })

  it('normalizes the hidden team teammate step to the review step', () => {
    const displayState = getRequestComposerDisplayState('team', 'swap', 2)

    expect(displayState.currentStep.id).toBe(3)
    expect(displayState.currentStep.displayStep).toBe(2)
    expect(displayState.currentStepTitle).toBe('Step 2: Final message / review')
  })
})
