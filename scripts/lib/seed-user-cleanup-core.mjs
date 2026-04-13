/**
 * @typedef {{ id: string, email?: string | null }} AuthUserLike
 *
 * @typedef {{
 *   allowedDomains?: string[],
 *   emailPrefixes?: string[],
 *   exactEmails?: string[],
 * }} CleanupRuleOptions
 *
 * @typedef {{
 *   user: AuthUserLike,
 *   reasons: string[],
 *   email: string,
 * }} CleanupMatch
 */

const DEFAULT_ALLOWED_DOMAINS = ['teamwise.test']
const DEFAULT_EMAIL_PREFIXES = ['demo-manager', 'demo-lead-', 'demo-therapist', 'employee']
const DEFAULT_EXACT_EMAILS = ['manager@teamwise.test']

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeList(values) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) =>
          String(value ?? '')
            .trim()
            .toLowerCase()
        )
        .filter((value) => value.length > 0)
    )
  )
}

function buildRules(options = {}) {
  const allowedDomains = normalizeList(options.allowedDomains)
  const emailPrefixes = normalizeList(options.emailPrefixes)
  const exactEmails = normalizeList(options.exactEmails)

  return {
    allowedDomains: allowedDomains.length > 0 ? allowedDomains : DEFAULT_ALLOWED_DOMAINS,
    emailPrefixes: emailPrefixes.length > 0 ? emailPrefixes : DEFAULT_EMAIL_PREFIXES,
    exactEmails: exactEmails.length > 0 ? exactEmails : DEFAULT_EXACT_EMAILS,
  }
}

function getEmailDomain(email) {
  const atIndex = email.lastIndexOf('@')
  if (atIndex < 0) return ''
  return email.slice(atIndex + 1)
}

/**
 * @param {AuthUserLike} user
 * @param {CleanupRuleOptions} [options]
 * @returns {CleanupMatch | null}
 */
export function matchSeedUser(user, options = {}) {
  const rules = buildRules(options)
  const email = normalizeEmail(user.email)
  if (!email) return null

  const reasons = []
  const domain = getEmailDomain(email)
  if (rules.allowedDomains.includes(domain)) {
    reasons.push('matches seeded test domain')
  }

  const localPart = domain ? email.slice(0, email.length - domain.length - 1) : email
  if (rules.emailPrefixes.some((prefix) => localPart.startsWith(prefix))) {
    reasons.push('matches seeded email prefix')
  }

  if (rules.exactEmails.includes(email)) {
    reasons.push('matches seeded exact email')
  }

  const hasDomainMatch = reasons.includes('matches seeded test domain')
  const hasIdentityMatch =
    reasons.includes('matches seeded email prefix') ||
    reasons.includes('matches seeded exact email')

  if (!hasDomainMatch || !hasIdentityMatch) return null

  return {
    user,
    reasons,
    email,
  }
}

/**
 * @param {AuthUserLike[]} users
 * @param {CleanupRuleOptions} [options]
 */
export function buildCleanupPlan(users, options = {}) {
  const matches = []
  const skipped = []

  for (const user of users) {
    const match = matchSeedUser(user, options)
    if (match) {
      matches.push(match)
      continue
    }
    skipped.push(user)
  }

  return {
    matches,
    skipped,
    summary: {
      total: users.length,
      matched: matches.length,
      skipped: skipped.length,
    },
    rules: buildRules(options),
  }
}
