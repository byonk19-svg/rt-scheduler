import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type StaffPagesCtx = {
  supabase: SupabaseClient
  therapist: { id: string; email: string; password: string }
  partner: { id: string; fullName: string }
  cycleId: string
  shiftDate: string
  historyMessage: string
}

test.describe.serial('staff personal schedule pages', () => {
  test.setTimeout(90_000)

  let ctx: StaffPagesCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const therapistEmail = `${randomString('staff-pages-ther')}@example.com`
    const therapistPassword = `Ther!${Math.random().toString(16).slice(2, 10)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: 'Staff Pages Therapist',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    const partnerFullName = `Staff Pages Partner ${randomString('partner')}`
    const partner = await createE2EUser(supabase, {
      email: `${randomString('staff-pages-partner')}@example.com`,
      password: `Part!${Math.random().toString(16).slice(2, 10)}`,
      fullName: partnerFullName,
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })

    createdUserIds.push(therapist.id, partner.id)

    const shiftDate = formatDateKey(addDays(new Date(), 7))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Staff Personal Pages ${randomString('cycle')}`,
        start_date: shiftDate,
        end_date: formatDateKey(addDays(new Date(`${shiftDate}T00:00:00`), 41)),
        published: true,
      })
      .select('id')
      .single()
    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create staff pages cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftInsert = await supabase
      .from('shifts')
      .insert({
        cycle_id: cycleInsert.data.id,
        user_id: therapist.id,
        date: shiftDate,
        shift_type: 'day',
        role: 'staff',
        status: 'scheduled',
        assignment_status: 'scheduled',
      })
      .select('id')
      .single()
    if (shiftInsert.error || !shiftInsert.data) {
      throw new Error(shiftInsert.error?.message ?? 'Could not create staff pages shift.')
    }

    const historyMessage = `History pickup ${randomString('history')}`
    const postInsert = await supabase.from('shift_posts').insert({
      shift_id: shiftInsert.data.id,
      posted_by: therapist.id,
      claimed_by: partner.id,
      type: 'pickup',
      status: 'approved',
      visibility: 'team',
      request_kind: 'standard',
      message: historyMessage,
    })
    if (postInsert.error) {
      throw new Error(postInsert.error.message)
    }

    ctx = {
      supabase,
      therapist: { id: therapist.id, email: therapistEmail, password: therapistPassword },
      partner: { id: partner.id, fullName: partnerFullName },
      cycleId: cycleInsert.data.id,
      shiftDate,
      historyMessage,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('shift_posts').delete().in('posted_by', createdUserIds)
    await ctx.supabase.from('shift_posts').delete().in('claimed_by', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('therapist My Schedule and History render seeded live data', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run staff pages e2e.')

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)

    await page.goto('/staff/my-schedule')
    await expect(page.getByRole('heading', { name: 'My Shifts' })).toBeVisible()
    await expect(page.getByText('Upcoming shifts from published schedules only.')).toBeVisible()
    await expect(page.getByText('day', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/1 shift this week/i)).toBeVisible()

    await page.goto('/staff/history')
    await expect(page.getByRole('heading', { name: 'Shift Swaps & Pickups History' })).toBeVisible()
    await expect(page.getByText(ctx!.historyMessage)).toBeVisible()
    await expect(page.getByText('Posted', { exact: true })).toBeVisible()
    await expect(page.getByText('Approved', { exact: true })).toBeVisible()
  })
})
