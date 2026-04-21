'use client'

import { useState } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

import type { MyShift, RequestType } from '@/components/requests/request-types'

export function useRequestFormState({
  myShifts,
  newFromParam,
  pathname,
  router,
  shiftIdFromQuery,
  setError,
}: {
  myShifts: MyShift[]
  newFromParam: boolean
  pathname: string
  router: AppRouterInstance
  shiftIdFromQuery: string | null
  setError: (value: string | null) => void
}) {
  const initialShiftExists =
    shiftIdFromQuery != null && myShifts.some((shift) => shift.id === shiftIdFromQuery)

  const [view, setView] = useState<'list' | 'form'>(
    pathname === '/requests/new' || newFromParam || initialShiftExists ? 'form' : 'list'
  )
  const [requestType, setRequestTypeState] = useState<RequestType>('swap')
  const [selectedShift, setSelectedShiftState] = useState<string | null>(
    initialShiftExists ? shiftIdFromQuery : null
  )
  const [swapWith, setSwapWith] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const setSelectedShift = (value: string | null) => {
    setSelectedShiftState(value)
    setSwapWith(null)
    setSearch('')
  }

  const setRequestType = (value: RequestType) => {
    setRequestTypeState(value)
    if (value === 'pickup') {
      setSwapWith(null)
    }
  }

  const handleNew = () => {
    setView('form')
    setStep(1)
    setRequestTypeState('swap')
    setSelectedShiftState(null)
    setSwapWith(null)
    setMessage('')
    setSearch('')
    setError(null)
  }

  const handleBack = () => {
    if (pathname === '/requests/new') {
      router.push('/staff/requests')
      return
    }
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
      setStep(2)
      return
    }
    if (step === 2) {
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
    setStep(2)
  }

  return {
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
  }
}
