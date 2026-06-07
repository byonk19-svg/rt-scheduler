import { describe, expect, it } from 'vitest'

import { parseActionBody } from './parse-action-body'

describe('parseActionBody', () => {
  it('parses a valid assign payload', () => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        role: 'staff',
        overrideWeeklyRules: true,
        availabilityOverride: false,
        availabilityOverrideReason: 'Manager approved',
      })
    ).toEqual({
      action: 'assign',
      cycleId: 'cycle-1',
      userId: 'therapist-1',
      shiftType: 'day',
      date: '2026-03-10',
      role: 'staff',
      overrideWeeklyRules: true,
      availabilityOverride: false,
      availabilityOverrideReason: 'Manager approved',
    })
  })

  it('parses a valid move payload', () => {
    expect(
      parseActionBody({
        action: 'move',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
        targetDate: '2026-03-11',
        targetShiftType: 'night',
        overrideWeeklyRules: true,
        availabilityOverride: true,
        availabilityOverrideReason: 'Coverage need',
      })
    ).toEqual({
      action: 'move',
      cycleId: 'cycle-1',
      shiftId: 'shift-1',
      targetDate: '2026-03-11',
      targetShiftType: 'night',
      overrideWeeklyRules: true,
      availabilityOverride: true,
      availabilityOverrideReason: 'Coverage need',
    })
  })

  it('parses a valid remove payload by shiftId', () => {
    expect(
      parseActionBody({
        action: 'remove',
        cycleId: 'cycle-1',
        shiftId: 'shift-1',
      })
    ).toEqual({
      action: 'remove',
      cycleId: 'cycle-1',
      shiftId: 'shift-1',
    })
  })

  it('parses a valid remove payload by user/date/shiftType', () => {
    expect(
      parseActionBody({
        action: 'remove',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        date: '2026-03-10',
        shiftType: 'day',
      })
    ).toEqual({
      action: 'remove',
      cycleId: 'cycle-1',
      userId: 'therapist-1',
      date: '2026-03-10',
      shiftType: 'day',
    })
  })

  it('parses a valid set_lead payload', () => {
    expect(
      parseActionBody({
        action: 'set_lead',
        cycleId: 'cycle-1',
        therapistId: 'therapist-1',
        date: '2026-03-10',
        shiftType: 'night',
        overrideWeeklyRules: false,
        availabilityOverride: true,
        availabilityOverrideReason: 'Lead coverage',
      })
    ).toEqual({
      action: 'set_lead',
      cycleId: 'cycle-1',
      therapistId: 'therapist-1',
      date: '2026-03-10',
      shiftType: 'night',
      overrideWeeklyRules: false,
      availabilityOverride: true,
      availabilityOverrideReason: 'Lead coverage',
    })
  })

  it.each([undefined, 'text', 1, true, []])('rejects non-object body %#', (body) => {
    expect(parseActionBody(body)).toBeNull()
  })

  it('rejects null body', () => {
    expect(parseActionBody(null)).toBeNull()
  })

  it('rejects missing cycleId', () => {
    expect(parseActionBody({ action: 'assign' })).toBeNull()
  })

  it('rejects invalid shiftType values', () => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'evening',
        date: '2026-03-10',
      })
    ).toBeNull()
  })

  it('rejects unsupported actions', () => {
    expect(parseActionBody({ action: 'swap', cycleId: 'cycle-1' })).toBeNull()
  })

  it.each([undefined, 123])('rejects invalid or missing assign userId %#', (userId) => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId,
        shiftType: 'day',
        date: '2026-03-10',
      })
    ).toBeNull()
  })

  it.each([undefined, 123])('rejects invalid or missing move shiftId %#', (shiftId) => {
    expect(
      parseActionBody({
        action: 'move',
        cycleId: 'cycle-1',
        shiftId,
        targetDate: '2026-03-10',
        targetShiftType: 'day',
      })
    ).toBeNull()
  })

  it.each([undefined, 123])('rejects invalid or missing set_lead therapistId %#', (therapistId) => {
    expect(
      parseActionBody({
        action: 'set_lead',
        cycleId: 'cycle-1',
        therapistId,
        date: '2026-03-10',
        shiftType: 'day',
      })
    ).toBeNull()
  })

  it('drops invalid role values while preserving valid lead and staff roles', () => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        role: 'manager',
      })
    ).toMatchObject({ role: undefined })

    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        role: 'lead',
      })
    ).toMatchObject({ role: 'lead' })

    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        role: 'staff',
      })
    ).toMatchObject({ role: 'staff' })
  })

  it('sets overrideWeeklyRules only when input is exactly true', () => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        overrideWeeklyRules: true,
      })
    ).toMatchObject({ overrideWeeklyRules: true })

    for (const overrideWeeklyRules of [false, 'true', 1, undefined]) {
      expect(
        parseActionBody({
          action: 'assign',
          cycleId: 'cycle-1',
          userId: 'therapist-1',
          shiftType: 'day',
          date: '2026-03-10',
          overrideWeeklyRules,
        })
      ).toMatchObject({ overrideWeeklyRules: false })
    }
  })

  it('preserves availabilityOverride only when it is boolean', () => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        availabilityOverride: false,
      })
    ).toMatchObject({ availabilityOverride: false })

    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        availabilityOverride: 'false',
      })
    ).toMatchObject({ availabilityOverride: undefined })
  })

  it('preserves availabilityOverrideReason only when it is a string', () => {
    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        availabilityOverrideReason: 'Manager approved',
      })
    ).toMatchObject({ availabilityOverrideReason: 'Manager approved' })

    expect(
      parseActionBody({
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-1',
        shiftType: 'day',
        date: '2026-03-10',
        availabilityOverrideReason: 123,
      })
    ).toMatchObject({ availabilityOverrideReason: undefined })
  })
})
