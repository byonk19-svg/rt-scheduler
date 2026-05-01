import type { GenerateDraftInput, GenerateDraftResult } from '@/lib/coverage/generate-draft'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'

export function runPreFlight(input: GenerateDraftInput): GenerateDraftResult {
  return generateDraftForCycle(input)
}

export function summarizePreFlight(result: GenerateDraftResult) {
  const predictedUnfilledAssignments =
    result.unfilledConstraintSlots?.reduce((total, slot) => total + slot.missingCount, 0) ?? 0

  return {
    unfilledSlots: predictedUnfilledAssignments,
    missingLeadSlots: result.missingLeadSlots ?? 0,
    forcedMustWorkMisses: result.forcedMustWorkMisses ?? 0,
    details: result.unfilledConstraintSlots ?? [],
  }
}
