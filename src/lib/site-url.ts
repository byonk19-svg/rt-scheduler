/**
 * Canonical site origin for metadata, sitemap, and absolute URLs.
 * Prefer NEXT_PUBLIC_APP_URL in each environment (e.g. https://www.teamwise.work).
 */
export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL
  if (raw) {
    try {
      return new URL(raw)
    } catch {
      // fall through
    }
  }
  return new URL('http://localhost:3000')
}

export function getSupabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}
