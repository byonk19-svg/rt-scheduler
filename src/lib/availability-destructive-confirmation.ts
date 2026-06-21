export const COPY_PREVIOUS_AVAILABILITY_CONFIRMATION =
  'Copying the previous Schedule Block will replace current availability selections for this Schedule Block. Continue?'

export const CLEAR_AVAILABILITY_CONFIRMATION =
  'Clearing availability changes will remove current selections for this Schedule Block. Continue?'

export function confirmAvailabilityDestructiveAction({
  hasUnsavedChanges,
  hasExistingSelections = false,
  message,
  confirm,
}: {
  hasUnsavedChanges: boolean
  hasExistingSelections?: boolean
  message: string
  confirm: (message: string) => boolean
}): boolean {
  if (!hasUnsavedChanges && !hasExistingSelections) return true
  return confirm(message)
}
