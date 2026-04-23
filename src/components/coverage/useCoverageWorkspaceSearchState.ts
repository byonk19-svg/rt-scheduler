'use client'

import { useMemo } from 'react'

import type { ScheduleSearchParams } from '@/app/schedule/types'
import {
  COVERAGE_SHIFT_QUERY_KEY,
  parseCoverageShiftSearchParam,
} from '@/lib/coverage/coverage-shift-tab'

export function useCoverageWorkspaceSearchState(search: URLSearchParams) {
  const successParam = search.get('success')
  const errorParam = search.get('error')
  const autoParam = search.get('auto')
  const draftParam = search.get('draft')
  const overrideWeeklyRulesParam = search.get('override_weekly_rules')
  const overrideShiftRulesParam = search.get('override_shift_rules')
  const urlShiftTab = useMemo(
    () => parseCoverageShiftSearchParam(search.get(COVERAGE_SHIFT_QUERY_KEY)),
    [search]
  )

  const scheduleFeedbackParams = useMemo<ScheduleSearchParams>(
    () => ({
      success: successParam ?? undefined,
      error: errorParam ?? undefined,
      auto: autoParam ?? undefined,
      draft: draftParam ?? undefined,
      added: search.get('added') ?? undefined,
      unfilled: search.get('unfilled') ?? undefined,
      constraints_unfilled: search.get('constraints_unfilled') ?? undefined,
      dropped: search.get('dropped') ?? undefined,
      removed: search.get('removed') ?? undefined,
      week_start: search.get('week_start') ?? undefined,
      week_end: search.get('week_end') ?? undefined,
      violations: search.get('violations') ?? undefined,
      under: search.get('under') ?? undefined,
      over: search.get('over') ?? undefined,
      under_coverage: search.get('under_coverage') ?? undefined,
      over_coverage: search.get('over_coverage') ?? undefined,
      lead_missing: search.get('lead_missing') ?? undefined,
      lead_multiple: search.get('lead_multiple') ?? undefined,
      lead_ineligible: search.get('lead_ineligible') ?? undefined,
    }),
    [autoParam, draftParam, errorParam, search, successParam]
  )

  return {
    autoParam,
    draftParam,
    errorParam,
    overrideShiftRulesParam,
    overrideWeeklyRulesParam,
    scheduleFeedbackParams,
    successParam,
    urlShiftTab,
  }
}
