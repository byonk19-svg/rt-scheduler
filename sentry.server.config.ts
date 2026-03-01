import * as Sentry from '@sentry/nextjs'

function parseSampleRate(value: string | undefined): number {
  if (!value) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  if (parsed < 0) return 0
  if (parsed > 1) return 1
  return parsed
}

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
})
