export type AvailabilityFeedbackVariant = 'success' | 'error'

export type AvailabilityFeedback = {
  message: string
  variant: AvailabilityFeedbackVariant
}

export type AvailabilityFeedbackSearchParams = {
  copied?: string | string[]
  error?: string | string[]
  success?: string | string[]
}

export function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function getCommonAvailabilityFeedback(
  params?: AvailabilityFeedbackSearchParams,
  options?: {
    deleteFailedMessage?: string
  }
): AvailabilityFeedback | null {
  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)

  if (error === 'duplicate_entry') {
    return {
      message:
        'You already had an availability request for that date and shift in this cycle. We updated it.',
      variant: 'success',
    }
  }

  if (error === 'submit_failed') {
    return {
      message: "Couldn't save availability. Try again.",
      variant: 'error',
    }
  }

  if (error === 'submission_closed') {
    return {
      message: 'Availability changes are closed for this cycle.',
      variant: 'error',
    }
  }

  if (success === 'entry_submitted') {
    return {
      message: 'Availability saved and submitted for this cycle.',
      variant: 'success',
    }
  }

  if (success === 'draft_saved') {
    return {
      message: "Draft saved. Submit availability when you're ready.",
      variant: 'success',
    }
  }

  if (success === 'entry_deleted') {
    return {
      message: 'Availability request deleted.',
      variant: 'success',
    }
  }

  if (error === 'delete_failed') {
    return {
      message: options?.deleteFailedMessage ?? "Couldn't delete that request. Try again.",
      variant: 'error',
    }
  }

  return null
}
