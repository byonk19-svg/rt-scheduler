import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type PublishLifecycleCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
}

function nextSundayAfter(date: Date, minimumDaysAhead: number) {
  const next = addDays(date, minimumDaysAhead)
  const day = next.getDay()
  return addDays(next, (7 - day) % 7)
}

async function submitPublishForm(page: Page, buttonName: string) {
  const button = page.getByRole('button', { name: buttonName }).first()
  await expect(button).toBeVisible({ timeout: 30_000 })
  await button.click()
  await page.waitForLoadState('networkidle').catch(() => undefined)
}

test.describe.serial('publish history lifecycle', () => {
  test.setTimeout(120_000)

  let ctx: PublishLifecycleCtx | null = null
  const dateOffsetBase = 14000 + Math.floor(Math.random() * 3650)
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []
  const createdPublishEventIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('publish-life-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Publish Lifecycle Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
    }
  })

  test.afterAll(async () => {
    if (!ctx) return

    const cycleEventIds =
      createdCycleIds.length > 0
        ? await ctx.supabase.from('publish_events').select('id').in('cycle_id', createdCycleIds)
        : { data: [], error: null }
    if (cycleEventIds.error) {
      throw new Error(cycleEventIds.error.message)
    }
    const publishEventIds = Array.from(
      new Set([
        ...createdPublishEventIds,
        ...((cycleEventIds.data ?? []) as Array<{ id: string }>).map((row) => row.id),
      ])
    )

    await ctx.supabase.from('notification_outbox').delete().in('publish_event_id', publishEventIds)
    await ctx.supabase.from('publish_events').delete().in('id', publishEventIds)
    await ctx.supabase.from('preliminary_snapshots').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('notifications').delete().in('user_id', createdUserIds)
    await ctx.supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
    await ctx.supabase.from('schedule_cycles').delete().in('id', createdCycleIds)

    for (const userId of createdUserIds) {
      await ctx.supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can open publish details for a failed event', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run publish lifecycle e2e.')

    const cycleDate = nextSundayAfter(new Date(), dateOffsetBase)
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: `Detail Cycle ${randomString('cycle')}`,
        start_date: formatDateKey(cycleDate),
        end_date: formatDateKey(addDays(cycleDate, 41)),
        published: false,
        status: 'draft',
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create detail cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const eventInsert = await ctx!.supabase
      .from('publish_events')
      .insert({
        cycle_id: cycleInsert.data.id,
        published_by: ctx!.manager.id,
        status: 'failed',
        recipient_count: 1,
        queued_count: 0,
        sent_count: 0,
        failed_count: 1,
        error_message: 'SMTP provider rejected the message.',
      })
      .select('id')
      .single()

    if (eventInsert.error || !eventInsert.data) {
      throw new Error(eventInsert.error?.message ?? 'Could not create failed publish event.')
    }
    createdPublishEventIds.push(eventInsert.data.id)

    const outboxInsert = await ctx!.supabase.from('notification_outbox').insert({
      publish_event_id: eventInsert.data.id,
      user_id: ctx!.manager.id,
      email: `failed-${randomString('mail')}@example.com`,
      name: 'Failed Recipient',
      channel: 'email',
      status: 'failed',
      attempt_count: 2,
      last_error: 'Mailbox rejected message',
    })

    if (outboxInsert.error) {
      throw new Error(outboxInsert.error.message)
    }

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/publish/${eventInsert.data.id}`)
    await expect(page.getByRole('heading', { name: 'Publish Details' })).toBeVisible()
    await expect(page.getByText('Failed Recipient').first()).toBeVisible()
    await expect(page.getByText('SMTP provider rejected the message.').first()).toBeVisible()
  })

  test('manager can delete a non-live publish history entry', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run publish lifecycle e2e.')

    const cycleDate = nextSundayAfter(new Date(), dateOffsetBase + 56)
    const cycleLabel = `Delete History ${randomString('cycle')}`
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: cycleLabel,
        start_date: formatDateKey(cycleDate),
        end_date: formatDateKey(addDays(cycleDate, 41)),
        published: false,
        status: 'draft',
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create delete-history cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const eventInsert = await ctx!.supabase
      .from('publish_events')
      .insert({
        cycle_id: cycleInsert.data.id,
        published_by: ctx!.manager.id,
        status: 'success',
        recipient_count: 0,
        queued_count: 0,
        sent_count: 0,
        failed_count: 0,
      })
      .select('id')
      .single()

    if (eventInsert.error || !eventInsert.data) {
      throw new Error(eventInsert.error?.message ?? 'Could not create delete-history event.')
    }
    createdPublishEventIds.push(eventInsert.data.id)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/publish')
    const eventRow = page
      .locator('tr')
      .filter({ has: page.getByText(cycleLabel).first() })
      .filter({ has: page.getByRole('button', { name: 'Delete history' }) })
      .first()
    await expect(eventRow).toBeVisible()
    await eventRow.getByRole('button', { name: 'Delete history' }).click()
    await expect(page).toHaveURL(/success=publish_event_deleted/, { timeout: 30_000 })

    await expect
      .poll(
        async () => {
          const result = await ctx!.supabase
            .from('publish_events')
            .select('id')
            .eq('id', eventInsert.data.id)
            .maybeSingle()
          if (result.error) throw new Error(result.error.message)
          return result.data?.id ?? null
        },
        { timeout: 30_000 }
      )
      .toBeNull()
  })

  test('manager can take a live cycle offline while preserving shifts and closing preliminary review', async ({
    page,
  }) => {
    test.skip(!ctx, 'Supabase service env values are required to run publish lifecycle e2e.')

    const cycleDate = nextSundayAfter(new Date(), dateOffsetBase + 112)
    const cycleLabel = `Offline Cycle ${randomString('cycle')}`
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: cycleLabel,
        start_date: formatDateKey(cycleDate),
        end_date: formatDateKey(addDays(cycleDate, 41)),
        published: true,
        status: 'final',
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create offline lifecycle cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const shiftInsert = await ctx!.supabase.from('shifts').insert({
      cycle_id: cycleInsert.data.id,
      user_id: ctx!.manager.id,
      date: formatDateKey(cycleDate),
      shift_type: 'day',
      status: 'scheduled',
      assignment_status: 'scheduled',
      role: 'lead',
    })
    if (shiftInsert.error) throw new Error(shiftInsert.error.message)

    const snapshotInsert = await ctx!.supabase
      .from('preliminary_snapshots')
      .insert({
        cycle_id: cycleInsert.data.id,
        created_by: ctx!.manager.id,
        status: 'active',
      })
      .select('id')
      .single()

    if (snapshotInsert.error || !snapshotInsert.data) {
      throw new Error(
        snapshotInsert.error?.message ?? 'Could not create active preliminary snapshot.'
      )
    }

    const eventInsert = await ctx!.supabase
      .from('publish_events')
      .insert({
        cycle_id: cycleInsert.data.id,
        published_by: ctx!.manager.id,
        status: 'success',
        recipient_count: 0,
        queued_count: 0,
        sent_count: 0,
        failed_count: 0,
      })
      .select('id')
      .single()

    if (eventInsert.error || !eventInsert.data) {
      throw new Error(eventInsert.error?.message ?? 'Could not create restart publish event.')
    }
    createdPublishEventIds.push(eventInsert.data.id)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/publish')
    const cycleRow = page
      .locator('tr')
      .filter({ has: page.getByText(cycleLabel).first() })
      .filter({ has: page.getByRole('button', { name: 'Take offline' }) })
      .first()
    await expect(cycleRow).toBeVisible()
    await expect(cycleRow.getByRole('button', { name: 'Clear & restart' })).toHaveCount(0)
    await cycleRow.getByRole('button', { name: 'Take offline' }).click()

    await expect
      .poll(async () => {
        const cycle = await ctx!.supabase
          .from('schedule_cycles')
          .select('published, status')
          .eq('id', cycleInsert.data.id)
          .maybeSingle()
        if (cycle.error) throw new Error(cycle.error.message)
        return cycle.data ? `${cycle.data.status}:${cycle.data.published}` : null
      })
      .toBe('offline:false')

    await expect
      .poll(async () => {
        const shifts = await ctx!.supabase
          .from('shifts')
          .select('id')
          .eq('cycle_id', cycleInsert.data.id)
        if (shifts.error) throw new Error(shifts.error.message)
        return (shifts.data ?? []).length
      })
      .toBe(1)

    await expect
      .poll(async () => {
        const snapshot = await ctx!.supabase
          .from('preliminary_snapshots')
          .select('status')
          .eq('id', snapshotInsert.data.id)
          .maybeSingle()
        if (snapshot.error) throw new Error(snapshot.error.message)
        return snapshot.data?.status ?? null
      })
      .toBe('superseded')
  })

  test('manager can republish an offline cycle from publish history', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run publish lifecycle e2e.')

    const cycleDate = nextSundayAfter(new Date(), dateOffsetBase + 168)
    const cycleLabel = `Republish Offline ${randomString('cycle')}`
    const cycleInsert = await ctx!.supabase
      .from('schedule_cycles')
      .insert({
        label: cycleLabel,
        start_date: formatDateKey(cycleDate),
        end_date: formatDateKey(addDays(cycleDate, 41)),
        published: false,
        status: 'offline',
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create republish cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    const nightLead = await createE2EUser(ctx!.supabase, {
      email: `${randomString('republish-night-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Republish Night Lead ${randomString('staff')}`,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: true,
    })
    createdUserIds.push(nightLead.id)

    const shiftsInsert = await ctx!.supabase.from('shifts').insert(
      Array.from({ length: 42 }, (_, index) => {
        const date = formatDateKey(addDays(cycleDate, index))
        return [
          {
            cycle_id: cycleInsert.data.id,
            user_id: ctx!.manager.id,
            date,
            shift_type: 'day',
            status: 'scheduled',
            assignment_status: 'scheduled',
            role: 'lead',
          },
          {
            cycle_id: cycleInsert.data.id,
            user_id: nightLead.id,
            date,
            shift_type: 'night',
            status: 'scheduled',
            assignment_status: 'scheduled',
            role: 'lead',
          },
        ]
      }).flat()
    )
    if (shiftsInsert.error) throw new Error(shiftsInsert.error.message)

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto('/publish')
    const cycleRow = page
      .locator('tr')
      .filter({ has: page.getByText(cycleLabel).first() })
      .filter({ has: page.getByRole('button', { name: 'Republish' }) })
      .first()
    await expect(cycleRow).toBeVisible()
    await cycleRow.getByRole('button', { name: 'Republish' }).click()

    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible({ timeout: 30_000 })

    const cyclePublished = async () => {
      const cycle = await ctx!.supabase
        .from('schedule_cycles')
        .select('published, status')
        .eq('id', cycleInsert.data.id)
        .maybeSingle()

      if (cycle.error) throw new Error(cycle.error.message)
      return cycle.data ? `${cycle.data.status}:${cycle.data.published}` : null
    }

    if ((await cyclePublished()) !== 'final:true') {
      await submitPublishForm(page, 'Publish with weekly override')
    }

    if ((await cyclePublished()) !== 'final:true') {
      await submitPublishForm(page, 'Publish with shift override')
    }

    if ((await cyclePublished()) !== 'final:true') {
      await submitPublishForm(page, 'Acknowledge and publish')
    }

    await expect
      .poll(cyclePublished, {
        timeout: 60_000,
        message: `url=${page.url()}`,
      })
      .toBe('final:true')
  })
})
