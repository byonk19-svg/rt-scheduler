import { expect, test, type Page } from '@playwright/test'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, getEnv, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type RoleJourneysContext = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  lead: { id: string; email: string; password: string; firstName: string }
  therapist: { id: string; email: string; password: string; firstName: string }
  claimant: { id: string; email: string; password: string; firstName: string }
  pendingDeclineUser: { id: string; fullName: string; email: string }
  pendingApproveUser: { id: string; fullName: string; email: string }
  publishedCycle: {
    id: string
    label: string
    shiftDate: string
    requestShiftDate: string
    leadRequestShiftDate: string
  }
  draftCycle: { id: string; label: string; availabilityDate: string; openShiftDate: string }
}

function formatCalendarLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPreliminaryShiftLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

async function createPublishReadyCycle(params: {
  supabase: SupabaseClient
  createdUserIds: string[]
  createdCycleIds: string[]
  lead: { id: string }
  therapist: { id: string }
}): Promise<{ cycleId: string; label: string }> {
  const { supabase, createdUserIds, createdCycleIds, lead, therapist } = params

  const daySupport = await createE2EUser(supabase, {
    email: `${randomString('publish-day')}@example.com`,
    password: `Day!${Math.random().toString(16).slice(2, 10)}`,
    fullName: `Publish Day ${randomString('staff')}`,
    role: 'therapist',
    employmentType: 'full_time',
    shiftType: 'day',
    isLeadEligible: false,
  })
  createdUserIds.push(daySupport.id)

  const nightLead = await createE2EUser(supabase, {
    email: `${randomString('publish-nlead')}@example.com`,
    password: `NLead!${Math.random().toString(16).slice(2, 10)}`,
    fullName: `Publish Night Lead ${randomString('staff')}`,
    role: 'lead',
    employmentType: 'full_time',
    shiftType: 'night',
    isLeadEligible: true,
  })
  createdUserIds.push(nightLead.id)

  const nightStaffOne = await createE2EUser(supabase, {
    email: `${randomString('publish-night1')}@example.com`,
    password: `Night!${Math.random().toString(16).slice(2, 10)}`,
    fullName: `Publish Night One ${randomString('staff')}`,
    role: 'therapist',
    employmentType: 'full_time',
    shiftType: 'night',
    isLeadEligible: false,
  })
  createdUserIds.push(nightStaffOne.id)

  const nightStaffTwo = await createE2EUser(supabase, {
    email: `${randomString('publish-night2')}@example.com`,
    password: `Night!${Math.random().toString(16).slice(2, 10)}`,
    fullName: `Publish Night Two ${randomString('staff')}`,
    role: 'therapist',
    employmentType: 'full_time',
    shiftType: 'night',
    isLeadEligible: false,
  })
  createdUserIds.push(nightStaffTwo.id)

  const publishDate = addDays(new Date(), 21)
  const publishDateKey = formatDateKey(publishDate)
  const cycleLabel = `Publish Ready ${randomString('cycle')}`
  const cycleInsert = await supabase
    .from('schedule_cycles')
    .insert({
      label: cycleLabel,
      start_date: publishDateKey,
      end_date: publishDateKey,
      published: false,
    })
    .select('id')
    .single()

  if (cycleInsert.error || !cycleInsert.data) {
    throw new Error(cycleInsert.error?.message ?? 'Could not create publish-ready cycle.')
  }
  createdCycleIds.push(cycleInsert.data.id)

  const seedShifts = await supabase.from('shifts').insert([
    {
      cycle_id: cycleInsert.data.id,
      user_id: lead.id,
      date: publishDateKey,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'lead',
    },
    {
      cycle_id: cycleInsert.data.id,
      user_id: daySupport.id,
      date: publishDateKey,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    },
    {
      cycle_id: cycleInsert.data.id,
      user_id: nightLead.id,
      date: publishDateKey,
      shift_type: 'night',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'lead',
    },
    {
      cycle_id: cycleInsert.data.id,
      user_id: nightStaffOne.id,
      date: publishDateKey,
      shift_type: 'night',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    },
    {
      cycle_id: cycleInsert.data.id,
      user_id: nightStaffTwo.id,
      date: publishDateKey,
      shift_type: 'night',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    },
    {
      cycle_id: cycleInsert.data.id,
      user_id: therapist.id,
      date: publishDateKey,
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'staff',
    },
  ])

  if (seedShifts.error) {
    throw new Error(seedShifts.error.message)
  }

  return { cycleId: cycleInsert.data.id, label: cycleLabel }
}

async function createSimpleDraftCycle(params: {
  supabase: SupabaseClient
  createdCycleIds: string[]
}): Promise<{ cycleId: string; label: string }> {
  const { supabase, createdCycleIds } = params
  const startDate = addDays(new Date(), 30)
  const startKey = formatDateKey(startDate)
  const endKey = formatDateKey(addDays(startDate, 41))
  const label = `Dialog Draft ${randomString('cycle')}`
  const inserted = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: startKey,
      end_date: endKey,
      published: false,
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? 'Could not create simple draft cycle.')
  }
  createdCycleIds.push(inserted.data.id)
  return { cycleId: inserted.data.id, label }
}

async function expectShiftTabActive(page: Page, tab: 'day' | 'night') {
  const button = page.getByTestId(`coverage-shift-tab-${tab}`).first()
  await expect(button).toBeVisible()
  const className = await button.evaluate((element) => element.className)
  expect(className).toMatch(/bg-primary/)
}

async function expectStaffRedirect(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/dashboard\/staff(?:[/?].*)?$/, { timeout: 20_000 })
}

async function createAuthenticatedClient(email: string, password: string): Promise<SupabaseClient> {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase env for authenticated test client.')
  }

  const client = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) {
    throw new Error(`Could not sign in test client ${email}: ${signIn.error.message}`)
  }

  return client
}

test.describe.serial('role journeys', () => {
  test.setTimeout(120_000)

  let ctx: RoleJourneysContext | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []
  const suspendedPreliminarySnapshotIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('journey-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Journey Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const leadName = `Lead Journey ${randomString('lead')}`
    const leadEmail = `${randomString('journey-lead')}@example.com`
    const leadPassword = `Lead!${Math.random().toString(16).slice(2, 10)}`
    const lead = await createE2EUser(supabase, {
      email: leadEmail,
      password: leadPassword,
      fullName: leadName,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(lead.id)

    const therapistName = `Therapist Journey ${randomString('ther')}`
    const therapistEmail = `${randomString('journey-ther')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 10)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: therapistName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(therapist.id)

    const claimantName = `Claimant Journey ${randomString('claim')}`
    const claimantEmail = `${randomString('journey-claim')}@example.com`
    const claimantPassword = `Claim!${Math.random().toString(16).slice(2, 10)}`
    const claimant = await createE2EUser(supabase, {
      email: claimantEmail,
      password: claimantPassword,
      fullName: claimantName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(claimant.id)

    const pendingDeclineEmail = `${randomString('pending-decline')}@example.com`
    const pendingDeclineName = `Pending Decline ${randomString('user')}`
    const pendingDeclineUser = await supabase.auth.admin.createUser({
      email: pendingDeclineEmail,
      password: `Pend!${Math.random().toString(16).slice(2, 10)}`,
      email_confirm: true,
      user_metadata: { full_name: pendingDeclineName },
    })

    if (pendingDeclineUser.error || !pendingDeclineUser.data.user) {
      throw new Error(
        pendingDeclineUser.error?.message ?? 'Could not create pending decline access user.'
      )
    }
    createdUserIds.push(pendingDeclineUser.data.user.id)

    const pendingProfile = await supabase.from('profiles').upsert(
      {
        id: pendingDeclineUser.data.user.id,
        full_name: pendingDeclineName,
        email: pendingDeclineEmail,
        role: null,
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 5,
        preferred_work_days: [],
        is_lead_eligible: false,
        on_fmla: false,
        is_active: true,
        site_id: 'default',
      },
      { onConflict: 'id' }
    )

    if (pendingProfile.error) {
      throw new Error(pendingProfile.error.message)
    }

    const pendingApproveEmail = `${randomString('pending-approve')}@example.com`
    const pendingApproveName = `Pending Approve ${randomString('user')}`
    const pendingApproveUser = await supabase.auth.admin.createUser({
      email: pendingApproveEmail,
      password: `Pend!${Math.random().toString(16).slice(2, 10)}`,
      email_confirm: true,
      user_metadata: { full_name: pendingApproveName },
    })

    if (pendingApproveUser.error || !pendingApproveUser.data.user) {
      throw new Error(
        pendingApproveUser.error?.message ?? 'Could not create pending approve access user.'
      )
    }
    createdUserIds.push(pendingApproveUser.data.user.id)

    const pendingApproveProfile = await supabase.from('profiles').upsert(
      {
        id: pendingApproveUser.data.user.id,
        full_name: pendingApproveName,
        email: pendingApproveEmail,
        role: null,
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 5,
        preferred_work_days: [],
        is_lead_eligible: false,
        on_fmla: false,
        is_active: true,
        site_id: 'default',
      },
      { onConflict: 'id' }
    )

    if (pendingApproveProfile.error) {
      throw new Error(pendingApproveProfile.error.message)
    }

    const existingActiveSnapshots = await supabase
      .from('preliminary_snapshots')
      .select('id')
      .eq('status', 'active')

    if (existingActiveSnapshots.error) {
      throw new Error(existingActiveSnapshots.error.message)
    }

    const activeSnapshotIds = (existingActiveSnapshots.data ?? []).map((row) => row.id as string)
    if (activeSnapshotIds.length > 0) {
      suspendedPreliminarySnapshotIds.push(...activeSnapshotIds)
      const suspendSnapshots = await supabase
        .from('preliminary_snapshots')
        .update({ status: 'superseded' })
        .in('id', activeSnapshotIds)

      if (suspendSnapshots.error) {
        throw new Error(suspendSnapshots.error.message)
      }
    }

    const publishedStart = addDays(new Date(), -1)
    const publishedEnd = addDays(publishedStart, 13)
    const publishedShiftDate = formatDateKey(addDays(publishedStart, 2))
    const requestShiftDate = formatDateKey(addDays(publishedStart, 4))
    const leadRequestShiftDate = formatDateKey(addDays(publishedStart, 6))
    const publishedLabel = `Journey Published ${randomString('cycle')}`
    const publishedCycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: publishedLabel,
        start_date: formatDateKey(publishedStart),
        end_date: formatDateKey(publishedEnd),
        published: true,
      })
      .select('id')
      .single()

    if (publishedCycleInsert.error || !publishedCycleInsert.data) {
      throw new Error(
        publishedCycleInsert.error?.message ?? 'Could not create published journey cycle.'
      )
    }
    createdCycleIds.push(publishedCycleInsert.data.id)

    const draftStart = addDays(publishedEnd, 1)
    const draftEnd = addDays(draftStart, 13)
    const availabilityDate = formatDateKey(addDays(draftStart, 2))
    const openShiftDate = formatDateKey(addDays(draftStart, 3))
    const availabilityDueAt = `${availabilityDate}T17:00:00.000Z`
    const draftLabel = `Journey Draft ${randomString('cycle')}`
    const draftCycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: draftLabel,
        start_date: formatDateKey(draftStart),
        end_date: formatDateKey(draftEnd),
        published: false,
        availability_due_at: availabilityDueAt,
      })
      .select('id')
      .single()

    if (draftCycleInsert.error || !draftCycleInsert.data) {
      throw new Error(draftCycleInsert.error?.message ?? 'Could not create draft journey cycle.')
    }
    createdCycleIds.push(draftCycleInsert.data.id)

    const { data: shiftRows, error: shiftsError } = await supabase
      .from('shifts')
      .insert([
        {
          cycle_id: publishedCycleInsert.data.id,
          user_id: lead.id,
          date: publishedShiftDate,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'lead',
        },
        {
          cycle_id: publishedCycleInsert.data.id,
          user_id: therapist.id,
          date: publishedShiftDate,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
        {
          cycle_id: publishedCycleInsert.data.id,
          user_id: therapist.id,
          date: requestShiftDate,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
        {
          cycle_id: publishedCycleInsert.data.id,
          user_id: lead.id,
          date: leadRequestShiftDate,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'lead',
        },
        {
          cycle_id: draftCycleInsert.data.id,
          user_id: therapist.id,
          date: availabilityDate,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
        {
          cycle_id: draftCycleInsert.data.id,
          user_id: null,
          date: openShiftDate,
          shift_type: 'day',
          status: 'scheduled',
          assignment_status: 'scheduled',
          role: 'staff',
        },
      ])
      .select('id, cycle_id, date, user_id')

    if (shiftsError) {
      throw new Error(shiftsError.message)
    }

    const draftAssignedShift = shiftRows?.find(
      (row) => row.cycle_id === draftCycleInsert.data.id && row.user_id === therapist.id
    )
    const draftOpenShift = shiftRows?.find(
      (row) => row.cycle_id === draftCycleInsert.data.id && row.user_id === null
    )

    if (!draftAssignedShift?.id || !draftOpenShift?.id) {
      throw new Error('Could not seed draft preliminary shifts.')
    }

    const preliminarySnapshotInsert = await supabase
      .from('preliminary_snapshots')
      .insert({
        cycle_id: draftCycleInsert.data.id,
        created_by: manager.id,
        status: 'active',
      })
      .select('id')
      .single()

    if (preliminarySnapshotInsert.error || !preliminarySnapshotInsert.data) {
      throw new Error(
        preliminarySnapshotInsert.error?.message ?? 'Could not create preliminary snapshot.'
      )
    }

    const preliminaryStatesError = await supabase.from('preliminary_shift_states').insert([
      {
        snapshot_id: preliminarySnapshotInsert.data.id,
        shift_id: draftAssignedShift.id,
        state: 'tentative_assignment',
        reserved_by: therapist.id,
      },
      {
        snapshot_id: preliminarySnapshotInsert.data.id,
        shift_id: draftOpenShift.id,
        state: 'open',
        reserved_by: null,
      },
    ])

    if (preliminaryStatesError.error) {
      throw new Error(preliminaryStatesError.error.message)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      lead: {
        id: lead.id,
        email: leadEmail,
        password: leadPassword,
        firstName: leadName.split(' ')[0] ?? leadName,
      },
      therapist: {
        id: therapist.id,
        email: therapistEmail,
        password: therapistPassword,
        firstName: therapistName.split(' ')[0] ?? therapistName,
      },
      claimant: {
        id: claimant.id,
        email: claimantEmail,
        password: claimantPassword,
        firstName: claimantName.split(' ')[0] ?? claimantName,
      },
      pendingDeclineUser: {
        id: pendingDeclineUser.data.user.id,
        fullName: pendingDeclineName,
        email: pendingDeclineEmail,
      },
      pendingApproveUser: {
        id: pendingApproveUser.data.user.id,
        fullName: pendingApproveName,
        email: pendingApproveEmail,
      },
      publishedCycle: {
        id: publishedCycleInsert.data.id,
        label: publishedLabel,
        shiftDate: publishedShiftDate,
        requestShiftDate,
        leadRequestShiftDate,
      },
      draftCycle: {
        id: draftCycleInsert.data.id,
        label: draftLabel,
        availabilityDate,
        openShiftDate,
      },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase
      .from('therapist_availability_submissions')
      .delete()
      .in('schedule_cycle_id', createdCycleIds)
    await ctx.supabase.from('preliminary_snapshots').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shift_posts').delete().in('posted_by', createdUserIds)
    await ctx.supabase.from('shift_posts').delete().in('claimed_by', createdUserIds)
    await ctx.supabase.from('availability_overrides').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    if (suspendedPreliminarySnapshotIds.length > 0) {
      await ctx.supabase
        .from('preliminary_snapshots')
        .update({ status: 'active' })
        .in('id', suspendedPreliminarySnapshotIds)
    }

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('therapist can complete the core staff journey', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const noteText = `Need off for family event ${randomString('note')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await expect(page).toHaveURL(/\/dashboard\/staff(?:[/?].*)?$/)
    await expect(
      page.getByRole('heading', { name: new RegExp(`Welcome, ${ctx!.therapist.firstName}`) })
    ).toBeVisible()
    await expect(page.getByText('Availability for This Cycle').first()).toBeVisible()

    await page.goto(`/therapist/availability?cycle=${ctx!.draftCycle.id}`)
    await expect(page.getByRole('heading', { name: 'Availability for This Cycle' })).toBeVisible()

    const dayButton = page
      .getByRole('button', {
        name: new RegExp(`^${formatCalendarLabel(ctx!.draftCycle.availabilityDate)}:`),
      })
      .first()
    await expect(dayButton).toBeVisible()
    await dayButton.click()

    const noteBox = page.locator(`textarea#therapist-day-note-${ctx!.draftCycle.availabilityDate}`)
    await expect(noteBox).toBeVisible()
    await noteBox.fill(noteText)

    await page.getByRole('button', { name: /submit availability/i }).click()
    await expect(
      page.getByText(/availability saved and submitted/i).or(page.getByText(/saved and submitted/i))
    ).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(noteText).first()).toBeVisible()

    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week`)
    await expectShiftTabActive(page, 'day')

    await page.goto('/shift-board')
    await expect(
      page
        .getByText('Published schedule changes only')
        .or(page.getByText('No open swap or pickup posts right now.'))
        .first()
    ).toBeVisible()

    await expectStaffRedirect(page, '/team')
    await expectStaffRedirect(page, '/publish')
  })

  test('therapist can review the preliminary schedule and claim an open shift', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const claimNote = `I can cover this shift ${randomString('claim')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/preliminary')
    await expect(page.getByRole('heading', { name: 'Preliminary Schedule' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request change' })).toBeVisible()

    const openShiftCard = page
      .locator('article')
      .filter({
        has: page.getByText(new RegExp(formatPreliminaryShiftLabel(ctx!.draftCycle.openShiftDate))),
      })
      .filter({ has: page.getByText('Help needed') })
      .first()

    await expect(openShiftCard).toBeVisible()
    await openShiftCard.getByRole('textbox').fill(claimNote)
    await openShiftCard.getByRole('button', { name: 'Claim shift' }).click()

    await expect(page.getByText('Your shift claim is pending manager approval.')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('heading', { name: 'Request history' })).toBeVisible()
    await expect(page.getByText('Claimed open shift').first()).toBeVisible()
  })

  test('lead can update assignment status but remains blocked from manager-only pages', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    await loginAs(page, ctx!.lead.email, ctx!.lead.password)
    await expect(page).toHaveURL(/\/dashboard\/staff(?:[/?].*)?$/)
    await expect(
      page.getByRole('heading', { name: new RegExp(`Welcome, ${ctx!.lead.firstName}`) })
    ).toBeVisible()
    await expect(page.getByText('Lead').first()).toBeVisible()

    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week`)
    await expectShiftTabActive(page, 'day')

    const assignmentTrigger = page
      .locator('[data-testid^="coverage-assignment-trigger-"]:visible')
      .filter({ hasText: ctx!.therapist.firstName })
      .first()

    await expect(assignmentTrigger).toBeVisible({ timeout: 30_000 })
    const assignmentStatusResponse = page.waitForResponse((response) =>
      response.url().includes('/api/schedule/assignment-status')
    )
    await assignmentTrigger.click()
    await expect(
      page.locator('[data-testid="coverage-status-popover"]:visible').first()
    ).toBeVisible()
    await page
      .locator('[data-testid="coverage-status-popover"]:visible')
      .first()
      .getByRole('button', { name: 'Call In' })
      .click()
    const response = await assignmentStatusResponse
    const responseBody = (await response.json().catch(() => null)) as Record<string, unknown> | null

    expect(
      response.ok(),
      `assignment status response: ${JSON.stringify(responseBody)}`
    ).toBeTruthy()

    await expect
      .poll(async () => {
        const shiftResult = await ctx!.supabase
          .from('shifts')
          .select('id')
          .eq('cycle_id', ctx!.publishedCycle.id)
          .eq('user_id', ctx!.therapist.id)
          .eq('date', ctx!.publishedCycle.shiftDate)
          .maybeSingle()

        if (shiftResult.error) throw new Error(shiftResult.error.message)
        if (!shiftResult.data?.id) return null

        const operationalResult = await ctx!.supabase
          .from('shift_operational_entries')
          .select('code')
          .eq('shift_id', shiftResult.data.id)
          .eq('active', true)
          .maybeSingle()

        if (operationalResult.error) throw new Error(operationalResult.error.message)
        return operationalResult.data?.code ?? null
      })
      .toBe('call_in')

    await page.goto(`/coverage?cycle=${ctx!.draftCycle.id}&view=week`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await expectShiftTabActive(page, 'day')

    await expectStaffRedirect(page, '/team')
    await expectStaffRedirect(page, '/publish')
  })

  test('manager can approve the pending preliminary claim and sync it into the draft', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/approvals')
    await expect(page.getByRole('heading', { name: 'Preliminary approvals' })).toBeVisible()

    const requestCard = page
      .locator('div.rounded-xl')
      .filter({ has: page.getByText(ctx!.therapist.firstName, { exact: false }) })
      .first()

    await expect(requestCard).toBeVisible()
    await requestCard.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Request approved').first()).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(async () => {
        const requests = await ctx!.supabase
          .from('preliminary_requests')
          .select('status')
          .eq('requester_id', ctx!.therapist.id)
          .eq(
            'snapshot_id',
            (
              await ctx!.supabase
                .from('preliminary_snapshots')
                .select('id')
                .eq('cycle_id', ctx!.draftCycle.id)
                .maybeSingle()
            ).data?.id ?? ''
          )
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (requests.error) throw new Error(requests.error.message)
        return requests.data?.status ?? null
      })
      .toBe('approved')

    await expect
      .poll(async () => {
        const openShift = await ctx!.supabase
          .from('shifts')
          .select('user_id')
          .eq('cycle_id', ctx!.draftCycle.id)
          .eq('date', ctx!.draftCycle.openShiftDate)
          .maybeSingle()

        if (openShift.error) throw new Error(openShift.error.message)
        return openShift.data?.user_id ?? null
      })
      .toBe(ctx!.therapist.id)
  })

  test('therapist sees the lead status change in notifications and can clear it', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
    await expect(page.getByText('Published schedule updated').first()).toBeVisible()
    await expect(page.getByText(/call in/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0)
  })

  test('therapist can create a request and manager can deny it from the shift board', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const requestMessage = `Need coverage for family event ${randomString('post')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/requests/new')
    await expect(page.getByText('Step 1: Request details').first()).toBeVisible()
    await page.getByRole('button', { name: 'pickup' }).click()
    await page.getByRole('combobox', { name: 'Select shift' }).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Step 2: Choose teammate').first()).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Step 3: Final message').first()).toBeVisible()
    await page.getByLabel('Message').fill(requestMessage)
    await page.getByRole('button', { name: 'Submit request' }).click()
    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('shift_posts')
          .select('status')
          .eq('posted_by', ctx!.therapist.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data?.status ?? null
      })
      .toBe('pending')

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await managerPage.goto('/shift-board')

      const requestCard = managerPage
        .locator('div.rounded-xl')
        .filter({ has: managerPage.getByText(requestMessage) })
        .first()
      await expect(requestCard).toBeVisible()
      await requestCard.getByRole('button', { name: 'Deny' }).click()

      await expect
        .poll(async () => {
          const result = await ctx!.supabase
            .from('shift_posts')
            .select('status')
            .eq('posted_by', ctx!.therapist.id)
            .eq('message', requestMessage)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          return result.data?.status ?? null
        })
        .toBe('denied')
    } finally {
      await managerContext.close()
    }
  })

  test('pickup request can be approved and transfer the shift to a claimant', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const requestMessage = `Claimable pickup ${randomString('pickup')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/requests/new')
    await page.getByRole('button', { name: 'pickup' }).click()
    await page.getByRole('combobox', { name: 'Select shift' }).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Message').fill(requestMessage)
    await page.getByRole('button', { name: 'Submit request' }).click()

    let postId: string | null = null
    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('id')
          .eq('posted_by', ctx!.therapist.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (post.error) throw new Error(post.error.message)
        postId = post.data?.id ?? null
        return postId !== null
      })
      .toBe(true)

    const seedClaim = await ctx!.supabase
      .from('shift_posts')
      .update({ claimed_by: ctx!.claimant.id })
      .eq('id', postId!)

    if (seedClaim.error) {
      throw new Error(seedClaim.error.message)
    }

    const managerClient = await createAuthenticatedClient(ctx!.manager.email, ctx!.manager.password)
    const approveResult = await managerClient
      .from('shift_posts')
      .update({ status: 'approved' })
      .eq('id', postId!)

    if (approveResult.error) {
      throw new Error(approveResult.error.message)
    }

    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('status')
          .eq('posted_by', ctx!.therapist.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (post.error) throw new Error(post.error.message)
        return post.data?.status ?? null
      })
      .toBe('approved')

    await expect
      .poll(async () => {
        const shift = await ctx!.supabase
          .from('shifts')
          .select('user_id')
          .eq('cycle_id', ctx!.publishedCycle.id)
          .eq('date', ctx!.publishedCycle.requestShiftDate)
          .maybeSingle()

        if (shift.error) throw new Error(shift.error.message)
        return shift.data?.user_id ?? null
      })
      .toBe(ctx!.claimant.id)
  })

  test('manager can force approve a lead-gap pickup with an override reason', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const requestMessage = `Lead override pickup ${randomString('override')}`
    const overrideReason = `Override accepted ${randomString('reason')}`

    await loginAs(page, ctx!.lead.email, ctx!.lead.password)
    await page.goto('/requests/new')
    await page.getByRole('button', { name: 'pickup' }).click()
    await page.getByRole('combobox', { name: 'Select shift' }).selectOption({ index: 2 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Message').fill(requestMessage)
    await page.getByRole('button', { name: 'Submit request' }).click()

    let postId: string | null = null
    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('id')
          .eq('posted_by', ctx!.lead.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (post.error) throw new Error(post.error.message)
        postId = post.data?.id ?? null
        return postId !== null
      })
      .toBe(true)

    const seedClaim = await ctx!.supabase
      .from('shift_posts')
      .update({ claimed_by: ctx!.claimant.id })
      .eq('id', postId!)

    if (seedClaim.error) {
      throw new Error(seedClaim.error.message)
    }

    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('claimed_by')
          .eq('posted_by', ctx!.lead.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (post.error) throw new Error(post.error.message)
        return post.data?.claimed_by ?? null
      })
      .toBe(ctx!.claimant.id)

    const managerClient = await createAuthenticatedClient(ctx!.manager.email, ctx!.manager.password)
    const approveResult = await managerClient
      .from('shift_posts')
      .update({
        manager_override: true,
        override_reason: overrideReason,
        status: 'approved',
      })
      .eq('id', postId!)

    if (approveResult.error) {
      throw new Error(approveResult.error.message)
    }

    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('status, manager_override, override_reason')
          .eq('posted_by', ctx!.lead.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (post.error) throw new Error(post.error.message)
        return JSON.stringify(post.data ?? null)
      })
      .toBe(
        JSON.stringify({
          status: 'approved',
          manager_override: true,
          override_reason: overrideReason,
        })
      )

    await expect
      .poll(async () => {
        const shift = await ctx!.supabase
          .from('shifts')
          .select('user_id')
          .eq('cycle_id', ctx!.publishedCycle.id)
          .eq('date', ctx!.publishedCycle.leadRequestShiftDate)
          .maybeSingle()

        if (shift.error) throw new Error(shift.error.message)
        return shift.data?.user_id ?? null
      })
      .toBe(ctx!.claimant.id)
  })

  test('manager can unpublish a live cycle from publish history', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const publishReady = await createPublishReadyCycle({
      supabase: ctx!.supabase,
      createdUserIds,
      createdCycleIds,
      lead: { id: ctx!.lead.id },
      therapist: { id: ctx!.therapist.id },
    })

    const markPublished = await ctx!.supabase
      .from('schedule_cycles')
      .update({ published: true })
      .eq('id', publishReady.cycleId)

    if (markPublished.error) {
      throw new Error(markPublished.error.message)
    }

    const publishEvent = await ctx!.supabase.from('publish_events').insert({
      cycle_id: publishReady.cycleId,
      published_by: ctx!.manager.id,
      status: 'success',
      recipient_count: 3,
      queued_count: 0,
      sent_count: 0,
      failed_count: 0,
    })

    if (publishEvent.error) {
      throw new Error(publishEvent.error.message)
    }

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('schedule_cycles')
          .select('published')
          .eq('id', publishReady.cycleId)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data?.published ?? null
      })
      .toBe(true)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/publish')
    await expect(page.getByRole('heading', { name: 'Finalize schedule' })).toBeVisible()
    const publishRow = page
      .locator('tr')
      .filter({ has: page.getByText(publishReady.label).first() })
      .first()
    await expect(publishRow).toBeVisible()
    await publishRow.getByRole('button', { name: 'Take offline' }).click()
    await expect(
      page.getByText(
        'Block unpublished. Assignments stay on the draft grid; staff no longer see it as a published schedule until you publish again.'
      )
    ).toBeVisible({
      timeout: 20_000,
    })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('schedule_cycles')
          .select('published')
          .eq('id', publishReady.cycleId)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data?.published ?? null
      })
      .toBe(false)
  })

  test('manager can requeue failed recipients from publish details', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const draftCycle = await createSimpleDraftCycle({
      supabase: ctx!.supabase,
      createdCycleIds,
    })
    const publishEventInsert = await ctx!.supabase
      .from('publish_events')
      .insert({
        cycle_id: draftCycle.cycleId,
        published_by: ctx!.manager.id,
        status: 'failed',
        recipient_count: 2,
        queued_count: 0,
        sent_count: 0,
        failed_count: 2,
        error_message: '2 email notifications failed.',
      })
      .select('id')
      .single()

    if (publishEventInsert.error || !publishEventInsert.data) {
      throw new Error(publishEventInsert.error?.message ?? 'Could not seed publish event.')
    }

    const outboxInsert = await ctx!.supabase.from('notification_outbox').insert([
      {
        publish_event_id: publishEventInsert.data.id,
        user_id: ctx!.therapist.id,
        email: `failed-${randomString('mail')}@example.com`,
        name: 'Failed One',
        channel: 'email',
        status: 'failed',
        attempt_count: 2,
        last_error: 'SMTP timeout',
      },
      {
        publish_event_id: publishEventInsert.data.id,
        user_id: ctx!.claimant.id,
        email: `failed-${randomString('mail')}@example.com`,
        name: 'Failed Two',
        channel: 'email',
        status: 'failed',
        attempt_count: 1,
        last_error: 'Mailbox rejected message',
      },
    ])

    if (outboxInsert.error) {
      throw new Error(outboxInsert.error.message)
    }

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/publish/${publishEventInsert.data.id}`)
    await expect(page.getByRole('heading', { name: 'Publish Details' })).toBeVisible()
    await expect(page.getByText('Failed One').first()).toBeVisible()
    await page.getByRole('button', { name: 'Re-send failed' }).click()
    await expect(page.getByText(/Failed recipients re-queued:/)).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('notification_outbox')
          .select('status')
          .eq('publish_event_id', publishEventInsert.data.id)
          .order('created_at', { ascending: true })

        if (result.error) throw new Error(result.error.message)
        return (result.data ?? []).map((row) => row.status).join(',')
      })
      .toBe('queued,queued')
  })

  test('manager can create and then delete a draft cycle through coverage and publish history', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const startDate = addDays(new Date(), 45)
    const startKey = formatDateKey(startDate)
    const endKey = formatDateKey(addDays(startDate, 41))
    const label = `Coverage Dialog ${randomString('cycle')}`

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/coverage?view=week')
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    const directCreateButton = page.getByRole('button', { name: 'New 6-week block' })
    if (
      (await directCreateButton
        .first()
        .isVisible()
        .catch(() => false)) === true
    ) {
      await directCreateButton.first().click()
    } else {
      await page.getByText('Cycle tools').first().click()
      await page.getByText('New 6-week block').last().click()
    }

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Start date').fill(startKey)
    await dialog.getByLabel('End date').fill(endKey)
    await dialog.getByLabel('Label').fill(label)
    await dialog.getByRole('button', { name: 'Create draft block' }).click()

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('schedule_cycles')
          .select('id')
          .eq('label', label)
          .maybeSingle()
        if (result.error) throw new Error(result.error.message)
        return result.data?.id ?? null
      })
      .not.toBeNull()

    const cycleId =
      (await ctx!.supabase.from('schedule_cycles').select('id').eq('label', label).maybeSingle())
        .data?.id ?? null

    if (!cycleId) {
      throw new Error('Created cycle not found after coverage dialog submit.')
    }
    createdCycleIds.push(cycleId)

    await page.goto('/publish')
    const cycleRow = page
      .locator('tr')
      .filter({ has: page.getByText(label).first() })
      .first()
    await expect(cycleRow).toBeVisible()
    await cycleRow.getByRole('button', { name: 'Delete draft' }).click()
    await expect(page.getByText('Draft schedule block deleted.')).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('schedule_cycles')
          .select('id')
          .eq('id', cycleId)
          .maybeSingle()
        if (result.error) throw new Error(result.error.message)
        return result.data?.id ?? null
      })
      .toBeNull()
  })

  test('manager can send and refresh a preliminary schedule from coverage', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const draftCycle = await createPublishReadyCycle({
      supabase: ctx!.supabase,
      createdUserIds,
      createdCycleIds,
      lead: { id: ctx!.lead.id },
      therapist: { id: ctx!.therapist.id },
    })

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${draftCycle.cycleId}&view=week`)
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    await page.getByRole('button', { name: 'Send preliminary' }).click()
    await expect(
      page.getByText('Preliminary schedule sent. Therapists can now review it in the app.')
    ).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('preliminary_snapshots')
          .select('status')
          .eq('cycle_id', draftCycle.cycleId)
          .eq('status', 'active')
          .maybeSingle()
        if (result.error) throw new Error(result.error.message)
        return result.data?.status ?? null
      })
      .toBe('active')

    await page.getByRole('button', { name: 'Refresh preliminary' }).click()
    await expect(
      page.getByText('Preliminary schedule refreshed with the latest staffing draft.')
    ).toBeVisible({ timeout: 20_000 })
  })

  test('manager can reach the planning and admin surfaces', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await expect(page).toHaveURL(/\/dashboard\/manager(?:[/?].*)?$/)
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
    await expect(page.getByText('Coverage Issues').first()).toBeVisible()

    await page.goto(`/availability?cycle=${ctx!.draftCycle.id}&therapist=${ctx!.therapist.id}`)
    await expect(page.getByRole('heading', { name: 'Availability planning' }).first()).toBeVisible()
    await expect(page.locator('#planner_therapist_id')).toBeVisible()

    await page.goto('/team')
    await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()

    await page.goto('/requests')
    await expect(page.getByRole('heading', { name: 'Open shifts' })).toBeVisible()
    await expect(page.getByText('Open shifts').first()).toBeVisible()

    await page.goto('/requests/user-access')
    await expect(page.getByRole('heading', { name: 'Access requests' })).toBeVisible()
    await expect(page.getByText(ctx!.pendingApproveUser.fullName).first()).toBeVisible()
    const approveRow = page
      .locator('tr, article')
      .filter({ has: page.getByText(ctx!.pendingApproveUser.fullName) })
      .first()
    await approveRow.getByRole('button', { name: 'Approve' }).click()
    const approveDialog = page.getByRole('dialog')
    await expect(approveDialog).toBeVisible()
    await approveDialog.getByLabel('Role').selectOption('therapist')
    await approveDialog.getByRole('button', { name: 'Approve' }).click()

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('profiles')
          .select('role')
          .eq('id', ctx!.pendingApproveUser.id)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data?.role ?? null
      })
      .toBe('therapist')

    await expect(page.getByText(ctx!.pendingDeclineUser.fullName).first()).toBeVisible()
    await page.getByRole('button', { name: 'Decline' }).first().click()
    await page.getByRole('button', { name: 'Decline' }).last().click()
    await expect(page.getByText('Request declined and pending account deleted.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(ctx!.pendingDeclineUser.fullName)).toHaveCount(0)

    await page.goto('/publish')
    await expect(page.getByRole('heading', { name: 'Publish' })).toBeVisible()
    await expect(page.getByText(ctx!.publishedCycle.label).first()).toBeVisible()
    await expect(page.getByText(ctx!.draftCycle.label).first()).toBeVisible()
  })
})
