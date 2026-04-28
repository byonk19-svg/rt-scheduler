import { isDynamicUsageError } from 'next/dist/export/helpers/is-dynamic-usage-error'

export function shouldIgnoreAuthenticatedLayoutError(error: unknown): boolean {
  return isDynamicUsageError(error)
}
