import { NextResponse } from 'next/server'

import type { ScheduleMutationErrorCode } from '@/lib/schedule-mutations/errors'

export function scheduleMutationErrorResponse(
  error: string,
  code: ScheduleMutationErrorCode,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error, code, ...extra }, { status })
}
