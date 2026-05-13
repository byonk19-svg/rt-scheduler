import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type PencilCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  therapist: { id: string; email: string; password: string }
  cycleId: string
  snapshotId: string
  assignedShiftId: string
  assignedDate: string
  replacementDate: string
}

test.describe.serial('preliminary pencil marks', () => {
  test.setTimeout(120_000)

  let ctx: PencilCtx | null = null
  const createdUserIds: string[] = []
  const suspendedSnapshotIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const existingActiveSnapshots = await supabase
      .from('preliminary_snapshots')
      .select('id')
      .eq('status', 'active')

    if (existingActiveSnapshots.error) throw new Error(existingActiveSnapshots.error.message)
    suspendedSnapshotIds.push(...(existingActiveSnapshots.data ?? []).map((row) => row.id))
    if (suspendedSnapshotIds.length > 0) {
      const suspend = await supabase
        .from('preliminary_snapshots')
        .update({ status: 'superseded' })
        .in('id', suspendedSnapshotIds)
      if (suspend.error) throw new Error(suspend.error.message)
    }

    const managerEmail = `${randomString('pencil-manager')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Pencil Mark Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const therapistEmail = `${randomString('pencil-staff')}@example.com`
    const therapistPassword = `Staff!${Math.random().toString(16).slice(2, 10)}`
    const therapist = await createE2EUser(supabase, {
      email: therapistEmail,
      password: therapistPassword,
      fullName: 'Pencil Mark Staff',
      role: 'therapist',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: false,
    })
    createdUserIds.push(therapist.id)

    const start = addDays(new Date(), 21)
    const assignedDate = formatDateKey(start)
    const replacementDate = formatDateKey(addDays(start, 1))

    const cycle = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Pencil Marks ${randomString('cycle')}`,
        start_date: assignedDate,
        end_date: replacementDate,
        published: false,
        status: 'preliminary',
      })
      .select('id')
      .single()

    if (cycle.error || !cycle.data) {
      throw new Error(cycle.error?.message ?? 'Could not seed pencil mark cycle.')
    }

    const shift = await supabase
      .from('shifts')
      .insert({
        cycle_id: cycle.data.id,
        user_id: therapist.id,
        date: assignedDate,
        shift_type: 'day',
        status: 'scheduled',
        assignment_status: 'scheduled',
        role: 'staff',
      })
      .select('id')
      .single()

    if (shift.error || !shift.data) {
      throw new Error(shift.error?.message ?? 'Could not seed pencil mark shift.')
    }

    const snapshot = await supabase
      .from('preliminary_snapshots')
      .insert({
        cycle_id: cycle.data.id,
        created_by: manager.id,
        sent_at: new Date().toISOString(),
        status: 'active',
      })
      .select('id')
      .single()

    if (snapshot.error || !snapshot.data) {
      throw new Error(snapshot.error?.message ?? 'Could not seed preliminary snapshot.')
    }

    const shiftState = await supabase.from('preliminary_shift_states').insert({
      snapshot_id: snapshot.data.id,
      shift_id: shift.data.id,
      state: 'tentative_assignment',
      reserved_by: therapist.id,
    })

    if (shiftState.error) throw new Error(shiftState.error.message)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      therapist: { id: therapist.id, email: therapistEmail, password: therapistPassword },
      cycleId: cycle.data.id,
      snapshotId: snapshot.data.id,
      assignedShiftId: shift.data.id,
      assignedDate,
      replacementDate,
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    await ctx.supabase.from('publish_events').delete().eq('cycle_id', ctx.cycleId)
    await ctx.supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('preliminary_snapshots').delete().eq('cycle_id', ctx.cycleId)
    await ctx.supabase.from('availability_overrides').delete().eq('cycle_id', ctx.cycleId)
    await ctx.supabase.from('shifts').delete().eq('cycle_id', ctx.cycleId)
    await ctx.supabase.from('schedule_cycles').delete().eq('id', ctx.cycleId)

    if (suspendedSnapshotIds.length > 0) {
      await ctx.supabase
        .from('preliminary_snapshots')
        .update({ status: 'active' })
        .in('id', suspendedSnapshotIds)
    }

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('staff pencil marks a trade and manager approval makes it publishable', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run seeded e2e tests.')

    await loginAs(page, ctx!.therapist.email, ctx!.therapist.password)
    await page.goto('/preliminary', { waitUntil: 'domcontentloaded' })

    const assignedCard = page.locator(`#preliminary-shift-${ctx!.assignedShiftId}`)
    await expect(assignedCard.getByText('Pencil Mark Staff')).toBeVisible()
    await assignedCard.locator('input[name="replacement_date"]').fill(ctx!.replacementDate)
    await assignedCard.getByRole('button', { name: 'Remove me' }).click()
    await expect(page.getByText('Your pencil mark was saved for manager review.')).toBeVisible()

    await expect
      .poll(async () => {
        const marks = await ctx!.supabase
          .from('preliminary_cell_marks')
          .select('mark_type,status')
          .eq('snapshot_id', ctx!.snapshotId)
          .order('mark_type')
        if (marks.error) throw new Error(marks.error.message)
        return (marks.data ?? []).map((mark) => `${mark.mark_type}:${mark.status}`).join(',')
      })
      .toBe('add_work:pending,mark_off:pending')

    await expect
      .poll(async () => {
        const notification = await ctx!.supabase
          .from('notifications')
          .select('title,message')
          .eq('event_type', 'preliminary_request_submitted')
          .eq('user_id', ctx!.manager.id)
          .maybeSingle()
        if (notification.error) throw new Error(notification.error.message)
        return notification.data ? `${notification.data.title}: ${notification.data.message}` : null
      })
      .toBe(
        'Preliminary pencil mark waiting: A therapist added a preliminary pencil mark for manager review.'
      )

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/preliminary', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Pencil mark: Marked out scheduled day')).toBeVisible()
    await expect(page.getByText('Pencil mark: Wants to work this day')).toBeVisible()
    await expect(page.getByText('No draft row yet')).toBeVisible()
    await page.getByRole('button', { name: 'Approve' }).first().click()
    await expect(page.getByText('Preliminary pencil mark reviewed.')).toBeVisible()

    await expect
      .poll(async () => {
        const marks = await ctx!.supabase
          .from('preliminary_cell_marks')
          .select('mark_type,status')
          .eq('snapshot_id', ctx!.snapshotId)
          .order('mark_type')
        if (marks.error) throw new Error(marks.error.message)
        return (marks.data ?? []).map((mark) => `${mark.mark_type}:${mark.status}`).join(',')
      })
      .toBe('add_work:approved,mark_off:approved')

    await expect
      .poll(async () => {
        const oldShift = await ctx!.supabase
          .from('shifts')
          .select('user_id')
          .eq('id', ctx!.assignedShiftId)
          .maybeSingle()
        if (oldShift.error) throw new Error(oldShift.error.message)
        return oldShift.data?.user_id ?? null
      })
      .toBeNull()

    await expect
      .poll(async () => {
        const newShift = await ctx!.supabase
          .from('shifts')
          .select('user_id')
          .eq('cycle_id', ctx!.cycleId)
          .eq('date', ctx!.replacementDate)
          .eq('shift_type', 'day')
          .maybeSingle()
        if (newShift.error) throw new Error(newShift.error.message)
        return newShift.data?.user_id ?? null
      })
      .toBe(ctx!.therapist.id)

    const publish = await ctx!.supabase.rpc('app_publish_schedule_cycle', {
      p_actor_id: ctx!.manager.id,
      p_cycle_id: ctx!.cycleId,
    })
    expect(publish.error).toBeNull()

    await expect
      .poll(async () => {
        const cycle = await ctx!.supabase
          .from('schedule_cycles')
          .select('published,status')
          .eq('id', ctx!.cycleId)
          .maybeSingle()
        if (cycle.error) throw new Error(cycle.error.message)
        return `${cycle.data?.published}:${cycle.data?.status}`
      })
      .toBe('true:final')
  })
})
