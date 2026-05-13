import { describe, expect, it } from 'vitest'

import {
  affectsLotteryHistoryStatus,
  countsAsActiveWorkingStatus,
  createsStaffingGapStatus,
  evaluateStaffingSafety,
  isVisibleNotWorkingStatus,
  satisfiesLeadRequirement,
  toStaffingSafetyStatus,
} from '@/lib/staffing-safety'

describe('staffing safety model', () => {
  it('counts scheduled and left early rows as active working staff', () => {
    expect(toStaffingSafetyStatus({ assignmentStatus: 'scheduled' })).toBe('working')
    expect(toStaffingSafetyStatus({ assignmentStatus: 'left_early' })).toBe('left_early')
    expect(countsAsActiveWorkingStatus('working')).toBe(true)
    expect(countsAsActiveWorkingStatus('left_early')).toBe(true)
  })

  it('keeps call-in, cancelled, and on-call visible but outside active staffing', () => {
    for (const status of ['call_in', 'cancelled', 'on_call'] as const) {
      expect(countsAsActiveWorkingStatus(status)).toBe(false)
      expect(isVisibleNotWorkingStatus(status)).toBe(true)
    }
  })

  it('treats only call-in as an automatic staffing gap status', () => {
    expect(createsStaffingGapStatus('call_in')).toBe(true)
    expect(createsStaffingGapStatus('cancelled')).toBe(false)
    expect(createsStaffingGapStatus('on_call')).toBe(false)
    expect(createsStaffingGapStatus('left_early')).toBe(false)
  })

  it('requires an active working lead to satisfy the lead requirement', () => {
    expect(satisfiesLeadRequirement({ role: 'lead', status: 'working' })).toBe(true)
    expect(satisfiesLeadRequirement({ role: 'lead', status: 'left_early' })).toBe(true)
    expect(satisfiesLeadRequirement({ role: 'lead', status: 'on_call' })).toBe(false)
    expect(satisfiesLeadRequirement({ role: 'staff', status: 'working' })).toBe(false)
  })

  it('evaluates the standard minimum, target, and maximum thresholds', () => {
    expect(
      evaluateStaffingSafety([
        { role: 'lead', status: 'working' },
        { role: 'staff', status: 'working' },
      ])
    ).toMatchObject({ activeWorkingCount: 2, tone: 'critical', label: 'Understaffed' })

    expect(
      evaluateStaffingSafety([
        { role: 'lead', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
      ])
    ).toMatchObject({ activeWorkingCount: 3, tone: 'warning', label: 'Minimum staffed' })

    expect(
      evaluateStaffingSafety([
        { role: 'lead', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
      ])
    ).toMatchObject({ activeWorkingCount: 4, tone: 'healthy', label: 'Fully staffed' })

    expect(
      evaluateStaffingSafety([
        { role: 'lead', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
        { role: 'staff', status: 'working' },
      ])
    ).toMatchObject({ activeWorkingCount: 6, tone: 'warning', label: 'Overstaffed' })
  })

  it('reports missing lead and call-in gap details from the same result', () => {
    const result = evaluateStaffingSafety([
      { role: 'lead', status: 'call_in' },
      { role: 'staff', status: 'working' },
      { role: 'staff', status: 'working' },
      { role: 'staff', status: 'working' },
    ])

    expect(result).toMatchObject({
      activeWorkingCount: 3,
      activeLeadCount: 0,
      missingLead: true,
      callInCount: 1,
      hasCallInGap: true,
      tone: 'critical',
      label: 'Missing lead',
    })
  })

  it('centralizes lottery history-affecting statuses', () => {
    expect(affectsLotteryHistoryStatus('on_call')).toBe(true)
    expect(affectsLotteryHistoryStatus('cancelled')).toBe(true)
    expect(affectsLotteryHistoryStatus('left_early')).toBe(false)
    expect(affectsLotteryHistoryStatus('call_in')).toBe(false)
    expect(affectsLotteryHistoryStatus('scheduled')).toBe(false)
  })
})
