type StructuredLogLevel = 'info' | 'warn' | 'error'

type StructuredLogFields = {
  event: string
  cycle_id?: string | null
  user_id?: string | null
  shift_id?: string | null
  therapist_id?: string | null
  assignment_id?: string | null
  publish_event_id?: string | null
  error_code?: string | null
  [key: string]: unknown
}

function compactFields(fields: StructuredLogFields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
}

export function logServerEvent(level: StructuredLogLevel, fields: StructuredLogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    ...compactFields(fields),
  }
  const line = JSON.stringify(payload)

  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.info(line)
}
