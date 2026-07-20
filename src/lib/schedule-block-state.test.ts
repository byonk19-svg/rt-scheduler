import { describe, expect, it } from 'vitest'

import {
  canEditScheduleBlock,
  canPublishScheduleBlock,
  getScheduleBlockLifecycleLabel,
  isArchivedScheduleBlock,
  isPreliminaryScheduleBlock,
  isPublishedScheduleBlock,
  isReadOnlyScheduleBlock,
  resolveScheduleBlockState,
} from './schedule-block-state'

describe('resolveScheduleBlockState', () => {
  it('preserves draft planning depth from shift count', () => {
    expect(resolveScheduleBlockState({ published: false })).toBe('created')
    expect(resolveScheduleBlockState({ published: false, shiftCount: 3 })).toBe('shifts_assigned')
  })

  it('treats archived timestamps as archived regardless of published flag', () => {
    expect(
      resolveScheduleBlockState({
        published: true,
        status: 'final',
        archived_at: '2026-07-20T12:00:00.000Z',
      })
    ).toBe('archived')
  })

  it('treats explicit archived status as archived', () => {
    expect(resolveScheduleBlockState({ published: false, status: 'archived' })).toBe('archived')
  })

  it('treats offline status as offline before final or preliminary states', () => {
    expect(
      resolveScheduleBlockState({
        published: true,
        status: 'offline',
        hasActivePreliminarySnapshot: true,
      })
    ).toBe('offline')
  })

  it('treats published or final Schedule Blocks as published', () => {
    expect(resolveScheduleBlockState({ published: true, status: 'draft' })).toBe('published')
    expect(resolveScheduleBlockState({ published: false, status: 'final' })).toBe('published')
  })

  it('treats preliminary status or an active preliminary snapshot as preliminary', () => {
    expect(resolveScheduleBlockState({ published: false, status: 'preliminary' })).toBe(
      'preliminary_sent'
    )
    expect(
      resolveScheduleBlockState({
        published: false,
        status: 'draft',
        hasActivePreliminarySnapshot: true,
      })
    ).toBe('preliminary_sent')
    expect(
      resolveScheduleBlockState({
        published: false,
        activePreliminarySnapshotId: 'snapshot-1',
      })
    ).toBe('preliminary_sent')
  })

  it('does not let a preliminary snapshot override a published Schedule Block', () => {
    expect(
      resolveScheduleBlockState({
        published: true,
        status: 'draft',
        hasActivePreliminarySnapshot: true,
      })
    ).toBe('published')
  })

  it('falls back to draft for unknown or missing active states', () => {
    expect(resolveScheduleBlockState({ published: false, status: null })).toBe('created')
    expect(resolveScheduleBlockState({ published: false, status: 'legacy' })).toBe('created')
  })
})

describe('Schedule Block State helpers', () => {
  it('identifies read-only Schedule Blocks', () => {
    expect(isReadOnlyScheduleBlock({ status: 'offline' })).toBe(true)
    expect(isReadOnlyScheduleBlock({ archivedAt: '2026-07-20T12:00:00.000Z' })).toBe(true)
    expect(isReadOnlyScheduleBlock({ published: true, status: 'final' })).toBe(false)
    expect(isArchivedScheduleBlock({ status: 'offline' })).toBe(false)
    expect(isArchivedScheduleBlock({ archivedAt: '2026-07-20T12:00:00.000Z' })).toBe(true)
  })

  it('identifies published live and preliminary active states', () => {
    expect(isPublishedScheduleBlock({ published: true, status: 'draft' })).toBe(true)
    expect(isPreliminaryScheduleBlock({ published: false, status: 'preliminary' })).toBe(true)
    expect(
      isPreliminaryScheduleBlock({
        published: true,
        status: 'draft',
        hasActivePreliminarySnapshot: true,
      })
    ).toBe(false)
  })

  it('preserves user-facing labels and publish/edit gates', () => {
    expect(getScheduleBlockLifecycleLabel({ published: false, status: 'draft' })).toBe('Draft')
    expect(getScheduleBlockLifecycleLabel({ published: false, status: 'preliminary' })).toBe(
      'Preliminary'
    )
    expect(getScheduleBlockLifecycleLabel({ published: false, status: 'final' })).toBe('Published')
    expect(getScheduleBlockLifecycleLabel({ published: false, status: 'offline' })).toBe('Offline')
    expect(getScheduleBlockLifecycleLabel({ published: false, status: 'archived' })).toBe(
      'Archived'
    )

    expect(canEditScheduleBlock('created')).toBe(true)
    expect(canEditScheduleBlock('preliminary_sent')).toBe(true)
    expect(canEditScheduleBlock('published')).toBe(false)
    expect(canEditScheduleBlock('offline')).toBe(false)
    expect(canEditScheduleBlock('archived')).toBe(false)
    expect(canPublishScheduleBlock('created')).toBe(false)
    expect(canPublishScheduleBlock('shifts_assigned')).toBe(true)
    expect(canPublishScheduleBlock('preliminary_sent')).toBe(true)
    expect(canPublishScheduleBlock('offline')).toBe(true)
    expect(canPublishScheduleBlock('archived')).toBe(false)
  })
})
