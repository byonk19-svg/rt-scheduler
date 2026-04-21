'use client'

import { RequestFormDetailsStep } from '@/components/requests/RequestFormDetailsStep'
import { RequestFormMessageStep } from '@/components/requests/RequestFormMessageStep'
import { RequestFormTeammateStep } from '@/components/requests/RequestFormTeammateStep'
import type { MyShift, RequestType, TeamMember } from '@/components/requests/request-types'

export function RequestFormStepPanel({
  eligibleMembers,
  message,
  myShifts,
  requestType,
  search,
  selectedMember,
  selectedShift,
  selectedShiftData,
  selectedShiftRequiresLeadEligibleReplacement,
  setMessage,
  setRequestType,
  setSearch,
  setSelectedShift,
  setSwapWith,
  step,
  swapWith,
}: {
  eligibleMembers: TeamMember[]
  message: string
  myShifts: MyShift[]
  requestType: RequestType
  search: string
  selectedMember: TeamMember | null
  selectedShift: string | null
  selectedShiftData: MyShift | null
  selectedShiftRequiresLeadEligibleReplacement: boolean
  setMessage: (value: string) => void
  setRequestType: (value: RequestType) => void
  setSearch: (value: string) => void
  setSelectedShift: (value: string | null) => void
  setSwapWith: (value: string | null) => void
  step: 1 | 2 | 3
  swapWith: string | null
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {step === 1 ? (
        <RequestFormDetailsStep
          myShifts={myShifts}
          requestType={requestType}
          selectedShift={selectedShift}
          selectedShiftData={selectedShiftData}
          selectedShiftRequiresLeadEligibleReplacement={
            selectedShiftRequiresLeadEligibleReplacement
          }
          setRequestType={setRequestType}
          setSelectedShift={setSelectedShift}
        />
      ) : null}

      {step === 2 ? (
        <RequestFormTeammateStep
          eligibleMembers={eligibleMembers}
          requestType={requestType}
          search={search}
          selectedShiftRequiresLeadEligibleReplacement={
            selectedShiftRequiresLeadEligibleReplacement
          }
          setSearch={setSearch}
          setSwapWith={setSwapWith}
          swapWith={swapWith}
        />
      ) : null}

      {step === 3 ? (
        <RequestFormMessageStep
          message={message}
          requestType={requestType}
          selectedMember={selectedMember}
          selectedShiftData={selectedShiftData}
          setMessage={setMessage}
        />
      ) : null}
    </div>
  )
}
