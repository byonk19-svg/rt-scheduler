export const TEAM_SUCCESS_MESSAGES = {
  profile_saved: 'Team member updated.',
  profile_archived: 'Team member archived.',
  roster_saved: 'Employee roster entry saved.',
  roster_deleted: 'Employee roster entry removed.',
  roster_bulk_saved: 'Employee roster bulk import saved.',
  therapist_roster_replaced: 'Therapist roster replaced.',
  bulk_updated: 'Bulk team update saved.',
  work_pattern_saved: 'Work pattern saved.',
  imported: 'Team import completed.',
} as const

export const TEAM_ERROR_MESSAGES = {
  missing_profile: 'Could not find that team member.',
  missing_name: 'Name is required.',
  invalid_role: 'Choose a valid role.',
  invalid_shift: 'Choose a valid shift.',
  invalid_employment: 'Choose a valid employment type.',
  update_failed: 'Could not save team member changes. Please try again.',
  archive_requires_inactive: 'Only inactive team members can be archived.',
  archive_failed: 'Could not archive that team member. Please try again.',
  roster_missing_name: 'Employee roster name is required.',
  roster_invalid_role: 'Employee roster role is invalid.',
  roster_invalid_shift: 'Employee roster shift is invalid.',
  roster_invalid_employment: 'Employee roster employment type is invalid.',
  roster_invalid_max_days: 'Employee roster max days must be between 1 and 7.',
  roster_save_failed: 'Could not save employee roster entry.',
  roster_delete_failed: 'Could not remove employee roster entry.',
  roster_missing_entry: 'Employee roster entry is missing.',
  roster_bulk_empty: 'Bulk import had no valid lines.',
  roster_bulk_invalid: 'Bulk import failed. Check name and column format.',
  roster_bulk_save_failed: 'Bulk import could not be saved. Try again.',
  therapist_roster_invalid:
    'Therapist roster source failed. Check the roster format and phone numbers.',
  therapist_roster_empty: 'Therapist roster source did not include any therapists.',
  therapist_roster_replace_failed: 'Could not replace the therapist roster. Please try again.',
  bulk_empty: 'Select at least one team member for a bulk update.',
  bulk_invalid_profiles: 'One or more selected people could not be updated. Refresh and try again.',
  bulk_invalid_action: 'That bulk action is not supported.',
  bulk_invalid_employment: 'Choose a valid employment type for bulk update.',
  bulk_update_failed: 'Bulk update could not be saved. Try again.',
  import_failed: 'Team import failed.',
  invalid_pattern: 'Work pattern is invalid.',
  invalid_weekend_anchor: 'Weekend rotation anchor must be a Saturday.',
  work_pattern_save_failed: 'Could not save work pattern.',
} as const

export type TeamSuccessCode = keyof typeof TEAM_SUCCESS_MESSAGES
export type TeamErrorCode = keyof typeof TEAM_ERROR_MESSAGES

export function isTeamSuccessCode(value: string | null | undefined): value is TeamSuccessCode {
  return Boolean(value && value in TEAM_SUCCESS_MESSAGES)
}

export function isTeamErrorCode(value: string | null | undefined): value is TeamErrorCode {
  return Boolean(value && value in TEAM_ERROR_MESSAGES)
}

export type TeamFeedbackQuery = {
  success?: TeamSuccessCode
  error?: TeamErrorCode
  bulk_count?: string
  bulk_line?: string
  roster_bulk_count?: string
}

export function getTeamFeedbackMessage(params: TeamFeedbackQuery): {
  message: string
  variant: 'success' | 'error'
} | null {
  if (params.success) {
    const base = TEAM_SUCCESS_MESSAGES[params.success]
    if (params.success === 'roster_bulk_saved') {
      const suffix = params.roster_bulk_count ? ` (${params.roster_bulk_count} rows)` : ''
      return { message: `${base}${suffix}`, variant: 'success' }
    }
    if (params.success === 'therapist_roster_replaced') {
      const suffix = params.roster_bulk_count ? ` (${params.roster_bulk_count} therapists)` : ''
      return { message: `${base}${suffix}`, variant: 'success' }
    }
    if (params.success === 'bulk_updated') {
      const suffix = params.bulk_count ? ` (${params.bulk_count} people)` : ''
      return { message: `${base}${suffix}`, variant: 'success' }
    }
    return { message: base, variant: 'success' }
  }

  if (params.error) {
    const base = TEAM_ERROR_MESSAGES[params.error]
    if (params.error === 'roster_bulk_invalid' || params.error === 'therapist_roster_invalid') {
      const suffix = params.bulk_line ? ` on line ${params.bulk_line}` : ''
      return {
        message: `${base.replace('.', suffix ? `${suffix}.` : '.')}`,
        variant: 'error',
      }
    }
    return { message: base, variant: 'error' }
  }

  return null
}
