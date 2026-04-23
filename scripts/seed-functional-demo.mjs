/**
 * Full demo dataset for local/UAT: auth users, profiles, work patterns, two 6-week cycles,
 * and coverage shifts (1 lead + 4 staff per day/night slot where roster allows).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-functional-demo.mjs
 *
 * Each run removes prior demo cycles (label starts with "Teamwise UAT") then recreates them.
 * Optional --reset is the same behavior (kept for explicit scripting).
 *
 * Env (optional):
 *   SEED_DOMAIN=teamwise.test
 *   SEED_PASSWORD=Teamwise123!
 *   SEED_THERAPIST_COUNT=12   (extra therapists beyond 2 fixed leads; default 12)
 */
import { createClient } from '@supabase/supabase-js'

const DEMO_LABEL_PREFIX = 'Teamwise UAT'

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

const domain = String(process.env.SEED_DOMAIN ?? 'teamwise.test')
  .trim()
  .toLowerCase()
const defaultPassword = String(process.env.SEED_PASSWORD ?? 'Teamwise123!').trim()
const extraTherapistCount = Math.max(
  4,
  Math.min(24, Number.parseInt(String(process.env.SEED_THERAPIST_COUNT ?? '12'), 10) || 12)
)

const ROSTER = [
  'Aleyce L.',
  'Irene Y.',
  'Julie D.',
  'Jannie B.',
  'Barbara C.',
  'Nicole G.',
  'Ruth G.',
  'Roy H.',
  'Denise H.',
  'Mark J.',
  'Gayle K.',
  'Kristine M.',
  'Lisa M.',
  'Keturah S.',
  'Lynn S.',
  'Adrienne S.',
  'Kim S.',
  'Rosa V.',
  'Audbriana W.',
  'Matthew W.',
  'Sarah W.',
  'Layne W.',
  'Brianna Y.',
]

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Monday 00:00 local of the week containing `date` (Sun=0 → Monday start). */
function mondayOfWeekContaining(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const dow = base.getDay()
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  base.setDate(base.getDate() - daysFromMonday)
  return base
}

function* eachDateInclusive(isoStart, isoEnd) {
  let d = new Date(`${isoStart}T12:00:00`)
  const end = new Date(`${isoEnd}T12:00:00`)
  while (d <= end) {
    yield formatDate(d)
    d = addDays(d, 1)
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

async function ensureAuthUser(allUsersByEmail, email, password, userMetadata) {
  const key = email.toLowerCase()
  const existing = allUsersByEmail.get(key)
  if (existing?.id) return existing.id

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  })

  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      const fresh = await listAllAuthUsers()
      for (const u of fresh) {
        allUsersByEmail.set(String(u.email ?? '').toLowerCase(), u)
      }
      const found = allUsersByEmail.get(key)
      if (found?.id) return found.id
    }
    throw error
  }

  allUsersByEmail.set(key, data.user)
  return data.user.id
}

async function wipeDemoCycles() {
  const { data: rows, error: selErr } = await supabase
    .from('schedule_cycles')
    .select('id,label')
    .like('label', `${DEMO_LABEL_PREFIX}%`)
  if (selErr) throw selErr
  if (!rows?.length) {
    console.log('No demo cycles to remove.')
    return
  }
  const { error: delErr } = await supabase
    .from('schedule_cycles')
    .delete()
    .like('label', `${DEMO_LABEL_PREFIX}%`)
  if (delErr) throw delErr
  console.log(`Removed ${rows.length} demo cycle(s) and cascaded data.`)
}

async function upsertProfile(row) {
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

async function ensureWorkPattern(therapistId, worksDow) {
  const { error } = await supabase.from('work_patterns').upsert(
    {
      therapist_id: therapistId,
      works_dow: worksDow,
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'soft',
      shift_preference: 'either',
    },
    { onConflict: 'therapist_id' }
  )
  if (error) throw error
}

function pickStaff(pool, excludeId, count, rotation) {
  const others = pool.filter((p) => p.id !== excludeId)
  const out = []
  const n = others.length
  if (n === 0) return out
  for (let i = 0; i < count; i += 1) {
    out.push(others[(rotation + i) % n])
  }
  return out
}

async function insertShiftsBatched(rows) {
  const size = 200
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await supabase.from('shifts').insert(chunk)
    if (error) throw error
  }
}

async function seedShiftsForCycle(cycleId, cycleStartIso, cycleEndIso, rosterRows) {
  const therapistsAndLeads = rosterRows.filter((p) => p.role === 'therapist' || p.role === 'lead')
  const dayPool = therapistsAndLeads.filter((p) => p.shift_type === 'day')
  const nightPool = therapistsAndLeads.filter((p) => p.shift_type === 'night')

  const dayLeads = dayPool.filter((p) => p.is_lead_eligible)
  const nightLeads = nightPool.filter((p) => p.is_lead_eligible)

  if (dayLeads.length === 0 || nightLeads.length === 0) {
    throw new Error('Need at least one lead-eligible day and one lead-eligible night therapist.')
  }

  let rotation = 0
  const rows = []

  for (const dateStr of eachDateInclusive(cycleStartIso, cycleEndIso)) {
    for (const { shiftType, pool, leadPool } of [
      { shiftType: 'day', pool: dayPool, leadPool: dayLeads },
      { shiftType: 'night', pool: nightPool, leadPool: nightLeads },
    ]) {
      const lead = leadPool[rotation % leadPool.length]
      const wantStaff = 4
      const staff = pickStaff(pool, lead.id, wantStaff, rotation)
      const assignees = [
        { user: lead, role: 'lead' },
        ...staff.map((u) => ({ user: u, role: 'staff' })),
      ]

      const seen = new Set()
      for (const { user, role } of assignees) {
        if (!user?.id || seen.has(user.id)) continue
        seen.add(user.id)
        rows.push({
          cycle_id: cycleId,
          user_id: user.id,
          date: dateStr,
          shift_type: shiftType,
          status: 'scheduled',
          role,
          site_id: 'default',
        })
      }
    }
    rotation += 1
  }

  await insertShiftsBatched(rows)
  return rows.length
}

async function main() {
  console.log('Removing any prior Teamwise UAT demo cycles, then seeding users + schedules.')
  await wipeDemoCycles()

  const authUsers = await listAllAuthUsers()
  const userByEmail = new Map(authUsers.map((u) => [String(u.email ?? '').toLowerCase(), u]))

  const managerEmail = `demo-manager@${domain}`
  const managerId = await ensureAuthUser(userByEmail, managerEmail, defaultPassword, {
    full_name: 'Demo Manager',
    role: 'manager',
    shift_type: 'day',
  })
  await upsertProfile({
    id: managerId,
    full_name: 'Demo Manager',
    email: managerEmail,
    role: 'manager',
    shift_type: 'day',
    site_id: 'default',
    employment_type: 'full_time',
    max_work_days_per_week: 5,
    is_active: true,
    is_lead_eligible: false,
    on_fmla: false,
    archived_at: null,
  })

  const leadSpecs = [
    { email: `demo-lead-day@${domain}`, name: 'Demo Lead (Day)', shift: 'day' },
    { email: `demo-lead-night@${domain}`, name: 'Demo Lead (Night)', shift: 'night' },
  ]

  const leadIds = []
  for (const spec of leadSpecs) {
    const id = await ensureAuthUser(userByEmail, spec.email, defaultPassword, {
      full_name: spec.name,
      role: 'lead',
      shift_type: spec.shift,
    })
    leadIds.push(id)
    await upsertProfile({
      id,
      full_name: spec.name,
      email: spec.email,
      role: 'lead',
      shift_type: spec.shift,
      site_id: 'default',
      employment_type: 'full_time',
      max_work_days_per_week: 5,
      is_active: true,
      is_lead_eligible: true,
      on_fmla: false,
      archived_at: null,
    })
    await ensureWorkPattern(id, [1, 2, 3, 4, 5])
  }

  const therapistRows = []
  for (let i = 0; i < extraTherapistCount; i += 1) {
    const n = i + 1
    const email = `demo-therapist${String(n).padStart(2, '0')}@${domain}`
    const fullName = ROSTER[i] ?? `Demo Therapist ${n}`
    const shiftType = n % 2 === 0 ? 'night' : 'day'
    const id = await ensureAuthUser(userByEmail, email, defaultPassword, {
      full_name: fullName,
      role: 'therapist',
      shift_type: shiftType,
    })
    const alsoLeadEligible = n <= 2
    await upsertProfile({
      id,
      full_name: fullName,
      email,
      role: 'therapist',
      shift_type: shiftType,
      site_id: 'default',
      employment_type: 'full_time',
      max_work_days_per_week: 5,
      is_active: true,
      is_lead_eligible: alsoLeadEligible,
      on_fmla: false,
      archived_at: null,
    })
    await ensureWorkPattern(id, [1, 2, 3, 4, 5])
    therapistRows.push({
      id,
      full_name: fullName,
      role: 'therapist',
      shift_type: shiftType,
      is_lead_eligible: alsoLeadEligible,
    })
  }

  const rosterForShifts = [
    ...leadSpecs.map((s, idx) => ({
      id: leadIds[idx],
      role: 'lead',
      shift_type: s.shift,
      is_lead_eligible: true,
    })),
    ...therapistRows,
  ]

  const today = new Date()
  const publishedStart = mondayOfWeekContaining(addDays(today, -3))
  const publishedStartIso = formatDate(publishedStart)
  const publishedEndIso = formatDate(addDays(publishedStart, 41))

  const draftStart = addDays(publishedStart, 42)
  const draftStartIso = formatDate(draftStart)
  const draftEndIso = formatDate(addDays(draftStart, 41))

  const publishedLabel = `${DEMO_LABEL_PREFIX} Published ${publishedStartIso}`
  const draftLabel = `${DEMO_LABEL_PREFIX} Draft ${draftStartIso}`

  const { data: pubInserted, error: pubErr } = await supabase
    .from('schedule_cycles')
    .insert({
      label: publishedLabel,
      start_date: publishedStartIso,
      end_date: publishedEndIso,
      published: true,
    })
    .select('id')
    .single()

  if (pubErr) throw pubErr
  const publishedCycleId = pubInserted.id

  const { data: draftInserted, error: draftErr } = await supabase
    .from('schedule_cycles')
    .insert({
      label: draftLabel,
      start_date: draftStartIso,
      end_date: draftEndIso,
      published: false,
    })
    .select('id')
    .single()

  if (draftErr) throw draftErr
  const draftCycleId = draftInserted.id

  const pubCount = await seedShiftsForCycle(
    publishedCycleId,
    publishedStartIso,
    publishedEndIso,
    rosterForShifts
  )
  const draftCount = await seedShiftsForCycle(
    draftCycleId,
    draftStartIso,
    draftEndIso,
    rosterForShifts
  )

  console.log('')
  console.log('Functional demo seed complete.')
  console.log(`  Published cycle: ${publishedLabel} (${publishedCycleId}) — ${pubCount} shift rows`)
  console.log(`  Draft cycle:     ${draftLabel} (${draftCycleId}) — ${draftCount} shift rows`)
  console.log('')
  console.log('Sign in (examples):')
  console.log(`  Manager:  ${managerEmail} / ${defaultPassword}`)
  console.log(`  Lead:     ${leadSpecs[0].email} / ${defaultPassword}`)
  console.log(`  Staff:    demo-therapist01@${domain} / ${defaultPassword}`)
}

main().catch((error) => {
  console.error('seed-functional-demo failed:', error.message ?? error)
  process.exit(1)
})
