export type FieldMapping = Record<string, string>

export const TEAMWISE_FIELDS = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'shift_type', label: 'Shift type (day/night)', required: false },
  { key: 'role', label: 'Role (therapist/lead/manager)', required: false },
  { key: 'employment_type', label: 'Employment type (full_time/part_time/prn)', required: false },
  { key: 'phone_number', label: 'Phone number', required: false },
  { key: 'max_work_days_per_week', label: 'Max work days/week', required: false },
] as const

type TeamwiseFieldKey = (typeof TEAMWISE_FIELDS)[number]['key']

export type ValidationError = {
  rowIndex: number
  field: TeamwiseFieldKey
  message: string
}

export type MappedRow = Partial<Record<TeamwiseFieldKey, string>>

export function parseRawCsv(text: string): { headers: string[]; rows: string[][] } {
  const input = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  function pushField() {
    currentRow.push(currentField)
    currentField = ''
  }

  function pushRow() {
    pushField()
    rows.push(currentRow)
    currentRow = []
  }

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      pushField()
      continue
    }

    if (!inQuotes && char === '\r') {
      if (next === '\n') i += 1
      pushRow()
      continue
    }

    if (!inQuotes && char === '\n') {
      pushRow()
      continue
    }

    currentField += char
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    pushRow()
  }

  const [headerRow = [], ...dataRows] = rows
  return {
    headers: headerRow,
    rows: dataRows.filter((row) => row.some((value) => value.trim().length > 0)),
  }
}

function normalizeMappedValue(value: string): string {
  return value.trim()
}

function validateEnum(field: TeamwiseFieldKey, value: string): string | null {
  const normalized = value.trim().toLowerCase()

  if (field === 'shift_type') {
    return normalized === 'day' || normalized === 'night'
      ? null
      : 'Shift type must be day or night.'
  }

  if (field === 'role') {
    return normalized === 'therapist' || normalized === 'lead' || normalized === 'manager'
      ? null
      : 'Role must be therapist, lead, or manager.'
  }

  if (field === 'employment_type') {
    return normalized === 'full_time' || normalized === 'part_time' || normalized === 'prn'
      ? null
      : 'Employment type must be full_time, part_time, or prn.'
  }

  return null
}

export function validateMappedRows(
  rows: string[][],
  headers: string[],
  mapping: FieldMapping
): { valid: MappedRow[]; errors: ValidationError[] } {
  const valid: MappedRow[] = []
  const errors: ValidationError[] = []

  rows.forEach((row, index) => {
    const mapped: MappedRow = {}

    for (const [csvColumn, teamwiseField] of Object.entries(mapping)) {
      const headerIndex = headers.indexOf(csvColumn)
      if (headerIndex < 0 || !teamwiseField) continue
      mapped[teamwiseField as TeamwiseFieldKey] = normalizeMappedValue(row[headerIndex] ?? '')
    }

    if (!mapped.full_name) {
      errors.push({ rowIndex: index + 1, field: 'full_name', message: 'Full name is required.' })
      return
    }

    for (const field of ['shift_type', 'role', 'employment_type'] as const) {
      if (!mapped[field]) continue
      const error = validateEnum(field, mapped[field] ?? '')
      if (error) {
        errors.push({ rowIndex: index + 1, field, message: error })
      }
    }

    if (!errors.some((error) => error.rowIndex === index + 1)) {
      valid.push(mapped)
    }
  })

  return { valid, errors }
}
