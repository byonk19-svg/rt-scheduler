'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { dateKeyFromDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'
import { SkeletonCard, SkeletonListItem } from '@/components/ui/skeleton'
import { RequestFormFlow } from '@/components/requests/RequestFormFlow'
import { RequestListView } from '@/components/requests/RequestListView'
import {
  defaultMessage,
  loadRequestPageData,
  loadRequestTeamMembers,
  slotKey,
} from '@/components/requests/request-page-data'
import { useRequestFormState } from '@/components/requests/useRequestFormState'
import type {
  MyShift,
  OpenRequest,
  RequestType,
  TeamMember,
} from '@/components/requests/request-types'

function SwapRequestPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const shiftIdFromQuery = searchParams.get('shiftId')
  const newFromParam = searchParams.get('new') === '1'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [leadCountsBySlot, setLeadCountsBySlot] = useState<Record<string, number>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [myOpenRequests, setMyOpenRequests] = useState<OpenRequest[]>([])
  const {
    handleBack,
    handleNew,
    handleNextStep,
    handlePrevStep,
    message,
    requestType,
    search,
    selectedShift,
    setMessage,
    setRequestType,
    setSearch,
    setSelectedShift,
    setSwapWith,
    step,
    swapWith,
    view,
  } = useRequestFormState({
    myShifts,
    newFromParam,
    pathname,
    router,
    shiftIdFromQuery,
    setError,
  })

  const selectedShiftData = useMemo(
    () => myShifts.find((shift) => shift.id === selectedShift) ?? null,
    [myShifts, selectedShift]
  )
  const selectedShiftRequiresLeadEligibleReplacement = useMemo(() => {
    if (!selectedShiftData?.isLead) return false
    const key = slotKey(selectedShiftData.isoDate, selectedShiftData.shiftType)
    const leadCount = leadCountsBySlot[key] ?? 0
    return leadCount <= 1
  }, [leadCountsBySlot, selectedShiftData])
  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        const todayKey = dateKeyFromDate(new Date())
        setCurrentUserId(user.id)

        if (!active) return
        const { myShifts, leadCountsBySlot, myOpenRequests } = await loadRequestPageData({
          supabase,
          todayKey,
          userId: user.id,
        })

        if (!active) return

        setMyShifts(myShifts)
        setLeadCountsBySlot(leadCountsBySlot)
        setMyOpenRequests(myOpenRequests)
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
    }

    void loadData()

    return () => {
      active = false
    }
  }, [router, supabase])

  useEffect(() => {
    let active = true

    async function loadTeamMembers() {
      if (!selectedShiftData || !currentUserId) {
        setTeamMembers([])
        return
      }

      try {
        const members = await loadRequestTeamMembers({
          currentUserId,
          selectedShiftData,
          selectedShiftRequiresLeadEligibleReplacement,
          supabase,
        })

        if (!active) return
        setTeamMembers(members)
      } catch (membersError) {
        console.error('Failed to load team members for swap request form:', membersError)
        setError('Could not load eligible team members.')
      }
    }

    void loadTeamMembers()

    return () => {
      active = false
    }
  }, [currentUserId, selectedShiftData, selectedShiftRequiresLeadEligibleReplacement, supabase])

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

    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('shift_posts').insert({
      type: requestType,
      shift_id: selectedShift,
      claimed_by: requestType === 'swap' ? swapWith : null,
      message: message.trim() || defaultMessage(requestType),
      status: 'pending',
      posted_by: currentUserId,
    })

    setSubmitting(false)

    if (insertError) {
      console.error('Failed to submit shift request:', insertError)
      setError('Could not submit your request. Please try again.')
      return
    }

    const destination =
      pathname.startsWith('/staff') || pathname === '/requests/new'
        ? '/staff/requests'
        : '/requests'
    router.push(destination)
  }

  return (
    <div className="space-y-6">
      {view === 'list' ? (
        <RequestListView loading={loading} myOpenRequests={myOpenRequests} onNew={handleNew} />
      ) : (
        <RequestFormFlow
          error={error}
          eligibleMembers={eligibleMembers}
          handleBack={handleBack}
          handleNextStep={handleNextStep}
          handlePrevStep={handlePrevStep}
          handleSubmit={() => void handleSubmit()}
          message={message}
          myShifts={myShifts}
          requestType={requestType}
          search={search}
          selectedMember={selectedMember}
          selectedShift={selectedShift}
          selectedShiftData={selectedShiftData}
          selectedShiftRequiresLeadEligibleReplacement={
            selectedShiftRequiresLeadEligibleReplacement
          }
          setMessage={setMessage}
          setRequestType={setRequestType}
          setSearch={setSearch}
          setSelectedShift={setSelectedShift}
          setSwapWith={setSwapWith}
          step={step}
          submitting={submitting}
          swapWith={swapWith}
        />
      )}
    </div>
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
