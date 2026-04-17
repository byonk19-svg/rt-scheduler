import { normalizeRosterFullName, type BulkEmployeeRosterRow } from '@/lib/employee-roster-bulk'

export type TherapistRosterSourceRow = BulkEmployeeRosterRow & {
  phone_number: string
}

type TherapistRosterSourceResult =
  | { ok: true; rows: TherapistRosterSourceRow[] }
  | { ok: false; line: number; message: string }

function normalizeSourcePhone(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  const digits = trimmed.replace(/\D/g, '')

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return trimmed
}

function parseTherapistSourceLine(
  line: string
): { ok: true; full_name: string; phone: string } | { ok: false; message: string } {
  const commaIndex = line.indexOf(',')
  if (commaIndex <= 0) {
    return { ok: false, message: 'Expected "Last, First Phone" format.' }
  }

  const lastName = line.slice(0, commaIndex).trim().replace(/\s+/g, ' ')
  const remainder = line
    .slice(commaIndex + 1)
    .trim()
    .replace(/\s+/g, ' ')

  if (!lastName || !remainder) {
    return { ok: false, message: 'Expected "Last, First Phone" format.' }
  }

  const match = remainder.match(/^(.+?)\s+((?=.*\d)[()\d.+\-\s]+)$/)
  if (!match) {
    return { ok: false, message: 'Missing therapist phone number.' }
  }

  const [, rawFirstName, rawPhone] = match
  const firstName = rawFirstName.trim().replace(/\s+/g, ' ')
  const phone = rawPhone.trim()
  if (!firstName || !phone) {
    return { ok: false, message: 'Expected "Last, First Phone" format.' }
  }

  return {
    ok: true,
    full_name: `${firstName} ${lastName}`,
    phone: normalizeSourcePhone(phone),
  }
}

export function parseTherapistRosterSource(text: string): TherapistRosterSourceResult {
  const lines = text.split(/\r?\n/)
  const seenNames = new Map<string, string>()
  const rows: TherapistRosterSourceRow[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const trimmed = lines[index]?.trim() ?? ''

    if (!trimmed || trimmed.startsWith('#')) continue

    const parsed = parseTherapistSourceLine(trimmed)
    if (!parsed.ok) {
      return { ok: false, line: lineNumber, message: parsed.message }
    }

    const normalized_full_name = normalizeRosterFullName(parsed.full_name)
    const existingName = seenNames.get(normalized_full_name)
    if (existingName) {
      return {
        ok: false,
        line: lineNumber,
        message: `Duplicate therapist name "${existingName}".`,
      }
    }

    seenNames.set(normalized_full_name, parsed.full_name)
    rows.push({
      full_name: parsed.full_name,
      normalized_full_name,
      phone_number: parsed.phone,
      role: 'therapist',
      shift_type: 'day',
      employment_type: 'full_time',
      max_work_days_per_week: 3,
      is_lead_eligible: false,
      is_active: true,
    })
  }

  return { ok: true, rows }
}
