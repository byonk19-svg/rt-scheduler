import { describe, expect, it } from 'vitest'

// ESM helper used by scripts/sync-team-roster.mjs
import { parseRosterLine } from '../../scripts/lib/parse-roster-line.mjs'

describe('parseRosterLine', () => {
  it('returns null for empty and comments', () => {
    expect(parseRosterLine('')).toBeNull()
    expect(parseRosterLine('   ')).toBeNull()
    expect(parseRosterLine('# note')).toBeNull()
  })

  it('parses angle bracket form', () => {
    expect(parseRosterLine('Jane Doe <jane@example.com>')).toEqual({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    })
  })

  it('parses email-first comma form', () => {
    expect(parseRosterLine('jane@example.com, Jane Doe')).toEqual({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    })
  })

  it('parses name-first comma form', () => {
    expect(parseRosterLine('Jane Doe, jane@example.com')).toEqual({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    })
  })

  it('parses tab-separated', () => {
    expect(parseRosterLine('Jane Doe\tjane@example.com')).toEqual({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    })
    expect(parseRosterLine('jane@example.com\tJane Doe')).toEqual({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
    })
  })

  it('derives name from lone email', () => {
    expect(parseRosterLine('jane.doe@example.com')).toEqual({
      fullName: 'Jane Doe',
      email: 'jane.doe@example.com',
    })
  })

  it('throws on invalid lines', () => {
    expect(() => parseRosterLine('not an email')).toThrow(/need email/)
  })
})
