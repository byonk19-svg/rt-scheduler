'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { RequestComposer, type SwapRequestPath } from '@/components/requests/RequestComposer'
import { RequestsHistoryView } from '@/components/requests/RequestsHistoryView'
import type { MyShift, OpenRequest, TeamMember } from '@/components/requests/request-page-model'
import { loadEligibleRequestTeammates, loadRequestPageSnapshot } from '@/lib/request-page-data'
import { dateKeyFromDate } from '@/lib/schedule-helpers'
import {
  defaultRequestMessage,
  mutateShiftPost,
  requestSlotKey,
  type RequestType,
  type RequestVisibility,
} from '@/lib/request-workflow'
import { createClient } from '@/lib/supabase/client'
import { SkeletonCard, SkeletonListItem } from '@/components/ui/skeleton'

function SwapRequestPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const shiftIdFromQuery = searchParams.get('shiftId')
  const composeMode = searchParams.get('new') === '1'
  const requestTypeFromQuery: RequestType =
    searchParams.get('type') === 'pickup' ? 'pickup' : 'swap'
  const requestIdFromQuery = searchParams.get('requestId')

  const [view, setView] = useState<'list' | 'form'>('list')
  const [requestType, setRequestType] = useState<RequestType>('swap')
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const [swapWith, setSwapWith] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageNeedsReview, setMessageNeedsReview] = useState(false)
  const [search, setSearch] = useState('')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [requestVisibility, setRequestVisibility] = useState<RequestVisibility>('direct')
  const [swapPath, setSwapPath] = useState<SwapRequestPath>('direct')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [leadCountsBySlot, setLeadCountsBySlot] = useState<Record<string, number>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [myOpenRequests, setMyOpenRequests] = useState<OpenRequest[]>([])
  const showsTeammateStep =
    requestVisibility === 'direct' || (requestType === 'swap' && swapPath === 'team_suggested')
  const listPath = pathname === '/therapist/swaps' ? '/therapist/swaps' : '/requests/new'
  const historySurface = pathname === '/therapist/swaps' ? 'therapist-swaps' : 'requests'

  const selectedShiftData = useMemo(
    () => myShifts.find((shift) => shift.id === selectedShift) ?? null,
    [myShifts, selectedShift]
  )
  const selectedShiftRequiresLeadEligibleReplacement = useMemo(() => {
    if (!selectedShiftData?.isLead) return false
    const key = requestSlotKey(selectedShiftData.isoDate, selectedShiftData.shiftType)
    const leadCount = leadCountsBySlot[key] ?? 0
    return leadCount <= 1
  }, [leadCountsBySlot, selectedShiftData])

  useEffect(() => {
    if (requestIdFromQuery) {
      setView('list')
      return
    }
    if (composeMode) {
      setView('form')
      setRequestType(requestTypeFromQuery)
      setRequestVisibility(requestTypeFromQuery === 'pickup' ? 'team' : 'direct')
      setSwapPath('direct')
    }
  }, [composeMode, requestIdFromQuery, requestTypeFromQuery])

  const loadData = useCallback(async () => {
    let active = true

    const complete = () => {
      active = false
    }

    try {
      setLoading(true)
      setError(null)
      const todayKey = dateKeyFromDate(new Date())
      const {
        currentUserId: nextUserId,
        leadCountsBySlot: nextLeadCountsBySlot,
        myOpenRequests: nextOpenRequests,
        myShifts: nextShifts,
      } = (await loadRequestPageSnapshot(supabase, todayKey)) ?? {}

      if (!nextUserId) {
        router.replace('/login')
        return
      }

      if (!active) return
      setCurrentUserId(nextUserId)
      setMyShifts(nextShifts ?? [])
      setLeadCountsBySlot(nextLeadCountsBySlot ?? {})
      setMyOpenRequests(nextOpenRequests ?? [])
    } catch (loadError) {
      console.error('Failed to load swap request form data:', loadError)
      if (active) {
        setError('Could not load your shifts and requests.')
      }
    } finally {
      if (active) {
        setLoading(false)
      }
    }

    return complete
  }, [router, supabase])

  useEffect(() => {
    let teardown: (() => void) | undefined
    void loadData().then((cleanup) => {
      teardown = cleanup
    })

    return () => {
      teardown?.()
    }
  }, [loadData])

  useEffect(() => {
    setSwapWith(null)
    setSearch('')
  }, [selectedShift])

  useEffect(() => {
    if (!shiftIdFromQuery || myShifts.length === 0) return
    const exists = myShifts.some((shift) => shift.id === shiftIdFromQuery)
    if (!exists) return
    setView('form')
    setStep(1)
    setSelectedShift(shiftIdFromQuery)
  }, [myShifts, shiftIdFromQuery])

  useEffect(() => {
    if (requestType === 'pickup') {
      setSwapWith(null)
      setMessageNeedsReview(false)
      setSwapPath('direct')
    }
  }, [requestType])

  useEffect(() => {
    if (!showsTeammateStep) {
      setSwapWith(null)
      if (step === 2) {
        setStep(3)
      }
    }
  }, [showsTeammateStep, step])

  useEffect(() => {
    if (view !== 'form' || shiftIdFromQuery || selectedShift || myShifts.length === 0) return
    setSelectedShift(myShifts[0]?.id ?? null)
  }, [myShifts, selectedShift, shiftIdFromQuery, view])

  useEffect(() => {
    if (
      view !== 'form' ||
      step !== 1 ||
      !selectedShift ||
      myShifts.length !== 1 ||
      requestType !== 'swap' ||
      pathname !== '/therapist/swaps'
    ) {
      return
    }

    setStep(showsTeammateStep ? 2 : 3)
  }, [myShifts.length, pathname, requestType, selectedShift, showsTeammateStep, step, view])

  useEffect(() => {
    let active = true

    async function loadTeamMembers() {
      if (!selectedShiftData || !currentUserId || !showsTeammateStep) {
        setTeamMembers([])
        return
      }

      try {
        const mappedMembers = await loadEligibleRequestTeammates(selectedShiftData.id, requestType)

        if (!active) return
        setTeamMembers(mappedMembers)
      } catch (membersError) {
        if (!active) return
        console.error('Failed to load team members for swap request form:', membersError)
        setError('Could not load eligible team members.')
      }
    }

    void loadTeamMembers()

    return () => {
      active = false
    }
  }, [
    currentUserId,
    requestType,
    requestVisibility,
    selectedShiftData,
    selectedShiftRequiresLeadEligibleReplacement,
    showsTeammateStep,
    supabase,
  ])

  const eligibleMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return teamMembers
    return teamMembers.filter((member) => member.name.toLowerCase().includes(normalized))
  }, [search, teamMembers])

  const selectedMember = useMemo(
    () => teamMembers.find((member) => member.id === swapWith) ?? null,
    [swapWith, teamMembers]
  )

  const handleSubmit = async () => {
    if (!currentUserId) {
      setError('Session expired. Please sign in again.')
      return
    }

    if (!selectedShift) {
      setError('Please select a shift first.')
      return
    }
    if (showsTeammateStep && !swapWith) {
      setError(
        requestVisibility === 'direct'
          ? 'Choose the teammate you want to ask.'
          : 'Choose the teammate you want to suggest for this team swap.'
      )
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await mutateShiftPost({
        action: 'create_request',
        shiftId: selectedShift,
        requestType,
        visibility: requestVisibility,
        teammateId: swapWith,
        message: message.trim() || defaultRequestMessage(requestType),
      })
      await loadData()
    } catch (submitError) {
      console.error('Failed to submit shift request:', submitError)
      setError('Could not submit your request. Please try again.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    resetComposerState()
    setView('list')
    router.replace(listPath)
  }

  const resetComposerState = () => {
    setStep(1)
    setRequestType('swap')
    setRequestVisibility('direct')
    setSwapPath('direct')
    setSelectedShift(null)
    setSwapWith(null)
    setMessage('')
    setSearch('')
    setMessageNeedsReview(false)
    setError(null)
  }

  const handleNew = () => {
    setView('form')
    resetComposerState()
  }

  const handleBack = () => {
    setView('list')
    resetComposerState()
    router.replace(listPath)
  }

  const handleNextStep = () => {
    setError(null)
    if (step === 1) {
      if (!selectedShift) {
        setError('Choose a shift before continuing.')
        return
      }
      setStep(showsTeammateStep ? 2 : 3)
      return
    }
    if (step === 2) {
      if (showsTeammateStep && !swapWith) {
        setError(
          requestVisibility === 'direct'
            ? 'Choose the teammate you want to ask before continuing.'
            : 'Choose the teammate you want to suggest before continuing.'
        )
        return
      }
      setStep(3)
    }
  }

  const handlePrevStep = () => {
    setError(null)
    if (step === 1) {
      handleBack()
      return
    }
    if (step === 2) {
      setStep(1)
      return
    }
    setStep(showsTeammateStep ? 2 : 1)
  }

  const handleSwapWithChange = (value: string | null) => {
    setSwapWith(value)
    if (message.trim().length > 0) {
      setMessageNeedsReview(true)
    }
  }

  const pendingCount = myOpenRequests.filter((request) => request.status === 'pending').length
  const approvedCount = myOpenRequests.filter(
    (request) => request.status === 'approved' || request.status === 'selected'
  ).length
  const totalRequests = myOpenRequests.length

  const handleRecipientDecision = async (requestId: string, decision: 'accepted' | 'declined') => {
    setError(null)
    try {
      await mutateShiftPost({
        action: 'respond_direct_request',
        requestId,
        decision,
      })
      await loadData()
    } catch (updateError) {
      console.error('Failed to update direct request response:', updateError)
      setError('Could not update that direct request. Please try again.')
    }
  }

  const handleInterestWithdrawal = async (interestId: string) => {
    setError(null)
    try {
      await mutateShiftPost({
        action: 'withdraw_interest',
        interestId,
      })
      await loadData()
    } catch (updateError) {
      console.error('Failed to withdraw pickup interest:', updateError)
      setError('Could not withdraw that interest. Please try again.')
    }
  }

  const handleRequestWithdrawal = async (requestId: string) => {
    setError(null)
    try {
      await mutateShiftPost({
        action: 'withdraw_request',
        requestId,
      })
      await loadData()
    } catch (updateError) {
      console.error('Failed to withdraw shift request:', updateError)
      setError('Could not withdraw that request. Please try again.')
    }
  }

  return view === 'list' ? (
    <RequestsHistoryView
      approvedCount={approvedCount}
      error={error}
      loading={loading}
      pendingCount={pendingCount}
      requests={myOpenRequests}
      selectedRequestId={requestIdFromQuery}
      surface={historySurface}
      totalRequests={totalRequests}
      onNewRequest={handleNew}
      onRespondDirectRequest={handleRecipientDecision}
      onWithdrawInterest={handleInterestWithdrawal}
      onWithdrawRequest={handleRequestWithdrawal}
    />
  ) : (
    <RequestComposer
      eligibleMembers={eligibleMembers}
      error={error}
      message={message}
      messageNeedsReview={messageNeedsReview}
      myShifts={myShifts}
      requestType={requestType}
      requestVisibility={requestVisibility}
      search={search}
      selectedMember={selectedMember}
      selectedShift={selectedShift}
      selectedShiftData={selectedShiftData}
      selectedShiftRequiresLeadEligibleReplacement={selectedShiftRequiresLeadEligibleReplacement}
      step={step}
      submitting={submitting}
      swapPath={swapPath}
      swapWith={swapWith}
      onBack={handleBack}
      onMessageChange={(value) => {
        setMessage(value)
        setMessageNeedsReview(false)
      }}
      onNextStep={handleNextStep}
      onPrevStep={handlePrevStep}
      onRequestTypeChange={(value) => {
        setRequestType(value)
        setRequestVisibility(value === 'swap' ? 'direct' : 'team')
        setSwapPath('direct')
        setSwapWith(null)
      }}
      onRequestVisibilityChange={(value) => {
        setRequestVisibility(value)
        if (value === 'team') {
          setSwapWith(null)
        }
      }}
      onSearchChange={setSearch}
      onSelectedShiftChange={setSelectedShift}
      onSubmit={handleSubmit}
      onSwapPathChange={(value) => {
        setSwapPath(value)
        setRequestVisibility(value === 'direct' ? 'direct' : 'team')
        if (value === 'team_open') {
          setSwapWith(null)
        }
      }}
      onSwapWithChange={handleSwapWithChange}
    />
  )
}

function RequestPageSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-24" rows={1} />
      <div className="space-y-3">
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </div>
    </div>
  )
}

export default function SwapRequestPage() {
  return (
    <Suspense fallback={<RequestPageSkeleton />}>
      <SwapRequestPageContent />
    </Suspense>
  )
}
