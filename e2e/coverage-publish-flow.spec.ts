import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loginAs } from './helpers/auth'
import { addDays, formatDateKey, randomString } from './helpers/env'
import { createE2EUser, createServiceRoleClientOrNull } from './helpers/supabase'

type PublishFlowCtx = {
  supabase: SupabaseClient
  manager: { id: string; email: string; password: string }
  cycleId: string
}

async function submitPublishForm(page: Page, buttonName: string) {
  const button = page.getByRole('button', { name: buttonName }).first()
  await expect(button).toBeVisible()
  await button.click()
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(750)
}

function nextSundayAfter(date: Date, minimumDaysAhead: number) {
  const next = addDays(date, minimumDaysAhead)
  const day = next.getDay()
  return addDays(next, (7 - day) % 7)
}

test.describe.serial('coverage publish flow', () => {
  test.setTimeout(120_000)

  let ctx: PublishFlowCtx | null = null
  const createdUserIds: string[] = []
  const createdCycleIds: string[] = []

  test.beforeAll(async () => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) return

    const managerEmail = `${randomString('pub-mgr')}@example.com`
    const managerPassword = `Mngr!${Math.random().toString(16).slice(2, 10)}`
    const manager = await createE2EUser(supabase, {
      email: managerEmail,
      password: managerPassword,
      fullName: 'Coverage Publish Manager',
      role: 'manager',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(manager.id)

    const cycleStart = nextSundayAfter(new Date(), 8000 + Math.floor(Math.random() * 3650))
    const cycleDate = formatDateKey(cycleStart)
    const cycleEndDate = formatDateKey(addDays(cycleStart, 41))
    const cycleInsert = await supabase
      .from('schedule_cycles')
      .insert({
        label: `Publish Coverage ${randomString('cycle')}`,
        start_date: cycleDate,
        end_date: cycleEndDate,
        published: false,
        status: 'preliminary',
      })
      .select('id')
      .single()

    if (cycleInsert.error || !cycleInsert.data) {
      throw new Error(cycleInsert.error?.message ?? 'Could not create publish test cycle.')
    }
    createdCycleIds.push(cycleInsert.data.id)

    // Seed the full six-week block with exactly one designated lead for every
    // day/night slot. Coverage remains intentionally below minimum so the browser
    // exercises the manager override flow before the final RPC accepts publish.
    const dayLead = await createE2EUser(supabase, {
      email: `${randomString('pub-day-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Lead ${randomString('staff')}`,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'day',
      isLeadEligible: true,
    })
    createdUserIds.push(dayLead.id)

    const nightLead = await createE2EUser(supabase, {
      email: `${randomString('pub-night-lead')}@example.com`,
      password: `Lead!${Math.random().toString(16).slice(2, 10)}`,
      fullName: `Publish Night Lead ${randomString('staff')}`,
      role: 'lead',
      employmentType: 'full_time',
      shiftType: 'night',
      isLeadEligible: true,
    })
    createdUserIds.push(nightLead.id)

    const shiftsInsert = await supabase.from('shifts').insert(
      Array.from({ length: 42 }, (_, index) => {
        const date = formatDateKey(addDays(cycleStart, index))
        return [
          {
            cycle_id: cycleInsert.data.id,
            user_id: dayLead.id,
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

    if (shiftsInsert.error) {
      throw new Error(shiftsInsert.error.message)
    }

    const preliminarySnapshot = await supabase.from('preliminary_snapshots').insert({
      cycle_id: cycleInsert.data.id,
      created_by: manager.id,
      sent_at: new Date().toISOString(),
      status: 'active',
    })

    if (preliminarySnapshot.error) {
      throw new Error(preliminarySnapshot.error.message)
    }

    ctx = {
      supabase,
      manager: { id: manager.id, email: managerEmail, password: managerPassword },
      cycleId: cycleInsert.data.id,
    }
  })

  test.afterAll(async () => {
    const supabase = ctx?.supabase ?? createServiceRoleClientOrNull()
    if (!supabase) return

    if (createdCycleIds.length > 0) {
      await supabase.from('publish_events').delete().in('cycle_id', createdCycleIds)
      await supabase.from('shifts').delete().in('cycle_id', createdCycleIds)
      await supabase.from('schedule_cycles').delete().in('id', createdCycleIds)
    }

    if (createdUserIds.length > 0) {
      await supabase.from('notification_outbox').delete().in('user_id', createdUserIds)
      await supabase.from('notifications').delete().in('user_id', createdUserIds)
    }

    for (const userId of createdUserIds) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined)
    }
  })

  test('manager can publish from the coverage override form', async ({ page }) => {
    test.skip(!ctx, 'Supabase service env values are required to run publish flow e2e.')

    await loginAs(page, ctx!.manager.email, ctx!.manager.password)
    await page.goto(`/coverage?cycle=${ctx!.cycleId}&view=week`)
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()
    const requests: Array<{ url: string; method: string; postData?: string | null }> = []
    const responses: Array<{ url: string; status: number }> = []
    const failures: Array<{ url: string; failure: string | null }> = []
    page.on('request', (request) => {
      requests.push({ url: request.url(), method: request.method(), postData: request.postData() })
    })
    page.on('response', (response) => {
      responses.push({ url: response.url(), status: response.status() })
    })
    page.on('requestfailed', (request) => {
      failures.push({ url: request.url(), failure: request.failure()?.errorText ?? null })
    })
    await submitPublishForm(page, 'Publish')

    await expect.poll(async () => requests.some((request) => request.method === 'POST')).toBe(true)

    const cyclePublished = async () => {
      const cycle = await ctx!.supabase
        .from('schedule_cycles')
        .select('published')
        .eq('id', ctx!.cycleId)
        .maybeSingle()

      if (cycle.error) throw new Error(cycle.error.message)
      return cycle.data?.published === true
    }

    if (!(await cyclePublished())) {
      await expect(page.getByText(/Weekly workload rule failed/i).first()).toBeVisible({
        timeout: 30_000,
      })
      await submitPublishForm(page, 'Publish with weekly override')
    }

    if (!(await cyclePublished())) {
      await expect(page.getByText(/Publish blocked\. Coverage under:/i).first()).toBeVisible({
        timeout: 30_000,
      })
      await submitPublishForm(page, 'Publish with shift override')
    }

    if (!(await cyclePublished())) {
      await expect(page.getByText(/Missing availability for/i).first()).toBeVisible({
        timeout: 30_000,
      })
      await submitPublishForm(page, 'Acknowledge and publish')
    }

    await expect
      .poll(
        async () => {
          return await cyclePublished()
        },
        {
          timeout: 60_000,
          message: `url=${page.url()} requests=${JSON.stringify(requests)} responses=${JSON.stringify(responses)} failures=${JSON.stringify(failures)}`,
        }
      )
      .toBe(true)

    await page.reload()
    await expect(page.getByText(/Published/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
