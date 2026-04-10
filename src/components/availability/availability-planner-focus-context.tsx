'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type AvailabilityPlannerFocusContextValue = {
  focusedTherapistName: string | null
  setFocusedTherapistName: (name: string | null) => void
}

const AvailabilityPlannerFocusContext = createContext<AvailabilityPlannerFocusContextValue | null>(
  null
)

export function AvailabilityPlannerFocusProvider({
  children,
  initialFocusedTherapistName = null,
}: {
  children: ReactNode
  /** Server-known therapist name for the selected planner row — keeps SSR and client first paint aligned. */
  initialFocusedTherapistName?: string | null
}) {
  const [focusedTherapistName, setFocusedTherapistNameState] = useState<string | null>(() =>
    initialFocusedTherapistName == null || initialFocusedTherapistName.trim() === ''
      ? null
      : initialFocusedTherapistName.trim()
  )

  const setFocusedTherapistName = useCallback((name: string | null) => {
    setFocusedTherapistNameState(name)
  }, [])

  const value = useMemo(
    () => ({ focusedTherapistName, setFocusedTherapistName }),
    [focusedTherapistName, setFocusedTherapistName]
  )

  return (
    <AvailabilityPlannerFocusContext.Provider value={value}>
      {children}
    </AvailabilityPlannerFocusContext.Provider>
  )
}

export function useAvailabilityPlannerFocus(): AvailabilityPlannerFocusContextValue | null {
  return useContext(AvailabilityPlannerFocusContext)
}
