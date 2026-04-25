import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260425133000_add_direct_request_manager_resolution_notifications.sql'
  ),
  'utf8'
)

describe('direct request notification migration', () => {
  it('adds recipient-decline notifications for direct requests', () => {
    expect(source).toContain('direct_request_declined')
    expect(source).toContain('Your direct request was declined by the recipient.')
  })

  it('adds withdraw notifications for direct requests', () => {
    expect(source).toContain('direct_request_withdrawn')
    expect(source).toContain('withdrew this direct request before final approval')
  })

  it('notifies both direct-request participants when the manager resolves the request', () => {
    expect(source).toContain('direct_request_approved')
    expect(source).toContain('Your direct request was approved by the manager.')
    expect(source).toContain('The manager approved this direct request.')
    expect(source).toContain('direct_request_denied')
    expect(source).toContain('Your direct request was denied by the manager.')
    expect(source).toContain('The manager denied this direct request.')
  })
})
