export type AvailabilityOverrideMutationFields = {
  availability_override: boolean
  availability_override_reason: string | null
  availability_override_by: string | null
  availability_override_at: string | null
}

export function buildAvailabilityOverrideMutationFields(params: {
  blockedByConstraints: boolean
  inactiveOrFmla: boolean
  availabilityOverride?: boolean
  availabilityOverrideReason?: string
  actorId: string
  now?: Date
}): AvailabilityOverrideMutationFields {
  const shouldSetAvailabilityOverride =
    params.blockedByConstraints && !params.inactiveOrFmla && params.availabilityOverride === true
  const normalizedReason =
    typeof params.availabilityOverrideReason === 'string'
      ? params.availabilityOverrideReason.trim() || null
      : null

  return {
    availability_override: shouldSetAvailabilityOverride,
    availability_override_reason: shouldSetAvailabilityOverride ? normalizedReason : null,
    availability_override_by: shouldSetAvailabilityOverride ? params.actorId : null,
    availability_override_at: shouldSetAvailabilityOverride
      ? (params.now ?? new Date()).toISOString()
      : null,
  }
}
