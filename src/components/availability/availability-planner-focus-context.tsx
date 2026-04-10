'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type AvailabilityPlannerFocusContextValue = {
  focusedTherapistName: string | null
  setFocusedTherapistName: (name: string | null) => void
}

const AvailabilityPlannerFocusContext = createContext<AvailabilityPlannerFocusContextValue | null>(
  null
)

export function AvailabilityPlannerFocusProvider({ children }: { children: ReactNode }) {
  const [focusedTherapistName, setFocusedTherapistNameState] = useState<string | null>(null)

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
