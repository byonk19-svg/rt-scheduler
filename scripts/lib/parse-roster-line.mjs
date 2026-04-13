function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim())
}

function normEmail(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function titleCaseFromLocalPart(local) {
  const raw = String(local ?? '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  return raw.length > 0 ? raw : 'New User'
}

/**
 * @returns {{ fullName: string, email: string } | null }
 */
export function parseRosterLine(line) {
  const raw = String(line ?? '').trim()
  if (!raw || raw.startsWith('#')) return null

  if (raw.includes('\t')) {
    const parts = raw
      .split(/\t+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length < 2) {
      throw new Error(`Tab line needs name and email: ${raw}`)
    }
    const a = parts[0]
    const b = parts[1]
    if (looksLikeEmail(a) && !looksLikeEmail(b)) {
      return { fullName: b, email: normEmail(a) }
    }
    if (looksLikeEmail(b) && !looksLikeEmail(a)) {
      return { fullName: a, email: normEmail(b) }
    }
    throw new Error(`Tab line must include exactly one email: ${raw}`)
  }

  const angle = raw.match(/^(.+?)\s*<([^>]+)>\s*$/)
  if (angle) {
    const fullName = angle[1].trim().replace(/^["']|["']$/g, '')
    const email = normEmail(angle[2])
    if (!looksLikeEmail(email)) throw new Error(`Bad email in angle brackets: ${raw}`)
    return {
      fullName: fullName.length > 0 ? fullName : titleCaseFromLocalPart(email.split('@')[0]),
      email,
    }
  }

  if (raw.includes(',')) {
    const idx = raw.indexOf(',')
    const left = raw.slice(0, idx).trim()
    const right = raw.slice(idx + 1).trim()
    if (looksLikeEmail(left)) {
      return {
        fullName: right.length > 0 ? right : titleCaseFromLocalPart(left.split('@')[0]),
        email: normEmail(left),
      }
    }
    if (looksLikeEmail(right)) {
      return {
        fullName: left.length > 0 ? left : titleCaseFromLocalPart(right.split('@')[0]),
        email: normEmail(right),
      }
    }
    throw new Error(`Comma line must include an email: ${raw}`)
  }

  if (looksLikeEmail(raw)) {
    const email = normEmail(raw)
    return { fullName: titleCaseFromLocalPart(email.split('@')[0]), email }
  }

  throw new Error(`Unrecognized roster line (need email): ${raw}`)
}
