'use client'

import type { MutableRefObject } from 'react'

export function CoverageWorkspaceActionForms({
  activeCycleId,
  autoDraftFormRef,
  clearDraftFormRef,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
}: {
  activeCycleId: string | null
  autoDraftFormRef: MutableRefObject<HTMLFormElement | null>
  clearDraftFormRef: MutableRefObject<HTMLFormElement | null>
  generateDraftScheduleAction: (formData: FormData) => void | Promise<void>
  resetDraftScheduleAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <>
      <form
        ref={autoDraftFormRef}
        action={generateDraftScheduleAction}
        className="hidden"
        aria-hidden="true"
      >
        <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
        <input type="hidden" name="view" value="week" />
        <input type="hidden" name="show_unavailable" value="false" />
        <input type="hidden" name="return_to" value="coverage" />
      </form>
      <form
        ref={clearDraftFormRef}
        action={resetDraftScheduleAction}
        className="hidden"
        aria-hidden="true"
      >
        <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
        <input type="hidden" name="view" value="week" />
        <input type="hidden" name="show_unavailable" value="false" />
        <input type="hidden" name="return_to" value="coverage" />
      </form>
    </>
  )
}
