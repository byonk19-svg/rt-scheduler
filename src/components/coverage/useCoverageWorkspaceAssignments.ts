'use client'

import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

import type { TherapistOption } from '@/app/(app)/coverage/coverage-page-snapshot'
import {
  assignCoverageShiftViaApi,
  persistCoverageShiftStatus,
  setCoverageDesignatedLeadViaApi,
  unassignCoverageShiftViaApi,
} from '@/lib/coverage/mutations'
import {
  applyCoverageAssignedShift,
  getCoverageAssignErrorMessage,
  removeCoverageShiftFromDays,
  toCoverageShiftItem,
  updateCoverageShiftStatusInDays,
} from '@/lib/coverage/coverage-workspace-mutations'
import type { DayItem, ShiftTab, UiStatus } from '@/lib/coverage/selectors'
import { toCoverageAssignmentPayload } from '@/lib/coverage/status-ui'
import type { OperationalCode } from '@/lib/operational-codes'
import type { ShiftStatus } from '@/lib/shift-types'
import { updateCoverageAssignmentStatus } from '@/lib/coverage/updateAssignmentStatus'

type CoverageSupabaseClient = ReturnType<typeof import('@/lib/supabase/client').createClient>

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function useCoverageWorkspaceAssignments({
  activeCycleId,
  allTherapists,
  canUpdateAssignmentStatus,
  days,
  selectedDayId,
  setActiveOpCodes,
  setAssignError,
  setAssigning,
  setDays,
  setError,
  setRosterCellError,
  setUnassigningShiftId,
  shiftTab,
  supabase,
  unassigningShiftId,
  router,
}: {
  activeCycleId: string | null
  allTherapists: TherapistOption[]
  canUpdateAssignmentStatus: boolean
  days: DayItem[]
  selectedDayId: string | null
  setActiveOpCodes: Dispatch<SetStateAction<Map<string, string>>>
  setAssignError: Dispatch<SetStateAction<string>>
  setAssigning: Dispatch<SetStateAction<boolean>>
  setDays: Dispatch<SetStateAction<DayItem[]>>
  setError: Dispatch<SetStateAction<string>>
  setRosterCellError: Dispatch<
    SetStateAction<{ dayId: string; memberId: string; message: string } | null>
  >
  setUnassigningShiftId: Dispatch<SetStateAction<string | null>>
  shiftTab: ShiftTab
  supabase: CoverageSupabaseClient
  unassigningShiftId: string | null
  router: AppRouterInstance
}) {
  const syncOperationalCodeState = useCallback(
    (shiftId: string, nextStatus: UiStatus) => {
      const assignmentStatus = toCoverageAssignmentPayload(nextStatus).assignment_status

      setActiveOpCodes((current) => {
        const next = new Map(current)
        if (assignmentStatus === 'scheduled') {
          next.delete(shiftId)
        } else {
          next.set(shiftId, assignmentStatus as OperationalCode)
        }
        return next
      })
    },
    [setActiveOpCodes]
  )

  const assignTherapistToDay = useCallback(
    async (dayId: string, userId: string, role: 'lead' | 'staff', options?: { inline?: boolean }) => {
      const targetDay = days.find((day) => day.id === dayId)
      if (!targetDay || !userId || !activeCycleId) return

      setAssigning(true)
      setError('')
      if (options?.inline) {
        setRosterCellError(null)
      }

      const selectedTherapist = allTherapists.find((therapist) => therapist.id === userId) ?? null
      const shiftType = shiftTab === 'Day' ? 'day' : 'night'

      const failAssign = (message: string) => {
        if (options?.inline) {
          setRosterCellError({
            dayId,
            memberId: userId,
            message,
          })
        } else {
          setAssignError(message)
        }
        setAssigning(false)
      }

      if (role === 'lead') {
        const existingLead = targetDay.leadShift
        const staffShift = targetDay.staffShifts.find((shift) => shift.userId === userId)

        if (existingLead?.userId === userId) {
          setAssigning(false)
          return
        }

        const needsDesignatedLeadChange =
          Boolean(staffShift) && (existingLead ? existingLead.userId !== userId : true)

        if (needsDesignatedLeadChange) {
          const { error: leadError } = await setCoverageDesignatedLeadViaApi({
            cycleId: activeCycleId,
            therapistId: userId,
            isoDate: targetDay.isoDate,
            shiftType,
          })
          if (leadError) {
            console.error('Set designated lead failed:', leadError)
            failAssign(leadError.message ?? 'Could not update designated lead. Please try again.')
            return
          }
          setAssignError('')
          setRosterCellError(null)
          router.refresh()
          setAssigning(false)
          return
        }

        if (existingLead && existingLead.userId !== userId) {
          const { data: inserted, error: insertError } = await assignCoverageShiftViaApi({
            cycleId: activeCycleId,
            userId,
            isoDate: targetDay.isoDate,
            shiftType,
            role: 'staff',
          })

          if (insertError || !inserted) {
            console.error('Assign failed:', insertError)
            failAssign(getCoverageAssignErrorMessage(insertError, selectedTherapist?.full_name))
            return
          }

          setAssignError('')
          setRosterCellError(null)
          const nextShift = toCoverageShiftItem(inserted, selectedTherapist?.full_name)
          setDays((current) => applyCoverageAssignedShift(current, targetDay.id, nextShift, 'staff'))
          setAssigning(false)
          return
        }
      }

      const { data: inserted, error: insertError } = await assignCoverageShiftViaApi({
        cycleId: activeCycleId,
        userId,
        isoDate: targetDay.isoDate,
        shiftType,
        role,
      })

      if (insertError || !inserted) {
        console.error('Assign failed:', insertError)
        failAssign(getCoverageAssignErrorMessage(insertError, selectedTherapist?.full_name))
        return
      }

      setAssignError('')
      setRosterCellError(null)
      const nextShift = toCoverageShiftItem(inserted, selectedTherapist?.full_name)
      setDays((current) => applyCoverageAssignedShift(current, targetDay.id, nextShift, role))
      setAssigning(false)
    },
    [
      activeCycleId,
      allTherapists,
      days,
      router,
      setAssignError,
      setAssigning,
      setDays,
      setError,
      setRosterCellError,
      shiftTab,
    ]
  )

  const handleAssignTherapist = useCallback(
    async (userId: string, role: 'lead' | 'staff') => {
      if (!selectedDayId) return
      await assignTherapistToDay(selectedDayId, userId, role)
    },
    [assignTherapistToDay, selectedDayId]
  )

  const handleChangeStatus = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => {
      if (!canUpdateAssignmentStatus) return

      const targetDay = days.find((day) => day.id === dayId)
      const targetShift = isLead
        ? targetDay?.leadShift
        : targetDay?.staffShifts.find((shift) => shift.id === shiftId)

      if (!targetShift?.id) {
        console.error('Could not find shift row id for status update.', { dayId, shiftId, isLead })
        return
      }

      if (targetShift.status === nextStatus) {
        return
      }

      const previousStatus = targetShift.status
      const changeTime = timestamp()

      const updated = await updateCoverageAssignmentStatus({
        shiftId: targetShift.id,
        nextStatus,
        setState: setDays,
        clearError: () => setError(''),
        showError: (message) => setError(message),
        applyOptimisticUpdate: (current) =>
          updateCoverageShiftStatusInDays({
            days: current,
            dayId,
            shiftId,
            isLead,
            nextStatus,
            previousStatus,
            changeTime,
            mode: 'optimistic',
          }),
        rollbackOptimisticUpdate: (current) =>
          updateCoverageShiftStatusInDays({
            days: current,
            dayId,
            shiftId,
            isLead,
            nextStatus,
            previousStatus,
            changeTime,
            mode: 'rollback',
          }),
        persistAssignmentStatus: async (id, payload) =>
          await persistCoverageShiftStatus(supabase, id, payload),
        logError: (message, error) => {
          console.error(message, error)
        },
      })

      if (updated) {
        syncOperationalCodeState(targetShift.id, nextStatus)
      }
    },
    [canUpdateAssignmentStatus, days, setDays, setError, supabase, syncOperationalCodeState]
  )

  const handleUnassign = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean) => {
      if (!shiftId || !activeCycleId || unassigningShiftId) return

      const previousDays = days
      setError('')
      setUnassigningShiftId(shiftId)

      setDays((current) => removeCoverageShiftFromDays(current, dayId, shiftId, isLead))

      const { error: deleteError } = await unassignCoverageShiftViaApi({
        cycleId: activeCycleId,
        shiftId,
      })

      if (!deleteError) {
        setUnassigningShiftId(null)
        return
      }

      console.error('Failed to unassign therapist from shift:', deleteError)
      setDays(previousDays)
      setError('Could not unassign therapist. Changes were rolled back.')
      setUnassigningShiftId(null)
    },
    [activeCycleId, days, setDays, setError, setUnassigningShiftId, unassigningShiftId]
  )

  return {
    handleAssignTherapist,
    handleChangeStatus,
    handleUnassign,
  }
}
