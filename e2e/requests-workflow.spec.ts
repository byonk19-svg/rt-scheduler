import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type RequestsCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  requester: { id: string; email: string; password: string }
  partner: { id: string; email: string; password: string }
}

test.describe.serial('requests workflow', () => {
  test.setTimeout(120_000)

  let ctx: RequestsCtx | null = null
  const createdCycleIds: string[] = []
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('req-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Requests Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const requesterEmail = `${randomString('req-user')}@example.com`
    const requesterPassword = `Req!${Math.random().toString(16).slice(2, 10)}`
    const requester = await createE2EUser(supabase, {
      email: requesterEmail,
      password: requesterPassword,
      fullName: 'Requests User',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(requester.id)

    const partnerEmail = `${randomString('req-partner')}@example.com`
    const partnerPassword = `Part!${Math.random().toString(16).slice(2, 10)}`
    const partner = await createE2EUser(supabase, {
      email: partnerEmail,
      password: partnerPassword,
      fullName: 'Requests Partner',
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

    await ctx.supabase.from('shift_post_interests').delete().in('therapist_id', createdUserIds)
    await ctx.supabase.from('shift_posts').delete().in('posted_by', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('requester can create a pickup request from My Requests', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleDate = addDays(new Date(), 18)
    const cycleKey = formatDateKey(cycleDate)
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Pickup ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: cycleKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create pickup requests cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await ctx!.supabase.from('shifts').insert({
      cycle_id: cycleInsert.data.id,
      user_id: ctx!.requester.id,
      date: cycleKey,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    })

    if (shiftsInsert.error) {
      throw new Error(shiftsInsert.error.message)
    }

    const requestMessage = `Withdrawable pickup ${randomString('pickup')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await page.goto('/requests/new')
    await page.getByRole('button', { name: 'New request' }).click()
    await expect(page.getByText('Step 1: Request details').first()).toBeVisible()
    await page.getByRole('button', { name: 'pickup' }).click()
    await page.getByRole('combobox', { name: 'Select shift' }).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Step 3: Final message').first()).toBeVisible()
    await page.getByLabel('Message').fill(requestMessage)
    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/shift-posts')
    )
    await page.getByRole('button', { name: 'Submit request' }).click()
    const createResponse = await createResponsePromise
    const createBody = await createResponse.json().catch(() => null)
    expect(createResponse.ok(), JSON.stringify(createBody)).toBe(true)

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shift_posts')
          .select('status')
          .eq('posted_by', ctx!.requester.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data?.status ?? null
      })
      .toBe('pending')

    await expect(page.getByText(requestMessage).first()).toBeVisible()
  })

  test('direct request recipient can accept from My Requests', async ({ page, browser }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleDate = addDays(new Date(), 19)
    const cycleKey = formatDateKey(cycleDate)
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: cycleKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create direct requests cycle.')
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

    const requestMessage = `Direct request ${randomString('direct')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await page.goto('/requests/new')
    await page.getByRole('button', { name: 'New request' }).click()
    await page.getByRole('button', { name: 'Direct request' }).click()
    await page.getByRole('combobox', { name: 'Select shift' }).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Step 2: Choose teammate').first()).toBeVisible()
    await page.getByRole('button', { name: 'Requests Partner' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Message').fill(requestMessage)
    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/shift-posts')
    )
    await page.getByRole('button', { name: 'Submit request' }).click()
    const createResponse = await createResponsePromise
    const createBody = await createResponse.json().catch(() => null)
    expect(createResponse.ok(), JSON.stringify(createBody)).toBe(true)

    const recipientContext = await browser.newContext()
    const recipientPage = await recipientContext.newPage()
    try {
      await loginAs(recipientPage, ctx!.partner.email, ctx!.partner.password)
      await recipientPage.goto('/requests/new')
      const requestCard = recipientPage
        .locator('div.rounded-xl')
        .filter({ has: recipientPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible()
      await requestCard.getByRole('button', { name: 'Accept' }).click()

      await expect
        .poll(async () => {
          const result = await ctx!.supabase
            .from('shift_posts')
            .select('recipient_response, status')
            .eq('posted_by', ctx!.requester.id)
            .eq('message', requestMessage)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return `${result.data?.recipient_response ?? ''}:${result.data?.status ?? ''}`
        })
        .toBe('accepted:pending')
    } finally {
      await recipientContext.close()
    }
  })
})
