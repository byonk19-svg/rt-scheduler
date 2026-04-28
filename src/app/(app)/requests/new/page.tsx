'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { RequestComposer } from '@/components/requests/RequestComposer'
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
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const shiftIdFromQuery = searchParams.get('shiftId')
  const composeMode = searchParams.get('new') === '1'

  const [view, setView] = useState<'list' | 'form'>('list')
  const [requestType, setRequestType] = useState<RequestType>('swap')
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const [swapWith, setSwapWith] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [requestVisibility, setRequestVisibility] = useState<RequestVisibility>('team')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [leadCountsBySlot, setLeadCountsBySlot] = useState<Record<string, number>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [myOpenRequests, setMyOpenRequests] = useState<OpenRequest[]>([])

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
    if (composeMode) {
      setView('form')
    }
  }, [composeMode])

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
    }
  }, [requestType])

  useEffect(() => {
    if (requestVisibility === 'team') {
      setSwapWith(null)
      if (step === 2) {
        setStep(3)
      }
    }
  }, [requestVisibility, step])

  useEffect(() => {
    let active = true

    async function loadTeamMembers() {
      if (!selectedShiftData || !currentUserId || requestVisibility !== 'direct') {
        setTeamMembers([])
        return
      }

      try {
        const mappedMembers = await loadEligibleRequestTeammates(selectedShiftData.id)

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
    requestVisibility,
    selectedShiftData,
    selectedShiftRequiresLeadEligibleReplacement,
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
    if (requestVisibility === 'direct' && !swapWith) {
      setError('Choose the teammate for this direct request.')
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
    router.push('/requests/new')
  }

  const handleNew = () => {
    setView('form')
    setStep(1)
    setRequestType('swap')
    setRequestVisibility('team')
    setSelectedShift(null)
    setSwapWith(null)
    setMessage('')
    setSearch('')
    setError(null)
  }

  const handleBack = () => {
    setView('list')
    setStep(1)
    setError(null)
  }

  const handleNextStep = () => {
    setError(null)
    if (step === 1) {
      if (!selectedShift) {
        setError('Choose a shift before continuing.')
        return
      }
      setStep(requestVisibility === 'direct' ? 2 : 3)
      return
    }
    if (step === 2) {
      if (requestVisibility === 'direct' && !swapWith) {
        setError('Choose the teammate for this direct request before continuing.')
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
    setStep(requestVisibility === 'direct' ? 2 : 1)
  }

  const pendingCount = myOpenRequests.filter((request) => request.status === 'pending').length
  const approvedCount = myOpenRequests.filter(
    (request) => request.status === 'approved' || request.status === 'selected'
  ).length
  const totalRequests = myOpenRequests.length
  const stepTitle =
    step === 1 ? 'Request details' : step === 2 ? 'Choose teammate' : 'Final message'

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
      myShifts={myShifts}
      requestType={requestType}
      requestVisibility={requestVisibility}
      search={search}
      selectedMember={selectedMember}
      selectedShift={selectedShift}
      selectedShiftData={selectedShiftData}
      selectedShiftRequiresLeadEligibleReplacement={selectedShiftRequiresLeadEligibleReplacement}
      step={step}
      stepTitle={stepTitle}
      submitting={submitting}
      swapWith={swapWith}
      onBack={handleBack}
      onMessageChange={setMessage}
      onNextStep={handleNextStep}
      onPrevStep={handlePrevStep}
      onRequestTypeChange={setRequestType}
      onRequestVisibilityChange={setRequestVisibility}
      onSearchChange={setSearch}
      onSelectedShiftChange={setSelectedShift}
      onSubmit={handleSubmit}
      onSwapWithChange={setSwapWith}
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
