import { createClient } from '@supabase/supabase-js'

import { buildCleanupPlan } from './lib/seed-user-cleanup-core.mjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  console.error(`Missing required env var(s): ${missing.join(', ')}`)
  process.exit(1)
}

let urlRef = ''
let keyRef = ''
try {
  urlRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const payload = JSON.parse(
    Buffer.from(SUPABASE_SERVICE_ROLE_KEY.split('.')[1], 'base64url').toString('utf8')
  )
  keyRef = payload.ref ?? ''
} catch {
  // Ignore parsing issues here; Supabase client will still report invalid API key.
}

if (urlRef && keyRef && urlRef !== keyRef) {
  console.error(
    `SUPABASE_SERVICE_ROLE_KEY project ref (${keyRef}) does not match NEXT_PUBLIC_SUPABASE_URL ref (${urlRef})`
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function parseListArg(name) {
  const prefix = `${name}=`
  return process.argv
    .filter((arg) => arg.startsWith(prefix))
    .flatMap((arg) => arg.slice(prefix.length).split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function parseListEnv(name) {
  return String(process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function parseRules() {
  const argDomains = parseListArg('--domain')
  const argPrefixes = parseListArg('--prefix')
  const argExactEmails = parseListArg('--email')

  return {
    allowedDomains: argDomains.length > 0 ? argDomains : parseListEnv('CLEANUP_ALLOWED_DOMAINS'),
    emailPrefixes: argPrefixes.length > 0 ? argPrefixes : parseListEnv('CLEANUP_EMAIL_PREFIXES'),
    exactEmails: argExactEmails.length > 0 ? argExactEmails : parseListEnv('CLEANUP_EXACT_EMAILS'),
  }
}

async function listAllAuthUsers() {
  const users = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const batch = data?.users ?? []
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }

  return users
}

function logPlan(plan) {
  console.log(`Total auth users scanned: ${plan.summary.total}`)
  console.log(`Matched seeded/demo users: ${plan.summary.matched}`)
  console.log(`Skipped users: ${plan.summary.skipped}`)
  console.log(
    `Rules: domains=[${plan.rules.allowedDomains.join(', ')}] prefixes=[${plan.rules.emailPrefixes.join(', ')}] exactEmails=[${plan.rules.exactEmails.join(', ')}]`
  )

  if (plan.matches.length === 0) {
    console.log('No seeded/demo users matched the cleanup rules.')
    return
  }

  console.log('')
  console.log('Matched users:')
  for (const match of plan.matches) {
    console.log(`- ${match.user.id}  ${match.email}  (${match.reasons.join('; ')})`)
  }
}

async function deleteMatches(plan) {
  let deleted = 0

  for (const match of plan.matches) {
    const { error } = await supabase.auth.admin.deleteUser(match.user.id)
    if (error) {
      throw new Error(`Failed to delete ${match.email}: ${error.message}`)
    }
    deleted += 1
    console.log(`Deleted ${match.email}`)
  }

  return deleted
}

async function main() {
  const execute = process.argv.includes('--execute')
  const rules = parseRules()
  const users = await listAllAuthUsers()
  const plan = buildCleanupPlan(users, rules)

  logPlan(plan)

  if (!execute) {
    console.log('')
    console.log('Dry run only. Re-run with --execute to delete the matched auth users.')
    return
  }

  if (plan.matches.length === 0) {
    console.log('')
    console.log('Nothing to delete.')
    return
  }

  console.log('')
  const deleted = await deleteMatches(plan)
  console.log('')
  console.log(`Deleted ${deleted} seeded/demo auth user(s).`)
}

main().catch((error) => {
  console.error('cleanup:seed-users failed:', error.message ?? error)
  process.exit(1)
})
