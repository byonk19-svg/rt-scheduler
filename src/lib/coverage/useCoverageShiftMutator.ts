'use client'

import { useMemo } from 'react'

import {
  createCoverageShiftMutator,
  type CoverageShiftMutator,
} from '@/lib/coverage/mutations'

export function useCoverageShiftMutator(): CoverageShiftMutator {
  return useMemo(() => createCoverageShiftMutator(), [])
}
