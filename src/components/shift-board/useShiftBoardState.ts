'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { createClient } from '@/lib/supabase/client'
import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'
import { getShiftBoardActionErrorMessage } from '@/components/shift-board/shift-board-logic'
import type {
  MetricState,
  ProfileLookupRow,
  Role,
  ShiftBoardInitialSnapshot,
  ShiftBoardRequest,
  ShiftType,
} from '@/components/shift-board/types'

export function useShiftBoardState(initialSnapshot: ShiftBoardInitialSnapshot) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const initialServerSnapshotConsumedRef = useRef(true)

  const [role, setRole] = useState<Role>(initialSnapshot.role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<ShiftBoardRequest[]>(initialSnapshot.requests)
  const [metrics, setMetrics] = useState<MetricState>(initialSnapshot.metrics)
  const [pendingCount, setPendingCount] = useState(initialSnapshot.pendingCount)
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialSnapshot.currentUserId)
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open')
  const [savingState, setSavingState] = useState<Record<string, boolean>>({})
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({})
  const [therapists, setTherapists] = useState<ProfileLookupRow[]>(initialSnapshot.therapists)
  const [employmentType, setEmploymentType] = useState<string | null>(
    initialSnapshot.employmentType
  )
  const [swapPartners, setSwapPartners] = useState<Record<string, string>>({})
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({})
  const [scheduledByDate, setScheduledByDate] = useState<Map<string, Map<string, ShiftType>>>(
    () =>
      new Map(
        initialSnapshot.scheduledByDateEntries.map(([date, entries]) => [date, new Map(entries)])
      )
  )

  const loadBoard = useCallback(
    async (tab: 'open' | 'history') => {
      setLoading(true)
      setError(null)
      setRequestErrors({})

      try {
        const snapshot = await loadShiftBoardSnapshot({ supabase, tab })
        if (snapshot.unauthorized) {
          router.replace('/login')
          return
        }
        setCurrentUserId(snapshot.currentUserId)
        setRole(snapshot.role)
        setEmploymentType(snapshot.employmentType)
        setPendingCount(snapshot.pendingCount)
        setTherapists(snapshot.therapists as ProfileLookupRow[])
        setScheduledByDate(
          new Map(
            snapshot.scheduledByDateEntries.map(([date, entries]) => [date, new Map(entries)])
          )
        )
        setRequests(snapshot.requests as ShiftBoardRequest[])
        setMetrics(snapshot.metrics as MetricState)
      } catch (loadError) {
        console.error('Failed to load shift board:', loadError)
        setError('Could not load shift board data. Refresh and try again.')
      } finally {
        setLoading(false)
      }
    },
    [router, supabase]
  )

  useEffect(() => {
    if (initialServerSnapshotConsumedRef.current && activeTab === 'open') {
      initialServerSnapshotConsumedRef.current = false
      return
    }
    initialServerSnapshotConsumedRef.current = false
    void loadBoard(activeTab)
  }, [activeTab, loadBoard])

  const canReview = can(role, 'review_shift_posts')
  const isStaffRole = !canReview

  const handleAction = useCallback(
    async (id: string, action: 'approve' | 'deny', opts?: { override?: boolean }) => {
      if (!canReview) return

      const previousRequest = requests.find((request) => request.id === id) ?? null

      setRequestErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })

      if (opts?.override) {
        setSavingState((current) => ({ ...current, [id]: true }))
        const { error: overrideError } = await supabase
          .from('shift_posts')
          .update({
            manager_override: true,
            override_reason: overrideReasons[id]?.trim() || 'Manager override',
          })
          .eq('id', id)
        if (overrideError) {
          console.error('Failed to set manager override:', overrideError.message)
          setRequestErrors((prev) => ({
            ...prev,
            [id]: 'Could not set override. Please try again.',
          }))
          setSavingState((current) => ({ ...current, [id]: false }))
          return
        }
      }

      if (action === 'approve') {
        const req = requests.find((r) => r.id === id)
        if (req?.type === 'swap' && !req.swapWithId) {
          const partnerId = swapPartners[id]
          if (!partnerId) {
            setRequestErrors((prev) => ({
              ...prev,
              [id]: 'Please select a swap partner before approving.',
            }))
            return
          }
          setSavingState((current) => ({ ...current, [id]: true }))
          const { error: partnerError } = await supabase
            .from('shift_posts')
            .update({ claimed_by: partnerId })
            .eq('id', id)
          if (partnerError) {
            console.error('Failed to assign swap partner:', partnerError.message)
            setRequestErrors((prev) => ({
              ...prev,
              [id]: 'Could not assign swap partner. Please try again.',
            }))
            setSavingState((current) => ({ ...current, [id]: false }))
            return
          }
          const partnerName = therapists.find((t) => t.id === partnerId)?.full_name ?? 'Unknown'
          setRequests((current) =>
            current.map((r) =>
              r.id === id ? { ...r, swapWithId: partnerId, swapWithName: partnerName } : r
            )
          )
        }
      }

      const nextStatus = action === 'approve' ? 'approved' : 'denied'
      const previousRequests = requests

      setRequests((current) =>
        current.map((request) => {
          if (request.id !== id) return request
          return { ...request, status: nextStatus }
        })
      )

      setSavingState((current) => ({ ...current, [id]: true }))
      setError(null)

      const { error: updateError } = await supabase
        .from('shift_posts')
        .update({ status: nextStatus })
        .eq('id', id)

      if (updateError) {
        console.error('Failed to save action:', updateError.message)
        setRequests(previousRequests)
        setError('Could not save request update. Changes were rolled back.')
        const msg = getShiftBoardActionErrorMessage(updateError.message)
        setRequestErrors((prev) => ({ ...prev, [id]: msg }))
        setSavingState((current) => ({ ...current, [id]: false }))
        return
      }

      if (previousRequest?.status === 'pending') {
        setPendingCount((current) => Math.max(current - 1, 0))
      }
      setSavingState((current) => ({ ...current, [id]: false }))
    },
    [canReview, overrideReasons, requests, supabase, swapPartners, therapists]
  )

  return {
    role,
    loading,
    error,
    setError,
    requests,
    metrics,
    pendingCount,
    currentUserId,
    activeTab,
    setActiveTab,
    savingState,
    requestErrors,
    therapists,
    employmentType,
    swapPartners,
    setSwapPartners,
    overrideReasons,
    setOverrideReasons,
    scheduledByDate,
    canReview,
    isStaffRole,
    handleAction,
  }
}
