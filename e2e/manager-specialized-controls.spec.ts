import { expect, test } from '@playwright/test'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, getEnv, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type ManagerCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  requester: { id: string; email: string; password: string }
  partner: { id: string; email: string; password: string }
}

async function createAuthenticatedClient(email: string, password: string) {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase env for authenticated manager-specialized client.')
  }
  const client = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) {
    throw new Error(`Could not sign in ${email}: ${signIn.error.message}`)
  }
  return client
}

test.describe.serial('manager specialized controls', () => {
  test.setTimeout(120_000)

  let ctx: ManagerCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('special-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Manager Specialized',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const requesterEmail = `${randomString('swap-req')}@example.com`
    const requesterPassword = `Req!${Math.random().toString(16).slice(2, 10)}`
    const requester = await createE2EUser(supabase, {
      email: requesterEmail,
      password: requesterPassword,
      fullName: 'Swap Requester',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(requester.id)

    const partnerEmail = `${randomString('swap-partner')}@example.com`
    const partnerPassword = `Part!${Math.random().toString(16).slice(2, 10)}`
    const partner = await createE2EUser(supabase, {
      email: partnerEmail,
      password: partnerPassword,
      fullName: 'Swap Partner',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(partner.id)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      requester: { id: requester.id, email: requesterEmail, password: requesterPassword },
      partner: { id: partner.id, email: partnerEmail, password: partnerPassword },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('publish_events').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shift_posts').delete().in('posted_by', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can assign a swap partner and approve the swap path', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run manager-specialized e2e.')

    const cycleDate = addDays(new Date(), 16)
    const cycleKey = formatDateKey(cycleDate)
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Swap Cycle ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: cycleKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create swap cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await ctx!.supabase.from('shifts').insert([
      {
        cycle_id: cycleInsert.data.id,
        user_id: ctx!.requester.id,
        date: cycleKey,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
      {
        cycle_id: cycleInsert.data.id,
        user_id: ctx!.partner.id,
        date: cycleKey,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      },
    ])

    if (shiftsInsert.error) {
      throw new Error(shiftsInsert.error.message)
    }

    const requesterPage = page
    await loginAs(requesterPage, ctx!.requester.email, ctx!.requester.password)
    await requesterPage.goto('/requests/new')
    await requesterPage.getByRole('button', { name: 'swap' }).click()
    await requesterPage.getByRole('combobox', { name: 'Select shift' }).selectOption({ index: 1 })
    await requesterPage.getByRole('button', { name: 'Continue' }).click()
    await requesterPage.getByRole('button', { name: 'Continue' }).click()
    const requestMessage = `Swap me ${randomString('swap')}`
    await requesterPage.getByLabel('Message').fill(requestMessage)
    await requesterPage.getByRole('button', { name: 'Submit request' }).click()

    const managerPage = await page.context().browser()?.newPage()
    if (!managerPage) throw new Error('Could not create manager page for swap approval test.')
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await managerPage.goto('/shift-board')
      const card = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(card).toBeVisible()
      await card.locator('select').selectOption(ctx!.partner.id)
      await card.getByRole('button', { name: 'Approve' }).click()
    } finally {
      await managerPage.close()
    }

    const managerClient = await createAuthenticatedClient(ctx!.manager.email, ctx!.manager.password)
    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('status, claimed_by')
          .eq('posted_by', ctx!.requester.id)
          .eq('message', requestMessage)
          .maybeSingle()
        if (post.error) throw new Error(post.error.message)
        return `${post.data?.status ?? ''}:${post.data?.claimed_by ?? ''}`
      })
      .toBe(`approved:${ctx!.partner.id}`)

    // The trigger swaps user assignments; both shifts should still be assigned, just exchanged.
    const shiftRows = await ctx!.supabase
      .from('shifts')
      .select('user_id')
      .eq('cycle_id', cycleInsert.data.id)
      .eq('date', cycleKey)

    if (shiftRows.error) throw new Error(shiftRows.error.message)
    const assignedIds = (shiftRows.data ?? []).map((row) => row.user_id).sort()
    expect(assignedIds).toEqual([ctx!.partner.id, ctx!.requester.id].sort())
    void managerClient
  })

  test('manager can archive a draft cycle from publish history', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run manager-specialized e2e.')

    const cycleDate = addDays(new Date(), 50)
    const cycleKey = formatDateKey(cycleDate)
    const label = `Archive Cycle ${randomString('cycle')}`
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label,
        start_date: cycleKey,
        end_date: formatDateKey(addDays(cycleDate, 6)),
        published: false,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create archive cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/publish')
    const row = page
      .locator('tr')
      .filter({ has: page.getByText(label).first() })
      .first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Archive' }).click()
    await expect(
      page.getByText('Cycle archived. It will no longer appear in Coverage or availability views.')
    ).toBeVisible({
      timeout: 20_000,
    })

    await expect
      .poll(async () => {
        const cycle = await ctx!.supabase
          .from('schedule_cycles')
          .select('archived_at')
          .eq('id', cycleInsert.data.id)
          .maybeSingle()
        if (cycle.error) throw new Error(cycle.error.message)
        return Boolean(cycle.data?.archived_at)
      })
      .toBe(true)
  })
})
