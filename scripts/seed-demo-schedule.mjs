/**
 * Safe local/dev seed for the photographed RT paper schedule:
 * May 3, 2026 through June 13, 2026.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-demo-schedule.mjs --confirm-demo-schedule
 *
 * This script only replaces data scoped to the deterministic paper demo cycle/site.
 * Hosted Supabase projects must be explicitly allowlisted with
 * SEED_DEMO_SCHEDULE_PROJECT_REFS. Do not allowlist production.
 */
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { DEMO_PAPER_SCHEDULE } from './fixtures/demo-paper-schedule.mjs'

const REQUIRED_FLAG = '--confirm-demo-schedule'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_ONBOARDING_COMPLETED_AT = '2026-04-27T17:00:00.000Z'

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

function assertSafeTarget() {
  if (!process.argv.includes(REQUIRED_FLAG)) {
    console.error(`Refusing to seed without ${REQUIRED_FLAG}.`)
    process.exit(1)
  }

  const missing = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length > 0) {
    console.error(`Missing required env var(s): ${missing.join(', ')}`)
    process.exit(1)
  }

  const target = getSupabaseProjectRef(SUPABASE_URL)
  if (!target.ref) {
    console.error(`Could not parse Supabase project ref from NEXT_PUBLIC_SUPABASE_URL.`)
    process.exit(1)
  }

  let keyRef = ''
  try {
    const payload = JSON.parse(
      Buffer.from(SUPABASE_SERVICE_ROLE_KEY.split('.')[1], 'base64url').toString('utf8')
    )
    keyRef = payload.ref ?? ''
  } catch {
    // Supabase will report invalid key details if the value is malformed.
  }

  if (target.ref !== 'local' && keyRef && target.ref !== keyRef) {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY project ref (${keyRef}) does not match NEXT_PUBLIC_SUPABASE_URL ref (${target.ref})`
    )
    process.exit(1)
  }

  const allowedRefs = String(process.env.SEED_DEMO_SCHEDULE_PROJECT_REFS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (target.isHosted && !allowedRefs.includes(target.ref)) {
    console.error(
      [
        `Refusing to seed hosted Supabase project ${target.ref} (${target.hostname}).`,
        'Set SEED_DEMO_SCHEDULE_PROJECT_REFS to an explicit dev/test project allowlist.',
        'Do not include production project refs in that allowlist.',
      ].join('\n')
    )
    process.exit(1)
  }
}

assertSafeTarget()

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function stableUuid(key) {
  const hash = createHash('sha1').update(`rt-paper-demo:${key}`).digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function normalizeRosterName(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function formatDate(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(isoDate, offset) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return formatDate(date)
}

function flattenCells(staffRow) {
  return staffRow.weeks.flat()
}

function dateRange(startDate, endDate) {
  const days = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    days.push(date)
  }
  return days
}

function validateFixture() {
  const days = dateRange(DEMO_PAPER_SCHEDULE.startDate, DEMO_PAPER_SCHEDULE.endDate)
  if (days.length !== 42) {
    throw new Error(`Expected 42 schedule days, got ${days.length}.`)
  }
  if (new Date(`${DEMO_PAPER_SCHEDULE.startDate}T00:00:00Z`).getUTCDay() !== 0) {
    throw new Error('Demo paper schedule must start on Sunday.')
  }
  for (const key of ['dayStaffingTargets', 'combinedStaffingTargets']) {
    if (DEMO_PAPER_SCHEDULE[key].length !== days.length) {
      throw new Error(`${key} must have ${days.length} entries.`)
    }
  }
  for (const staff of DEMO_PAPER_SCHEDULE.staff) {
    const cells = flattenCells(staff)
    if (cells.length !== days.length) {
      throw new Error(`${staff.fullName} has ${cells.length} cells; expected ${days.length}.`)
    }
    for (const token of cells) {
      if (!Object.hasOwn(DEMO_PAPER_SCHEDULE.tokenLegend, token)) {
        throw new Error(`${staff.fullName} has unsupported fixture token "${token}".`)
      }
    }
  }
  return days
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

async function ensureAuthUser(allUsersByEmail, email, password, userMetadata) {
  const key = email.toLowerCase()
  const existing = allUsersByEmail.get(key)
  if (existing?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })
    if (error) throw error
    allUsersByEmail.set(key, data.user ?? existing)
    return existing.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  })
  if (error) throw error

  allUsersByEmail.set(key, data.user)
  return data.user.id
}

async function upsertProfile(row) {
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

async function ensureSite(id, name = id) {
  const { error } = await supabase.from('sites').upsert({ id, name }, { onConflict: 'id' })
  if (error) throw error
}

async function ensureWorkPattern(therapistId, shiftPreference) {
  const { error } = await supabase.from('work_patterns').upsert(
    {
      therapist_id: therapistId,
      works_dow: [1, 2, 3, 4, 5],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'soft',
      shift_preference: shiftPreference,
      pattern_type: 'weekly_fixed',
      weekly_weekdays: [1, 2, 3, 4, 5],
      weekend_rule: 'none',
      cycle_anchor_date: null,
      cycle_segments: [],
    },
    { onConflict: 'therapist_id' }
  )
  if (error) throw error
}

async function resetScopedDemoRows(cycleId) {
  for (const table of [
    'availability_entries',
    'availability_requests',
    'availability_overrides',
    'therapist_availability_submissions',
    'shifts',
  ]) {
    const column = table === 'therapist_availability_submissions' ? 'schedule_cycle_id' : 'cycle_id'
    const { error } = await supabase.from(table).delete().eq(column, cycleId)
    if (error) throw error
  }
}

async function insertBatched(table, rows) {
  const size = 200
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    if (chunk.length === 0) continue
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw error
  }
}

function buildRows({ cycleId, managerId, staffRowsByName, days }) {
  const shifts = []
  const availabilityOverrides = []
  const availabilityRequests = []
  const availabilityEntries = []
  const submissions = []

  for (const staff of DEMO_PAPER_SCHEDULE.staff) {
    const profile = staffRowsByName.get(staff.fullName)
    if (!profile) throw new Error(`Missing seeded profile for ${staff.fullName}.`)

    submissions.push({
      therapist_id: profile.id,
      schedule_cycle_id: cycleId,
      submitted_at: '2026-04-27T17:00:00.000Z',
      last_edited_at: '2026-04-27T17:00:00.000Z',
    })

    const cells = flattenCells(staff)
    cells.forEach((token, index) => {
      const date = days[index]
      const note = `Seeded from May-Jun 2026 paper schedule cell "${token}".`
      if (token === '1' || token === 'H' || token === 'N') {
        shifts.push({
          cycle_id: cycleId,
          user_id: profile.id,
          date,
          shift_type: token === 'N' ? 'night' : staff.shiftType,
          status: 'scheduled',
          role: 'staff',
          site_id: DEMO_PAPER_SCHEDULE.siteId,
          assignment_status: 'scheduled',
        })
      }
      if (token === 'H') {
        availabilityOverrides.push({
          cycle_id: cycleId,
          therapist_id: profile.id,
          date,
          shift_type: staff.shiftType,
          override_type: 'force_on',
          note: `${note} Highlighted/confirmed working cell.`,
          created_by: profile.id,
          source: 'therapist',
        })
      }
      if (token === '*' || token === 'N') {
        const shiftType = token === 'N' && staff.shiftType === 'day' ? 'day' : staff.shiftType
        availabilityOverrides.push({
          cycle_id: cycleId,
          therapist_id: profile.id,
          date,
          shift_type: shiftType,
          override_type: 'force_off',
          note:
            token === 'N'
              ? `${note} Day-side availability blocked because the paper cell is night-specific.`
              : `${note} Unavailable / need-off / PTO-style marker.`,
          created_by: profile.id,
          source: 'therapist',
        })
        availabilityRequests.push({
          user_id: profile.id,
          cycle_id: cycleId,
          date,
          reason: token === 'N' ? 'Paper schedule night marker' : 'Paper schedule need-off marker',
        })
        availabilityEntries.push({
          therapist_id: profile.id,
          cycle_id: cycleId,
          date,
          shift_type: shiftType,
          entry_type: 'unavailable',
          reason: token === 'N' ? 'Paper schedule night marker' : 'Paper schedule need-off marker',
          created_by: managerId,
        })
      }
    })
  }

  return { shifts, availabilityOverrides, availabilityRequests, availabilityEntries, submissions }
}

function countShiftsByDate(shifts, days, shiftType) {
  return days.map(
    (date) => shifts.filter((row) => row.date === date && row.shift_type === shiftType).length
  )
}

function printCountSanity(rows, days) {
  const dayCounts = countShiftsByDate(rows.shifts, days, 'day')
  const nightCounts = countShiftsByDate(rows.shifts, days, 'night')
  const combinedCounts = dayCounts.map((count, index) => count + nightCounts[index])

  const dayMismatches = dayCounts
    .map((actual, index) => ({
      date: days[index],
      actual,
      target: DEMO_PAPER_SCHEDULE.dayStaffingTargets[index],
    }))
    .filter((row) => row.actual !== row.target)
  const combinedMismatches = combinedCounts
    .map((actual, index) => ({
      date: days[index],
      actual,
      target: DEMO_PAPER_SCHEDULE.combinedStaffingTargets[index],
    }))
    .filter((row) => row.actual !== row.target)

  console.log('')
  console.log('Paper count sanity check:')
  console.log(`  Day count mismatches: ${dayMismatches.length}`)
  console.log(`  Combined count mismatches: ${combinedMismatches.length}`)
  if (dayMismatches.length > 0 || combinedMismatches.length > 0) {
    console.log(
      '  Fixture is intentionally readable; adjust scripts/fixtures/demo-paper-schedule.mjs after manual review.'
    )
    for (const row of dayMismatches.slice(0, 6)) {
      console.log(`  - Day ${row.date}: actual ${row.actual}, paper target ${row.target}`)
    }
    for (const row of combinedMismatches.slice(0, 6)) {
      console.log(`  - Combined ${row.date}: actual ${row.actual}, paper target ${row.target}`)
    }
  }
}

async function seedDemoSchedule() {
  const days = validateFixture()
  const cycleId = stableUuid('schedule-cycle:2026-05-03:2026-06-13')
  await ensureSite(DEMO_PAPER_SCHEDULE.siteId, DEMO_PAPER_SCHEDULE.siteId)

  const authUsers = await listAllAuthUsers()
  const userByEmail = new Map(authUsers.map((u) => [String(u.email ?? '').toLowerCase(), u]))

  const managerId = await ensureAuthUser(
    userByEmail,
    DEMO_PAPER_SCHEDULE.manager.email,
    DEMO_PAPER_SCHEDULE.password,
    {
      full_name: DEMO_PAPER_SCHEDULE.manager.fullName,
      role: 'manager',
      shift_type: 'day',
      site_id: DEMO_PAPER_SCHEDULE.siteId,
    }
  )
  await upsertProfile({
    id: managerId,
    full_name: DEMO_PAPER_SCHEDULE.manager.fullName,
    email: DEMO_PAPER_SCHEDULE.manager.email,
    role: 'manager',
    shift_type: 'day',
    site_id: DEMO_PAPER_SCHEDULE.siteId,
    employment_type: 'full_time',
    max_work_days_per_week: 5,
    is_active: true,
    is_lead_eligible: true,
    on_fmla: false,
    staff_onboarding_required: false,
    staff_onboarding_completed_at: DEMO_ONBOARDING_COMPLETED_AT,
  })

  const staffRowsByName = new Map()
  for (const staff of DEMO_PAPER_SCHEDULE.staff) {
    const id = await ensureAuthUser(userByEmail, staff.email, DEMO_PAPER_SCHEDULE.password, {
      full_name: staff.fullName,
      role: 'therapist',
      shift_type: staff.shiftType,
      site_id: DEMO_PAPER_SCHEDULE.siteId,
    })
    await upsertProfile({
      id,
      full_name: staff.fullName,
      email: staff.email,
      role: 'therapist',
      shift_type: staff.shiftType,
      site_id: DEMO_PAPER_SCHEDULE.siteId,
      employment_type: 'full_time',
      max_work_days_per_week: 5,
      is_active: true,
      is_lead_eligible: false,
      on_fmla: false,
      preferred_work_days: [],
      preferred_work_days_mode: 'no_preference',
      staff_onboarding_required: false,
      staff_onboarding_preferences_confirmed_at: DEMO_ONBOARDING_COMPLETED_AT,
      staff_onboarding_theme_confirmed_at: DEMO_ONBOARDING_COMPLETED_AT,
      staff_onboarding_completed_at: DEMO_ONBOARDING_COMPLETED_AT,
    })
    await ensureWorkPattern(id, staff.shiftType)
    staffRowsByName.set(staff.fullName, { id, ...staff })
  }

  const rosterRows = [...staffRowsByName.values()].map((row) => ({
    full_name: row.fullName,
    normalized_full_name: normalizeRosterName(row.fullName),
    role: 'therapist',
    shift_type: row.shiftType,
    employment_type: 'full_time',
    max_work_days_per_week: 5,
    is_lead_eligible: false,
    is_active: true,
    matched_profile_id: row.id,
    matched_email: row.email,
    matched_at: '2026-04-27T17:00:00.000Z',
    created_by: managerId,
    updated_by: managerId,
  }))
  const { error: rosterError } = await supabase
    .from('employee_roster')
    .upsert(rosterRows, { onConflict: 'normalized_full_name' })
  if (rosterError) throw rosterError

  const { error: cycleError } = await supabase.from('schedule_cycles').upsert(
    {
      id: cycleId,
      label: DEMO_PAPER_SCHEDULE.label,
      start_date: DEMO_PAPER_SCHEDULE.startDate,
      end_date: DEMO_PAPER_SCHEDULE.endDate,
      published: true,
      availability_due_at: '2026-04-27T17:00:00.000Z',
      site_id: DEMO_PAPER_SCHEDULE.siteId,
      archived_at: null,
    },
    { onConflict: 'id' }
  )
  if (cycleError) throw cycleError

  await resetScopedDemoRows(cycleId)

  const rows = buildRows({ cycleId, managerId, staffRowsByName, days })
  await insertBatched('shifts', rows.shifts)
  await insertBatched('availability_overrides', rows.availabilityOverrides)
  await insertBatched('availability_requests', rows.availabilityRequests)
  await insertBatched('availability_entries', rows.availabilityEntries)
  await insertBatched('therapist_availability_submissions', rows.submissions)

  const templateName = `${DEMO_PAPER_SCHEDULE.label} staffing targets`
  const { error: deleteTemplateError } = await supabase
    .from('cycle_templates')
    .delete()
    .eq('name', templateName)
    .eq('site_id', DEMO_PAPER_SCHEDULE.siteId)
  if (deleteTemplateError) throw deleteTemplateError
  const { error: templateError } = await supabase.from('cycle_templates').insert({
    name: templateName,
    description:
      'Staffing-count sanity targets transcribed from the May 3-Jun 13 2026 paper RT schedule.',
    created_by: managerId,
    site_id: DEMO_PAPER_SCHEDULE.siteId,
    shift_data: {
      version: 1,
      source: 'May-Jun 2026 photographed RT paper schedule',
      startDate: DEMO_PAPER_SCHEDULE.startDate,
      endDate: DEMO_PAPER_SCHEDULE.endDate,
      dayStaffingTargets: DEMO_PAPER_SCHEDULE.dayStaffingTargets,
      combinedStaffingTargets: DEMO_PAPER_SCHEDULE.combinedStaffingTargets,
    },
  })
  if (templateError) throw templateError

  printCountSanity(rows, days)

  console.log('')
  console.log('Paper schedule demo seed complete.')
  console.log(`  Demo site/department: ${DEMO_PAPER_SCHEDULE.siteId}`)
  console.log(`  Cycle: ${DEMO_PAPER_SCHEDULE.label} (${cycleId})`)
  console.log(`  Dates: ${DEMO_PAPER_SCHEDULE.startDate} to ${DEMO_PAPER_SCHEDULE.endDate}`)
  console.log(`  Staff profiles: ${DEMO_PAPER_SCHEDULE.staff.length}`)
  console.log(`  Shift rows: ${rows.shifts.length}`)
  console.log(`  Availability overrides: ${rows.availabilityOverrides.length}`)
  console.log(`  Availability requests: ${rows.availabilityRequests.length}`)
  console.log(`  Availability entries: ${rows.availabilityEntries.length}`)
  console.log('')
  console.log('Sign in:')
  console.log(`  Manager: ${DEMO_PAPER_SCHEDULE.manager.email} / ${DEMO_PAPER_SCHEDULE.password}`)

  return {
    cycleId,
    managerEmail: DEMO_PAPER_SCHEDULE.manager.email,
    password: DEMO_PAPER_SCHEDULE.password,
    shiftCount: rows.shifts.length,
  }
}

async function main() {
  await seedDemoSchedule()
}

export { seedDemoSchedule }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('seed-demo-schedule failed:', error.message ?? error)
    process.exit(1)
  })
}
