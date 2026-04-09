import { describe, expect, it } from 'vitest'

import {
  COVERAGE_SHIFT_QUERY_KEY,
  defaultCoverageShiftTabFromProfileShift,
  normalizeActorShiftType,
  parseCoverageShiftSearchParam,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'

describe('coverage-shift-tab', () => {
  it('exports a stable query key', () => {
    expect(COVERAGE_SHIFT_QUERY_KEY).toBe('shift')
  })

  it('parses explicit day/night query values', () => {
    expect(parseCoverageShiftSearchParam('day')).toBe('Day')
    expect(parseCoverageShiftSearchParam('DAY')).toBe('Day')
    expect(parseCoverageShiftSearchParam(' night ')).toBe('Night')
    expect(parseCoverageShiftSearchParam('night')).toBe('Night')
  })

  it('returns null for missing or unknown shift params', () => {
    expect(parseCoverageShiftSearchParam(null)).toBeNull()
    expect(parseCoverageShiftSearchParam(undefined)).toBeNull()
    expect(parseCoverageShiftSearchParam('')).toBeNull()
    expect(parseCoverageShiftSearchParam('both')).toBeNull()
    expect(parseCoverageShiftSearchParam('invalid')).toBeNull()
  })

  it('maps profile shift to default tab with night vs day fallback', () => {
    expect(defaultCoverageShiftTabFromProfileShift('night')).toBe('Night')
    expect(defaultCoverageShiftTabFromProfileShift('day')).toBe('Day')
    expect(defaultCoverageShiftTabFromProfileShift(null)).toBe('Day')
    expect(defaultCoverageShiftTabFromProfileShift(undefined)).toBe('Day')
    expect(defaultCoverageShiftTabFromProfileShift('')).toBe('Day')
    expect(defaultCoverageShiftTabFromProfileShift('both')).toBe('Day')
  })

  it('normalizes actor shift type to day, night, or null', () => {
    expect(normalizeActorShiftType('day')).toBe('day')
    expect(normalizeActorShiftType('night')).toBe('night')
    expect(normalizeActorShiftType(null)).toBeNull()
    expect(normalizeActorShiftType('manager')).toBeNull()
  })

  it('serializes tab to query value', () => {
    expect(shiftTabToQueryValue('Day')).toBe('day')
    expect(shiftTabToQueryValue('Night')).toBe('night')
  })
})
