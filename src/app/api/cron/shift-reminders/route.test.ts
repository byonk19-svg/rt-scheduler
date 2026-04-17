import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('shift reminders cron source contract', () => {
  it('uses the same Bearer CRON_SECRET auth pattern and admin client trigger', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/cron/shift-reminders/route.ts'),
      'utf8'
    )

    expect(source).toContain('const cronSecret = process.env.CRON_SECRET')
    expect(source).toContain('if (authHeader !== `Bearer ${cronSecret}`)')
    expect(source).toContain('createAdminClient')
    expect(source).toContain('queueAndSendShiftReminders')
  })

  it('adds the shift reminders cron schedule to vercel.json', () => {
    const source = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')
    expect(source).toContain('/api/cron/shift-reminders')
    expect(source).toContain('0 6 * * *')
  })
})
