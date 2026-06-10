import { captureException, withScope } from '@sentry/core'

type StructuredLogLevel = 'info' | 'warn' | 'error'
type SafeLogValue = string | number | boolean | null | undefined
type SafeLogContext = Record<string, SafeLogValue>

type StructuredLogEntry = {
  ts: string
  level: StructuredLogLevel
  event: string
} & Record<string, string | number | boolean | null>

export function buildStructuredLogEntry({
  level,
  event,
  context = {},
  now = new Date(),
}: {
  level: StructuredLogLevel
  event: string
  context?: SafeLogContext
  now?: Date
}): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    ts: now.toISOString(),
    level,
    event,
  }

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue
    entry[key] = value
  }

  return entry
}

export function logStructuredEvent(
  level: StructuredLogLevel,
  event: string,
  context: SafeLogContext = {}
) {
  const line = JSON.stringify(buildStructuredLogEntry({ level, event, context }))

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

export function captureSafeException(event: string, context: SafeLogContext = {}) {
  try {
    withScope((scope) => {
      scope.setTag('event', event)
      for (const [key, value] of Object.entries(context)) {
        if (value === undefined || value === null) continue
        scope.setContext(key, { value })
      }
      captureException(new Error(event))
    })
  } catch {
    logStructuredEvent('warn', 'observability.sentry_capture_failed', { source_event: event })
  }
}
