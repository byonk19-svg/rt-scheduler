import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { queueAndSendShiftReminders } from '@/lib/shift-reminders'

export async function GET(request: Request) {
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/shift-reminders] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron not configured.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const adminClient = createAdminClient()
    const result = await queueAndSendShiftReminders(adminClient, new Date())
    return NextResponse.json(result)
  } catch (error) {
    console.error('[cron/shift-reminders] Failed to process reminders:', error)
    return NextResponse.json({ error: 'Failed to process shift reminders.' }, { status: 500 })
  }
}
