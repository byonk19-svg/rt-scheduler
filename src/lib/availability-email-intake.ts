import {
  extractAvailabilityEmployeeName,
  matchAvailabilityEmailEmployee,
  type AvailabilityEmailEmployeeCandidate,
} from '@/lib/availability-email-item-matcher'
import { normalizeRosterFullName } from '@/lib/employee-roster-bulk'

type AvailabilityOverrideType = 'force_off' | 'force_on'
type AvailabilityShiftType = 'day' | 'night' | 'both'

export type IntakeCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
}

export type ParsedAvailabilityRequest = {
  date: string
  override_type: AvailabilityOverrideType
  shift_type: AvailabilityShiftType
  note: string | null
  source_line: string
}

export type ParsedAvailabilityEmail = {
  requests: ParsedAvailabilityRequest[]
  matchedCycleId: string | null
  summary: string
  status: 'parsed' | 'needs_review' | 'failed'
  unresolvedLines: string[]
}

export type ParsedAvailabilityEmailItem = {
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  extractedEmployeeName: string | null
  employeeMatchCandidates: AvailabilityEmailEmployeeCandidate[]
  matchedTherapistId: string | null
  matchedCycleId: string | null
  parseStatus: 'parsed' | 'auto_applied' | 'needs_review' | 'failed'
  confidenceLevel: 'high' | 'medium' | 'low'
  confidenceReasons: string[]
  requests: ParsedAvailabilityRequest[]
  unresolvedLines: string[]
  rawText: string
}

export type ParsedAvailabilityEmailBatch = {
  items: ParsedAvailabilityEmailItem[]
  itemCount: number
  autoAppliedCount: number
  needsReviewCount: number
  failedCount: number
  summary: string
}

export type AvailabilityEmailBatchStatus = 'parsed' | 'needs_review' | 'failed' | 'applied'

export type AvailabilityEmailAttachmentSource = {
  id: string | null
  filename: string
  rawText: string | null
  ocrStatus: 'not_run' | 'completed' | 'failed' | 'skipped'
  ocrModel: string | null
  ocrError: string | null
}

export type ParsedAvailabilityEmailBatchItem = ParsedAvailabilityEmailItem & {
  attachmentId: string | null
  ocrStatus: 'not_run' | 'completed' | 'failed' | 'skipped'
  ocrModel: string | null
  ocrError: string | null
}

export type ParsedAvailabilityEmailBatchResult = {
  items: ParsedAvailabilityEmailBatchItem[]
  batchStatus: AvailabilityEmailBatchStatus
  batchSummary: ParsedAvailabilityEmailBatch
}

type MatchableProfile = {
  id: string
  full_name: string
  is_active?: boolean | null
}

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

const OFF_PATTERNS = [
  /\bneed off\b/i,
  /\boff\b/i,
  /\bunavailable\b/i,
  /\bcannot work\b/i,
  /\bcan'?t work\b/i,
  /\bpto\b/i,
  /\bvacation\b/i,
]

const WORK_PATTERNS = [
  /\bwant to work\b/i,
  /\bcan work\b/i,
  /\bavailable\b/i,
  /\bmust work\b/i,
  /\bno pto\b/i,
  /\bworking\b/i,
  /\bwork\b/i,
]

const PTO_FORM_MARKERS = [
  /\bpto request\/edit form\b/i,
  /\bemployee name\s*:/i,
  /\bemployee signature\b/i,
  /\bpto hours\b/i,
]

const PTO_METADATA_PATTERNS = [
  /^\s*-+\s*$/i,
  /^pto request(?:\/edit form)?$/i,
  /^employee name\s*:/i,
  /^department\s*:/i,
  /^kronos number\s*:/i,
  /^employee signature\s*:/i,
  /^signature\s*:/i,
  /^pto type\s*:/i,
  /^comments\s*:/i,
  /^date\s+pto hours\b/i,
  /^date\b[:\s-]+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i,
]

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

const INTENT_MATCHERS: Array<{ type: AvailabilityOverrideType; pattern: RegExp }> = [
  { type: 'force_off', pattern: /\bneed off\b/gi },
  { type: 'force_off', pattern: /\bcannot work\b/gi },
  { type: 'force_off', pattern: /\bcan'?t work\b/gi },
  { type: 'force_off', pattern: /\bunavailable\b/gi },
  { type: 'force_off', pattern: /\bvacation\b/gi },
  { type: 'force_off', pattern: /\bpto\b/gi },
  { type: 'force_off', pattern: /\boff\b/gi },
  { type: 'force_on', pattern: /\bwant to work\b/gi },
  { type: 'force_on', pattern: /\bcan work\b/gi },
  { type: 'force_on', pattern: /\bmust work\b/gi },
  { type: 'force_on', pattern: /\bavailable\b/gi },
  { type: 'force_on', pattern: /\bworking\b/gi },
  { type: 'force_on', pattern: /\bwork\b/gi },
]

const DATE_TOKEN_PATTERN =
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:,\s*\d{4})?\b/gi

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!isValidDateParts(year, month, day)) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function normalizeYear(year: number): number {
  if (year >= 100) return year
  return year >= 70 ? 1900 + year : 2000 + year
}

function inferExplicitDate(token: string): string | null {
  const trimmed = token.trim().replace(/\.$/, '')

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10)
    const day = Number.parseInt(slashMatch[2], 10)
    if (!slashMatch[3]) return null
    const year = normalizeYear(Number.parseInt(slashMatch[3], 10))
    return toIsoDate(year, month, day)
  }

  const monthNameMatch = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?$/)
  if (monthNameMatch) {
    const month = MONTHS[monthNameMatch[1].toLowerCase()]
    if (!month || !monthNameMatch[3]) return null
    const day = Number.parseInt(monthNameMatch[2], 10)
    const year = Number.parseInt(monthNameMatch[3], 10)
    return toIsoDate(year, month, day)
  }

  return null
}

function inferCycleScopedDate(token: string, cycles: IntakeCycle[]): string | null {
  const trimmed = token.trim().replace(/\.$/, '')
  let month: number | null = null
  let day: number | null = null

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) {
    month = Number.parseInt(slashMatch[1], 10)
    day = Number.parseInt(slashMatch[2], 10)
  }

  const monthNameMatch = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2})$/)
  if (monthNameMatch) {
    month = MONTHS[monthNameMatch[1].toLowerCase()] ?? null
    day = Number.parseInt(monthNameMatch[2], 10)
  }

  if (!month || !day) return null

  const matches = new Set<string>()
  for (const cycle of cycles) {
    const cycleYear = Number.parseInt(cycle.start_date.slice(0, 4), 10)
    const sameYear = toIsoDate(cycleYear, month, day)
    if (sameYear && sameYear >= cycle.start_date && sameYear <= cycle.end_date) {
      matches.add(sameYear)
    }

    const nextYear = toIsoDate(cycleYear + 1, month, day)
    if (nextYear && nextYear >= cycle.start_date && nextYear <= cycle.end_date) {
      matches.add(nextYear)
    }
  }

  if (matches.size !== 1) return null
  return [...matches][0] ?? null
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function stripOrdinalSuffixes(value: string): string {
  return value.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
}

function isPtoFormText(text: string): boolean {
  return PTO_FORM_MARKERS.some((pattern) => pattern.test(text))
}

function shouldIgnorePtoMetadataLine(line: string): boolean {
  return PTO_METADATA_PATTERNS.some((pattern) => pattern.test(line))
}

function inferDateToken(token: string, cycles: IntakeCycle[]): string | null {
  const explicit = inferExplicitDate(token)
  if (explicit) return explicit
  return inferCycleScopedDate(token, cycles)
}

function expandIsoDateRange(startIso: string, endIso: string): string[] {
  if (endIso < startIso) return []

  const dates: string[] = []
  const current = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
    if (dates.length > 90) break
  }

  return dates
}

function collectRangeDates(
  line: string,
  cycles: IntakeCycle[]
): { dates: string[]; stripped: string } {
  let stripped = stripOrdinalSuffixes(line)
  const resolved = new Set<string>()

  const applyRange = (startToken: string, endToken: string) => {
    const startIso = inferDateToken(startToken, cycles)
    const endIso = inferDateToken(endToken, cycles)
    if (!startIso || !endIso) return

    for (const iso of expandIsoDateRange(startIso, endIso)) {
      resolved.add(iso)
    }
  }

  const repeatedMonthPattern =
    /\b([A-Za-z]+\.?\s+\d{1,2}(?:,\s*\d{4})?)\s*(?:-|thru|through|to)\s*([A-Za-z]+\.?\s+\d{1,2}(?:,\s*\d{4})?)\b/gi
  stripped = stripped.replace(repeatedMonthPattern, (...args) => {
    const match = args[0] as string
    applyRange(args[1] as string, args[2] as string)
    return ' '.repeat(match.length)
  })

  const sameMonthTextPattern =
    /\b([A-Za-z]+\.?\s+\d{1,2}(?:,\s*\d{4})?)\s*(?:-|thru|through|to)\s*(\d{1,2})\b/gi
  stripped = stripped.replace(sameMonthTextPattern, (...args) => {
    const match = args[0] as string
    const first = args[1] as string
    const second = args[2] as string
    const firstParts = first.match(/^([A-Za-z]+\.?)\s+(\d{1,2})(?:,\s*(\d{4}))?$/i)
    if (firstParts) {
      const inheritedMonth = firstParts[1]
      const inheritedYear = firstParts[3] ? `, ${firstParts[3]}` : ''
      applyRange(first, `${inheritedMonth} ${second}${inheritedYear}`)
    }
    return ' '.repeat(match.length)
  })

  const slashFullPattern =
    /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:-|thru|through|to)\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi
  stripped = stripped.replace(slashFullPattern, (...args) => {
    const match = args[0] as string
    applyRange(args[1] as string, args[2] as string)
    return ' '.repeat(match.length)
  })

  const slashSameMonthPattern = /\b(\d{1,2}\/\d{1,2})\s*(?:-|thru|through|to)\s*(\d{1,2})\b/gi
  stripped = stripped.replace(slashSameMonthPattern, (...args) => {
    const match = args[0] as string
    const first = args[1] as string
    const second = args[2] as string
    const firstParts = first.match(/^(\d{1,2})\/(\d{1,2})$/)
    if (firstParts) {
      applyRange(first, `${firstParts[1]}/${second}`)
    }
    return ' '.repeat(match.length)
  })

  return { dates: [...resolved].sort((a, b) => a.localeCompare(b)), stripped }
}

function buildPtoWindow(
  lines: string[],
  cycles: IntakeCycle[]
): { start: string; end: string } | null {
  const windowLines = lines.filter(
    (line) =>
      /\b(?:handwritten note|note)\s*:/i.test(line) ||
      (!classifyOverrideType(line) && /(through|thru|-)/i.test(line))
  )

  for (const line of windowLines) {
    const { dates } = collectRangeDates(line, cycles)
    if (dates.length >= 2) {
      return { start: dates[0]!, end: dates[dates.length - 1]! }
    }
  }

  if (cycles.length === 1) {
    return { start: cycles[0]!.start_date, end: cycles[0]!.end_date }
  }

  return null
}

function extractWeekdayDates(
  line: string,
  window: { start: string; end: string } | null
): string[] {
  if (!window) return []

  const weekdayMatches = [
    ...line
      .toLowerCase()
      .matchAll(
        /\b(?:sun(?:day)?s?|mon(?:day)?s?|tue(?:s|sday)?s?|wed(?:nesday)?s?|thu(?:rs|rsday|rday)?s?|fri(?:day)?s?|sat(?:urday)?s?)\b/g
      ),
  ]
  const weekdays = [
    ...new Set(
      weekdayMatches
        .map((match) => WEEKDAY_MAP[match[0]])
        .filter((value): value is number => Number.isInteger(value))
    ),
  ]

  if (weekdays.length === 0) return []

  const resolved: string[] = []
  const current = new Date(`${window.start}T00:00:00Z`)
  const end = new Date(`${window.end}T00:00:00Z`)

  while (current <= end) {
    if (weekdays.includes(current.getUTCDay())) {
      resolved.push(current.toISOString().slice(0, 10))
    }
    current.setUTCDate(current.getUTCDate() + 1)
    if (resolved.length > 90) break
  }

  return resolved
}

function splitIntoCandidateLines(text: string): string[] {
  return text
    .split(/\r?\n|;/)
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 0)
}

function shouldIgnoreCandidateLine(line: string): boolean {
  return (
    /\b(?:from|to|sent|subject|cc)\s*:/i.test(line) ||
    /teamwise\.work/i.test(line) ||
    /mailto:/i.test(line)
  )
}

function classifyOverrideType(line: string): AvailabilityOverrideType | null {
  if (OFF_PATTERNS.some((pattern) => pattern.test(line))) return 'force_off'
  if (WORK_PATTERNS.some((pattern) => pattern.test(line))) return 'force_on'
  return null
}

function splitLineIntoIntentSegments(
  line: string
): Array<{ overrideType: AvailabilityOverrideType; segment: string }> {
  const matches: Array<{
    overrideType: AvailabilityOverrideType
    index: number
    text: string
    end: number
  }> = []

  for (const matcher of INTENT_MATCHERS) {
    matcher.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = matcher.pattern.exec(line)) !== null) {
      matches.push({
        overrideType: matcher.type,
        index: match.index,
        text: match[0],
        end: match.index + match[0].length,
      })
    }
  }

  if (matches.length === 0) return []

  const dedupedMatches: typeof matches = []
  for (const match of matches.sort((a, b) => a.index - b.index || b.text.length - a.text.length)) {
    const previous = dedupedMatches.at(-1)
    if (previous && match.index < previous.end) {
      continue
    }
    dedupedMatches.push(match)
  }

  return dedupedMatches.map((match, index) => ({
    overrideType: match.overrideType,
    segment: line.slice(match.index, dedupedMatches[index + 1]?.index ?? line.length).trim(),
  }))
}

function extractDateTokens(line: string): string[] {
  const matches = line.match(DATE_TOKEN_PATTERN)
  if (!matches) return []
  return [...new Set(matches.map((match) => normalizeLine(match)))]
}

function resolveLineDates(line: string, cycles: IntakeCycle[]): string[] {
  const resolved = new Set<string>()

  for (const token of extractDateTokens(line)) {
    const explicit = inferExplicitDate(token)
    if (explicit) {
      resolved.add(explicit)
      continue
    }

    const inferred = inferCycleScopedDate(token, cycles)
    if (inferred) {
      resolved.add(inferred)
    }
  }

  return [...resolved].sort((a, b) => a.localeCompare(b))
}

function summarizeRequests(
  requests: ParsedAvailabilityRequest[],
  unresolvedLines: string[]
): string {
  if (requests.length === 0) {
    return unresolvedLines.length > 0
      ? 'Found request language but could not resolve any dates.'
      : 'No request lines with dates were detected.'
  }

  const offCount = requests.filter((request) => request.override_type === 'force_off').length
  const workCount = requests.length - offCount
  const summaryParts = [
    `${requests.length} date${requests.length === 1 ? '' : 's'} parsed`,
    `${offCount} off`,
    `${workCount} work`,
  ]

  if (unresolvedLines.length > 0) {
    summaryParts.push(
      `${unresolvedLines.length} line${unresolvedLines.length === 1 ? '' : 's'} need review`
    )
  }

  return summaryParts.join(' | ')
}

function shouldIgnoreUnresolvedRequestLine(line: string): boolean {
  return /\bpto\b/i.test(line) && /\brequest\b/i.test(line) && extractDateTokens(line).length === 0
}

function parsePtoFormAvailability(
  sourceText: string,
  cycles: IntakeCycle[]
): ParsedAvailabilityEmail {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 0)

  const requests: ParsedAvailabilityRequest[] = []
  const unresolvedLines: string[] = []
  const window = buildPtoWindow(lines, cycles)

  for (const line of lines) {
    if (shouldIgnorePtoMetadataLine(line)) continue

    const ignoreRestOfWeekWork = /\brest of (?:the )?week\b/i.test(line) && /\boff\b/i.test(line)
    const explicitIntent = ignoreRestOfWeekWork ? 'force_off' : classifyOverrideType(line)
    const normalizedLine = stripOrdinalSuffixes(line)
    const hasWeekdays = /\b(?:sun|mon|tue|wed|thu|fri|sat)/i.test(line)
    const defaultOff =
      explicitIntent === null && (extractDateTokens(normalizedLine).length > 0 || hasWeekdays)
    const overrideType = explicitIntent ?? (defaultOff ? 'force_off' : null)

    if (!overrideType) continue

    const { dates: rangeDates, stripped } = collectRangeDates(line, cycles)
    const resolved = new Set<string>(rangeDates)
    for (const date of resolveLineDates(stripped, cycles)) {
      resolved.add(date)
    }
    for (const date of extractWeekdayDates(line, window)) {
      resolved.add(date)
    }

    const dates = [...resolved].sort((a, b) => a.localeCompare(b))
    if (dates.length === 0) {
      unresolvedLines.push(line)
      continue
    }

    for (const date of dates) {
      requests.push({
        date,
        override_type: overrideType,
        shift_type: 'both',
        note: null,
        source_line: line,
      })
    }
  }

  const dedupedRequests = Array.from(
    new Map(
      requests.map((request) => [
        `${request.date}:${request.override_type}:${request.shift_type}`,
        request,
      ])
    ).values()
  ).sort((a, b) => a.date.localeCompare(b.date) || a.override_type.localeCompare(b.override_type))

  const matchingCycleIds = new Set(
    dedupedRequests
      .map(
        (request) =>
          cycles.find((cycle) => request.date >= cycle.start_date && request.date <= cycle.end_date)
            ?.id ?? null
      )
      .filter((value): value is string => Boolean(value))
  )

  const matchedCycleId = matchingCycleIds.size === 1 ? ([...matchingCycleIds][0] ?? null) : null
  const status: ParsedAvailabilityEmail['status'] =
    dedupedRequests.length === 0
      ? 'failed'
      : matchedCycleId && unresolvedLines.length === 0
        ? 'parsed'
        : 'needs_review'

  return {
    requests: dedupedRequests,
    matchedCycleId,
    summary: summarizeRequests(dedupedRequests, unresolvedLines),
    status,
    unresolvedLines,
  }
}

function splitEmployeeFormBlocks(text: string): string[] {
  const rawLines = text.split(/\r?\n/)
  const blocks: string[][] = []
  let current: string[] = []
  let seenEmployeeHeader = false

  for (const rawLine of rawLines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^\s*-{3,}\s*$/.test(line)) {
      if (current.length > 0) {
        blocks.push(current)
        current = []
      }
      continue
    }

    if (/^employee name\s*:/i.test(line)) {
      seenEmployeeHeader = true
      if (current.length > 0) {
        blocks.push(current)
        current = []
      }
    }

    if (!seenEmployeeHeader && isPtoFormText(text)) {
      continue
    }

    current.push(rawLine)
  }

  if (current.length > 0) {
    blocks.push(current)
  }

  return blocks.length > 1 ? blocks.map((block) => block.join('\n').trim()) : [text]
}

function sanitizeEmployeeBlockText(block: string): string {
  return block
    .replace(/^---\s*Page\s+\d+\s*---$/gim, '')
    .replace(/Employee Name:\s*Employee Name:\s*/gi, 'Employee Name: ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function expandSourceCandidateIntoEmployeeBlocks(candidate: {
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  rawText: string
  attachment: AvailabilityEmailAttachmentSource | null
}): Array<{
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  rawText: string
  attachment: AvailabilityEmailAttachmentSource | null
}> {
  const blocks = splitEmployeeFormBlocks(candidate.rawText)
  if (blocks.length <= 1) return [candidate]

  const merged = new Map<
    string,
    {
      sourceType: 'body' | 'attachment'
      sourceLabel: string
      rawText: string
      attachment: AvailabilityEmailAttachmentSource | null
    }
  >()

  for (const block of blocks) {
    const sanitizedBlock = sanitizeEmployeeBlockText(block)
    const extractedName = extractAvailabilityEmployeeName(sanitizedBlock)
    const key = extractedName ? normalizeRosterFullName(extractedName) : `block:${merged.size}`
    const existing = merged.get(key)
    if (existing) {
      existing.rawText = `${existing.rawText}\n${sanitizedBlock}`.trim()
      continue
    }
    merged.set(key, {
      ...candidate,
      rawText: sanitizedBlock,
    })
  }

  return [...merged.values()]
}

function buildConfidenceReasons(params: {
  therapistMatch: ReturnType<typeof matchAvailabilityEmailEmployee>
  parsed: ParsedAvailabilityEmail
}): string[] {
  const reasons = [...params.therapistMatch.reasons]
  if (params.parsed.requests.length === 0) {
    reasons.push('request_dates_missing')
  }
  if (params.parsed.requests.length > 0 && !params.parsed.matchedCycleId) {
    reasons.push('cycle_match_missing')
  }
  if (params.parsed.unresolvedLines.length > 0) {
    reasons.push('unresolved_lines_present')
  }
  return [...new Set(reasons)]
}

function classifyItemConfidence(params: {
  therapistMatch: ReturnType<typeof matchAvailabilityEmailEmployee>
  parsed: ParsedAvailabilityEmail
  confidenceReasons: string[]
}): 'high' | 'medium' | 'low' {
  if (
    params.therapistMatch.confidence === 'high' &&
    params.parsed.requests.length > 0 &&
    params.parsed.matchedCycleId &&
    params.parsed.unresolvedLines.length === 0
  ) {
    return 'high'
  }

  if (params.parsed.requests.length > 0) {
    return 'medium'
  }

  if (params.confidenceReasons.length > 0) {
    return 'low'
  }

  return 'low'
}

export function parseAvailabilityEmailItem(params: {
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  rawText: string
  cycles: IntakeCycle[]
  profiles: MatchableProfile[]
}): ParsedAvailabilityEmailItem {
  const therapistMatch = matchAvailabilityEmailEmployee(params.rawText, params.profiles)
  const parsed = parseAvailabilityEmail(params.rawText, params.cycles)
  const confidenceReasons = buildConfidenceReasons({ therapistMatch, parsed })
  const confidenceLevel = classifyItemConfidence({
    therapistMatch,
    parsed,
    confidenceReasons,
  })

  const parseStatus: ParsedAvailabilityEmailItem['parseStatus'] =
    parsed.requests.length === 0 ? 'failed' : confidenceLevel === 'high' ? 'parsed' : 'needs_review'

  return {
    sourceType: params.sourceType,
    sourceLabel: params.sourceLabel,
    extractedEmployeeName: therapistMatch.extractedName,
    employeeMatchCandidates: therapistMatch.candidates,
    matchedTherapistId: therapistMatch.matchedTherapistId,
    matchedCycleId: parsed.matchedCycleId,
    parseStatus,
    confidenceLevel,
    confidenceReasons,
    requests: parsed.requests,
    unresolvedLines: parsed.unresolvedLines,
    rawText: params.rawText,
  }
}

export function summarizeAvailabilityEmailBatch(
  items: ParsedAvailabilityEmailItem[]
): ParsedAvailabilityEmailBatch {
  const autoAppliedCount = items.filter((item) => item.parseStatus === 'auto_applied').length
  const failedCount = items.filter((item) => item.parseStatus === 'failed').length
  const needsReviewCount = items.filter((item) => item.parseStatus === 'needs_review').length
  const parsedCount = items.filter((item) => item.parseStatus === 'parsed').length

  return {
    items,
    itemCount: items.length,
    autoAppliedCount,
    needsReviewCount,
    failedCount,
    summary: [
      `${items.length} item${items.length === 1 ? '' : 's'}`,
      `${parsedCount} parsed`,
      `${needsReviewCount} need review`,
      `${failedCount} failed`,
    ].join(' | '),
  }
}

function buildSourceCandidates(params: {
  normalizedBodyText: string
  attachments: AvailabilityEmailAttachmentSource[]
}): Array<{
  sourceType: 'body' | 'attachment'
  sourceLabel: string
  rawText: string
  attachment: AvailabilityEmailAttachmentSource | null
}> {
  const candidates: Array<{
    sourceType: 'body' | 'attachment'
    sourceLabel: string
    rawText: string
    attachment: AvailabilityEmailAttachmentSource | null
  }> = []

  if (params.normalizedBodyText.trim().length > 0) {
    candidates.push({
      sourceType: 'body',
      sourceLabel: 'Email body',
      rawText: params.normalizedBodyText,
      attachment: null,
    })
  }

  for (const attachment of params.attachments) {
    candidates.push({
      sourceType: 'attachment',
      sourceLabel: attachment.filename,
      rawText: attachment.rawText ?? '',
      attachment,
    })
  }

  return candidates.flatMap((candidate) => expandSourceCandidateIntoEmployeeBlocks(candidate))
}

function buildItemParseStatus(params: {
  item: ParsedAvailabilityEmailItem
  autoApplyHighConfidence: boolean
}): ParsedAvailabilityEmailItem['parseStatus'] {
  if (
    params.autoApplyHighConfidence &&
    params.item.confidenceLevel === 'high' &&
    params.item.matchedTherapistId &&
    params.item.matchedCycleId &&
    params.item.requests.length > 0
  ) {
    return 'auto_applied'
  }

  return params.item.parseStatus
}

function getBatchStatus(items: ParsedAvailabilityEmailItem[]): AvailabilityEmailBatchStatus {
  if (items.length === 0) return 'failed'
  if (items.some((item) => item.parseStatus === 'needs_review' || item.parseStatus === 'failed')) {
    return 'needs_review'
  }
  if (items.every((item) => item.parseStatus === 'auto_applied')) {
    return 'applied'
  }
  return 'parsed'
}

export function parseAvailabilityEmailBatchSources(params: {
  normalizedBodyText: string
  attachments: AvailabilityEmailAttachmentSource[]
  cycles: IntakeCycle[]
  profiles: MatchableProfile[]
  autoApplyHighConfidence?: boolean
}): ParsedAvailabilityEmailBatchResult {
  const items = buildSourceCandidates({
    normalizedBodyText: params.normalizedBodyText,
    attachments: params.attachments,
  }).map((candidate) => {
    const parsedItem = parseAvailabilityEmailItem({
      sourceType: candidate.sourceType,
      sourceLabel: candidate.sourceLabel,
      rawText: candidate.rawText,
      cycles: params.cycles,
      profiles: params.profiles,
    })

    return {
      ...parsedItem,
      parseStatus: buildItemParseStatus({
        item: parsedItem,
        autoApplyHighConfidence: params.autoApplyHighConfidence ?? false,
      }),
      attachmentId: candidate.attachment?.id ?? null,
      ocrStatus: candidate.attachment?.ocrStatus ?? 'not_run',
      ocrModel: candidate.attachment?.ocrModel ?? null,
      ocrError: candidate.attachment?.ocrError ?? null,
    } satisfies ParsedAvailabilityEmailBatchItem
  })

  return {
    items,
    batchStatus: getBatchStatus(items),
    batchSummary: summarizeAvailabilityEmailBatch(items),
  }
}

export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSender(raw: string | null | undefined): {
  email: string | null
  name: string | null
} {
  if (!raw) return { email: null, name: null }
  const trimmed = raw.trim()
  const bracketMatch = trimmed.match(/^(.*)<([^>]+)>$/)
  if (bracketMatch) {
    const name = bracketMatch[1].replace(/^"|"$/g, '').trim() || null
    const email = bracketMatch[2].trim().toLowerCase()
    return { email, name }
  }

  const asEmail = trimmed.toLowerCase()
  return {
    email: asEmail.includes('@') ? asEmail : null,
    name: asEmail.includes('@') ? null : trimmed,
  }
}

export function parseAvailabilityEmail(
  sourceText: string,
  cycles: IntakeCycle[]
): ParsedAvailabilityEmail {
  if (isPtoFormText(sourceText)) {
    return parsePtoFormAvailability(sourceText, cycles)
  }

  const lines = splitIntoCandidateLines(sourceText)
  const requests: ParsedAvailabilityRequest[] = []
  const unresolvedLines: string[] = []

  for (const rawLine of lines) {
    if (shouldIgnoreCandidateLine(rawLine)) {
      continue
    }

    const segments = splitLineIntoIntentSegments(rawLine)
    if (segments.length === 0) {
      const overrideType = classifyOverrideType(rawLine)
      if (!overrideType) continue

      const dates = resolveLineDates(rawLine, cycles)
      if (dates.length === 0) {
        if (shouldIgnoreUnresolvedRequestLine(rawLine)) continue
        unresolvedLines.push(rawLine)
        continue
      }

      for (const date of dates) {
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

    let matchedAnyDate = false
    for (const segment of segments) {
      const dates =
        segments.length === 1
          ? resolveLineDates(rawLine, cycles)
          : resolveLineDates(segment.segment, cycles)
      if (dates.length === 0) continue
      matchedAnyDate = true

      for (const date of dates) {
        requests.push({
          date,
          override_type: segment.overrideType,
          shift_type: 'both',
          note: null,
          source_line: segments.length === 1 ? rawLine : segment.segment,
        })
      }
    }

    if (!matchedAnyDate) {
      if (shouldIgnoreUnresolvedRequestLine(rawLine)) continue
      unresolvedLines.push(rawLine)
    }
  }

  const dedupedRequests = Array.from(
    new Map(
      requests.map((request) => [
        `${request.date}:${request.override_type}:${request.shift_type}`,
        request,
      ])
    ).values()
  ).sort((a, b) => a.date.localeCompare(b.date) || a.override_type.localeCompare(b.override_type))

  const matchingCycleIds = new Set(
    dedupedRequests
      .map(
        (request) =>
          cycles.find((cycle) => request.date >= cycle.start_date && request.date <= cycle.end_date)
            ?.id ?? null
      )
      .filter((value): value is string => Boolean(value))
  )

  const matchedCycleId = matchingCycleIds.size === 1 ? ([...matchingCycleIds][0] ?? null) : null

  const status: ParsedAvailabilityEmail['status'] =
    dedupedRequests.length === 0
      ? unresolvedLines.length > 0
        ? 'failed'
        : 'needs_review'
      : matchedCycleId
        ? unresolvedLines.length > 0
          ? 'needs_review'
          : 'parsed'
        : 'needs_review'

  return {
    requests: dedupedRequests,
    matchedCycleId,
    summary: summarizeRequests(dedupedRequests, unresolvedLines),
    status,
    unresolvedLines,
  }
}

export function sanitizeParsedRequests(value: unknown): ParsedAvailabilityRequest[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const candidate = entry as Record<string, unknown>
      const date = typeof candidate.date === 'string' ? candidate.date.trim() : ''
      const overrideType = candidate.override_type
      const shiftType = candidate.shift_type
      const sourceLine =
        typeof candidate.source_line === 'string' ? candidate.source_line.trim() : 'Imported email'
      const note = typeof candidate.note === 'string' ? candidate.note.trim() || null : null

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      if (overrideType !== 'force_off' && overrideType !== 'force_on') return null
      if (shiftType !== 'day' && shiftType !== 'night' && shiftType !== 'both') return null

      return {
        date,
        override_type: overrideType,
        shift_type: shiftType,
        note,
        source_line: sourceLine,
      } satisfies ParsedAvailabilityRequest
    })
    .filter((entry): entry is ParsedAvailabilityRequest => entry !== null)
}
