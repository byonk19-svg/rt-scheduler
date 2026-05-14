import { createServerClient } from '@supabase/ssr'
import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, formatDateKey, getEnv, randomString } from './helpers/env'
import { createScheduleCycle } from './helpers/schedule-cycles'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type LotteryWorkflowCtx = {
  supabase: SupabaseClient
  shiftDate: string
  cycleId: string
  manager: { id: string; email: string; password: string }
  alpha: { id: string; fullName: string }
  bravo: { id: string; fullName: string }
  charlie: { id: string; fullName: string }
}

function formatDateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function loginForLottery(page: Page, email: string, password: string) {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for lottery e2e auth.'
    )
  }

  const cookieJar = new Map<string, { value: string; options: Record<string, unknown> }>()
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, row]) => ({ name, value: row.value }))
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.value) {
            cookieJar.set(cookie.name, { value: cookie.value, options: cookie.options ?? {} })
          } else {
            cookieJar.delete(cookie.name)
          }
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Could not sign in ${email}: ${error.message}`)
  }

  await page.context().addCookies(
    [...cookieJar.entries()].map(([name, row]) => ({
      name,
      value: row.value,
      domain: '127.0.0.1',
      path: typeof row.options.path === 'string' ? row.options.path : '/',
      httpOnly: Boolean(row.options.httpOnly),
      secure: Boolean(row.options.secure),
      sameSite: 'Lax' as const,
    }))
  )
}

test.describe.serial('lottery workflow', () => {
  test.setTimeout(120_000)

  let ctx: LotteryWorkflowCtx | null = null
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('lottery-mgr')}@example.com`
    const managerPassword = `Mgr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Lottery Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const alphaUser = await createE2EUser(supabase, {
      email: `${randomString('lottery-alpha')}@example.com`,
      password: `Alpha!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Alpha Requester',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })
    createdUserIds.push(alphaUser.id)

    const bravoUser = await createE2EUser(supabase, {
      email: `${randomString('lottery-bravo')}@example.com`,
      password: `Bravo!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Bravo Worker',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })
    createdUserIds.push(bravoUser.id)

    const charlieUser = await createE2EUser(supabase, {
      email: `${randomString('lottery-charlie')}@example.com`,
      password: `Charlie!${Math.random().toString(16).slice(2, 10)}`,
      fullName: 'Charlie Missing',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
    })
    createdUserIds.push(charlieUser.id)

    const cycle = await createScheduleCycle(supabase, {
      label: `Lottery Workflow ${randomString('cycle')}`,
      startDate: addDays(new Date(), 75 + Math.floor(Math.random() * 20)),
      published: true,
    })
    const shiftDate = formatDateKey(addDays(new Date(`${cycle.start_date}T00:00:00`), 2))

    const shiftsInsert = await supabase.from('shifts').insert([
      {
        cycle_id: cycle.id,
        site_id: 'default',
        user_id: alphaUser.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: cycle.id,
        site_id: 'default',
        user_id: bravoUser.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: cycle.id,
        site_id: 'default',
        user_id: charlieUser.id,
        date: shiftDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
    ])

    if (shiftsInsert.error) {
      throw new Error(shiftsInsert.error.message)
    }

    const listInsert = await supabase.from('lottery_list_entries').insert([
      {
        site_id: 'default',
        shift_type: 'day',
        therapist_id: alphaUser.id,
        display_order: 1,
        created_by: manager.id,
        updated_by: manager.id,
      },
      {
        site_id: 'default',
        shift_type: 'day',
        therapist_id: bravoUser.id,
        display_order: 2,
        created_by: manager.id,
        updated_by: manager.id,
      },
    ])

    if (listInsert.error) {
      throw new Error(listInsert.error.message)
    }

    ctx = {
      supabase,
      shiftDate,
      cycleId: cycle.id,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      alpha: { id: alphaUser.id, fullName: 'Alpha Requester' },
      bravo: { id: bravoUser.id, fullName: 'Bravo Worker' },
      charlie: { id: charlieUser.id, fullName: 'Charlie Missing' },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase
      .from('lottery_decisions')
      .delete()
      .eq('site_id', 'default')
      .eq('shift_date', ctx.shiftDate)

    await ctx.supabase
      .from('lottery_history_entries')
      .delete()
      .eq('site_id', 'default')
      .eq('shift_date', ctx.shiftDate)
      .in('therapist_id', [ctx.alpha.id, ctx.bravo.id, ctx.charlie.id])

    await ctx.supabase
      .from('lottery_requests')
      .delete()
      .eq('site_id', 'default')
      .eq('shift_date', ctx.shiftDate)
      .in('therapist_id', [ctx.alpha.id, ctx.bravo.id, ctx.charlie.id])

    await ctx.supabase
      .from('lottery_list_entries')
      .delete()
      .eq('site_id', 'default')
      .eq('shift_type', 'day')
      .in('therapist_id', [ctx.alpha.id, ctx.bravo.id, ctx.charlie.id])

    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycleId)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycleId)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can request, fix the list, apply the result, and inspect history', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run lottery e2e.')

    await loginForLottery(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/lottery?date=${ctx!.shiftDate}&shift=day`)

    await expect(page.getByRole('heading', { name: 'Lottery' }).first()).toBeVisible()
    await expect(
      page.locator('span').filter({ hasText: ctx!.charlie.fullName }).first()
    ).toBeVisible()

    await page.getByRole('button', { name: 'Add request' }).click()
    await expect
      .poll(
        async () => {
          const request = await ctx!.supabase
            .from('lottery_requests')
            .select('id, state')
            .eq('site_id', 'default')
            .eq('shift_date', ctx!.shiftDate)
            .eq('shift_type', 'day')
            .eq('therapist_id', ctx!.alpha.id)
            .maybeSingle()

          if (request.error) {
            throw new Error(request.error.message)
          }

          return request.data?.state ?? null
        },
        { timeout: 20_000 }
      )
      .toBe('active')
    const requestRow = page
      .locator('div.rounded-lg')
      .filter({ has: page.getByText(ctx!.alpha.fullName) })
      .filter({ has: page.getByRole('button', { name: 'Remove' }) })
      .first()
    await expect(requestRow).toBeVisible({ timeout: 20_000 })

    await page.getByLabel('Keep working').fill('2')
    await expect(page.getByLabel('Keep working')).toHaveValue('2')
    await expect
      .poll(
        async () => {
          const existingEntry = await ctx!.supabase
            .from('lottery_list_entries')
            .select('id')
            .eq('site_id', 'default')
            .eq('shift_type', 'day')
            .eq('therapist_id', ctx!.charlie.id)
            .maybeSingle()

          if (existingEntry.error) {
            throw new Error(existingEntry.error.message)
          }

          if (existingEntry.data?.id) return existingEntry.data.id

          await page
            .getByRole('button', { name: 'Add to list' })
            .click({ timeout: 5_000 })
            .catch(() => undefined)
          return null
        },
        { timeout: 45_000 }
      )
      .not.toBeNull()
    await expect(
      page.getByText('Scheduled full-time therapists are missing from the fixed Lottery order.')
    ).toHaveCount(0, { timeout: 20_000 })

    const snapshotResponse = await page.request.get(
      `/api/lottery/snapshot?date=${ctx!.shiftDate}&shift=day&keepToWork=2`
    )
    expect(snapshotResponse.ok()).toBeTruthy()
    const snapshotPayload = (await snapshotResponse.json()) as {
      snapshot?: {
        recommendation?: {
          contextSignature: string
          keepToWork: number
          actions: Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>
        } | null
      }
    }
    const recommendation = snapshotPayload.snapshot?.recommendation
    expect(recommendation?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          therapistId: ctx!.alpha.id,
          status: 'on_call',
        }),
      ])
    )
    const applyResponse = await page.request.post('/api/lottery/apply', {
      headers: {
        origin: 'http://127.0.0.1:3000',
        referer: `http://127.0.0.1:3000/lottery?date=${ctx!.shiftDate}&shift=day&keepToWork=2`,
      },
      data: {
        shiftDate: ctx!.shiftDate,
        shiftType: 'day',
        keepToWork: recommendation!.keepToWork,
        contextSignature: recommendation!.contextSignature,
        actions: recommendation!.actions,
      },
    })
    expect(applyResponse.ok()).toBeTruthy()

    await expect
      .poll(
        async () => {
          const decision = await ctx!.supabase
            .from('lottery_decisions')
            .select('id, applied_actions')
            .eq('site_id', 'default')
            .eq('shift_date', ctx!.shiftDate)
            .eq('shift_type', 'day')
            .maybeSingle()

          if (decision.error) {
            throw new Error(decision.error.message)
          }

          const appliedActions = Array.isArray(decision.data?.applied_actions)
            ? decision.data.applied_actions
            : []
          const alphaAction = appliedActions.find(
            (entry) => entry && typeof entry === 'object' && entry.therapistId === ctx!.alpha.id
          ) as { status?: string } | undefined

          return alphaAction?.status ?? null
        },
        { timeout: 20_000 }
      )
      .toBe('on_call')

    await expect
      .poll(
        async () => {
          const history = await ctx!.supabase
            .from('lottery_history_entries')
            .select('id, applied_status')
            .eq('site_id', 'default')
            .eq('shift_date', ctx!.shiftDate)
            .eq('shift_type', 'day')
            .eq('therapist_id', ctx!.alpha.id)
            .maybeSingle()

          if (history.error) {
            throw new Error(history.error.message)
          }

          return history.data?.applied_status ?? null
        },
        { timeout: 45_000 }
      )
      .toBe('on_call')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Loading Lottery data/)).toHaveCount(0, { timeout: 45_000 })
    await expect(page.getByText(`Last lotteried: ${formatDateLabel(ctx!.shiftDate)}`)).toBeVisible({
      timeout: 45_000,
    })
  })
})
