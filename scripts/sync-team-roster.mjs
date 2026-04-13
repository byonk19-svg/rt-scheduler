/**
 * Replace the active therapist/lead roster from a text file: everyone listed becomes
 * an active, unarchived team member; every other therapist/lead is deactivated and archived * (hidden from /team). Managers are never removed or demoted.
 *
 * Usage:
 *   npm run sync:roster -- --file path/to/roster.txt
 *   node --env-file=.env.local scripts/sync-team-roster.mjs --file roster.txt --dry-run
 *
 * Line formats (one person per line; # starts a comment; empty lines skipped):
 *   Full Name <email@example.com>
 *   email@example.com, Full Name
 *   Full Name, email@example.com
 *   name<TAB>email
 *   email@example.com   (display name is derived from the local part)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseRosterLine } from './lib/parse-roster-line.mjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function normEmail(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function parseArgs(argv) {
  const out = {
    file: null,
    dryRun: false,
    shift: 'day',
    password: process.env.ROSTER_NEW_USER_PASSWORD ?? 'ChangeMe-RosterSync-1!',
  }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (a === '--file' || a === '-f') {
      out.file = argv[i + 1] ?? null
      i += 1
      continue
    }
    if (a === '--shift') {
      const v = String(argv[i + 1] ?? '').toLowerCase()
      if (v !== 'day' && v !== 'night') {
        throw new Error('--shift must be day or night')
      }
      out.shift = v
      i += 1
      continue
    }
    if (a === '--password') {
      out.password = String(argv[i + 1] ?? '')
      i += 1
      continue
    }
    if (a === '--help' || a === '-h') {
      out.help = true
      continue
    }
    throw new Error(`Unknown argument: ${a}`)
  }
  return out
}

function getTodayKey() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function listAllAuthUsers(supabase) {
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

async function realignFutureDraftShiftsForEmployee(supabase, employeeId) {
  const { data: draftCycles, error: draftCyclesError } = await supabase
    .from('schedule_cycles')
    .select('id')
    .eq('published', false)

  if (draftCyclesError) {
    console.error('Could not load draft cycles for shift cleanup:', draftCyclesError.message)
    return
  }

  const cycleIds = (draftCycles ?? [])
    .map((row) => String(row.id ?? ''))
    .filter((id) => id.length > 0)

  if (cycleIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('shifts')
    .delete()
    .eq('user_id', employeeId)
    .gte('date', getTodayKey())
    .in('cycle_id', cycleIds)

  if (deleteError) {
    console.error('Could not remove future draft shifts:', deleteError.message)
  }
}

function printHelp() {
  console.log(`
sync-team-roster — set therapist/lead roster from a file; archive everyone else in those roles.

  npm run sync:roster -- --file ./roster.txt
  npm run sync:roster -- --file ./roster.txt --dry-run

Options:
  --file, -f   Path to roster file (required)
  --dry-run    Log actions only
  --shift      day | night (default: day) for created/updated therapists
  --password   Password for newly created auth users (default: env ROSTER_NEW_USER_PASSWORD or a placeholder)

Env:
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Managers are never archived. Rows that match an existing manager only refresh name/active state.
`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (!args.file) {
    console.error('Missing --file <path>. Use --help for usage.')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
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

  const filePath = resolve(process.cwd(), args.file)
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)

  /** @type {Map<string, { fullName: string, email: string }>} */
  const byEmail = new Map()
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseRosterLine(lines[i])
    if (!parsed) continue
    const key = parsed.email
    if (byEmail.has(key)) {
      console.warn(`Duplicate email in file (using last occurrence): ${key}`)
    }
    byEmail.set(key, parsed)
  }

  if (byEmail.size === 0) {
    console.error('No roster rows parsed. Check the file format.')
    process.exit(1)
  }

  const keepEmails = new Set(byEmail.keys())

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authUsers = await listAllAuthUsers(supabase)
  const userIdByEmail = new Map(
    authUsers.map((u) => [normEmail(u.email ?? ''), u.id]).filter(([e]) => e.length > 0)
  )

  const { data: existingProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, archived_at, is_active')

  if (profilesError) {
    console.error('Failed to load profiles:', profilesError.message)
    process.exit(1)
  }

  const profileById = new Map((existingProfiles ?? []).map((p) => [p.id, p]))

  console.log(
    args.dryRun
      ? `[dry-run] Would sync ${byEmail.size} roster entries`
      : `Syncing ${byEmail.size} roster entries`
  )

  for (const { fullName, email } of byEmail.values()) {
    let userId = userIdByEmail.get(email)

    if (!userId) {
      if (args.dryRun) {
        console.log(`[dry-run] create auth user + profile: ${fullName} <${email}>`)
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password: args.password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: 'therapist',
            shift_type: args.shift,
          },
        })
        if (error) {
          console.error(`createUser failed for ${email}:`, error.message)
          process.exit(1)
        }
        userId = data.user.id
        userIdByEmail.set(email, userId)
        console.log(`Created auth user: ${email}`)
      }
    }

    if (!userId) continue

    const existing = profileById.get(userId)
    const isManager = existing?.role === 'manager'
    const nextRole = existing?.role === 'lead' ? 'lead' : 'therapist'

    if (args.dryRun) {
      if (isManager) {
        console.log(`[dry-run] keep manager (name touch-up only if needed): ${email}`)
      } else {
        console.log(
          `[dry-run] upsert active ${nextRole}: ${fullName} <${email}> shift=${args.shift}${existing?.archived_at ? ' (unarchive)' : ''}`
        )
      }
      continue
    }

    if (isManager) {
      const { error: uerr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email,
          is_active: true,
          archived_at: null,
          archived_by: null,
        })
        .eq('id', userId)
      if (uerr) {
        console.error(`Failed to update manager profile ${email}:`, uerr.message)
        process.exit(1)
      }
      console.log(`Updated manager record (no role change): ${email}`)
      continue
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        role: nextRole,
        shift_type: args.shift,
        is_active: true,
        archived_at: null,
        archived_by: null,
        is_lead_eligible: nextRole === 'lead',
      },
      { onConflict: 'id' }
    )

    if (upsertError) {
      console.error(`Failed to upsert profile for ${email}:`, upsertError.message)
      process.exit(1)
    }
    console.log(`Upserted therapist: ${fullName} <${email}>`)
  }

  const toRemove = (existingProfiles ?? []).filter((p) => {
    if (p.role !== 'therapist' && p.role !== 'lead') return false
    if (p.archived_at) return false
    const em = normEmail(p.email ?? '')
    if (!em || keepEmails.has(em)) return false
    return true
  })

  for (const p of toRemove) {
    if (args.dryRun) {
      console.log(`[dry-run] archive + deactivate: ${p.email} (${p.id})`)
      continue
    }

    const { error: uerr } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        archived_by: null,
      })
      .eq('id', p.id)

    if (uerr) {
      console.error(`Failed to archive ${p.email}:`, uerr.message)
      process.exit(1)
    }

    await realignFutureDraftShiftsForEmployee(supabase, p.id)
    console.log(`Archived and removed from draft shifts (future): ${p.email}`)
  }

  console.log(args.dryRun ? `[dry-run] Done (${toRemove.length} would be archived).` : 'Done.')
}

main().catch((err) => {
  console.error('sync-team-roster failed:', err.message ?? err)
  process.exit(1)
})
