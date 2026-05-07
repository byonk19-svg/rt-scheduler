import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type RequestsCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  requester: { id: string; email: string; password: string }
  scheduledPartner: { id: string; email: string; password: string }
  offDayPartner: { id: string; email: string; password: string }
  leadRequester: { id: string; email: string; password: string }
  leadEligiblePartner: { id: string; email: string; password: string }
  leadIneligiblePartner: { id: string; email: string; password: string }
}

type SeededTeamwiseDirectSwap = {
  message: string
  partnerShiftId: string
  requesterId: string
  requesterName: string
  requesterShiftId: string
  recipientId: string
  recipientName: string
}

function reseedFunctionalDemo() {
  execFileSync(process.execPath, ['--env-file=.env.local', 'scripts/seed-functional-demo.mjs'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  })
}

async function loadSeededTeamwiseDirectSwap(
  supabase: SupabaseClient
): Promise<SeededTeamwiseDirectSwap> {
  const { data: recipient, error: recipientError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('email', 'demo-therapist01@teamwise.test')
    .maybeSingle()

  if (recipientError || !recipient) {
    throw new Error(recipientError?.message ?? 'Seeded Teamwise therapist was not found.')
  }

  const { data: post, error: postError } = await supabase
    .from('shift_posts')
    .select(
      'id, message, shift_id, posted_by, claimed_by, swap_shift_id, shift:shifts!shift_posts_shift_id_fkey(cycle_id, date, shift_type)'
    )
    .eq('message', 'Seeded direct swap awaiting response')
    .eq('visibility', 'direct')
    .eq('recipient_response', 'pending')
    .eq('claimed_by', recipient.id)
    .maybeSingle()

  if (postError || !post) {
    throw new Error(postError?.message ?? 'Seeded Teamwise direct swap was not found.')
  }

  const shift = Array.isArray(post.shift) ? post.shift[0] : post.shift
  if (!shift?.cycle_id || !shift.date || !shift.shift_type || !post.shift_id || !post.posted_by) {
    throw new Error('Seeded Teamwise direct swap is missing shift context.')
  }

  const { data: requester, error: requesterError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', post.posted_by)
    .maybeSingle()

  if (requesterError || !requester) {
    throw new Error(requesterError?.message ?? 'Seeded Teamwise requester was not found.')
  }

  const partnerShiftQuery = supabase.from('shifts').select('id')
  const partnerShiftPromise = post.swap_shift_id
    ? partnerShiftQuery.eq('id', post.swap_shift_id).maybeSingle()
    : partnerShiftQuery
        .eq('cycle_id', shift.cycle_id)
        .neq('date', shift.date)
        .eq('shift_type', shift.shift_type)
        .eq('user_id', recipient.id)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
  const { data: partnerShift, error: partnerShiftError } = await partnerShiftPromise

  if (partnerShiftError || !partnerShift) {
    throw new Error(partnerShiftError?.message ?? 'Seeded Teamwise partner shift was not found.')
  }

  return {
    message: post.message,
    partnerShiftId: partnerShift.id,
    requesterId: requester.id,
    requesterName: requester.full_name ?? 'Requester',
    requesterShiftId: post.shift_id,
    recipientId: recipient.id,
    recipientName: recipient.full_name ?? 'Recipient',
  }
}

async function openRequestComposerForShift(page: Parameters<typeof loginAs>[0], shiftId: string) {
  const url = `/requests/new?new=1&shiftId=${shiftId}`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const newRequestButton = page.getByRole('button', { name: 'New request' }).first()
    const shiftStepHeader = page.getByText('Which shift are you trying to change?').first()
    const teammateStepHeader = page.getByText('Who do you want to ask first?').first()
    const shiftSelect = page.getByRole('combobox', { name: 'Select shift' })
    const autoSelectedShift = page.getByText('Your shift is already selected').first()
    const requestSummary = page.getByText('Request summary').first()

    try {
      if (await newRequestButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await newRequestButton.click()
      }

      if (await teammateStepHeader.isVisible({ timeout: 2_000 }).catch(() => false)) {
        return
      }

      if (await autoSelectedShift.isVisible({ timeout: 2_000 }).catch(() => false)) {
        return
      }

      if (await requestSummary.isVisible({ timeout: 2_000 }).catch(() => false)) {
        return
      }

      await expect(shiftStepHeader).toBeVisible({ timeout: 10_000 })
      if (await shiftSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(shiftSelect).toHaveValue(shiftId, { timeout: 10_000 })
      }
      return
    } catch (error) {
      if (attempt === 2) {
        throw error
      }
      await page.waitForTimeout(1_000)
    }
  }
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

    const scheduledPartnerEmail = `${randomString('req-partner')}@example.com`
    const scheduledPartnerPassword = `Part!${Math.random().toString(16).slice(2, 10)}`
    const scheduledPartner = await createE2EUser(supabase, {
      email: scheduledPartnerEmail,
      password: scheduledPartnerPassword,
      fullName: 'Requests Partner',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(scheduledPartner.id)

    const offDayPartnerEmail = `${randomString('req-offday')}@example.com`
    const offDayPartnerPassword = `Off!${Math.random().toString(16).slice(2, 10)}`
    const offDayPartner = await createE2EUser(supabase, {
      email: offDayPartnerEmail,
      password: offDayPartnerPassword,
      fullName: 'Off Day Partner',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(offDayPartner.id)

    const leadRequesterEmail = `${randomString('req-lead')}@example.com`
    const leadRequesterPassword = `Lead!${Math.random().toString(16).slice(2, 10)}`
    const leadRequester = await createE2EUser(supabase, {
      email: leadRequesterEmail,
      password: leadRequesterPassword,
      fullName: 'Lead Requester',
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(leadRequester.id)

    const leadEligiblePartnerEmail = `${randomString('req-lead-ok')}@example.com`
    const leadEligiblePartnerPassword = `LeadOk!${Math.random().toString(16).slice(2, 10)}`
    const leadEligiblePartner = await createE2EUser(supabase, {
      email: leadEligiblePartnerEmail,
      password: leadEligiblePartnerPassword,
      fullName: 'Lead Eligible Partner',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(leadEligiblePartner.id)

    const leadIneligiblePartnerEmail = `${randomString('req-lead-no')}@example.com`
    const leadIneligiblePartnerPassword = `LeadNo!${Math.random().toString(16).slice(2, 10)}`
    const leadIneligiblePartner = await createE2EUser(supabase, {
      email: leadIneligiblePartnerEmail,
      password: leadIneligiblePartnerPassword,
      fullName: 'Non Lead Partner',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(leadIneligiblePartner.id)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      requester: { id: requester.id, email: requesterEmail, password: requesterPassword },
      scheduledPartner: {
        id: scheduledPartner.id,
        email: scheduledPartnerEmail,
        password: scheduledPartnerPassword,
      },
      offDayPartner: {
        id: offDayPartner.id,
        email: offDayPartnerEmail,
        password: offDayPartnerPassword,
      },
      leadRequester: {
        id: leadRequester.id,
        email: leadRequesterEmail,
        password: leadRequesterPassword,
      },
      leadEligiblePartner: {
        id: leadEligiblePartner.id,
        email: leadEligiblePartnerEmail,
        password: leadEligiblePartnerPassword,
      },
      leadIneligiblePartner: {
        id: leadIneligiblePartner.id,
        email: leadIneligiblePartnerEmail,
        password: leadIneligiblePartnerPassword,
      },
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

  test('seeded Teamwise therapist can accept a direct swap and manager can approve it', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded Teamwise swap e2e.')

    reseedFunctionalDemo()
    const seededSwap = await loadSeededTeamwiseDirectSwap(ctx!.supabase)

    await loginAs(page, 'demo-therapist01@teamwise.test', 'Teamwise123!')
    await page.goto('/therapist/swaps', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Shift Swaps & Pickups' })).toBeVisible()

    const directSwapCard = page
      .locator('div.rounded-xl')
      .filter({ has: page.getByText(seededSwap.message) })
      .first()
    await expect(directSwapCard).toBeVisible({ timeout: 20_000 })
    await expect(
      directSwapCard.getByText(`Swap requested by: ${seededSwap.requesterName}`)
    ).toBeVisible()
    await expect(directSwapCard.getByText(`Swap with: ${seededSwap.recipientName}`)).toHaveCount(0)
    await directSwapCard.getByRole('button', { name: 'Accept and send to manager' }).click()

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shift_posts')
            .select('recipient_response, status')
            .eq('message', seededSwap.message)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return `${result.data?.recipient_response ?? ''}:${result.data?.status ?? ''}`
        },
        { timeout: 20_000 }
      )
      .toBe('accepted:pending')

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, 'demo-manager@teamwise.test', 'Teamwise123!')
      await managerPage.goto('/shift-board', { waitUntil: 'domcontentloaded' })
      const managerCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(seededSwap.message) })
        .first()
      await expect(managerCard).toBeVisible({ timeout: 20_000 })
      await managerCard.getByRole('button', { name: 'Approve' }).click()

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shift_posts')
              .select('status, claimed_by, recipient_response')
              .eq('message', seededSwap.message)
              .maybeSingle()

            if (result.error) throw new Error(result.error.message)
            return `${result.data?.status ?? ''}:${result.data?.claimed_by ?? ''}:${result.data?.recipient_response ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe(`approved:${seededSwap.recipientId}:accepted`)

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shifts')
              .select('id, user_id')
              .in('id', [seededSwap.requesterShiftId, seededSwap.partnerShiftId])

            if (result.error) throw new Error(result.error.message)
            const owners = new Map((result.data ?? []).map((row) => [row.id, row.user_id]))
            return `${owners.get(seededSwap.requesterShiftId) ?? ''}:${owners.get(seededSwap.partnerShiftId) ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe(`${seededSwap.recipientId}:${seededSwap.requesterId}`)
    } finally {
      await managerContext.close().catch(() => undefined)
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

    const shiftInsert = await ctx!.supabase
      .from('shifts')
      .insert({
        cycle_id: cycleInsert.data.id,
        user_id: ctx!.requester.id,
        date: cycleKey,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      })
      .select('id')
      .single()

    if (shiftInsert.error || !shiftInsert.data) {
      throw new Error(shiftInsert.error?.message ?? 'Could not create pickup request shift.')
    }

    const requestMessage = `Withdrawable pickup ${randomString('pickup')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await openRequestComposerForShift(page, shiftInsert.data.id)
    await page.getByRole('button', { name: 'pickup' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Request summary').first()).toBeVisible()
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
    const partnerKey = formatDateKey(addDays(cycleDate, 1))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: partnerKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create direct requests cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await ctx!.supabase
      .from('shifts')
      .insert([
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
          user_id: ctx!.scheduledPartner.id,
          date: partnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
      ])
      .select('id, user_id')

    if (shiftsInsert.error || !shiftsInsert.data) {
      throw new Error(shiftsInsert.error?.message ?? 'Could not create direct swap shifts.')
    }
    const requesterShiftId =
      shiftsInsert.data.find((row) => row.user_id === ctx!.requester.id)?.id ?? null
    if (!requesterShiftId) {
      throw new Error('Could not find requester shift for direct swap test.')
    }

    const requestMessage = `Direct request ${randomString('direct')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await openRequestComposerForShift(page, requesterShiftId)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who do you want to ask first?').first()).toBeVisible()
    await page.getByRole('button', { name: 'Requests Partner' }).click()
    await expect(page.getByRole('button', { name: 'Off Day Partner' })).toHaveCount(0)
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
      await loginAs(recipientPage, ctx!.scheduledPartner.email, ctx!.scheduledPartner.password)
      await recipientPage.goto('/requests/new', { waitUntil: 'domcontentloaded' })
      const requestCard = recipientPage
        .locator('div.rounded-xl')
        .filter({ has: recipientPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await requestCard.getByRole('button', { name: 'Accept and send to manager' }).click()

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
      await recipientContext.close().catch(() => undefined)
    }
  })

  test('requester can send a direct swap that the teammate accepts before manager approval', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleDate = addDays(new Date(), 21)
    const cycleKey = formatDateKey(cycleDate)
    const partnerKey = formatDateKey(addDays(cycleDate, 1))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct Swap ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: partnerKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create direct swap cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await ctx!.supabase
      .from('shifts')
      .insert([
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
          user_id: ctx!.scheduledPartner.id,
          date: partnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
      ])
      .select('id, user_id')

    if (shiftsInsert.error || !shiftsInsert.data) {
      throw new Error(shiftsInsert.error?.message ?? 'Could not create direct swap shifts.')
    }

    const requesterShiftId =
      shiftsInsert.data.find((row) => row.user_id === ctx!.requester.id)?.id ?? null
    const partnerShiftId =
      shiftsInsert.data.find((row) => row.user_id === ctx!.scheduledPartner.id)?.id ?? null
    if (!requesterShiftId) {
      throw new Error('Could not find requester shift for direct swap test.')
    }
    if (!partnerShiftId) {
      throw new Error('Could not find partner shift for direct swap test.')
    }

    const requestMessage = `Direct swap ${randomString('swap-direct')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await openRequestComposerForShift(page, requesterShiftId)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who do you want to ask first?').first()).toBeVisible()
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

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shift_posts')
          .select('status, claimed_by')
          .eq('posted_by', ctx!.requester.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return `${result.data?.status ?? ''}:${result.data?.claimed_by ?? ''}`
      })
      .toBe(`pending:${ctx!.scheduledPartner.id}`)

    const recipientContext = await browser.newContext()
    const recipientPage = await recipientContext.newPage()
    try {
      await loginAs(recipientPage, ctx!.scheduledPartner.email, ctx!.scheduledPartner.password)
      await recipientPage.goto('/requests/new', { waitUntil: 'domcontentloaded' })
      const requestCard = recipientPage
        .locator('div.rounded-xl')
        .filter({ has: recipientPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await requestCard.getByRole('button', { name: 'Accept and send to manager' }).click()

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
      await recipientContext.close().catch(() => undefined)
    }

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await managerPage.goto('/shift-board', { waitUntil: 'domcontentloaded' })
      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await requestCard.getByRole('button', { name: 'Approve' }).click()

      await expect
        .poll(async () => {
          const result = await ctx!.supabase
            .from('shift_posts')
            .select('status, claimed_by')
            .eq('posted_by', ctx!.requester.id)
            .eq('message', requestMessage)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return `${result.data?.status ?? ''}:${result.data?.claimed_by ?? ''}`
        })
        .toBe(`approved:${ctx!.scheduledPartner.id}`)

      const { data: approvedPost, error: approvedPostError } = await ctx!.supabase
        .from('shift_posts')
        .select('swap_shift_id')
        .eq('posted_by', ctx!.requester.id)
        .eq('message', requestMessage)
        .maybeSingle()

      if (approvedPostError || !approvedPost?.swap_shift_id) {
        throw new Error(
          approvedPostError?.message ?? 'Approved direct swap is missing swap_shift_id.'
        )
      }

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shifts')
              .select('id, user_id')
              .in('id', [requesterShiftId, approvedPost.swap_shift_id])

            if (result.error) throw new Error(result.error.message)
            const owners = new Map((result.data ?? []).map((row) => [row.id, row.user_id]))
            return `${owners.get(requesterShiftId) ?? ''}:${owners.get(approvedPost.swap_shift_id) ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe(`${ctx!.scheduledPartner.id}:${ctx!.requester.id}`)
    } finally {
      await managerContext.close().catch(() => undefined)
    }
  })

  test('requester can post a team swap with a suggested partner and manager can approve it', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleDate = addDays(new Date(), 22)
    const cycleKey = formatDateKey(cycleDate)
    const partnerKey = formatDateKey(addDays(cycleDate, 1))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Suggested Swap ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: partnerKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create suggested swap cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await ctx!.supabase
      .from('shifts')
      .insert([
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
          user_id: ctx!.scheduledPartner.id,
          date: partnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
      ])
      .select('id, user_id')

    if (shiftsInsert.error || !shiftsInsert.data) {
      throw new Error(shiftsInsert.error?.message ?? 'Could not create suggested swap shifts.')
    }
    const requesterShiftId =
      shiftsInsert.data.find((row) => row.user_id === ctx!.requester.id)?.id ?? null
    const partnerShiftId =
      shiftsInsert.data.find((row) => row.user_id === ctx!.scheduledPartner.id)?.id ?? null
    if (!requesterShiftId || !partnerShiftId) {
      throw new Error('Could not find both shifts for suggested swap test.')
    }

    const requestMessage = `Suggested team swap ${randomString('swap-suggested')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await openRequestComposerForShift(page, requesterShiftId)
    await page.getByRole('button', { name: 'Suggest a teammate on the board' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who should managers try first?').first()).toBeVisible()
    await page.getByRole('button', { name: 'Requests Partner' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Post to the team board with a suggested teammate')).toBeVisible()
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
          .select('status, visibility, claimed_by, recipient_response')
          .eq('posted_by', ctx!.requester.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return `${result.data?.status ?? ''}:${result.data?.visibility ?? ''}:${result.data?.claimed_by ?? ''}:${result.data?.recipient_response ?? 'null'}`
      })
      .toBe(`pending:team:${ctx!.scheduledPartner.id}:null`)

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await managerPage.goto('/shift-board', { waitUntil: 'domcontentloaded' })
      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await expect(requestCard.getByText('Suggested partner:')).toBeVisible()
      await requestCard.getByRole('button', { name: 'Approve' }).click()

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shift_posts')
              .select('status, claimed_by')
              .eq('posted_by', ctx!.requester.id)
              .eq('message', requestMessage)
              .maybeSingle()

            if (result.error) throw new Error(result.error.message)
            return `${result.data?.status ?? ''}:${result.data?.claimed_by ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe(`approved:${ctx!.scheduledPartner.id}`)

      const { data: approvedPost, error: approvedPostError } = await ctx!.supabase
        .from('shift_posts')
        .select('swap_shift_id')
        .eq('posted_by', ctx!.requester.id)
        .eq('message', requestMessage)
        .maybeSingle()

      if (approvedPostError || !approvedPost?.swap_shift_id) {
        throw new Error(
          approvedPostError?.message ?? 'Approved team swap is missing swap_shift_id.'
        )
      }

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shifts')
              .select('id, user_id')
              .in('id', [requesterShiftId, approvedPost.swap_shift_id])

            if (result.error) throw new Error(result.error.message)
            const owners = new Map((result.data ?? []).map((row) => [row.id, row.user_id]))
            return `${owners.get(requesterShiftId) ?? ''}:${owners.get(approvedPost.swap_shift_id) ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe(`${ctx!.scheduledPartner.id}:${ctx!.requester.id}`)
    } finally {
      await managerContext.close().catch(() => undefined)
    }
  })

  test('direct pickup recipient can accept and manager can approve end to end', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleDate = addDays(new Date(), 20)
    const cycleKey = formatDateKey(cycleDate)
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct Pickup ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: cycleKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create direct pickup cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftInsert = await ctx!.supabase
      .from('shifts')
      .insert({
        cycle_id: cycleInsert.data.id,
        user_id: ctx!.requester.id,
        date: cycleKey,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      })
      .select('id')
      .single()

    if (shiftInsert.error || !shiftInsert.data) {
      throw new Error(shiftInsert.error?.message ?? 'Could not create direct pickup shift.')
    }

    const requestMessage = `Direct pickup ${randomString('pickup-direct')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await openRequestComposerForShift(page, shiftInsert.data.id)
    await page.getByRole('button', { name: 'pickup' }).click()
    await page.getByRole('button', { name: 'Ask a specific teammate' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who do you want to ask?').first()).toBeVisible()
    await page.getByTestId(`teammate-option-${ctx!.offDayPartner.id}`).click()
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
      await loginAs(recipientPage, ctx!.offDayPartner.email, ctx!.offDayPartner.password)
      await recipientPage.goto('/requests/new', { waitUntil: 'domcontentloaded' })
      const requestCard = recipientPage
        .locator('div.rounded-xl')
        .filter({ has: recipientPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await requestCard.getByRole('button', { name: 'Accept and send to manager' }).click()

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
      await recipientContext.close().catch(() => undefined)
    }

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await managerPage.goto('/shift-board', { waitUntil: 'domcontentloaded' })
      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await requestCard.getByRole('button', { name: 'Approve' }).click()

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shift_posts')
              .select('status, claimed_by, recipient_response')
              .eq('posted_by', ctx!.requester.id)
              .eq('message', requestMessage)
              .maybeSingle()

            if (result.error) throw new Error(result.error.message)
            return `${result.data?.status ?? ''}:${result.data?.claimed_by ?? ''}:${result.data?.recipient_response ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe(`approved:${ctx!.offDayPartner.id}:accepted`)

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shifts')
              .select('user_id')
              .eq('cycle_id', cycleInsert.data.id)
              .eq('date', cycleKey)
              .maybeSingle()

            if (result.error) throw new Error(result.error.message)
            return result.data?.user_id ?? null
          },
          { timeout: 20_000 }
        )
        .toBe(ctx!.offDayPartner.id)
    } finally {
      await managerContext.close().catch(() => undefined)
    }
  })

  test('lead direct requests rank lead-qualified teammates first and keep weaker options visible for review', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleDate = addDays(new Date(), 210)
    const cycleKey = formatDateKey(cycleDate)
    const leadEligiblePartnerKey = formatDateKey(addDays(cycleDate, 1))
    const leadIneligiblePartnerKey = formatDateKey(addDays(cycleDate, 2))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Lead Filter ${randomString('cycle')}`,
        start_date: cycleKey,
        end_date: leadIneligiblePartnerKey,
        published: true,
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create lead filter cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftsInsert = await ctx!.supabase
      .from('shifts')
      .insert([
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.leadRequester.id,
          date: cycleKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'lead',
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.leadEligiblePartner.id,
          date: leadEligiblePartnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.leadIneligiblePartner.id,
          date: leadIneligiblePartnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
      ])
      .select('id, user_id')

    if (shiftsInsert.error || !shiftsInsert.data) {
      throw new Error(shiftsInsert.error?.message ?? 'Could not create lead filter shifts.')
    }
    const leadRequesterShiftId =
      shiftsInsert.data.find((row) => row.user_id === ctx!.leadRequester.id)?.id ?? null
    if (!leadRequesterShiftId) {
      throw new Error('Could not find lead requester shift for lead filter test.')
    }

    await loginAs(page, ctx!.leadRequester.email, ctx!.leadRequester.password)
    await openRequestComposerForShift(page, leadRequesterShiftId)
    await page.getByRole('button', { name: 'Ask a specific teammate' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who do you want to ask first?').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lead Eligible Partner' })).toBeVisible()
    await expect(page.getByText('Best direct options')).toBeVisible()
    await expect(page.getByText('Worth checking')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Non Lead Partner' })).toBeVisible()
  })
})
