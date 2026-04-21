import type { AvailabilityFeedback } from '@/lib/availability-page-helpers'
import { getCommonAvailabilityFeedback, getSearchParam } from '@/lib/availability-page-helpers'

export type AvailabilityRouteSearchParams = {
  copied?: string | string[]
  cycle?: string | string[]
  endDate?: string | string[]
  error?: string | string[]
  roster?: string | string[]
  search?: string | string[]
  sort?: string | string[]
  startDate?: string | string[]
  status?: string | string[]
  success?: string | string[]
  tab?: string | string[]
  therapist?: string | string[]
}

export function toAvailabilitySearchString(params?: AvailabilityRouteSearchParams): string {
  if (!params) return ''

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item)
      }
      continue
    }
    searchParams.set(key, value)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function buildAvailabilityTabHref(
  params: AvailabilityRouteSearchParams | undefined,
  targetTab: 'planner' | 'intake'
): string {
  const searchParams = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === 'tab' || value == null) continue
      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, item)
        }
        continue
      }
      searchParams.set(key, value)
    }
  }

  searchParams.set('tab', targetTab)
  const query = searchParams.toString()
  return query ? `/availability?${query}` : '/availability'
}

export function buildAvailabilityHref(
  params: AvailabilityRouteSearchParams | undefined,
  updates: Record<string, string | undefined>,
  hash?: string
): string {
  const searchParams = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue
      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, item)
        }
        continue
      }
      searchParams.set(key, value)
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      searchParams.delete(key)
      continue
    }
    searchParams.set(key, value)
  }

  const query = searchParams.toString()
  const base = query ? `/availability?${query}` : '/availability'
  return hash ? `${base}${hash}` : base
}

export function getManagerAvailabilityFeedback(
  params?: AvailabilityRouteSearchParams
): AvailabilityFeedback | null {
  const commonFeedback = getCommonAvailabilityFeedback(params)
  if (commonFeedback) return commonFeedback

  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)

  if (success === 'planner_saved') {
    return {
      message: 'Planner dates saved.',
      variant: 'success',
    }
  }

  if (success === 'planner_deleted') {
    return {
      message: 'Saved staffing date removed.',
      variant: 'success',
    }
  }

  if (success === 'copy_success') {
    const count = getSearchParam(params?.copied)
    return {
      message: count
        ? `${count} date${Number(count) === 1 ? '' : 's'} copied from the previous cycle.`
        : 'Availability copied from the previous cycle.',
      variant: 'success',
    }
  }

  if (error === 'delete_failed') {
    return {
      message: "Couldn't delete that request. Try again.",
      variant: 'error',
    }
  }

  if (error === 'planner_save_failed') {
    return {
      message: "Couldn't save staffing dates. Try again.",
      variant: 'error',
    }
  }

  if (error === 'planner_delete_failed') {
    return {
      message: "Couldn't remove that date. Try again.",
      variant: 'error',
    }
  }

  if (error === 'copy_no_source') {
    return {
      message:
        'Nothing to copy â€” this therapist has no saved dates in the previous schedule block.',
      variant: 'error',
    }
  }

  if (error === 'copy_nothing_new') {
    return {
      message: 'All dates from the previous block are already planned for this cycle.',
      variant: 'error',
    }
  }

  if (error === 'copy_failed') {
    return {
      message: "Couldn't copy dates. Try again.",
      variant: 'error',
    }
  }

  if (success === 'email_intake_applied') {
    return {
      message: 'Intake dates applied to availability.',
      variant: 'success',
    }
  }

  if (success === 'email_intake_match_saved') {
    return {
      message: 'Matches saved. Apply dates when ready.',
      variant: 'success',
    }
  }

  if (error === 'email_intake_apply_failed') {
    return {
      message: "Couldn't apply this request. Review the matched dates first.",
      variant: 'error',
    }
  }

  if (error === 'email_intake_match_failed') {
    return {
      message: "Couldn't save that match. Try again.",
      variant: 'error',
    }
  }

  return null
}
