import { describe, expect, it } from 'vitest'

import {
  isScheduleGridAssignmentStatus,
  toScheduleGridAssignmentStatus,
  toScheduleGridCellStatus,
  toScheduleGridMutationPayload,
} from './schedule-status-model'

describe('schedule status model', () => {
  it('maps server shift and assignment status combinations to schedule grid cell status', () => {
    const cases = [
      {
        label: 'scheduled staff assignment',
        isLead: false,
        assignmentStatus: 'scheduled',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'staff',
      },
      {
        label: 'scheduled lead assignment',
        isLead: true,
        assignmentStatus: 'scheduled',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'lead',
      },
      {
        label: 'staff shift without an assignment status',
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'staff',
      },
      {
        label: 'assignment status on call',
        isLead: false,
        assignmentStatus: 'on_call',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'on_call',
      },
      {
        label: 'legacy shift status on call',
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'on_call',
        operationalCode: null,
        expected: 'on_call',
      },
      {
        label: 'assignment status cancelled',
        isLead: false,
        assignmentStatus: 'cancelled',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'cancelled',
      },
      {
        label: 'assignment status call in',
        isLead: false,
        assignmentStatus: 'call_in',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'call_in',
      },
      {
        label: 'assignment status left early',
        isLead: false,
        assignmentStatus: 'left_early',
        shiftStatus: 'scheduled',
        operationalCode: null,
        expected: 'left_early',
      },
      {
        label: 'legacy called off fallback',
        isLead: false,
        assignmentStatus: null,
        shiftStatus: 'called_off',
        operationalCode: null,
        expected: 'cancelled',
      },
    ] as const

    for (const testCase of cases) {
      expect(
        toScheduleGridCellStatus({
          isLead: testCase.isLead,
          assignmentStatus: testCase.assignmentStatus,
          shiftStatus: testCase.shiftStatus,
          operationalCode: testCase.operationalCode,
        }),
        testCase.label
      ).toBe(testCase.expected)
    }
  })

  it('gives active operational codes precedence over assignment status', () => {
    expect(
      toScheduleGridCellStatus({
        isLead: false,
        assignmentStatus: 'on_call',
        shiftStatus: 'scheduled',
        operationalCode: 'call_in',
      })
    ).toBe('call_in')
  })

  it('falls back to assignment status when no matching active operational code is present', () => {
    expect(
      toScheduleGridCellStatus({
        isLead: false,
        assignmentStatus: 'cancelled',
        shiftStatus: 'scheduled',
        operationalCode: null,
      })
    ).toBe('cancelled')
  })

  it('maps schedule grid UI status choices to mutation payloads', () => {
    const cases = [
      ['scheduled', { assignment_status: 'scheduled', status: 'scheduled' }],
      ['on_call', { assignment_status: 'on_call', status: 'on_call' }],
      ['cancelled', { assignment_status: 'cancelled', status: 'called_off' }],
      ['call_in', { assignment_status: 'call_in', status: 'called_off' }],
      ['left_early', { assignment_status: 'left_early', status: 'scheduled' }],
    ] as const

    for (const [status, expectedPayload] of cases) {
      expect(toScheduleGridMutationPayload(status)).toEqual(expectedPayload)
    }
  })

  it('falls back to scheduled payload for unsupported or missing UI status input', () => {
    for (const value of ['unknown', null, undefined]) {
      expect(toScheduleGridMutationPayload(value)).toEqual({
        assignment_status: 'scheduled',
        status: 'scheduled',
      })
    }
  })

  it('recognizes supported schedule grid assignment status values', () => {
    for (const status of ['scheduled', 'on_call', 'cancelled', 'call_in', 'left_early']) {
      expect(isScheduleGridAssignmentStatus(status), status).toBe(true)
    }
    expect(isScheduleGridAssignmentStatus('unknown')).toBe(false)
  })

  it('maps display cell statuses back to supported schedule grid assignment choices', () => {
    const cases = [
      ['staff', 'scheduled'],
      ['lead', 'scheduled'],
      ['on_call', 'on_call'],
      ['cancelled', 'cancelled'],
      ['call_in', 'call_in'],
      ['left_early', 'left_early'],
      ['off', 'scheduled'],
    ] as const

    for (const [cellStatus, assignmentStatus] of cases) {
      expect(toScheduleGridAssignmentStatus(cellStatus)).toBe(assignmentStatus)
    }
  })
})
