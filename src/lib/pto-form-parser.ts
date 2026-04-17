/**
 * PTO request / edit form parser.
 *
 * Detects the structured PTO REQUEST/EDIT FORM scaffold in OCR'd or typed text
 * and parses date rows into structured availability requests.
 *
 * Rules applied inside a detected form:
 *  - Bare dates (no explicit intent) → force_off by default
 *  - WORK / Work / working / back to work / will work → force_on
 *  - Date ranges are expanded day-by-day (M/D–M/D, thru/through, Month D–D, etc.)
 *  - "will work rest of week" and similar trailing clauses are stripped silently
 *  - Weekday recurrence phrases ("off Tuesdays") → unresolvedLines
 *  - The Employee Signature line and the Date: that follows it are skipped
 *  - Table header rows and form metadata lines are skipped
 *  - Comments: prefix is stripped; the remainder is parsed like a body line
 */

import type {
  IntakeCycle,
  ParsedAvailabilityEmail,
  ParsedAvailabilityRequest,
} from './availability-email-intake'

// ---------------------------------------------------------------------------
// Month lookup
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function parseMonthName(s: string): number | null {
  return MONTHS[s.toLowerCase()] ?? null
}

// ---------------------------------------------------------------------------
// Date math helpers
// ---------------------------------------------------------------------------

function pad(v: number): string {
  return String(v).padStart(2, '0')
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Resolve a (month, day) pair to an ISO date by finding the cycle year that
 * contains it. Returns null if no cycle contains the date.
 */
function resolveMonthDay(month: number, day: number, cycles: IntakeCycle[]): string | null {
  const yearsToTry: number[] = []
  for (const cycle of cycles) {
    const y = Number.parseInt(cycle.start_date.slice(0, 4), 10)
    if (!yearsToTry.includes(y)) yearsToTry.push(y)
    if (!yearsToTry.includes(y + 1)) yearsToTry.push(y + 1)
  }

  for (const year of yearsToTry) {
    const iso = toIsoDate(year, month, day)
    if (!iso) continue
    for (const cycle of cycles) {
      if (iso >= cycle.start_date && iso <= cycle.end_date) return iso
    }
  }
  return null
}

/**
 * Expand a (fromMonth/fromDay)–(toMonth/toDay) range into ISO dates using cycle
 * context to determine the year. Silently returns [] if the range is > 60 days
 * or if the endpoints can't be resolved.
 */
export function expandMonthDayRange(
  fromMonth: number,
  fromDay: number,
  toMonth: number,
  toDay: number,
  cycles: IntakeCycle[]
): string[] {
  const fromIso = resolveMonthDay(fromMonth, fromDay, cycles)
  if (!fromIso) return []

  const fromYear = Number.parseInt(fromIso.slice(0, 4), 10)
  // If toMonth is earlier than fromMonth, assume the range wraps into the next year
  const toYear = toMonth < fromMonth ? fromYear + 1 : fromYear
  const toIso = toIsoDate(toYear, toMonth, toDay)
  if (!toIso || toIso < fromIso) return []

  const MS_PER_DAY = 86_400_000
  const fromTime = new Date(fromIso + 'T00:00:00Z').getTime()
  const toTime = new Date(toIso + 'T00:00:00Z').getTime()
  if (toTime - fromTime > 60 * MS_PER_DAY) return [] // safety cap

  const dates: string[] = []
  let current = fromTime
  while (current <= toTime) {
    dates.push(new Date(current).toISOString().slice(0, 10))
    current += MS_PER_DAY
  }
  return dates
}

// ---------------------------------------------------------------------------
// Single-token date resolution (with ordinal-suffix tolerance)
// ---------------------------------------------------------------------------

function stripOrdinalSuffixes(s: string): string {
  return s.replace(/(\d+)(?:st|nd|rd|th)\b/gi, '$1')
}

function normalizeYear(raw: number): number {
  if (raw >= 100) return raw
  return raw >= 70 ? 1900 + raw : 2000 + raw
}

/**
 * Resolve a single date token (e.g., "5/10", "May 4", "May 24 2026",
 * "5/10/26") to an ISO date string. Returns null if unresolvable.
 */
export function resolveSingleDateToken(token: string, cycles: IntakeCycle[]): string | null {
  const t = stripOrdinalSuffixes(token.trim()).replace(/\s+/g, ' ')

  // ISO: 2026-05-10
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t

  // M/D/YYYY or M/D/YY
  const slashFull = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashFull) {
    return toIsoDate(
      normalizeYear(Number.parseInt(slashFull[3], 10)),
      Number.parseInt(slashFull[1], 10),
      Number.parseInt(slashFull[2], 10)
    )
  }

  // Month D YYYY  (e.g., "May 24 2026" — no comma required)
  const monthYear = t.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthYear) {
    const m = parseMonthName(monthYear[1])
    if (m) return toIsoDate(Number.parseInt(monthYear[3], 10), m, Number.parseInt(monthYear[2], 10))
  }

  // M/D (cycle-scoped)
  const slashNoYear = t.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (slashNoYear)
    return resolveMonthDay(
      Number.parseInt(slashNoYear[1], 10),
      Number.parseInt(slashNoYear[2], 10),
      cycles
    )

  // Month D (cycle-scoped, e.g., "May 4")
  const monthNoYear = t.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
  if (monthNoYear) {
    const m = parseMonthName(monthNoYear[1])
    if (!m) return null
    return resolveMonthDay(m, Number.parseInt(monthNoYear[2], 10), cycles)
  }

  return null
}

// ---------------------------------------------------------------------------
// Multi-date extraction: ranges + lists
// ---------------------------------------------------------------------------

/**
 * Extract all ISO dates from a PTO form row, handling:
 *   - Range keywords: "thru", "through"
 *   - Cross-month ranges: "May 3 - June 13"
 *   - Compact month ranges: "May 23-26", "June 12-14th"
 *   - Slash ranges: "5/3 - 5/5"
 *   - Comma / ampersand lists: "5/3 & 5/4", "5/6, 5/7"
 *   - Single dates in any supported format
 */
export function extractPtoRowDates(rawLine: string, cycles: IntakeCycle[]): string[] {
  const results: string[] = []
  // Work on a copy; consumed spans are replaced with spaces so later passes
  // don't double-count.
  let w = stripOrdinalSuffixes(rawLine)

  function consume(pattern: RegExp, handler: (...groups: string[]) => string[]): void {
    w = w.replace(pattern, (...args) => {
      // args: [fullMatch, ...captureGroups, offset, originalString]
      const groups = args.slice(1, args.length - 2) as string[]
      results.push(...handler(...groups))
      return ' '
    })
  }

  // 1. M/D thru/through M/D
  consume(/(\d{1,2})\/(\d{1,2})\s+(?:thru|through)\s+(\d{1,2})\/(\d{1,2})/gi, (m1, d1, m2, d2) =>
    expandMonthDayRange(+m1, +d1, +m2, +d2, cycles)
  )

  // 2. Month D thru/through Month D  (e.g., "May 14 through May 18")
  consume(
    /([A-Za-z]+)\s+(\d{1,2})\s+(?:thru|through)\s+([A-Za-z]+)\s+(\d{1,2})/gi,
    (mn1, d1, mn2, d2) => {
      const from = parseMonthName(mn1)
      const to = parseMonthName(mn2)
      if (!from || !to) return []
      return expandMonthDayRange(from, +d1, to, +d2, cycles)
    }
  )

  // 3. Compact month range: "Month D-D" or "Month D - D"
  //    (e.g., "May 23-26", "June 12-14", "May 3 - 9")
  //    Must come BEFORE the cross-month rule so that "May 10 - May 23-26"
  //    has its "May 23-26" consumed first, leaving "May 10" as a lone token.
  consume(/([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})(?!\s*\/)/gi, (mn, d1, d2) => {
    const m = parseMonthName(mn)
    if (!m) return []
    return expandMonthDayRange(m, +d1, m, +d2, cycles)
  })

  // 4. Cross-month range: "Month D - Month D"  (e.g., "May 3 - June 13")
  consume(/([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2})/gi, (mn1, d1, mn2, d2) => {
    const from = parseMonthName(mn1)
    const to = parseMonthName(mn2)
    if (!from || !to) return []
    return expandMonthDayRange(from, +d1, to, +d2, cycles)
  })

  // 5. Slash range: "M/D - M/D"  (e.g., "5/3 - 5/5")
  consume(/(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})/g, (m1, d1, m2, d2) =>
    expandMonthDayRange(+m1, +d1, +m2, +d2, cycles)
  )

  // 6. Individual date tokens from whatever remains.
  //    Split first on separators (&, comma, semicolon) to handle lists.
  //    Use an explicit month-name alternative (not [A-Za-z]+) so words like
  //    "off" can't steal the leading digit from a slash date like "5/3".
  const MONTH_ALT =
    'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
  const tokenPat = new RegExp(
    `\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?\\b|\\b(?:${MONTH_ALT})\\.?\\s+\\d{1,2}(?:\\s+\\d{4})?\\b`,
    'gi'
  )
  const segments = w.split(/[,&;]+/)
  for (const seg of segments) {
    tokenPat.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = tokenPat.exec(seg)) !== null) {
      const iso = resolveSingleDateToken(m[0].trim(), cycles)
      if (iso) results.push(iso)
    }
  }

  return [...new Set(results)].sort()
}

// ---------------------------------------------------------------------------
// Line intent classification (within a PTO form body)
// ---------------------------------------------------------------------------

const WORK_INTENT_PATTERNS = [
  /\bWORK\b/, // all-caps sentinel
  /\bwork(?:ing)?\b/i,
  /\bback\s+to\s+work\b/i,
  /\bwill\s+work\b/i,
  /\bno\s+pto\b/i,
]

const OFF_INTENT_PATTERNS = [
  /\bneed\s+off\b/i,
  /\boff\b/i,
  /\bunavailable\b/i,
  /\bcannot\s+work\b/i,
  /\bcan'?t\s+work\b/i,
  /\bpto\b/i,
  /\bvacation\b/i,
]

/**
 * Lines that mention "working" only as a trailing "rest of week" caveat — they
 * should not generate force_on entries because we don't know the specific dates.
 * Strip these phrases before intent detection so the primary off-intent wins.
 */
const TRAILING_WORK_REST_PATTERN = /(?:\d+\s+)?(?:will\s+)?work\s+rest\s+of\s+(?:the\s+)?week\b.*/i

/**
 * Weekday recurrence patterns ("off Tuesdays", "off Tuesday + Wednesdays").
 * These can't be expanded without a full cycle calendar; they go to unresolvedLines.
 */
const WEEKDAY_RECURRENCE_PATTERN =
  /\b(?:every\s+)?(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*(?:\+|and|&|,)?\s*(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)?\b/i

const WEEKDAY_TOKEN_PATTERN =
  /\b(?:sun(?:day)?s?|mon(?:day)?s?|tue(?:s|sday)?s?|wed(?:nesday)?s?|thu(?:rs|rsday|rday)?s?|fri(?:day)?s?|sat(?:urday)?s?)\b/gi

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sundays: 0,
  sun: 0,
  monday: 1,
  mondays: 1,
  mon: 1,
  tuesday: 2,
  tuesdays: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wednesdays: 3,
  wed: 3,
  thursday: 4,
  thursdays: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fridays: 5,
  fri: 5,
  saturday: 6,
  saturdays: 6,
  sat: 6,
}

/**
 * Returns 'force_on' when the line has an explicit WORK signal, 'force_off'
 * otherwise (bare dates in a PTO form default to off).
 */
function classifyPtoLineIntent(line: string): 'force_off' | 'force_on' {
  const stripped = line.replace(TRAILING_WORK_REST_PATTERN, '').trim()
  if (WORK_INTENT_PATTERNS.some((p) => p.test(stripped))) return 'force_on'
  return 'force_off'
}

function hasExplicitPtoLineIntent(line: string): boolean {
  const stripped = line.replace(TRAILING_WORK_REST_PATTERN, '').trim()
  return (
    WORK_INTENT_PATTERNS.some((p) => p.test(stripped)) ||
    OFF_INTENT_PATTERNS.some((p) => p.test(stripped))
  )
}

function buildSingleCycleWindow(cycles: IntakeCycle[]): { start: string; end: string } | null {
  if (cycles.length !== 1) return null
  const cycle = cycles[0]
  if (!cycle) return null
  return { start: cycle.start_date, end: cycle.end_date }
}

function buildPtoRequestWindow(
  rawLines: string[],
  cycles: IntakeCycle[]
): { start: string; end: string } | null {
  for (const rawLine of rawLines) {
    if (!ANNOTATION_PREFIX.test(rawLine)) continue
    const cleanedLine = rawLine.replace(ANNOTATION_PREFIX, '').trim()
    const dates = extractPtoRowDates(cleanedLine, cycles)
    if (dates.length >= 2) {
      return {
        start: dates[0]!,
        end: dates[dates.length - 1]!,
      }
    }
  }

  return buildSingleCycleWindow(cycles)
}

function looksLikeWeekdayRecurrence(line: string): boolean {
  const weekdayTokens = [...line.toLowerCase().matchAll(WEEKDAY_TOKEN_PATTERN)].map(
    (match) => match[0]
  )
  if (weekdayTokens.length === 0) return false

  const uniqueWeekdays = new Set(weekdayTokens.map((token) => token.replace(/s$/, '')))
  const hasPluralWeekday = weekdayTokens.some((token) => token.endsWith('s') && token.length > 3)

  return uniqueWeekdays.size >= 2 || hasPluralWeekday || /\bevery\b/i.test(line)
}

function expandWeekdayRecurrenceAcrossWindow(
  line: string,
  window: { start: string; end: string } | null
): string[] {
  if (!window || !looksLikeWeekdayRecurrence(line)) return []

  const weekdays = [
    ...new Set(
      [...line.toLowerCase().matchAll(WEEKDAY_TOKEN_PATTERN)]
        .map((match) => WEEKDAY_MAP[match[0]])
        .filter((value): value is number => Number.isInteger(value))
    ),
  ]

  if (weekdays.length === 0) return []

  const dates: string[] = []
  const current = new Date(`${window.start}T00:00:00Z`)
  const end = new Date(`${window.end}T00:00:00Z`)

  while (current <= end) {
    if (weekdays.includes(current.getUTCDay())) {
      dates.push(current.toISOString().slice(0, 10))
    }
    current.setUTCDate(current.getUTCDate() + 1)
    if (dates.length > 90) break
  }

  return dates
}

// ---------------------------------------------------------------------------
// Form boilerplate / metadata line detection
// ---------------------------------------------------------------------------

/**
 * Returns true for lines that should be completely skipped (metadata, table
 * headers, etc.). Does NOT cover Employee Signature — that's tracked via state.
 */
function isPtoBoilerplateLine(line: string): boolean {
  return (
    /\bPTO\s+REQUEST(?:\/EDIT)?\s+FORM\b/i.test(line) ||
    /^Employee\s+Name\s*:/i.test(line) ||
    /^Department\s*:/i.test(line) ||
    /^Kronos(?:\s+Number)?\s*:/i.test(line) ||
    // Table header row: contains both "PTO Hours" and at least one other column
    (/PTO\s+Hours/i.test(line) && /(?:LT\s+Sick|Jury|Bereavement|Hours)/i.test(line)) ||
    // PTO type row: "PTO TYPE:" or "PTO selected" on a line by itself
    /^PTO\s+(?:TYPE|selected|type)\s*[:(]/i.test(line)
  )
}

// Strip day-of-week prefix:  "Mon: ...", "Wednesday: ..."
const DOW_PREFIX =
  /^(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*:\s*/i
// Strip annotation labels that sometimes appear in handwritten OCR
const ANNOTATION_PREFIX = /^(?:Handwritten\s+)?(?:note|comment|annotation)\s*:\s*/i

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when `text` appears to be a PTO REQUEST/EDIT FORM.
 * Heuristic: has the form title, OR has both Employee Name: and Employee Signature: headers.
 */
export function isPtoFormText(text: string): boolean {
  const hasTitle = /\bPTO\s+REQUEST(?:\/EDIT)?\s+FORM\b/i.test(text)
  const hasName = /^Employee\s+Name\s*:/im.test(text)
  const hasSig = /^Employee\s+Signature\s*:/im.test(text)
  return hasTitle || (hasName && hasSig)
}

/**
 * Parse a PTO REQUEST/EDIT FORM text into structured availability requests.
 * Returns the same `ParsedAvailabilityEmail` shape as `parseAvailabilityEmail`.
 */
export function parsePtoForm(text: string, cycles: IntakeCycle[]): ParsedAvailabilityEmail {
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim())

  const requests: ParsedAvailabilityRequest[] = []
  const unresolvedLines: string[] = []
  const activeWindow = buildPtoRequestWindow(rawLines, cycles)

  let afterSignature = false

  for (const rawLine of rawLines) {
    if (!rawLine) continue

    // ── Signature section ──────────────────────────────────────────────────
    if (/^Employee\s+Signature\s*:/i.test(rawLine)) {
      afterSignature = true
      continue
    }

    // Skip the Date: line that immediately follows the employee signature
    if (afterSignature && /^Date\s*:/i.test(rawLine)) {
      afterSignature = false
      continue
    }

    afterSignature = false

    // ── Static boilerplate ─────────────────────────────────────────────────
    if (isPtoBoilerplateLine(rawLine)) continue

    // ── Comments: — strip prefix, parse the remainder ─────────────────────
    let line = rawLine
    if (/^Comments?\s*[:=]/i.test(line)) {
      line = line.replace(/^Comments?\s*[:=]\s*/i, '').trim()
      if (!line) continue
    }

    // ── Annotation / note labels ───────────────────────────────────────────
    line = line.replace(ANNOTATION_PREFIX, '').trim()
    if (!line) continue
    if (
      ANNOTATION_PREFIX.test(rawLine) &&
      !hasExplicitPtoLineIntent(line) &&
      extractPtoRowDates(line, cycles).length >= 2
    ) {
      continue
    }

    // ── Day-of-week prefix ("Mon: off …") ─────────────────────────────────
    line = line.replace(DOW_PREFIX, '').trim()

    // ── Weekday recurrence ("off Tuesdays + Wednesdays") ─────────────────
    if (
      WEEKDAY_RECURRENCE_PATTERN.test(line) &&
      // Only flag as recurrence when there are no explicit calendar dates
      !/\d{1,2}\/\d{1,2}/.test(line) &&
      !/[A-Za-z]+\s+\d{1,2}/.test(line)
    ) {
      const recurrenceDates = expandWeekdayRecurrenceAcrossWindow(line, activeWindow)
      if (recurrenceDates.length === 0) {
        unresolvedLines.push(rawLine)
        continue
      }

      const overrideType = classifyPtoLineIntent(line)
      for (const date of recurrenceDates) {
        requests.push({
          date,
          override_type: overrideType,
          shift_type: 'both',
          note: null,
          source_line: rawLine,
        })
      }
      continue
    }

    // ── Date extraction ────────────────────────────────────────────────────
    const dates = extractPtoRowDates(line, cycles)

    if (dates.length === 0) {
      if (hasExplicitPtoLineIntent(line)) {
        unresolvedLines.push(rawLine)
      }
      continue
    }

    const overrideType = hasExplicitPtoLineIntent(line) ? classifyPtoLineIntent(line) : 'force_off'

    for (const date of dates) {
      requests.push({
        date,
        override_type: overrideType,
        shift_type: 'both',
        note: null,
        source_line: rawLine,
      })
    }
  }

  // Deduplicate, keeping last intent wins for a given date
  const deduped = Array.from(
    new Map(requests.map((r) => [`${r.date}:${r.override_type}:${r.shift_type}`, r])).values()
  ).sort((a, b) => a.date.localeCompare(b.date) || a.override_type.localeCompare(b.override_type))

  const cycleIds = new Set(
    deduped
      .map((r) => cycles.find((c) => r.date >= c.start_date && r.date <= c.end_date)?.id ?? null)
      .filter((v): v is string => v !== null)
  )

  const matchedCycleId = cycleIds.size === 1 ? ([...cycleIds][0] ?? null) : null

  const status: ParsedAvailabilityEmail['status'] =
    deduped.length === 0
      ? unresolvedLines.length > 0
        ? 'failed'
        : 'needs_review'
      : matchedCycleId
        ? unresolvedLines.length > 0
          ? 'needs_review'
          : 'parsed'
        : 'needs_review'

  const offCount = deduped.filter((r) => r.override_type === 'force_off').length
  const workCount = deduped.length - offCount
  const summaryParts = [
    `${deduped.length} date${deduped.length === 1 ? '' : 's'} parsed`,
    `${offCount} off`,
    `${workCount} work`,
  ]
  if (unresolvedLines.length > 0)
    summaryParts.push(
      `${unresolvedLines.length} line${unresolvedLines.length === 1 ? '' : 's'} need review`
    )

  return {
    requests: deduped,
    matchedCycleId,
    summary: summaryParts.join(' | '),
    status,
    unresolvedLines,
  }
}
