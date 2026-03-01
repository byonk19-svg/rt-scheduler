import * as Sentry from '@sentry/nextjs'

type SentryCaptureContext = {
  tags?: Record<string, string>
  extras?: Record<string, unknown>
}

export function captureServerException(error: unknown, context?: SentryCaptureContext): void {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value)
      }
    }
    if (context?.extras) {
      for (const [key, value] of Object.entries(context.extras)) {
        scope.setExtra(key, value)
      }
    }
    Sentry.captureException(error)
  })
}
