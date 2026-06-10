import { describe, expect, it } from 'vitest'

import { buildAvailabilityOverrideMutationFields } from './availability-override'

const NOW = new Date('2026-03-05T12:00:00.000Z')

describe('buildAvailabilityOverrideMutationFields', () => {
  it('does not set override metadata when constraints are not blocking', () => {
    expect(
      buildAvailabilityOverrideMutationFields({
        blockedByConstraints: false,
        inactiveOrFmla: false,
        availabilityOverride: true,
        availabilityOverrideReason: 'Manager approved',
        actorId: 'manager-1',
        now: NOW,
      })
    ).toEqual({
      availability_override: false,
      availability_override_reason: null,
      availability_override_by: null,
      availability_override_at: null,
    })
  })

  it('does not set override metadata for inactive or FMLA therapists', () => {
    expect(
      buildAvailabilityOverrideMutationFields({
        blockedByConstraints: true,
        inactiveOrFmla: true,
        availabilityOverride: true,
        availabilityOverrideReason: 'Manager approved',
        actorId: 'manager-1',
        now: NOW,
      })
    ).toEqual({
      availability_override: false,
      availability_override_reason: null,
      availability_override_by: null,
      availability_override_at: null,
    })
  })

  it('does not set override metadata when the override was not confirmed', () => {
    expect(
      buildAvailabilityOverrideMutationFields({
        blockedByConstraints: true,
        inactiveOrFmla: false,
        availabilityOverride: false,
        availabilityOverrideReason: 'Manager approved',
        actorId: 'manager-1',
        now: NOW,
      })
    ).toEqual({
      availability_override: false,
      availability_override_reason: null,
      availability_override_by: null,
      availability_override_at: null,
    })
  })

  it('sets actor and timestamp when a blocking availability override is confirmed', () => {
    expect(
      buildAvailabilityOverrideMutationFields({
        blockedByConstraints: true,
        inactiveOrFmla: false,
        availabilityOverride: true,
        availabilityOverrideReason: 'Manager approved',
        actorId: 'manager-1',
        now: NOW,
      })
    ).toEqual({
      availability_override: true,
      availability_override_reason: 'Manager approved',
      availability_override_by: 'manager-1',
      availability_override_at: '2026-03-05T12:00:00.000Z',
    })
  })

  it('trims override reasons before storing metadata', () => {
    expect(
      buildAvailabilityOverrideMutationFields({
        blockedByConstraints: true,
        inactiveOrFmla: false,
        availabilityOverride: true,
        availabilityOverrideReason: '  Coverage emergency  ',
        actorId: 'manager-1',
        now: NOW,
      })
    ).toMatchObject({
      availability_override_reason: 'Coverage emergency',
    })
  })

  it('normalizes blank override reasons to null', () => {
    expect(
      buildAvailabilityOverrideMutationFields({
        blockedByConstraints: true,
        inactiveOrFmla: false,
        availabilityOverride: true,
        availabilityOverrideReason: '   ',
        actorId: 'manager-1',
        now: NOW,
      })
    ).toMatchObject({
      availability_override: true,
      availability_override_reason: null,
    })
  })
})
