export const SCHEDULE_MUTATION_ERROR_CODES = {
  invalidBody: 'invalid_body',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  managerAccessRequired: 'manager_access_required',
  managerSiteScopeRequired: 'manager_site_scope_required',
  outsideSiteScope: 'outside_site_scope',
  cycleNotFound: 'cycle_not_found',
  cycleReadOnly: 'cycle_read_only',
  dateOutsideCycle: 'date_outside_cycle',
  therapistShiftTypeMismatch: 'therapist_shift_type_mismatch',
  therapistUnassignable: 'therapist_unassignable',
  leadNotEligible: 'lead_not_eligible',
  availabilityConflict: 'availability_conflict',
  coverageLimitExceeded: 'coverage_limit_exceeded',
  weeklyLimitExceeded: 'weekly_limit_exceeded',
  duplicateShift: 'duplicate_shift',
  duplicateDesignatedLead: 'duplicate_designated_lead',
  shiftNotFound: 'shift_not_found',
  unsupportedAction: 'unsupported_action',
  internalError: 'internal_error',
} as const

export type ScheduleMutationErrorCode =
  (typeof SCHEDULE_MUTATION_ERROR_CODES)[keyof typeof SCHEDULE_MUTATION_ERROR_CODES]
