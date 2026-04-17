import { describe, expect, it } from 'vitest'

import { parseRawCsv, validateMappedRows, type FieldMapping } from '@/lib/csv-import-parser'

describe('parseRawCsv', () => {
  it('handles BOM, CRLF, quoted commas, and escaped quotes', () => {
    const input = '\uFEFFName,Shift\r\n"Brooks, Tannie",day\r\n"Alex ""AJ"" Jones",night'

    expect(parseRawCsv(input)).toEqual({
      headers: ['Name', 'Shift'],
      rows: [
        ['Brooks, Tannie', 'day'],
        ['Alex "AJ" Jones', 'night'],
      ],
    })
  })
})

describe('validateMappedRows', () => {
  it('returns valid rows and row-level validation errors', () => {
    const headers = ['Name', 'Shift', 'Role']
    const rows = [
      ['Barbara C.', 'day', 'therapist'],
      ['', 'night', 'lead'],
      ['Tannie B.', 'swing', 'therapist'],
    ]
    const mapping: FieldMapping = {
      Name: 'full_name',
      Shift: 'shift_type',
      Role: 'role',
    }

    expect(validateMappedRows(rows, headers, mapping)).toEqual({
      valid: [
        {
          full_name: 'Barbara C.',
          shift_type: 'day',
          role: 'therapist',
        },
      ],
      errors: [
        { rowIndex: 2, field: 'full_name', message: 'Full name is required.' },
        { rowIndex: 3, field: 'shift_type', message: 'Shift type must be day or night.' },
      ],
    })
  })
})
