import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'

export function getAutoDraftCoveragePolicy() {
  return {
    idealCoveragePerShift: 4,
    minimumCoveragePerShift: MIN_SHIFT_COVERAGE_PER_DAY,
  }
}
