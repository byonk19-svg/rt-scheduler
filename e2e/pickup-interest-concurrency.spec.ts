import { expect, test, type TestInfo } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type PickupInterestCtx = {
  supabase: SupabaseClient
  siteId: string
  managerId: string
  requesterId: string
  claimantIds: string[]
  createdCycleIds: string[]
  createdUserIds: string[]
}

type InterestStatus = 'selected' | 'pending' | 'withdrawn' | 'declined'

type InterestRow = {
  id: string
  therapist_id: string
  status: InterestStatus
}

function nextSundayAfter(daysAhead: number): Date {
  const target = addDays(new Date(), daysAhead)
  return addDays(target, (7 - target.getDay()) % 7)
}

async function createPickupPost(ctx: PickupInterestCtx, testInfo: TestInfo): Promise<string> {
  const cycleOffset = 1020 + ctx.createdCycleIds.length * 50 + testInfo.workerIndex * 5
  const cycleStart = nextSundayAfter(cycleOffset + testInfo.retry * 7)
  const cycleInsert = await ctx.supabase
    .from('schedule_cycles')
    .insert({
      label: `Pickup Interest Concurrency ${randomString('cycle')}`,
      start_date: formatDateKey(cycleStart),
      end_date: formatDateKey(addDays(cycleStart, 41)),
      site_id: ctx.siteId,
      published: true,
    })
    .select('id')
    .single()

  if (cycleInsert.error || !cycleInsert.data) {
    throw new Error(cycleInsert.error?.message ?? 'Could not create pickup interest cycle.')
  }
  ctx.createdCycleIds.push(cycleInsert.data.id)

  const shiftInsert = await ctx.supabase
    .from('shifts')
    .insert({
      cycle_id: cycleInsert.data.id,
      user_id: ctx.requesterId,
      date: formatDateKey(addDays(cycleStart, 3)),
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
      site_id: ctx.siteId,
    })
    .select('id')
    .single()

  if (shiftInsert.error || !shiftInsert.data) {
    throw new Error(shiftInsert.error?.message ?? 'Could not create pickup interest shift.')
  }

  const postInsert = await ctx.supabase
    .from('shift_posts')
    .insert({
      shift_id: shiftInsert.data.id,
      posted_by: ctx.requesterId,
      type: 'pickup',
      visibility: 'team',
      status: 'pending',
      request_kind: 'standard',
      message: `Pickup interest concurrency ${randomString('post')}`,
    })
    .select('id')
    .single()

  if (postInsert.error || !postInsert.data) {
    throw new Error(postInsert.error?.message ?? 'Could not create pickup interest post.')
  }

  return postInsert.data.id
}

async function expressInterest(ctx: PickupInterestCtx, postId: string, therapistId: string) {
  const result = await ctx.supabase.rpc('app_express_shift_post_interest', {
    p_actor_id: therapistId,
    p_post_id: postId,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return Array.isArray(result.data) ? result.data[0] : result.data
}

async function loadInterestRows(supabase: SupabaseClient, postId: string): Promise<InterestRow[]> {
  const result = await supabase
    .from('shift_post_interests')
    .select('id, therapist_id, status')
    .eq('shift_post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return (result.data ?? []) as InterestRow[]
}

function expectSingleSelected(rows: InterestRow[]): InterestRow {
  const selected = rows.filter((row) => row.status === 'selected')
  expect(selected).toHaveLength(1)
  return selected[0]
}

test.describe.serial('pickup interest concurrency and promotion', () => {
  test.setTimeout(120_000)

  let ctx: PickupInterestCtx | null = null

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const siteId = randomString('pickup-interest-site')
    const siteInsert = await supabase
      .from('sites')
      .insert({ id: siteId, name: 'Pickup Interest E2E Site' })
    if (siteInsert.error) {
      throw new Error(`Could not create pickup interest test site: ${siteInsert.error.message}`)
    }

    const createdUserIds: string[] = []
    const createdCycleIds: string[] = []

    const manager = await createE2EUser(supabase, {
      email: `${randomString('pickup-manager')}@example.com`,
      password: `Mgr!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Pickup Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
      siteId,
    })
    createdUserIds.push(manager.id)

    const requester = await createE2EUser(supabase, {
      email: `${randomString('pickup-requester')}@example.com`,
      password: `Req!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Pickup Requester',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      siteId,
    })
    createdUserIds.push(requester.id)

    const claimantIds: string[] = []
    for (let index = 0; index < 4; index += 1) {
      const claimant = await createE2EUser(supabase, {
        email: `${randomString(`pickup-claimant-${index}`)}@example.com`,
        password: `Claim!${Math.random().toString(16).slice(2, 10)}`,
        fullName: `Pickup Claimant ${index + 1}`,
        role: 'therapist',
        employmentType: 'full_time',
        shiftType: 'day',
        siteId,
      })
      createdUserIds.push(claimant.id)
      claimantIds.push(claimant.id)
    }

    ctx = {
      supabase,
      siteId,
      managerId: manager.id,
      requesterId: requester.id,
      claimantIds,
      createdCycleIds,
      createdUserIds,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('shift_post_interests').delete().in('therapist_id', ctx.createdUserIds)
    await ctx.supabase.from('shift_posts').delete().in('posted_by', ctx.createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', ctx.createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', ctx.createdCycleIds)
    await ctx.supabase.from('profiles').delete().in('id', ctx.createdUserIds)
    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)

    for (const userId of ctx.createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('simultaneous interest submissions produce exactly one selected claimant', async ({}, testInfo) => {
    test.skip(!ctx, 'Supabase service env values are required for DB-backed concurrency coverage.')

    const postId = await createPickupPost(ctx!, testInfo)
    const results = await Promise.all(
      ctx!.claimantIds.map((claimantId) => expressInterest(ctx!, postId, claimantId))
    )

    expect(results.filter((result) => result?.status === 'selected')).toHaveLength(1)
    const rows = await loadInterestRows(ctx!.supabase, postId)
    const selected = expectSingleSelected(rows)
    expect(rows).toHaveLength(ctx!.claimantIds.length)
    expect(rows.filter((row) => row.status === 'pending')).toHaveLength(ctx!.claimantIds.length - 1)
    expect(ctx!.claimantIds).toContain(selected.therapist_id)
  })

  test('selected claimant withdrawal promotes backups deterministically and clears the queue', async ({}, testInfo) => {
    test.skip(!ctx, 'Supabase service env values are required for DB-backed concurrency coverage.')

    const postId = await createPickupPost(ctx!, testInfo)
    for (const claimantId of ctx!.claimantIds.slice(0, 3)) {
      await expressInterest(ctx!, postId, claimantId)
    }

    let rows = await loadInterestRows(ctx!.supabase, postId)
    expect(expectSingleSelected(rows).therapist_id).toBe(ctx!.claimantIds[0])

    for (const promotedClaimantId of ctx!.claimantIds.slice(1, 3)) {
      const selected = expectSingleSelected(rows)
      const withdraw = await ctx!.supabase.rpc('app_withdraw_shift_post_interest', {
        p_actor_id: selected.therapist_id,
        p_interest_id: selected.id,
      })
      expect(withdraw.error?.message).toBeUndefined()

      rows = await loadInterestRows(ctx!.supabase, postId)
      expect(expectSingleSelected(rows).therapist_id).toBe(promotedClaimantId)
    }

    const finalSelected = expectSingleSelected(rows)
    const finalWithdraw = await ctx!.supabase.rpc('app_withdraw_shift_post_interest', {
      p_actor_id: finalSelected.therapist_id,
      p_interest_id: finalSelected.id,
    })
    expect(finalWithdraw.error?.message).toBeUndefined()

    rows = await loadInterestRows(ctx!.supabase, postId)
    expect(rows.filter((row) => row.status === 'selected')).toHaveLength(0)
    expect(rows.filter((row) => row.status === 'pending')).toHaveLength(0)
    expect(rows.filter((row) => row.status === 'withdrawn')).toHaveLength(3)
  })

  test('manager denial promotes the next backup without stale selected responders', async ({}, testInfo) => {
    test.skip(!ctx, 'Supabase service env values are required for DB-backed concurrency coverage.')

    const postId = await createPickupPost(ctx!, testInfo)
    for (const claimantId of ctx!.claimantIds.slice(0, 3)) {
      await expressInterest(ctx!, postId, claimantId)
    }

    let rows = await loadInterestRows(ctx!.supabase, postId)
    expect(expectSingleSelected(rows).therapist_id).toBe(ctx!.claimantIds[0])

    for (const promotedClaimantId of ctx!.claimantIds.slice(1, 3)) {
      const selected = expectSingleSelected(rows)
      const deny = await ctx!.supabase.rpc('app_deny_pickup_claimant', {
        p_actor_id: ctx!.managerId,
        p_post_id: postId,
        p_interest_id: selected.id,
      })
      expect(deny.error?.message).toBeUndefined()

      rows = await loadInterestRows(ctx!.supabase, postId)
      expect(expectSingleSelected(rows).therapist_id).toBe(promotedClaimantId)
    }

    const finalSelected = expectSingleSelected(rows)
    const finalDeny = await ctx!.supabase.rpc('app_deny_pickup_claimant', {
      p_actor_id: ctx!.managerId,
      p_post_id: postId,
      p_interest_id: finalSelected.id,
    })
    expect(finalDeny.error?.message).toBeUndefined()

    rows = await loadInterestRows(ctx!.supabase, postId)
    expect(rows.filter((row) => row.status === 'selected')).toHaveLength(0)
    expect(rows.filter((row) => row.status === 'pending')).toHaveLength(0)
    expect(rows.filter((row) => row.status === 'declined')).toHaveLength(3)
  })
})
