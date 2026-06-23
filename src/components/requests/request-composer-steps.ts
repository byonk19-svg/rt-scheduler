import type { RequestType, RequestVisibility } from '@/lib/request-workflow'

type RequestComposerStepId = 1 | 2 | 3

type RequestComposerStep = {
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
  requestType: RequestType,
  showsTeammateStep = requestVisibility === 'direct'
): RequestComposerStepId[] {
  void requestType
  if (showsTeammateStep) {
    return [1, 2, 3]
  }

  return [1, 3]
}

export function getRequestComposerSteps(
  requestVisibility: RequestVisibility,
  requestType: RequestType,
  showsTeammateStep = requestVisibility === 'direct'
): RequestComposerStep[] {
  return getVisibleStepIds(requestVisibility, requestType, showsTeammateStep).map((id, index) => ({
    id,
    displayStep: index + 1,
    label: STEP_LABELS[id],
  }))
}

export function getRequestComposerDisplayState(
  requestVisibility: RequestVisibility,
  requestType: RequestType,
  step: RequestComposerStepId,
  showsTeammateStep = requestVisibility === 'direct'
) {
  const steps = getRequestComposerSteps(requestVisibility, requestType, showsTeammateStep)
  const fallbackStepId =
    !showsTeammateStep && step === 2
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
