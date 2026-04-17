import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260414210000_track_intake_request_edits.sql'
)
const inboundRoutePath = path.join(
  repoRoot,
  'src',
  'app',
  'api',
  'inbound',
  'availability-email',
  'route.ts'
)
const availabilityActionsPath = path.join(
  repoRoot,
  'src',
  'app',
  '(app)',
  'availability',
  'actions.ts'
)

describe('intake request edit tracking contract', () => {
  it('adds the intake item edit-tracking columns in the task migration', () => {
    expect(existsSync(migrationPath)).toBe(true)

    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/alter table\s+public\.availability_email_intake_items/i)
    expect(sql).toMatch(/add column if not exists\s+original_parsed_requests\s+jsonb\s+null/i)
    expect(sql).toMatch(/add column if not exists\s+manually_edited_at\s+timestamptz\s+null/i)
  })

  it('preserves original parser output when inserting intake items', () => {
    const inboundRouteSource = readFileSync(inboundRoutePath, 'utf8')
    const availabilityActionsSource = readFileSync(availabilityActionsPath, 'utf8')

    expect(inboundRouteSource).toContain('original_parsed_requests: item.requests')
    expect(inboundRouteSource).toContain('manually_edited_at: null')

    expect(availabilityActionsSource).toContain('original_parsed_requests: item.requests')
    expect(availabilityActionsSource).toContain('manually_edited_at: null')
  })

  it('marks immediate-save request edits against the original parsed requests', () => {
    const availabilityActionsSource = readFileSync(availabilityActionsPath, 'utf8')

    expect(availabilityActionsSource).toContain('markRequestsEdited')
    expect(availabilityActionsSource).toContain('original_parsed_requests')
    expect(availabilityActionsSource).toContain('manually_edited_at:')
    expect(availabilityActionsSource).toMatch(
      /manually_edited_at:\s*item\.original_parsed_requests[\s\S]*markRequestsEdited/i
    )
  })
})
