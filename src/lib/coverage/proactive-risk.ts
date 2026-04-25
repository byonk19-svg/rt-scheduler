import { getAutoDraftCoveragePolicy } from '@/lib/coverage/auto-draft-policy'
import type { GenerateDraftResult } from '@/lib/coverage/generate-draft'

export type CoverageRiskAlert = {
  title: string
  description: string
  notice: string
  tone: 'warning' | 'critical'
  strongestDate: string
  strongestShiftType: 'day' | 'night'
  strongestMissingCount: number
  atRiskSlotCount: number
  missingLeadSlots: number
  forcedMustWorkMisses: number
}

function formatCoverageRiskDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function buildCoverageRiskAlert(
  result: Pick<
    GenerateDraftResult,
    'unfilledConstraintSlots' | 'missingLeadSlots' | 'forcedMustWorkMisses'
  >
): CoverageRiskAlert | null {
  if (result.unfilledConstraintSlots.length === 0) {
    return null
  }

  const strongestSlot = [...result.unfilledConstraintSlots].sort((left, right) => {
    if (right.missingCount !== left.missingCount) {
      return right.missingCount - left.missingCount
    }
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date)
    }
    return left.shiftType.localeCompare(right.shiftType)
  })[0]

  const atRiskSlotCount = result.unfilledConstraintSlots.length
  const additionalAtRiskSlots = atRiskSlotCount - 1
  const minimumCoverage = getAutoDraftCoveragePolicy().minimumCoveragePerShift
  const tone: CoverageRiskAlert['tone'] =
    strongestSlot.missingCount > 1 || additionalAtRiskSlots > 0 ? 'critical' : 'warning'
  const strongestDateLabel = formatCoverageRiskDate(strongestSlot.date)
  const strongestShiftLabel = `${strongestSlot.shiftType} shift`
  const missingAssignmentsLabel = `${strongestSlot.missingCount} assignment${
    strongestSlot.missingCount === 1 ? '' : 's'
  }`
  const additionalSlotsSentence =
    additionalAtRiskSlots > 0
      ? ` ${additionalAtRiskSlots} more shift slot${
          additionalAtRiskSlots === 1 ? '' : 's'
        } also look short.`
      : ''
  const missingLeadSentence =
    result.missingLeadSlots > 0
      ? ` ${result.missingLeadSlots} shift${result.missingLeadSlots === 1 ? '' : 's'} also still need a lead.`
      : ''
  const forcedMissSentence =
    result.forcedMustWorkMisses > 0
      ? ` ${result.forcedMustWorkMisses} forced-date override${
          result.forcedMustWorkMisses === 1 ? '' : 's'
        } may still miss coverage.`
      : ''

  return {
    title: 'Coverage risk before Auto-draft',
    description: `${strongestDateLabel} ${strongestShiftLabel} is projected to miss the ${minimumCoverage}-person minimum by ${missingAssignmentsLabel}.${additionalSlotsSentence}${missingLeadSentence}${forcedMissSentence} Based on current availability overrides and coverage targets.`,
    notice: `Coverage risk before Auto-draft: ${strongestDateLabel} ${strongestShiftLabel} is projected to miss minimum staffing by ${missingAssignmentsLabel}.`,
    tone,
    strongestDate: strongestSlot.date,
    strongestShiftType: strongestSlot.shiftType,
    strongestMissingCount: strongestSlot.missingCount,
    atRiskSlotCount,
    missingLeadSlots: result.missingLeadSlots,
    forcedMustWorkMisses: result.forcedMustWorkMisses,
  }
}
