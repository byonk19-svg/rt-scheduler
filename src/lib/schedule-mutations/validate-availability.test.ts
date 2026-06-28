import { describe, expect, it, vi } from 'vitest'

import {
  validateScheduleMutationAvailability,
  type ScheduleMutationAvailabilityProfile,
  type ScheduleMutationWorkPatternRow,
} from './validate-availability'
import type { AvailabilityOverrideRow } from '@/lib/coverage/types'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

const BASE_PROFILE: ScheduleMutationAvailabilityProfile = {
  full_name: 'Avery RT',
  is_active: true,
  archived_at: null,
  on_fmla: false,
  employment_type: 'full_time',
}

const BASE_WORK_PATTERN: ScheduleMutationWorkPatternRow = {
  therapist_id: 'therapist-1',
  pattern_type: 'weekly_fixed',
  works_dow: [1, 2, 3],
  offs_dow: [],
  weekend_rotation: null,
  weekend_anchor_date: null,
  works_dow_mode: 'hard',
  weekly_weekdays: [1, 2, 3],
  weekend_rule: null,
  cycle_anchor_date: null,
  cycle_segments: [],
  shift_preference: 'either',
}

const FORCE_OFF_OVERRIDE: AvailabilityOverrideRow = {
  cycle_id: 'cycle-1',
  therapist_id: 'therapist-1',
  date: '2026-03-02',
  shift_type: 'day',
  override_type: 'force_off',
  note: null,
}

function makeSupabaseMock(result: {
  profile?: ScheduleMutationAvailabilityProfile | null
  profileError?: { message: string } | null
  overrides?: AvailabilityOverrideRow[]
  overridesError?: { message: string } | null
  pattern?: ScheduleMutationWorkPatternRow | null
  patternError?: { message: string } | null
}) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    maybeSingle: vi.fn(async () => ({
      data: result.profile === undefined ? BASE_PROFILE : result.profile,
      error: result.profileError ?? null,
    })),
  }
  const workPatternQuery = {
    select: vi.fn(() => workPatternQuery),
    eq: vi.fn(() => workPatternQuery),
    maybeSingle: vi.fn(async () => ({
      data: result.pattern === undefined ? BASE_WORK_PATTERN : result.pattern,
      error: result.patternError ?? null,
    })),
  }

  const availabilityChain = {
    select: vi.fn(() => availabilityChain),
    eq: vi.fn(() => availabilityChain),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: result.overrides ?? [],
        error: result.overridesError ?? null,
      }).then(resolve),
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return profileQuery
      if (table === 'availability_overrides') return availabilityChain
      if (table === 'work_patterns') return workPatternQuery
      throw new Error(`Unexpected table ${table}`)
    }),
  } as unknown as ScheduleMutationSupabaseClient

  return { supabase, profileQuery, availabilityChain, workPatternQuery }
}

function validate(
  supabase: ScheduleMutationSupabaseClient,
  patch: Partial<Parameters<typeof validateScheduleMutationAvailability>[1]> = {}
) {
  return validateScheduleMutationAvailability(supabase, {
    therapistId: 'therapist-1',
    managerSiteId: 'site-a',
    cycleId: 'cycle-1',
    date: '2026-03-02',
    shiftType: 'day',
    availabilityOverride: false,
    ...patch,
  })
}

describe('validateScheduleMutationAvailability', () => {
  it('returns availability state for assignable therapists', async () => {
    const { supabase } = makeSupabaseMock({})

    await expect(validate(supabase)).resolves.toEqual({
      ok: true,
      availabilityState: {
        therapistName: 'Avery RT',
        blockedByConstraints: false,
        unavailableReason: null,
        forceOff: false,
        forceOn: false,
        inactiveOrFmla: false,
        prnNotOffered: false,
      },
    })
  })

  it('returns internal_error when availability inputs cannot be read', async () => {
    const { supabase } = makeSupabaseMock({
      profileError: { message: 'read failed' },
    })

    await expect(validate(supabase)).resolves.toEqual({
      ok: false,
      status: 500,
      error: 'Failed to validate availability constraints.',
      code: 'internal_error',
    })
  })

  it('returns therapist_unassignable for non-overridable availability blocks', async () => {
    const { supabase } = makeSupabaseMock({
      profile: {
        ...BASE_PROFILE,
        archived_at: '2026-03-01T00:00:00.000Z',
      },
    })

    await expect(validate(supabase, { availabilityOverride: true })).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'Therapist on FMLA',
      code: 'therapist_unassignable',
    })
  })

  it('returns an overridable availability_conflict payload for Need Off conflicts', async () => {
    const { supabase } = makeSupabaseMock({
      overrides: [FORCE_OFF_OVERRIDE],
    })

    await expect(validate(supabase)).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'Conflicts with scheduling constraints.',
      code: 'availability_conflict',
      details: {
        availability: {
          therapistId: 'therapist-1',
          therapistName: 'Avery RT',
          date: '2026-03-02',
          shiftType: 'day',
          reason: 'Force off override',
        },
      },
    })
  })

  it('allows an ordinary availability conflict when manager override is confirmed', async () => {
    const { supabase } = makeSupabaseMock({
      overrides: [FORCE_OFF_OVERRIDE],
    })

    await expect(validate(supabase, { availabilityOverride: true })).resolves.toEqual({
      ok: true,
      availabilityState: {
        therapistName: 'Avery RT',
        blockedByConstraints: true,
        unavailableReason: 'Force off override',
        forceOff: true,
        forceOn: false,
        inactiveOrFmla: false,
        prnNotOffered: false,
      },
    })
  })
})
