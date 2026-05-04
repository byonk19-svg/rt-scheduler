/**
 * Reset Supabase test data into a known local/e2e state.
 *
 * Safety model:
 * - Auth users are login accounts managed by Supabase Auth.
 * - Public app tables (`profiles`, `employee_roster`, schedules, requests, etc.) are the app roster/state.
 * - Deleting Auth users before clearing app data can leave broken references or confusing pending app state.
 *
 * This script therefore:
 * 1. derives the current public-table reset order from repo migrations
 * 2. prints counts before deleting anything
 * 3. deletes public app data first
 * 4. optionally deletes only `@teamwise.test` Auth users
 * 5. reseeds the functional demo accounts and schedules
 *
 * Usage:
 *   node --env-file=.env.local scripts/reset-e2e-data.mjs
 *   node --env-file=.env.local scripts/reset-e2e-data.mjs --dry-run
 *   node --env-file=.env.local scripts/reset-e2e-data.mjs --delete-auth-users
 */
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import {
  buildTeamwiseTestAuthDeletionPlan,
  loadResetSchemaPlan,
} from './lib/reset-e2e-data-core.mjs'
import {
  FUNCTIONAL_DEMO_ACCOUNTS,
  FUNCTIONAL_DEMO_DOMAIN,
  FUNCTIONAL_DEMO_PASSWORD,
  seedFunctionalDemo,
} from './seed-functional-demo.mjs'

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
  // ignore
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

const dryRun = process.argv.includes('--dry-run')
const deleteAuthUsers = process.argv.includes('--delete-auth-users')
const schemaPlan = loadResetSchemaPlan(path.join(process.cwd(), 'supabase', 'migrations'))
const tableByName = new Map(schemaPlan.tables.map((table) => [table.name, table]))

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

async function countRows(tableName, firstColumn) {
  const { count, error } = await supabase
    .from(tableName)
    .select(firstColumn, { count: 'exact', head: true })

  if (error) {
    throw new Error(`Failed to count rows in public.${tableName}: ${error.message}`)
  }

  return count ?? 0
}

async function deleteAllRows(tableName, firstColumn) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .or(`${firstColumn}.not.is.null,${firstColumn}.is.null`)

  if (error) {
    throw new Error(`Failed to delete rows from public.${tableName}: ${error.message}`)
  }
}

function printPublicResetPlan(tableCounts) {
  console.log('Public app table reset plan (delete order):')
  for (const tableName of schemaPlan.deleteOrder) {
    const count = tableCounts.get(tableName) ?? 0
    console.log(`- public.${tableName}: ${count} row(s)`)
  }
}

function printAuthResetPlan(authPlan) {
  console.log('')
  console.log(
    `Auth users eligible for deletion (${FUNCTIONAL_DEMO_DOMAIN} only): ${authPlan.summary.matched}`
  )
  if (authPlan.matches.length === 0) {
    console.log('- none')
    return
  }

  for (const match of authPlan.matches) {
    console.log(`- ${match.email}`)
  }
}

function printCompletionHelp() {
  console.log('')
  console.log('Ready for local testing:')
  console.log(`- ${FUNCTIONAL_DEMO_ACCOUNTS[0]} / ${FUNCTIONAL_DEMO_PASSWORD}`)
  console.log(`- ${FUNCTIONAL_DEMO_ACCOUNTS[1]} / ${FUNCTIONAL_DEMO_PASSWORD}`)
  console.log(`- ${FUNCTIONAL_DEMO_ACCOUNTS[2]} / ${FUNCTIONAL_DEMO_PASSWORD}`)
  console.log(`- ${FUNCTIONAL_DEMO_ACCOUNTS[3]} / ${FUNCTIONAL_DEMO_PASSWORD}`)
  console.log('- npm run dev')
  console.log('- npm run test:e2e')
}

async function main() {
  console.log(
    `Preparing ${dryRun ? 'dry-run' : 'live'} e2e reset. Auth deletion: ${deleteAuthUsers ? 'enabled' : 'disabled'}`
  )

  const tableCounts = new Map()
  for (const tableName of schemaPlan.deleteOrder) {
    const table = tableByName.get(tableName)
    tableCounts.set(tableName, await countRows(tableName, table.firstColumn))
  }

  printPublicResetPlan(tableCounts)

  let authPlan = null
  if (deleteAuthUsers) {
    authPlan = buildTeamwiseTestAuthDeletionPlan(await listAllAuthUsers())
    printAuthResetPlan(authPlan)
  } else {
    console.log('')
    console.log(
      'Auth users: unchanged by default. Re-run with --delete-auth-users to wipe only @teamwise.test accounts.'
    )
  }

  if (dryRun) {
    console.log('')
    console.log('Dry run only. No public rows, Auth users, or demo seed data were changed.')
    if (!deleteAuthUsers) {
      console.log('Would reseed the functional demo data after the public-table wipe.')
    } else {
      console.log(
        'Would wipe public tables, delete the listed @teamwise.test Auth users, then reseed the functional demo data.'
      )
    }
    printCompletionHelp()
    return
  }

  console.log('')
  console.log('Deleting public app data...')
  for (const tableName of schemaPlan.deleteOrder) {
    const count = tableCounts.get(tableName) ?? 0
    if (count === 0) {
      console.log(`- public.${tableName}: already empty`)
      continue
    }

    await deleteAllRows(tableName, tableByName.get(tableName).firstColumn)
    console.log(`- public.${tableName}: deleted ${count} row(s)`)
  }

  if (authPlan) {
    console.log('')
    console.log('Deleting scoped Auth users...')
    if (authPlan.matches.length === 0) {
      console.log('- no @teamwise.test Auth users matched')
    } else {
      for (const match of authPlan.matches) {
        const { error } = await supabase.auth.admin.deleteUser(match.user.id)
        if (error) {
          throw new Error(`Failed to delete Auth user ${match.email}: ${error.message}`)
        }
        console.log(`- deleted ${match.email}`)
      }
    }
  }

  console.log('')
  console.log('Reseeding functional demo data...')
  await seedFunctionalDemo({
    domain: FUNCTIONAL_DEMO_DOMAIN,
    password: FUNCTIONAL_DEMO_PASSWORD,
  })
  printCompletionHelp()
}

main().catch((error) => {
  console.error('reset-e2e-data failed:', error.message ?? error)
  process.exit(1)
})
