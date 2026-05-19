import { execFileSync } from 'node:child_process'

import { expect, test, type Response } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type RequestsCtx = {
  supabase: SupabaseClient
  siteId: string
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      execFileSync(
        process.execPath,
        ['--env-file=.env.local', 'scripts/seed-functional-demo.mjs'],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
        }
      )
      return
    } catch (error) {
      if (attempt === 2) {
        throw error
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000)
    }
  }
}

async function loadSeededTeamwiseDirectSwap(
  supabase: SupabaseClient
): Promise<SeededTeamwiseDirectSwap> {
  const { data: recipient, error: recipientError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('email', 'layne@teamwise.test')
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

async function openRequestComposerForShift(
  page: Parameters<typeof loginAs>[0],
  shiftId: string,
  requestType: 'swap' | 'pickup' = 'swap'
) {
  const typeParam = requestType === 'pickup' ? '&type=pickup' : ''
  const url = `/requests/new?new=1&shiftId=${shiftId}${typeParam}`

  await gotoWithRetry(page, url)
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)

  if (requestType === 'pickup') {
    await expect(page.getByRole('heading', { name: 'Give up shift' })).toBeVisible({
      timeout: 20_000,
    })
    return
  }

  const teammateStepHeader = page.getByText('Who do you want to ask first?').first()
  if (await teammateStepHeader.isVisible({ timeout: 5_000 }).catch(() => false)) {
    return
  }

  const autoSelectedShift = page.getByText('Your shift is already selected').first()
  if (await autoSelectedShift.isVisible({ timeout: 5_000 }).catch(() => false)) {
    return
  }

  const shiftStepHeader = page.getByText('Which shift are you trying to change?').first()
  await expect(shiftStepHeader).toBeVisible({ timeout: 20_000 })
  const shiftSelect = page.getByRole('combobox', { name: 'Select shift' })
  if (await shiftSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expect(shiftSelect).toHaveValue(shiftId, { timeout: 10_000 })
  }
}

function waitForShiftPostMutation(page: Parameters<typeof loginAs>[0]) {
  return page
    .waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/api/shift-posts'),
      { timeout: 10_000 }
    )
    .catch(() => null)
}

async function expectShiftPostResponseOk(response: Response | null) {
  if (!response) return
  const body = await response.json().catch(() => null)
  expect(response.ok(), JSON.stringify(body)).toBe(true)
}

async function clickSubmitRequest(page: Parameters<typeof loginAs>[0]) {
  await clickButtonNow(page, 'Submit request')
}

async function clickButtonNow(page: Parameters<typeof loginAs>[0], name: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const clicked = await page
      .evaluate((buttonName) => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const button = buttons.find((candidate) => {
          const ariaLabel = candidate.getAttribute('aria-label')?.trim()
          const text = candidate.textContent?.replace(/\s+/g, ' ').trim()
          return ariaLabel === buttonName || text === buttonName || text?.includes(buttonName)
        }) as HTMLButtonElement | undefined

        if (!button) return false
        if (button.disabled) {
          throw new Error(`${buttonName} button is disabled.`)
        }
        button.click()
        return true
      }, name)
      .catch((error: Error) => {
        if (/Execution context was destroyed|Cannot find context/.test(error.message)) {
          return false
        }
        throw error
      })

    if (clicked) {
      return
    }
    await page.waitForTimeout(500)
  }

  throw new Error(`${name} button was not found.`)
}

async function continueToSubmitRequest(page: Parameters<typeof loginAs>[0]) {
  const submitButton = page.getByRole('button', { name: 'Submit request' })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickButtonNow(page, 'Continue')
    if (await submitButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return
    }
    await page.keyboard.press('Enter').catch(() => undefined)
    if (await submitButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return
    }
  }
  await expect(submitButton).toBeVisible({ timeout: 10_000 })
}

async function chooseDirectPickupTeammate(
  page: Parameters<typeof loginAs>[0],
  shiftId: string,
  teammateId: string
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await openRequestComposerForShift(page, shiftId, 'pickup')
    }

    await expect(page.getByRole('heading', { name: 'Give up shift' })).toBeVisible({
      timeout: 10_000,
    })
    await clickButtonNow(page, 'Ask a specific teammate')

    const option = page.getByTestId(`teammate-option-${teammateId}`)
    if (
      !(await page
        .getByText('Who do you want to ask?')
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false))
    ) {
      await clickButtonNow(page, 'Ask a specific teammate')
    }
    await expect(page.getByText('Who do you want to ask?').first()).toBeVisible({
      timeout: 10_000,
    })
    if (await option.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await option.click()
      await continueToSubmitRequest(page)
      return
    }

    await page.waitForTimeout(750)
  }

  await expect(page.getByTestId(`teammate-option-${teammateId}`)).toBeVisible({
    timeout: 20_000,
  })
  await page.getByTestId(`teammate-option-${teammateId}`).click()
  await continueToSubmitRequest(page)
}

async function openShiftBoard(page: Parameters<typeof loginAs>[0]) {
  await gotoWithRetry(page, '/shift-board')
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
}

async function findRequestCard(page: Parameters<typeof loginAs>[0], message: string) {
  const requestCard = page
    .locator('div.rounded-xl')
    .filter({ has: page.getByText(message) })
    .first()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoWithRetry(page, '/requests/new')
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)
    if (await requestCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
      return requestCard
    }
  }

  await expect(requestCard).toBeVisible({ timeout: 20_000 })
  return requestCard
}

function nextSundayAfter(daysAhead: number): Date {
  const target = addDays(new Date(), daysAhead)
  return addDays(target, (7 - target.getDay()) % 7)
}

test.describe.serial('requests workflow', () => {
  test.setTimeout(240_000)

  let ctx: RequestsCtx | null = null
  const createdCycleIds: string[] = []
  const createdUserIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const siteId = randomString('requests-site')
    const siteInsert = await supabase
      .from('sites')
      .insert({ id: siteId, name: 'Requests E2E Site' })
    if (siteInsert.error) {
      throw new Error(`Could not create requests test site: ${siteInsert.error.message}`)
    }

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
      siteId,
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
      siteId,
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
      siteId,
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
      siteId,
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
      siteId,
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
      siteId,
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
      siteId,
    })
    createdUserIds.push(leadIneligiblePartner.id)

    ctx = {
      supabase,
      siteId,
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
    await ctx.supabase.from('audit_log').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    await ctx.supabase.from('profiles').delete().in('id', createdUserIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
    await ctx.supabase.from('sites').delete().eq('id', ctx.siteId)
  })

  test('seeded Teamwise therapist can accept a direct swap and manager can approve it', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded Teamwise swap e2e.')
    test.skip(
      true,
      'Global functional-demo direct swap state is not deterministic in the full suite; isolated direct-request specs below cover recipient acceptance and manager approval.'
    )

    reseedFunctionalDemo()
    const seededSwap = await loadSeededTeamwiseDirectSwap(ctx!.supabase)

    await loginAs(page, 'layne@teamwise.test', 'Teamwise123!')
    await gotoWithRetry(page, '/therapist/swaps')
    await expect(page.getByRole('heading', { name: 'Shift Swaps & Pickups' })).toBeVisible()

    const directSwapCard = page
      .locator('div.rounded-xl')
      .filter({ has: page.getByText(seededSwap.message) })
      .first()
    await expect
      .poll(
        async () => {
          if (await directSwapCard.isVisible({ timeout: 2_000 }).catch(() => false)) {
            return true
          }
          await gotoWithRetry(page, '/therapist/swaps')
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
          return false
        },
        { timeout: 45_000 }
      )
      .toBe(true)
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
      await loginAs(managerPage, 'julie.d@teamwise.test', 'Teamwise123!')
      await openShiftBoard(managerPage)
      const managerCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(seededSwap.message) })
        .first()
      await expect(managerCard).toBeVisible({ timeout: 20_000 })
      const approveResponsePromise = waitForShiftPostMutation(managerPage)
      await managerCard.getByRole('button', { name: 'Approve' }).click()
      const approveResponse = await approveResponsePromise
      await expectShiftPostResponseOk(approveResponse)

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

    const cycleStart = nextSundayAfter(520)
    const cycleKey = formatDateKey(addDays(cycleStart, 3))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Pickup ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        site_id: ctx!.siteId,
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
        site_id: ctx!.siteId,
      })
      .select('id')
      .single()

    if (shiftInsert.error || !shiftInsert.data) {
      throw new Error(shiftInsert.error?.message ?? 'Could not create pickup request shift.')
    }

    const requestMessage = `Withdrawable pickup ${randomString('pickup')}`

    await loginAs(page, ctx!.requester.email, ctx!.requester.password)
    await openRequestComposerForShift(page, shiftInsert.data.id, 'pickup')
    await expect(page.getByRole('heading', { name: 'Give up shift' })).toBeVisible({
      timeout: 10_000,
    })
    const boardReviewStep = page.getByText('Review board request').first()
    if (!(await boardReviewStep.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await page.getByRole('button', { name: 'Post to the board' }).click()
      await expect(boardReviewStep).toBeVisible({ timeout: 10_000 })
    }
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(boardReviewStep).toBeVisible()
    await page.getByLabel('Message').fill(requestMessage)
    const createResponsePromise = waitForShiftPostMutation(page)
    await clickSubmitRequest(page)
    const createResponse = await createResponsePromise
    await expectShiftPostResponseOk(createResponse)

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

    await gotoWithRetry(page, '/requests/new')
    await expect(page.getByText(requestMessage).first()).toBeVisible({ timeout: 20_000 })
  })

  test('direct request recipient can accept from My Requests', async ({ page, browser }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleStart = nextSundayAfter(620)
    const cycleKey = formatDateKey(addDays(cycleStart, 3))
    const partnerKey = formatDateKey(addDays(cycleStart, 4))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        site_id: ctx!.siteId,
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
          site_id: ctx!.siteId,
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.scheduledPartner.id,
          date: partnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
          site_id: ctx!.siteId,
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

    const requestMessage = `Direct request ${randomString('direct')}`
    const postInsert = await ctx!.supabase.from('shift_posts').insert({
      shift_id: requesterShiftId,
      posted_by: ctx!.requester.id,
      claimed_by: ctx!.scheduledPartner.id,
      swap_shift_id: partnerShiftId,
      type: 'swap',
      visibility: 'direct',
      recipient_response: 'pending',
      status: 'pending',
      message: requestMessage,
    })

    if (postInsert.error) {
      throw new Error(postInsert.error.message)
    }
    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shift_posts')
            .select('id')
            .eq('posted_by', ctx!.requester.id)
            .eq('claimed_by', ctx!.scheduledPartner.id)
            .eq('message', requestMessage)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return result.data?.id ?? null
        },
        { timeout: 20_000 }
      )
      .not.toBeNull()

    const recipientContext = await browser.newContext()
    const recipientPage = await recipientContext.newPage()
    try {
      await loginAs(recipientPage, ctx!.scheduledPartner.email, ctx!.scheduledPartner.password)
      const requestCard = await findRequestCard(recipientPage, requestMessage)
      const acceptResponsePromise = waitForShiftPostMutation(recipientPage)
      await requestCard.getByRole('button', { name: 'Accept and send to manager' }).click()
      const acceptResponse = await acceptResponsePromise
      await expectShiftPostResponseOk(acceptResponse)

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

    const cycleStart = nextSundayAfter(720)
    const cycleKey = formatDateKey(addDays(cycleStart, 3))
    const partnerKey = formatDateKey(addDays(cycleStart, 4))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct Swap ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        site_id: ctx!.siteId,
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
          site_id: ctx!.siteId,
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.scheduledPartner.id,
          date: partnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
          site_id: ctx!.siteId,
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

    const postInsert = await ctx!.supabase.from('shift_posts').insert({
      shift_id: requesterShiftId,
      posted_by: ctx!.requester.id,
      claimed_by: ctx!.scheduledPartner.id,
      swap_shift_id: partnerShiftId,
      type: 'swap',
      visibility: 'direct',
      recipient_response: 'pending',
      status: 'pending',
      message: requestMessage,
    })
    if (postInsert.error) {
      throw new Error(postInsert.error.message)
    }

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
      const requestCard = await findRequestCard(recipientPage, requestMessage)
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
      await openShiftBoard(managerPage)
      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      const approveResponsePromise = waitForShiftPostMutation(managerPage)
      await requestCard.getByRole('button', { name: 'Approve' }).click()
      const approveResponse = await approveResponsePromise
      await expectShiftPostResponseOk(approveResponse)

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

    const cycleStart = nextSundayAfter(820)
    const cycleKey = formatDateKey(addDays(cycleStart, 3))
    const partnerKey = formatDateKey(addDays(cycleStart, 4))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Suggested Swap ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        site_id: ctx!.siteId,
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
          site_id: ctx!.siteId,
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.scheduledPartner.id,
          date: partnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
          site_id: ctx!.siteId,
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
    const postInsert = await ctx!.supabase.from('shift_posts').insert({
      shift_id: requesterShiftId,
      posted_by: ctx!.requester.id,
      claimed_by: ctx!.scheduledPartner.id,
      swap_shift_id: partnerShiftId,
      type: 'swap',
      visibility: 'team',
      status: 'pending',
      message: requestMessage,
    })

    if (postInsert.error) {
      throw new Error(postInsert.error.message)
    }

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
      await openShiftBoard(managerPage)
      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      await expect(requestCard.getByText('Suggested partner:')).toBeVisible()
      const approveResponsePromise = waitForShiftPostMutation(managerPage)
      await requestCard.getByRole('button', { name: 'Approve' }).click()
      const approveResponse = await approveResponsePromise
      await expectShiftPostResponseOk(approveResponse)

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

    const cycleStart = nextSundayAfter(920)
    const cycleKey = formatDateKey(addDays(cycleStart, 3))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Direct Pickup ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        site_id: ctx!.siteId,
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
        site_id: ctx!.siteId,
      })
      .select('id')
      .single()

    if (shiftInsert.error || !shiftInsert.data) {
      throw new Error(shiftInsert.error?.message ?? 'Could not create direct pickup shift.')
    }

    const requestMessage = `Direct pickup ${randomString('pickup-direct')}`

    const postInsert = await ctx!.supabase.from('shift_posts').insert({
      shift_id: shiftInsert.data.id,
      posted_by: ctx!.requester.id,
      claimed_by: ctx!.offDayPartner.id,
      type: 'pickup',
      visibility: 'direct',
      recipient_response: 'pending',
      status: 'pending',
      request_kind: 'standard',
      message: requestMessage,
    })
    if (postInsert.error) {
      throw new Error(postInsert.error.message)
    }

    const recipientContext = await browser.newContext()
    const recipientPage = await recipientContext.newPage()
    try {
      await loginAs(recipientPage, ctx!.offDayPartner.email, ctx!.offDayPartner.password)
      const requestCard = await findRequestCard(recipientPage, requestMessage)
      const acceptResponsePromise = waitForShiftPostMutation(recipientPage)
      await requestCard.getByRole('button', { name: 'Accept and send to manager' }).click()
      const acceptResponse = await acceptResponsePromise
      await expectShiftPostResponseOk(acceptResponse)

      await expect
        .poll(
          async () => {
            const result = await ctx!.supabase
              .from('shift_posts')
              .select('recipient_response, status')
              .eq('posted_by', ctx!.requester.id)
              .eq('message', requestMessage)
              .maybeSingle()

            if (result.error) throw new Error(result.error.message)
            return `${result.data?.recipient_response ?? ''}:${result.data?.status ?? ''}`
          },
          { timeout: 20_000 }
        )
        .toBe('accepted:pending')
    } finally {
      await recipientContext.close().catch(() => undefined)
    }

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await openShiftBoard(managerPage)
      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible({ timeout: 20_000 })
      const approveResponsePromise = waitForShiftPostMutation(managerPage)
      await requestCard.getByRole('button', { name: 'Approve' }).click()
      const approveResponse = await approveResponsePromise
      await expectShiftPostResponseOk(approveResponse)

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

      const auditResult = await ctx!.supabase
        .from('audit_log')
        .select('id, action, target_type, target_id')
        .eq('user_id', ctx!.manager.id)
        .eq('action', 'post_publish_modification')
        .eq('target_type', 'shift')
        .eq('target_id', shiftInsert.data.id)
        .maybeSingle()
      expect(auditResult.error).toBeNull()
      expect(auditResult.data).toMatchObject({
        action: 'post_publish_modification',
        target_id: shiftInsert.data.id,
      })
    } finally {
      await managerContext.close().catch(() => undefined)
    }
  })

  test('lead direct requests rank lead-qualified teammates first and keep weaker options visible for review', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run requests workflow e2e.')

    const cycleStart = nextSundayAfter(1020)
    const cycleKey = formatDateKey(addDays(cycleStart, 3))
    const leadEligiblePartnerKey = formatDateKey(addDays(cycleStart, 4))
    const leadIneligiblePartnerKey = formatDateKey(addDays(cycleStart, 5))
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Requests Lead Filter ${randomString('cycle')}`,
        start_date: formatDateKey(cycleStart),
        end_date: formatDateKey(addDays(cycleStart, 41)),
        site_id: ctx!.siteId,
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
          site_id: ctx!.siteId,
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.leadEligiblePartner.id,
          date: leadEligiblePartnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
          site_id: ctx!.siteId,
        },
        {
          cycle_id: cycleInsert.data.id,
          user_id: ctx!.leadIneligiblePartner.id,
          date: leadIneligiblePartnerKey,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
          site_id: ctx!.siteId,
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
    await expect(page.getByTestId(`teammate-option-${ctx!.leadEligiblePartner.id}`)).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Best direct options')).toBeVisible()
    await expect(page.getByText('Worth checking')).toBeVisible()
    await expect(page.getByTestId(`teammate-option-${ctx!.leadIneligiblePartner.id}`)).toBeVisible({
      timeout: 30_000,
    })
  })
})
