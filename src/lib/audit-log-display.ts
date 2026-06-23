export type AuditLogActionTone = 'muted' | 'info' | 'success' | 'warning' | 'error'

type AuditLogActionDisplay = {
  label: string
  tone: AuditLogActionTone
}

const ACTION_DISPLAY_BY_KEY: Record<string, AuditLogActionDisplay> = {
  cycle_published: {
    label: 'Schedule Block published',
    tone: 'success',
  },
  schedule_block_taken_offline: {
    label: 'Schedule Block taken offline',
    tone: 'warning',
  },
  schedule_block_archived: {
    label: 'Schedule Block archived',
    tone: 'warning',
  },
  draft_schedule_generated: {
    label: 'Draft Schedule generated',
    tone: 'info',
  },
  preliminary_schedule_sent: {
    label: 'Preliminary Schedule sent',
    tone: 'info',
  },
  preliminary_schedule_refreshed: {
    label: 'Preliminary Schedule refreshed',
    tone: 'info',
  },
  post_publish_modification: {
    label: 'Published Schedule changed',
    tone: 'warning',
  },
  shift_added: {
    label: 'Shift added',
    tone: 'success',
  },
  shift_removed: {
    label: 'Shift removed',
    tone: 'error',
  },
  designated_lead_assigned: {
    label: 'Lead assigned',
    tone: 'info',
  },
  schedule_block_planning_created: {
    label: 'Schedule Block planned',
    tone: 'info',
  },
  schedule_block_planning_created_visible: {
    label: 'Schedule Block opened for availability',
    tone: 'info',
  },
  schedule_block_planning_made_visible: {
    label: 'Schedule Block opened for availability',
    tone: 'info',
  },
  schedule_block_availability_due_date_changed: {
    label: 'Availability due date changed',
    tone: 'info',
  },
  schedule_block_preliminary_target_changed: {
    label: 'Preliminary target changed',
    tone: 'info',
  },
  schedule_block_final_publish_target_changed: {
    label: 'Final Publish target changed',
    tone: 'info',
  },
  availability_window_closed: {
    label: 'Availability window locked',
    tone: 'warning',
  },
  availability_window_reopened: {
    label: 'Availability window reopened',
    tone: 'info',
  },
  create_request: {
    label: 'Coverage or trade request created',
    tone: 'info',
  },
  respond_direct_request: {
    label: 'Direct request response recorded',
    tone: 'info',
  },
  withdraw_request: {
    label: 'Request withdrawn',
    tone: 'warning',
  },
  express_interest: {
    label: 'Offer to cover submitted',
    tone: 'success',
  },
  withdraw_interest: {
    label: 'Offer to cover withdrawn',
    tone: 'warning',
  },
  review_request: {
    label: 'Request reviewed by manager',
    tone: 'info',
  },
  deny_claimant: {
    label: 'Backup responder denied',
    tone: 'warning',
  },
  team_profile_updated: {
    label: 'Team profile updated',
    tone: 'info',
  },
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  schedule_cycle: 'Schedule Block',
  shift: 'Shift',
  shift_slot: 'Shift slot',
  shift_post: 'Coverage or trade request',
  profile: 'Team member',
  system: 'System',
}

function fallbackActionLabel(action: string): string {
  const normalized = action.trim().replaceAll('_', ' ')
  if (!normalized) return 'Audit event'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function getAuditLogActionDisplay(action: string): AuditLogActionDisplay {
  return (
    ACTION_DISPLAY_BY_KEY[action] ?? {
      label: fallbackActionLabel(action),
      tone: 'muted',
    }
  )
}

export function getAuditLogTargetTypeLabel(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? fallbackActionLabel(targetType)
}
