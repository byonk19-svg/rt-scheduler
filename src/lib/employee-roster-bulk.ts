export type ManagedRole = 'manager' | 'therapist' | 'lead'
export type ShiftType = 'day' | 'night'
export type EmploymentType = 'full_time' | 'part_time' | 'prn'

export type BulkEmployeeRosterRow = {
  full_name: string
  normalized_full_name: string
  role: ManagedRole
  shift_type: ShiftType
  employment_type: EmploymentType
  max_work_days_per_week: number
  is_lead_eligible: boolean
  is_active: true
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim())
}

export function normalizeRosterFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseRoleToken(raw: string): ManagedRole | null {
  const t = raw.trim().toLowerCase()
  if (t === 'manager' || t === 'therapist' || t === 'lead') return t
  if (t === 'lead therapist' || t === 'lead_therapist') return 'lead'
  return null
}

function parseShiftToken(raw: string): ShiftType | null {
  const t = raw.trim().toLowerCase()
  if (t === 'day' || t === 'night') return t
  return null
}

function parseEmploymentToken(raw: string): EmploymentType | null {
  const t = raw.trim().toLowerCase()
  if (t === 'full_time' || t === 'full-time' || t === 'ft') return 'full_time'
  if (t === 'part_time' || t === 'part-time' || t === 'pt') return 'part_time'
  if (t === 'prn') return 'prn'
  return null
}

function parseLeadEligibleToken(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return t === 'y' || t === 'yes' || t === 'true' || t === '1' || t === 'x'
}

function splitNonTabLine(line: string): string[] {
  const raw = line.trim()
  const angle = raw.match(/^(.+?)\s*<([^>]+)>\s*$/)
  if (angle) {
    return [angle[1].trim().replace(/^["']|["']$/g, '')]
  }
  if (!raw.includes(',')) {
    return [raw]
  }
  const idx = raw.indexOf(',')
  const left = raw.slice(0, idx).trim()
  const right = raw.slice(idx + 1).trim()
  if (looksLikeEmail(right)) {
    return [left]
  }
  if (parseRoleToken(right)) {
    return [left, right]
  }
  if (parseShiftToken(right)) {
    return [left, right]
  }
  if (parseEmploymentToken(right)) {
    return [left, right]
  }
  return [`${left}, ${right}`]
}

function parseTabSegments(line: string): string[] {
  return line.split(/\t/).map((s) => s.trim())
}

export function parseBulkEmployeeRosterText(
  text: string
): { ok: true; rows: BulkEmployeeRosterRow[] } | { ok: false; line: number; message: string } {
  const lines = text.split(/\r?\n/)
  /** last row wins on duplicate normalized name */
  const byNorm = new Map<string, BulkEmployeeRosterRow>()

  for (let i = 0; i < lines.length; i += 1) {
    const lineNum = i + 1
    const rawLine = lines[i]
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    let segments: string[]
    if (trimmed.includes('\t')) {
      segments = parseTabSegments(trimmed)
    } else {
      segments = splitNonTabLine(trimmed)
    }

    const fullNameRaw = (segments[0] ?? '').trim()
    if (!fullNameRaw) {
      return { ok: false, line: lineNum, message: 'Missing name.' }
    }
    if (looksLikeEmail(fullNameRaw) && segments.length === 1) {
      return { ok: false, line: lineNum, message: 'Use a person name, not email only.' }
    }

    const roleTok = (segments[1] ?? '').trim()
    const shiftTok = (segments[2] ?? '').trim()
    const empTok = (segments[3] ?? '').trim()
    const maxTok = (segments[4] ?? '').trim()
    const leadTok = (segments[5] ?? '').trim()

    let role: ManagedRole = 'therapist'
    if (roleTok) {
      const parsed = parseRoleToken(roleTok)
      if (!parsed) {
        return { ok: false, line: lineNum, message: `Invalid role "${roleTok}".` }
      }
      role = parsed
    }

    let shift_type: ShiftType = 'day'
    if (shiftTok) {
      const parsed = parseShiftToken(shiftTok)
      if (!parsed) {
        return { ok: false, line: lineNum, message: `Invalid shift "${shiftTok}".` }
      }
      shift_type = parsed
    }

    let employment_type: EmploymentType = 'full_time'
    if (empTok) {
      const parsed = parseEmploymentToken(empTok)
      if (!parsed) {
        return { ok: false, line: lineNum, message: `Invalid employment "${empTok}".` }
      }
      employment_type = parsed
    }

    let max_work_days_per_week = 3
    if (maxTok) {
      const n = Number(maxTok)
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        return { ok: false, line: lineNum, message: `Max days must be 1–7, got "${maxTok}".` }
      }
      max_work_days_per_week = n
    }

    let is_lead_eligible = false
    if (leadTok) {
      const tl = leadTok.toLowerCase()
      if (tl === 'n' || tl === 'no' || tl === 'false' || tl === '0') {
        is_lead_eligible = false
      } else if (parseLeadEligibleToken(leadTok)) {
        is_lead_eligible = true
      } else {
        return { ok: false, line: lineNum, message: `Invalid lead flag "${leadTok}" (use y/n).` }
      }
    }

    const normalized_full_name = normalizeRosterFullName(fullNameRaw)
    if (!normalized_full_name) {
      return { ok: false, line: lineNum, message: 'Name normalizes to empty.' }
    }

    byNorm.set(normalized_full_name, {
      full_name: fullNameRaw.replace(/\s+/g, ' ').trim(),
      normalized_full_name,
      role,
      shift_type,
      employment_type,
      max_work_days_per_week,
      is_lead_eligible,
      is_active: true,
    })
  }

  return { ok: true, rows: [...byNorm.values()] }
}
