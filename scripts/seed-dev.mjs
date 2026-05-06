/**
 * Guarded local/dev seeding entrypoint.
 *
 * Usage:
 *   SEED_DEV_PROJECT_REFS=your-dev-ref node --env-file=.env.local scripts/seed-dev.mjs
 *   SEED_DEV_PROJECT_REFS=your-branch-ref node --env-file=.env.test scripts/seed-dev.mjs
 *
 * Hosted Supabase projects must be explicitly allowlisted by project ref before
 * this script will run. Localhost Supabase is allowed without allowlisting.
 */
function getSupabaseProjectRef(urlValue) {
  try {
    const hostname = new URL(urlValue).hostname
    const firstLabel = hostname.split('.')[0]
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { hostname, ref: 'local', isHosted: false }
    }
    return { hostname, ref: firstLabel, isHosted: hostname.endsWith('.supabase.co') }
  } catch {
    return { hostname: '', ref: '', isHosted: false }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const allowedRefs = String(process.env.SEED_DEV_PROJECT_REFS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  process.exit(1)
}

const target = getSupabaseProjectRef(supabaseUrl)

if (!target.ref) {
  console.error(
    `Could not parse Supabase project ref from NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`
  )
  process.exit(1)
}

if (target.isHosted && !allowedRefs.includes(target.ref)) {
  console.error(
    [
      `Refusing to seed hosted Supabase project ${target.ref} (${target.hostname}).`,
      'Set SEED_DEV_PROJECT_REFS to a comma-separated allowlist of dev/test/branch refs.',
      'Do not include production project refs in that allowlist.',
    ].join('\n')
  )
  process.exit(1)
}

const { seedFunctionalDemo } = await import('./seed-functional-demo.mjs')

await seedFunctionalDemo()
