import type { GenerateDraftInput, GenerateDraftResult } from '@/lib/coverage/generate-draft'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'

export function runPreFlight(input: GenerateDraftInput): GenerateDraftResult {
  return generateDraftForCycle(input)
}

export function summarizePreFlight(result: GenerateDraftResult) {
  return {
    unfilledSlots: result.unfilledConstraintSlots?.length ?? 0,
    missingLeadSlots: result.missingLeadSlots ?? 0,
    forcedMustWorkMisses: result.forcedMustWorkMisses ?? 0,
    details: result.unfilledConstraintSlots ?? [],
  }
}
