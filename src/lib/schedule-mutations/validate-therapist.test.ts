import { describe, expect, it, vi } from 'vitest'

import {
  validateAssignableTherapist,
  validateLeadEligibleTherapist,
  type AssignableTherapistProfile,
  type LeadEligibleTherapistProfile,
} from './validate-therapist'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

const BASE_ASSIGNABLE_THERAPIST: AssignableTherapistProfile = {
  site_id: 'site-a',
  shift_type: 'day',
  is_active: true,
  archived_at: null,
  on_fmla: false,
}

const BASE_LEAD_THERAPIST: LeadEligibleTherapistProfile = {
  ...BASE_ASSIGNABLE_THERAPIST,
  id: 'therapist-1',
  role: 'therapist',
  is_lead_eligible: true,
}

function makeSupabaseMock(result: {
  profile?: AssignableTherapistProfile | LeadEligibleTherapistProfile | null
  error?: { message: string } | null
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: result.profile === undefined ? BASE_ASSIGNABLE_THERAPIST : result.profile,
      error: result.error ?? null,
    })),
  }

  const supabase = {
    from: vi.fn(() => query),
  } as unknown as ScheduleMutationSupabaseClient

  return { supabase, query }
}

describe('validateAssignableTherapist', () => {
  it('loads and accepts an assignable therapist', async () => {
    const { supabase, query } = makeSupabaseMock({})

    await expect(
      validateAssignableTherapist(supabase, 'therapist-1', 'site-a', 'day')
    ).resolves.toEqual({
      ok: true,
      therapist: BASE_ASSIGNABLE_THERAPIST,
    })
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(query.select).toHaveBeenCalledWith(
      'site_id, shift_type, is_active, archived_at, on_fmla'
    )
    expect(query.eq).toHaveBeenCalledWith('id', 'therapist-1')
  })

  it('returns outside_site_scope for outside-site, missing, or failed therapist reads', async () => {
    for (const result of [
      { profile: { ...BASE_ASSIGNABLE_THERAPIST, site_id: 'site-b' } },
      { profile: null },
      { profile: BASE_ASSIGNABLE_THERAPIST, error: { message: 'read failed' } },
    ]) {
      const { supabase } = makeSupabaseMock(result)

      await expect(
        validateAssignableTherapist(supabase, 'therapist-1', 'site-a', 'day')
      ).resolves.toEqual({
        ok: false,
        status: 403,
        error: 'Therapist is outside your site scope.',
        code: 'outside_site_scope',
      })
    }
  })

  it('returns therapist_shift_type_mismatch when shift types differ', async () => {
    const { supabase } = makeSupabaseMock({
      profile: {
        ...BASE_ASSIGNABLE_THERAPIST,
        shift_type: 'night',
      },
    })

    await expect(
      validateAssignableTherapist(supabase, 'therapist-1', 'site-a', 'day')
    ).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'Therapist shift type does not match the selected schedule shift.',
      code: 'therapist_shift_type_mismatch',
    })
  })

  it.each([{ is_active: false }, { archived_at: '2026-03-01T00:00:00.000Z' }, { on_fmla: true }])(
    'returns therapist_unassignable for inactive archived or FMLA therapist %#',
    async (patch) => {
      const { supabase } = makeSupabaseMock({
        profile: {
          ...BASE_ASSIGNABLE_THERAPIST,
          ...patch,
        },
      })

      await expect(
        validateAssignableTherapist(supabase, 'therapist-1', 'site-a', 'day')
      ).resolves.toEqual({
        ok: false,
        status: 409,
        error: 'This therapist cannot be assigned.',
        code: 'therapist_unassignable',
      })
    }
  )
})

describe('validateLeadEligibleTherapist', () => {
  it('loads and accepts a lead-eligible therapist', async () => {
    const { supabase, query } = makeSupabaseMock({ profile: BASE_LEAD_THERAPIST })

    await expect(
      validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
    ).resolves.toEqual({
      ok: true,
      therapist: BASE_LEAD_THERAPIST,
    })
    expect(query.select).toHaveBeenCalledWith(
      'id, role, is_lead_eligible, site_id, shift_type, is_active, archived_at, on_fmla'
    )
  })

  it('accepts lead role therapists when they are lead eligible', async () => {
    const lead = {
      ...BASE_LEAD_THERAPIST,
      role: 'lead',
    }
    const { supabase } = makeSupabaseMock({ profile: lead })

    await expect(
      validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
    ).resolves.toEqual({
      ok: true,
      therapist: lead,
    })
  })

  it('returns lead_not_eligible for missing or failed lead candidate reads', async () => {
    for (const result of [
      { profile: null },
      { profile: BASE_LEAD_THERAPIST, error: { message: 'read failed' } },
    ]) {
      const { supabase } = makeSupabaseMock(result)

      await expect(
        validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
      ).resolves.toEqual({
        ok: false,
        status: 409,
        error: 'Only lead-eligible therapists can be designated as lead.',
        code: 'lead_not_eligible',
      })
    }
  })

  it('returns lead_not_eligible for wrong role or non-lead-eligible candidate', async () => {
    for (const profile of [
      {
        ...BASE_LEAD_THERAPIST,
        role: 'manager',
      },
      {
        ...BASE_LEAD_THERAPIST,
        is_lead_eligible: false,
      },
    ]) {
      const { supabase } = makeSupabaseMock({ profile })

      await expect(
        validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
      ).resolves.toEqual({
        ok: false,
        status: 409,
        error: 'Only lead-eligible therapists can be designated as lead.',
        code: 'lead_not_eligible',
      })
    }
  })

  it('returns outside_site_scope for lead candidates outside the manager site', async () => {
    const { supabase } = makeSupabaseMock({
      profile: {
        ...BASE_LEAD_THERAPIST,
        site_id: 'site-b',
      },
    })

    await expect(
      validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Therapist is outside your site scope.',
      code: 'outside_site_scope',
    })
  })

  it('returns therapist_shift_type_mismatch for lead candidates with mismatched shift type', async () => {
    const { supabase } = makeSupabaseMock({
      profile: {
        ...BASE_LEAD_THERAPIST,
        shift_type: 'night',
      },
    })

    await expect(
      validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
    ).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'Therapist shift type does not match the selected schedule shift.',
      code: 'therapist_shift_type_mismatch',
    })
  })

  it.each([{ is_active: false }, { archived_at: '2026-03-01T00:00:00.000Z' }, { on_fmla: true }])(
    'returns therapist_unassignable for inactive archived or FMLA lead candidate %#',
    async (patch) => {
      const { supabase } = makeSupabaseMock({
        profile: {
          ...BASE_LEAD_THERAPIST,
          ...patch,
        },
      })

      await expect(
        validateLeadEligibleTherapist(supabase, 'therapist-1', 'site-a', 'day')
      ).resolves.toEqual({
        ok: false,
        status: 409,
        error: 'This therapist cannot be assigned.',
        code: 'therapist_unassignable',
      })
    }
  )
})
