import { normalizeRosterFullName } from '@/lib/employee-roster-bulk'

export type AvailabilityEmailEmployeeCandidate = {
  id: string
  fullName: string
}

export type AvailabilityEmailEmployeeMatch = {
  extractedName: string | null
  matchedTherapistId: string | null
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  candidates: AvailabilityEmailEmployeeCandidate[]
}

type MatchableProfile = {
  id: string
  full_name: string
  is_active?: boolean | null
}

const NOISE_LINE_PATTERNS = [
  /@/,
  /\bdepartment\b/i,
  /\bkronos\b/i,
  /\bdate\b/i,
  /\bsignature\b/i,
  /\brequest\b/i,
  /\bpto\b/i,
  /\bedit form\b/i,
  /\bhours?\b/i,
  /\bneed\b/i,
  /\boff\b/i,
  /\bavailable\b/i,
  /\bwork\b/i,
]

function sanitizeExtractedName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z]+|[^A-Za-z.' -]+$/g, '')
    .trim()
}

function looksLikePersonName(value: string): boolean {
  if (!value || /\d/.test(value)) return false
  const words = sanitizeExtractedName(value).split(/\s+/).filter(Boolean)

  if (words.length < 2 || words.length > 4) return false
  return words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))
}

function looksLikeExplicitLabelName(value: string): boolean {
  const words = sanitizeExtractedName(value).split(/\s+/).filter(Boolean)

  if (words.length < 1 || words.length > 4) return false
  return words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))
}

export function extractAvailabilityEmployeeName(rawText: string): string | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const explicitSource = line.split(/\s{2,}(?=[A-Z][A-Za-z0-9 #]+:)/)[0] ?? line
    const explicitMatch = explicitSource.match(
      /\b(?:employee\s+name|name)\b[:\s-]*([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3})\b/i
    )
    if (explicitMatch) {
      const extracted = sanitizeExtractedName(explicitMatch[1] ?? '')
      if (looksLikeExplicitLabelName(extracted)) return extracted
    }
  }

  for (const line of lines) {
    if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line))) continue
    const extracted = sanitizeExtractedName(line)
    if (looksLikePersonName(extracted)) return extracted
  }

  const inlineMatch = rawText.match(/\bfor\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/)
  if (inlineMatch) {
    const extracted = sanitizeExtractedName(inlineMatch[1] ?? '')
    if (looksLikePersonName(extracted)) return extracted
  }

  return null
}

export function matchAvailabilityEmailEmployee(
  rawText: string,
  profiles: MatchableProfile[]
): AvailabilityEmailEmployeeMatch {
  const extractedName = extractAvailabilityEmployeeName(rawText)
  if (!extractedName) {
    return {
      extractedName: null,
      matchedTherapistId: null,
      confidence: 'low',
      reasons: ['employee_name_missing'],
      candidates: [],
    }
  }

  const normalizedExtractedName = normalizeRosterFullName(extractedName)
  const activeProfiles = profiles.filter((profile) => profile.is_active !== false)

  const exactMatches = activeProfiles.filter(
    (profile) => normalizeRosterFullName(profile.full_name) === normalizedExtractedName
  )

  if (exactMatches.length === 1) {
    return {
      extractedName,
      matchedTherapistId: exactMatches[0]?.id ?? null,
      confidence: 'high',
      reasons: [],
      candidates: exactMatches.map((profile) => ({ id: profile.id, fullName: profile.full_name })),
    }
  }

  if (exactMatches.length > 1) {
    return {
      extractedName,
      matchedTherapistId: null,
      confidence: 'medium',
      reasons: ['employee_match_ambiguous'],
      candidates: exactMatches.map((profile) => ({ id: profile.id, fullName: profile.full_name })),
    }
  }

  const extractedTokens = normalizedExtractedName.split(' ')
  const partialMatches = activeProfiles.filter((profile) => {
    const normalizedProfileName = normalizeRosterFullName(profile.full_name)
    return extractedTokens.every((token) => normalizedProfileName.includes(token))
  })

  if (partialMatches.length === 1) {
    return {
      extractedName,
      matchedTherapistId: null,
      confidence: 'medium',
      reasons: ['employee_match_fuzzy'],
      candidates: partialMatches.map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
      })),
    }
  }

  if (partialMatches.length > 1) {
    return {
      extractedName,
      matchedTherapistId: null,
      confidence: 'medium',
      reasons: ['employee_match_ambiguous'],
      candidates: partialMatches.map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
      })),
    }
  }

  return {
    extractedName,
    matchedTherapistId: null,
    confidence: 'low',
    reasons: ['employee_match_missing'],
    candidates: [],
  }
}
