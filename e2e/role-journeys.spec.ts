import { expect, test, type Browser, type Page } from '@playwright/test'
import { type SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { gotoWithRetry } from './helpers/navigation'
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

function formatPreliminaryShiftLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatAvailabilityDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function availabilityDayButtonName(isoDate: string): RegExp {
  return new RegExp(`^${formatAvailabilityDayLabel(isoDate)}\\b`)
}

function waitForShiftPostMutation(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/shift-posts'),
    { timeout: 30_000 }
  )
}

function nextSundayOnOrAfter(date: Date): Date {
  const day = date.getDay()
  return addDays(date, (7 - day) % 7)
}

async function nextAvailableCycleStart(
  supabase: SupabaseClient,
  minimumOffsetDays = 730
): Promise<Date> {
  const baseline = nextSundayOnOrAfter(addDays(new Date(), minimumOffsetDays))
  const latestCycle = await supabase
    .from('schedule_cycles')
    .select('end_date')
    .is('archived_at', null)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestCycle.error) {
    throw new Error(latestCycle.error.message)
  }

  if (!latestCycle.data?.end_date) return baseline

  const afterLatestCycle = nextSundayOnOrAfter(
    addDays(new Date(`${latestCycle.data.end_date}T00:00:00`), 1)
  )
  return afterLatestCycle > baseline ? afterLatestCycle : baseline
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

  const publishDate = await nextAvailableCycleStart(supabase, 1460)
  const publishDateKey = formatDateKey(publishDate)
  const cycleLabel = `Publish Ready ${randomString('cycle')}`
  const cycleInsert = await supabase
    .from('schedule_cycles')
    .insert({
      label: cycleLabel,
      start_date: publishDateKey,
      end_date: formatDateKey(addDays(publishDate, 41)),
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
  const startDate = await nextAvailableCycleStart(supabase, 30)
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
  const label = tab === 'day' ? 'Day shift' : 'Night shift'
  const button = page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first()
  await expect(button).toBeVisible()
  await expect(button).toHaveClass(/bg-primary/)
}

async function expectStaffRedirect(page: Page, path: string) {
  await gotoWithRetry(page, path)
  await expect(page).toHaveURL(/\/dashboard\/staff(?:[/?].*)?$/, { timeout: 20_000 })
}

async function seedSelectedPickupInterest(params: {
  supabase: SupabaseClient
  postId: string
  therapistId: string
}): Promise<string> {
  const { supabase, postId, therapistId } = params
  const result = await supabase
    .from('shift_post_interests')
    .insert({
      shift_post_id: postId,
      therapist_id: therapistId,
      status: 'selected',
    })
    .select('id')
    .single()

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'Could not seed pickup claimant interest.')
  }

  return result.data.id
}

async function approvePickupFromShiftBoard(params: {
  browser: Browser
  supabase: SupabaseClient
  requestId: string
  selectedInterestId: string
  shiftId: string
  claimantId: string
  requestMessage: string
  manager: { email: string; password: string }
  overrideReason?: string
}) {
  const {
    browser,
    supabase,
    requestId,
    selectedInterestId,
    shiftId,
    claimantId,
    requestMessage,
    manager,
    overrideReason,
  } = params
  const managerContext = await browser.newContext()
  const managerPage = await managerContext.newPage()

  try {
    await loginAs(managerPage, manager.email, manager.password)
    await managerPage.goto('/shift-board')

    const requestCard = managerPage
      .locator('div.rounded-xl')
      .filter({ has: managerPage.getByText(requestMessage) })
      .first()
    await expect(requestCard).toBeVisible({ timeout: 20_000 })

    const interestUpdate = await supabase
      .from('shift_post_interests')
      .update({ status: 'selected' })
      .eq('id', selectedInterestId)
    if (interestUpdate.error) throw new Error(interestUpdate.error.message)

    const postUpdate = await supabase
      .from('shift_posts')
      .update({
        status: 'approved',
        claimed_by: claimantId,
        manager_override: typeof overrideReason === 'string',
        override_reason: overrideReason ?? null,
      })
      .eq('id', requestId)
    if (postUpdate.error) throw new Error(postUpdate.error.message)

    const shiftUpdate = await supabase
      .from('shifts')
      .update({ user_id: claimantId })
      .eq('id', shiftId)
    if (shiftUpdate.error) throw new Error(shiftUpdate.error.message)
  } finally {
    await managerContext.close()
  }
}

test.describe.serial('role journeys', () => {
  test.setTimeout(180_000)

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
        role: 'therapist',
        access_status: 'pending',
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 5,
        preferred_work_days: [],
        is_lead_eligible: false,
        on_fmla: false,
        is_active: false,
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
        role: 'therapist',
        access_status: 'pending',
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 5,
        preferred_work_days: [],
        is_lead_eligible: false,
        on_fmla: false,
        is_active: false,
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

    const publishedStart = await nextAvailableCycleStart(supabase, 730)
    const publishedEnd = addDays(publishedStart, 41)
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
    const draftEnd = addDays(draftStart, 41)
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
        status: 'draft',
        availability_due_at: availabilityDueAt,
        availability_reopened_at: new Date().toISOString(),
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
    await expect(page.getByText('What needs your attention now').first()).toBeVisible()

    await page.goto(`/therapist/availability?cycle=${ctx!.draftCycle.id}`)
    await expect(page.getByRole('heading', { name: 'Future Availability' })).toBeVisible()

    const dayButton = page
      .getByRole('button', {
        name: availabilityDayButtonName(ctx!.draftCycle.availabilityDate),
      })
      .first()
    await expect(dayButton).toBeVisible()
    await dayButton.click()
    await page
      .getByRole('button', { name: /^Need Off$/ })
      .last()
      .click()

    const noteBox = page.locator('textarea[id^="therapist-day-note-"]').first()
    await expect(noteBox).toBeVisible()
    await noteBox.fill(noteText)

    const submitButton = page
      .getByRole('button', { name: /submit availability/i })
      .or(page.getByRole('button', { name: /save changes/i }))
      .first()
    await submitButton.click()
    await expect(page.getByText('Submitted').first()).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(noteText).first()).toBeVisible()

    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=week`)
    await expectShiftTabActive(page, 'day')

    await page.goto('/shift-board')
    await expect(page.getByRole('heading', { name: 'Shift Board' })).toBeVisible()
    await expect(
      page
        .getByText(
          'Post trade requests or coverage requests for the published schedule only. Team board and direct requests both live here.'
        )
        .first()
    ).toBeVisible()

    await expectStaffRedirect(page, '/team')
    await expectStaffRedirect(page, '/publish')
  })

  test('therapist can review the preliminary schedule and pencil mark an open shift', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const makePreliminary = await ctx!.supabase
      .from('schedule_cycles')
      .update({ status: 'preliminary' })
      .eq('id', ctx!.draftCycle.id)

    if (makePreliminary.error) throw new Error(makePreliminary.error.message)

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/preliminary')
    await expect(page.getByRole('heading', { name: 'Preliminary Schedule' })).toBeVisible()
    await expect(page.getByText('Team schedule overview')).toBeVisible()

    const openShiftCard = page
      .locator('article')
      .filter({
        has: page.getByText(new RegExp(formatPreliminaryShiftLabel(ctx!.draftCycle.openShiftDate))),
      })
      .filter({ has: page.getByText('Help needed') })
      .first()

    await expect(openShiftCard).toBeVisible()
    await openShiftCard.getByRole('button', { name: "I'll take this" }).click()

    await expect(page.getByRole('heading', { name: 'Pending pencil marks' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Wants to work this day').first()).toBeVisible()
    await expect(
      page
        .locator('article')
        .filter({
          has: page.getByText(
            new RegExp(formatPreliminaryShiftLabel(ctx!.draftCycle.openShiftDate))
          ),
        })
        .filter({ has: page.getByText('Open') })
        .first()
    ).toBeVisible()
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

    await page.goto(`/coverage?cycle=${ctx!.publishedCycle.id}&view=roster&shift=day`)
    await expectShiftTabActive(page, 'day')

    const targetShift = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', ctx!.publishedCycle.id)
      .eq('user_id', ctx!.therapist.id)
      .eq('date', ctx!.publishedCycle.shiftDate)
      .maybeSingle()

    if (targetShift.error || !targetShift.data?.id) {
      throw new Error(targetShift.error?.message ?? 'Could not find assignment status test shift.')
    }

    const assignmentStatusUrl = new URL('/api/schedule/assignment-status', page.url())
    const response = await page.request.post(assignmentStatusUrl.toString(), {
      headers: {
        Origin: assignmentStatusUrl.origin,
      },
      data: {
        assignmentId: targetShift.data.id,
        status: 'call_in',
      },
    })
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

  test('manager can approve the pending preliminary pencil mark and sync it into the draft', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/preliminary')
    await expect(page.getByRole('heading', { name: 'Preliminary Schedule' })).toBeVisible()

    const markSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Pending pencil marks' }) })
      .first()

    await expect(markSection).toContainText(
      formatPreliminaryShiftLabel(ctx!.draftCycle.openShiftDate)
    )
    await markSection.getByRole('button', { name: 'Approve' }).first().click()
    await expect(page.getByText('Preliminary pencil mark reviewed.').first()).toBeVisible({
      timeout: 20_000,
    })

    await expect
      .poll(async () => {
        const snapshotId =
          (
            await ctx!.supabase
              .from('preliminary_snapshots')
              .select('id')
              .eq('cycle_id', ctx!.draftCycle.id)
              .maybeSingle()
          ).data?.id ?? ''

        const mark = await ctx!.supabase
          .from('preliminary_cell_marks')
          .select('status')
          .eq('requester_id', ctx!.therapist.id)
          .eq('snapshot_id', snapshotId)
          .eq('date', ctx!.draftCycle.openShiftDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (mark.error) throw new Error(mark.error.message)
        return mark.data?.status ?? null
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
    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('notifications')
          .select('id')
          .eq('user_id', ctx!.therapist.id)
          .is('read_at', null)
        if (result.error) throw new Error(result.error.message)
        return result.data?.length ?? 0
      })
      .toBe(0)
  })

  test('therapist can create a request and manager can deny it from the shift board', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const requestMessage = `Need coverage for family event ${randomString('post')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/requests/new?new=1')
    await expect(page.getByText('Which shift are you trying to change?').first()).toBeVisible()
    await page.getByRole('button', { name: 'Need coverage' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Request summary').first()).toBeVisible()
    await page.getByLabel(/Message/).fill(requestMessage)
    await page.getByRole('button', { name: 'Submit request' }).click()
    let deniedPostId: string | null = null
    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('shift_posts')
            .select('id, status')
            .eq('posted_by', ctx!.therapist.id)
            .eq('message', requestMessage)
            .maybeSingle()

          if (result.error) throw new Error(result.error.message)
          deniedPostId = result.data?.id ?? null
          return result.data?.status ?? null
        },
        { timeout: 20_000 }
      )
      .toBe('pending')

    const managerContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    try {
      await loginAs(managerPage, ctx!.manager.email, ctx!.manager.password)
      await gotoWithRetry(managerPage, '/shift-board')
      await managerPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
      await expect(managerPage.getByRole('heading', { name: 'Shift Board' })).toBeVisible({
        timeout: 20_000,
      })

      await managerPage.getByRole('button', { name: /Open coverage requests -/ }).click()
      await expect(managerPage.locator('main')).toContainText(requestMessage, { timeout: 20_000 })
      const denyResult = await ctx!.supabase
        .from('shift_posts')
        .update({ status: 'denied' })
        .eq('id', deniedPostId)
      if (denyResult.error) throw new Error(denyResult.error.message)

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

  test('pickup request can be approved and transfer the shift to a claimant', async ({
    page,
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const requestMessage = `Claimable pickup ${randomString('pickup')}`

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/requests/new?new=1')
    await page.getByRole('button', { name: 'Need coverage' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel(/Message/).fill(requestMessage)
    const createResponsePromise = waitForShiftPostMutation(page)
    await page.getByRole('button', { name: 'Submit request' }).click()
    const createResponse = await createResponsePromise
    const createBody = await createResponse.json().catch(() => null)
    expect(createResponse.ok(), JSON.stringify(createBody)).toBe(true)

    let postId: string | null = null
    let shiftId: string | null = null
    await expect
      .poll(async () => {
        const post = await ctx!.supabase
          .from('shift_posts')
          .select('id, shift_id')
          .eq('posted_by', ctx!.therapist.id)
          .eq('message', requestMessage)
          .maybeSingle()

        if (post.error) throw new Error(post.error.message)
        postId = post.data?.id ?? null
        shiftId = post.data?.shift_id ?? null
        return postId !== null
      })
      .toBe(true)

    const interestId = await seedSelectedPickupInterest({
      supabase: ctx!.supabase,
      postId: postId!,
      therapistId: ctx!.claimant.id,
    })

    await approvePickupFromShiftBoard({
      browser,
      supabase: ctx!.supabase,
      requestId: postId!,
      selectedInterestId: interestId,
      shiftId: shiftId!,
      claimantId: ctx!.claimant.id,
      requestMessage,
      manager: ctx!.manager,
    })

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
          .eq('id', shiftId!)
          .maybeSingle()

        if (shift.error) throw new Error(shift.error.message)
        return shift.data?.user_id ?? null
      })
      .toBe(ctx!.claimant.id)
  })

  test('manager can force approve a lead-gap pickup with an override reason', async ({
    browser,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    const requestMessage = `Lead override pickup ${randomString('override')}`
    const overrideReason = `Override accepted ${randomString('reason')}`

    const leadShift = await ctx!.supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', ctx!.publishedCycle.id)
      .eq('user_id', ctx!.lead.id)
      .eq('date', ctx!.publishedCycle.leadRequestShiftDate)
      .eq('shift_type', 'day')
      .single()
    if (leadShift.error || !leadShift.data?.id) {
      throw new Error(leadShift.error?.message ?? 'Could not find lead pickup shift.')
    }

    const postInsert = await ctx!.supabase
      .from('shift_posts')
      .insert({
        shift_id: leadShift.data.id,
        posted_by: ctx!.lead.id,
        type: 'pickup',
        visibility: 'team',
        status: 'pending',
        request_kind: 'standard',
        message: requestMessage,
      })
      .select('id, shift_id')
      .single()
    if (postInsert.error || !postInsert.data?.id || !postInsert.data.shift_id) {
      throw new Error(postInsert.error?.message ?? 'Could not seed lead pickup request.')
    }

    const postId = postInsert.data.id
    const shiftId = postInsert.data.shift_id

    const interestId = await seedSelectedPickupInterest({
      supabase: ctx!.supabase,
      postId,
      therapistId: ctx!.claimant.id,
    })

    await approvePickupFromShiftBoard({
      browser,
      supabase: ctx!.supabase,
      requestId: postId,
      selectedInterestId: interestId,
      shiftId,
      claimantId: ctx!.claimant.id,
      requestMessage,
      manager: ctx!.manager,
      overrideReason,
    })

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
          .eq('id', shiftId!)
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
    await expect(page.getByRole('heading', { name: 'Publish History' })).toBeVisible()
    const publishRow = page
      .locator('tr')
      .filter({ has: page.getByText(publishReady.label).first() })
      .first()
    await expect(publishRow).toBeVisible()
    await publishRow.getByRole('button', { name: 'Take offline' }).click()
    await expect(
      page.getByText(
        'Schedule block taken offline. Assignments were preserved, staff live views are hidden, and new trade or coverage requests stay paused until you republish.'
      )
    ).toBeVisible({
      timeout: 20_000,
    })

    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('schedule_cycles')
          .select('published, status')
          .eq('id', publishReady.cycleId)
          .maybeSingle()

        if (result.error) throw new Error(result.error.message)
        return result.data ? `${result.data.status}:${result.data.published}` : null
      })
      .toBe('offline:false')
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

    const startDate = await nextAvailableCycleStart(ctx!.supabase, 1460)
    const startKey = formatDateKey(startDate)
    const endKey = formatDateKey(addDays(startDate, 41))
    const label = `Coverage Dialog ${randomString('cycle')}`

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label,
        start_date: startKey,
        end_date: endKey,
        published: false,
        status: 'draft',
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create draft cycle.')
    }

    const cycleId = cycleInsert.data.id

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
    const sent = await ctx!.supabase.rpc('app_send_preliminary_schedule', {
      p_actor_id: ctx!.manager.id,
      p_cycle_id: draftCycle.cycleId,
    })
    expect(sent.error).toBeNull()
    expect(sent.data?.[0]?.was_refresh).toBe(false)

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

    const refreshed = await ctx!.supabase.rpc('app_send_preliminary_schedule', {
      p_actor_id: ctx!.manager.id,
      p_cycle_id: draftCycle.cycleId,
    })
    expect(refreshed.error).toBeNull()
    expect(refreshed.data?.[0]?.was_refresh).toBe(true)
  })

  test('manager can reach the planning and admin surfaces', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run role journeys.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await expect(page).toHaveURL(/\/dashboard\/manager(?:[/?].*)?$/)
    await expect(page.getByRole('heading', { name: 'Manager Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible()
    await expect(page.getByText(/coverage safety issues/i).first()).toBeVisible()

    await page.goto(`/availability?cycle=${ctx!.draftCycle.id}&therapist=${ctx!.therapist.id}`)
    await expect(page.getByRole('heading', { name: 'Availability Manager' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Needs submission/ }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Availability editor/ })).toBeVisible()

    await page.goto('/team')
    await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Managers' })).toBeVisible()

    await page.goto('/requests')
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Trade & Coverage Requests' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'User Access Requests' })).toBeVisible()

    await gotoWithRetry(page, '/requests/user-access')
    await expect(page.getByRole('heading', { name: 'User Access Requests' })).toBeVisible()
    await expect(page.getByText(ctx!.pendingApproveUser.fullName).first()).toBeVisible()
    const approveRow = page
      .locator('tr, article')
      .filter({ has: page.getByText(ctx!.pendingApproveUser.fullName) })
      .first()
    const approveDialog = page.getByRole('dialog')
    const approveButton = approveRow.getByRole('button', { name: 'Approve' })
    await expect(approveButton).toBeEnabled()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await approveButton.click()
      if (await approveDialog.isVisible({ timeout: 1_000 }).catch(() => false)) break
      await page.waitForTimeout(500)
    }
    await expect(approveDialog).toBeVisible({ timeout: 10_000 })
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
    const declineRow = page
      .locator('tr, article')
      .filter({ has: page.getByText(ctx!.pendingDeclineUser.fullName) })
      .first()
    await declineRow.getByRole('button', { name: 'Decline' }).click()
    const declineDialog = page.getByRole('dialog', { name: 'Decline access request' })
    await expect(declineDialog).toBeVisible()
    const declineResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/requests/user-access'),
      { timeout: 30_000 }
    )
    await declineDialog.getByRole('button', { name: 'Decline' }).click()
    const declined = await declineResponse
    expect(declined.ok(), await declined.text()).toBe(true)
    await expect
      .poll(async () => {
        const result = await ctx!.supabase
          .from('profiles')
          .select('id')
          .eq('id', ctx!.pendingDeclineUser.id)
          .maybeSingle()
        if (result.error) throw new Error(result.error.message)
        return result.data?.id ?? null
      })
      .toBeNull()
    await expect(page.getByText(ctx!.pendingDeclineUser.fullName)).toHaveCount(0)

    await page.goto('/publish')
    await expect(page.getByRole('heading', { name: 'Publish History' })).toBeVisible()
    await expect(page.getByText(ctx!.publishedCycle.label).first()).toBeVisible()
    await expect(page.getByText(ctx!.draftCycle.label).first()).toBeVisible()
  })
})
