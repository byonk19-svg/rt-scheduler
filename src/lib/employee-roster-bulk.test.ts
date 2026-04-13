import { describe, expect, it } from 'vitest'

import { normalizeRosterFullName, parseBulkEmployeeRosterText } from '@/lib/employee-roster-bulk'

describe('normalizeRosterFullName', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizeRosterFullName('  Jane   Doe  ')).toBe('jane doe')
  })
})

describe('parseBulkEmployeeRosterText', () => {
  it('parses name-only lines', () => {
    const r = parseBulkEmployeeRosterText('Jane Doe\n# skip\nBob Smith')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows).toHaveLength(2)
    const jane = r.rows.find((x) => x.full_name === 'Jane Doe')
    expect(jane?.role).toBe('therapist')
    expect(jane?.shift_type).toBe('day')
  })

  it('parses tab-separated extended rows', () => {
    const r = parseBulkEmployeeRosterText(
      'Jane Doe\tlead\tnight\tprn\t5\ty\nBob\ttherapist\tday\tfull_time\t3\tn'
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows).toHaveLength(2)
    const jane = r.rows.find((x) => x.full_name === 'Jane Doe')
    expect(jane?.role).toBe('lead')
    expect(jane?.shift_type).toBe('night')
    expect(jane?.employment_type).toBe('prn')
    expect(jane?.max_work_days_per_week).toBe(5)
    expect(jane?.is_lead_eligible).toBe(true)
    const bob = r.rows.find((x) => x.full_name === 'Bob')
    expect(bob?.is_lead_eligible).toBe(false)
  })

  it('parses angle-bracket email lines as name only', () => {
    const r = parseBulkEmployeeRosterText('Jane Doe <jane@example.com>')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows[0]?.full_name).toBe('Jane Doe')
  })

  it('parses comma-separated name and email', () => {
    const r = parseBulkEmployeeRosterText('Jane Doe, jane@example.com')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows[0]?.full_name).toBe('Jane Doe')
  })

  it('keeps Last, First as a single name when not role/shift', () => {
    const r = parseBulkEmployeeRosterText('Doe, Jane')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows[0]?.full_name).toBe('Doe, Jane')
  })

  it('last duplicate name wins', () => {
    const r = parseBulkEmployeeRosterText('Jane Doe\ttherapist\tday\nJane Doe\tlead\tnight')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]?.role).toBe('lead')
  })

  it('errors on email-only line', () => {
    const r = parseBulkEmployeeRosterText('only@example.com')
    expect(r.ok).toBe(false)
  })
})
