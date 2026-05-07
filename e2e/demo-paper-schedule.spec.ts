import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { loginAs } from './helpers/auth'
import { createServiceRoleClientOrNull } from './helpers/supabase'

function reseedPaperScheduleDemo() {
  execFileSync(
    process.execPath,
    ['--env-file=.env.local', 'scripts/seed-demo-schedule.mjs', '--confirm-demo-schedule'],
    {
      cwd: process.cwd(),
      stdio: 'pipe',
    }
  )
}

test.describe.serial('paper schedule demo seed', () => {
  test.setTimeout(120_000)

  test('seeds and renders the May-Jun 2026 schedule block', async ({ page }) => {
    const supabase = createServiceRoleClientOrNull()
    if (!supabase) {
      test.skip(true, 'Missing service-role Supabase env for seeded smoke check.')
      return
    }

    reseedPaperScheduleDemo()

    const { data: cycle, error: cycleError } = await supabase
      .from('schedule_cycles')
      .select('id, label, start_date, end_date')
      .eq('label', 'RT Paper Demo May 3-Jun 13 2026')
      .maybeSingle()

    if (cycleError || !cycle) {
      throw new Error(cycleError?.message ?? 'Paper demo schedule cycle was not seeded.')
    }

    const { count: shiftCount, error: shiftError } = await supabase
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycle.id)

    if (shiftError) {
      throw new Error(`Could not count seeded shifts: ${shiftError.message}`)
    }
    expect(shiftCount ?? 0).toBeGreaterThan(0)

    await loginAs(page, 'paper-demo-manager@paper-demo.teamwise.test', 'Teamwise123!')
    await page.goto(`/schedule?cycle=${cycle.id}`, { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', { name: /Respiratory Therapy - Day Shift/i })
    ).toBeVisible()
    await expect(page.getByText('RT Paper Demo May 3-Jun 13 2026')).toBeVisible()
    await expect(page.getByText('May 3')).toBeVisible()
    await expect(page.getByText('June 13')).toBeVisible()
    await expect(page.getByText('Adrienne')).toBeVisible()
    await expect(page.getByText('Brianna')).toBeVisible()

    await page.getByRole('button', { name: 'Night Shift' }).click()
    await expect(page.getByText('Lisa M')).toBeVisible()
    await expect(page.getByText('Irene')).toBeVisible()
  })
})
