import { describe, expect, it } from 'vitest'

import { getAuditLogActionDisplay, getAuditLogTargetTypeLabel } from '@/lib/audit-log-display'

describe('audit log display helpers', () => {
  it('uses Schedule Block lifecycle labels for schedule audit actions', () => {
    expect(getAuditLogActionDisplay('cycle_published')).toEqual({
      label: 'Schedule Block published',
      tone: 'success',
    })
    expect(getAuditLogActionDisplay('schedule_block_taken_offline')).toEqual({
      label: 'Schedule Block taken offline',
      tone: 'warning',
    })
    expect(getAuditLogActionDisplay('schedule_block_archived')).toEqual({
      label: 'Schedule Block archived',
      tone: 'warning',
    })
    expect(getAuditLogActionDisplay('schedule_block_planning_created_visible')).toEqual({
      label: 'Schedule Block opened for availability',
      tone: 'info',
    })
    expect(getAuditLogActionDisplay('preliminary_schedule_refreshed')).toEqual({
      label: 'Preliminary Schedule refreshed',
      tone: 'info',
    })
    expect(getAuditLogActionDisplay('availability_window_closed')).toEqual({
      label: 'Availability window locked',
      tone: 'warning',
    })
    expect(getAuditLogActionDisplay('availability_window_reopened')).toEqual({
      label: 'Availability window reopened',
      tone: 'info',
    })
  })

  it('uses request lifecycle labels without leaking backend command names', () => {
    expect(getAuditLogActionDisplay('create_request')).toEqual({
      label: 'Coverage or trade request created',
      tone: 'info',
    })
    expect(getAuditLogActionDisplay('express_interest')).toEqual({
      label: 'Offer to cover submitted',
      tone: 'success',
    })
    expect(getAuditLogActionDisplay('review_request')).toEqual({
      label: 'Request reviewed by manager',
      tone: 'info',
    })
  })

  it('uses manager-facing target type labels', () => {
    expect(getAuditLogTargetTypeLabel('schedule_cycle')).toBe('Schedule Block')
    expect(getAuditLogTargetTypeLabel('shift_post')).toBe('Coverage or trade request')
    expect(getAuditLogTargetTypeLabel('profile')).toBe('Team member')
  })

  it('falls back to readable labels for unknown audit keys', () => {
    expect(getAuditLogActionDisplay('custom_backend_event')).toEqual({
      label: 'Custom backend event',
      tone: 'muted',
    })
    expect(getAuditLogTargetTypeLabel('custom_target')).toBe('Custom target')
  })
})
