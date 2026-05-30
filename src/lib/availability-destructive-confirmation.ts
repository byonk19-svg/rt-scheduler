export const COPY_PREVIOUS_AVAILABILITY_CONFIRMATION =
  'Copying the previous Schedule Block will replace unsaved availability changes for this Schedule Block. Continue?'

export const CLEAR_AVAILABILITY_CONFIRMATION =
  'Clearing availability changes will remove unsaved selections for this Schedule Block. Continue?'

export function confirmAvailabilityDestructiveAction({
  hasUnsavedChanges,
  message,
  confirm,
}: {
  hasUnsavedChanges: boolean
  message: string
  confirm: (message: string) => boolean
}): boolean {
  if (!hasUnsavedChanges) return true
  return confirm(message)
}
