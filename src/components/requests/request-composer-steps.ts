import type { RequestType, RequestVisibility } from '@/lib/request-workflow'

export type RequestComposerStepId = 1 | 2 | 3

export type RequestComposerStep = {
  id: RequestComposerStepId
  displayStep: number
  label: 'Request details' | 'Choose teammate' | 'Final message / review'
}

const STEP_LABELS: Record<RequestComposerStepId, RequestComposerStep['label']> = {
  1: 'Request details',
  2: 'Choose teammate',
  3: 'Final message / review',
}

function getVisibleStepIds(
  requestVisibility: RequestVisibility,
  requestType: RequestType
): RequestComposerStepId[] {
  void requestType
  if (requestVisibility === 'direct') {
    return [1, 2, 3]
  }

  return [1, 3]
}

export function getRequestComposerSteps(
  requestVisibility: RequestVisibility,
  requestType: RequestType
): RequestComposerStep[] {
  return getVisibleStepIds(requestVisibility, requestType).map((id, index) => ({
    id,
    displayStep: index + 1,
    label: STEP_LABELS[id],
  }))
}

export function getRequestComposerDisplayState(
  requestVisibility: RequestVisibility,
  requestType: RequestType,
  step: RequestComposerStepId
) {
  const steps = getRequestComposerSteps(requestVisibility, requestType)
  const fallbackStepId =
    requestVisibility === 'team' && step === 2
      ? 3
      : step < steps[0].id
        ? steps[0].id
        : steps[steps.length - 1].id
  const currentStep =
    steps.find((item) => item.id === step) ??
    steps.find((item) => item.id === fallbackStepId) ??
    steps[0]

  return {
    currentStep,
    currentStepTitle: `Step ${currentStep.displayStep}: ${currentStep.label}`,
    steps,
    totalSteps: steps.length,
  }
}
