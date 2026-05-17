/**
 * Full demo dataset for local/UAT: auth users, profiles, work patterns, two 6-week cycles,
 * and coverage shifts (1 lead + 4 staff per day/night slot where roster allows).
 * Also seeds a few swap-request scenarios so the request workflow is immediately testable.
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
 */
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

import {
  FUNCTIONAL_DEMO_ACCOUNTS,
  FUNCTIONAL_DEMO_DOMAIN,
  FUNCTIONAL_DEMO_PASSWORD,
  FUNCTIONAL_DEMO_ROSTER,
  getFunctionalDemoLoginExamples,
  getFunctionalDemoRequestAnchor,
  toSeedEmail,
} from './fixtures/functional-demo-roster.mjs'

const DEMO_LABEL_PREFIX = 'Teamwise UAT'
const DEMO_SITE_ID = 'teamwise-uat'
export { FUNCTIONAL_DEMO_ACCOUNTS, FUNCTIONAL_DEMO_DOMAIN, FUNCTIONAL_DEMO_PASSWORD }

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

const defaultDomain = String(process.env.SEED_DOMAIN ?? FUNCTIONAL_DEMO_DOMAIN)
  .trim()
  .toLowerCase()
const defaultPassword = String(process.env.SEED_PASSWORD ?? FUNCTIONAL_DEMO_PASSWORD).trim()

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

/** Sunday 00:00 local of the week containing `date` (Schedule Blocks must start Sunday). */
function sundayOfWeekContaining(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const dow = base.getDay()
  base.setDate(base.getDate() - dow)
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

function normalizeRosterName(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function generateUndisclosedPassword() {
  return `SeedNoLogin!${randomBytes(12).toString('base64url')}`
}

function maxWorkDaysFor(member) {
  return member.employmentType === 'prn' ? 1 : 3
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

async function ensureSite(id, name = 'Default') {
  const { error } = await supabase.from('sites').upsert({ id, name }, { onConflict: 'id' })
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
  const therapistsAndLeads = rosterRows.filter(
    (p) =>
      (p.role === 'therapist' || p.role === 'lead') &&
      p.is_active !== false &&
      p.on_fmla !== true &&
      p.employment_type !== 'prn'
  )
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
          site_id: DEMO_SITE_ID,
        })
      }
    }
    rotation += 1
  }

  await insertShiftsBatched(rows)
  return rows.length
}

async function seedSwapRequestScenarios({ publishedCycleId, requestAnchorEmail }) {
  const demoStaffEmail = requestAnchorEmail
  const { data: demoStaff, error: demoStaffError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', demoStaffEmail)
    .maybeSingle()

  if (demoStaffError) throw demoStaffError
  if (!demoStaff?.id) {
    console.log(`Skipped seeded swap requests: could not find ${demoStaffEmail}.`)
    return []
  }

  const todayIso = formatDate(new Date())
  const { data: shiftRows, error: shiftRowsError } = await supabase
    .from('shifts')
    .select('id, user_id, date, role')
    .eq('cycle_id', publishedCycleId)
    .eq('shift_type', 'day')
    .eq('status', 'scheduled')
    .eq('assignment_status', 'scheduled')
    .gte('date', todayIso)
    .order('date', { ascending: true })
    .order('user_id', { ascending: true })

  if (shiftRowsError) throw shiftRowsError

  const dayShiftRows = (shiftRows ?? []).filter((row) => Boolean(row.user_id))
  const shiftsByDate = new Map()
  for (const row of dayShiftRows) {
    const bucket = shiftsByDate.get(row.date) ?? []
    bucket.push(row)
    shiftsByDate.set(row.date, bucket)
  }

  const demoStaffId = demoStaff.id
  const partnerOnlyDates = Array.from(shiftsByDate.entries())
    .map(([date, rows]) => ({
      date,
      demoRow: rows.find((row) => row.user_id === demoStaffId) ?? null,
      partnerRow: rows.find((row) => row.user_id && row.user_id !== demoStaffId) ?? null,
      rows,
    }))
    .filter((entry) => !entry.demoRow && entry.partnerRow)
  const demoShiftDates = Array.from(shiftsByDate.entries())
    .map(([date, rows]) => ({
      date,
      demoRow: rows.find((row) => row.user_id === demoStaffId) ?? null,
      rows,
    }))
    .filter((entry) => entry.demoRow)

  if (partnerOnlyDates.length < 2 || demoShiftDates.length < 3) {
    console.log('Skipped seeded swap requests: not enough generated day-shift coverage.')
    return []
  }

  const hasUserOnDate = (userId, date) =>
    (shiftsByDate.get(date) ?? []).some((row) => row.user_id === userId)
  const findDemoTradeShift = (requestEntry, excludedDates) =>
    demoShiftDates.find(
      (entry) =>
        !excludedDates.has(entry.date) &&
        entry.demoRow.role !== 'lead' &&
        !hasUserOnDate(requestEntry.partnerRow.user_id, entry.date)
    )

  const teamSwapWithPartner =
    partnerOnlyDates.find((entry) => findDemoTradeShift(entry, new Set([entry.date]))) ?? null
  const openSwap = teamSwapWithPartner
    ? demoShiftDates.find((entry) => entry.date !== teamSwapWithPartner.date)
    : null
  const teamSwapRecipientShift = teamSwapWithPartner
    ? findDemoTradeShift(
        teamSwapWithPartner,
        new Set([teamSwapWithPartner.date, openSwap?.date].filter(Boolean))
      )
    : null
  const directSwap =
    partnerOnlyDates.find(
      (entry) =>
        entry.date !== teamSwapWithPartner?.date &&
        entry.date !== openSwap?.date &&
        entry.date !== teamSwapRecipientShift?.date &&
        findDemoTradeShift(
          entry,
          new Set(
            [
              teamSwapWithPartner?.date,
              openSwap?.date,
              teamSwapRecipientShift?.date,
              entry.date,
            ].filter(Boolean)
          )
        )
    ) ?? null
  const directSwapRecipientShift = directSwap
    ? findDemoTradeShift(
        directSwap,
        new Set(
          [
            teamSwapWithPartner?.date,
            openSwap?.date,
            teamSwapRecipientShift?.date,
            directSwap.date,
          ].filter(Boolean)
        )
      )
    : null

  if (
    !teamSwapWithPartner ||
    !openSwap ||
    !teamSwapRecipientShift ||
    !directSwap ||
    !directSwapRecipientShift
  ) {
    console.log('Skipped seeded swap requests: could not find distinct dates for each scenario.')
    return []
  }

  const scenarios = [
    {
      label: 'team swap with suggested partner',
      message: 'Seeded team swap with suggested partner',
      shiftId: teamSwapWithPartner.partnerRow.id,
      postedBy: teamSwapWithPartner.partnerRow.user_id,
      claimedBy: demoStaffId,
      swapShiftId: teamSwapRecipientShift.demoRow.id,
      visibility: 'team',
      recipientResponse: null,
    },
    {
      label: 'open team swap',
      message: 'Seeded open team swap request',
      shiftId: openSwap.demoRow.id,
      postedBy: demoStaffId,
      claimedBy: null,
      swapShiftId: null,
      visibility: 'team',
      recipientResponse: null,
    },
    {
      label: 'direct swap awaiting teammate response',
      message: 'Seeded direct swap awaiting response',
      shiftId: directSwap.partnerRow.id,
      postedBy: directSwap.partnerRow.user_id,
      claimedBy: demoStaffId,
      swapShiftId: directSwapRecipientShift.demoRow.id,
      visibility: 'direct',
      recipientResponse: 'pending',
    },
  ]

  for (const [index, scenario] of scenarios.entries()) {
    const createdAt = new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('shift_posts').insert({
      shift_id: scenario.shiftId,
      posted_by: scenario.postedBy,
      claimed_by: scenario.claimedBy,
      swap_shift_id: scenario.swapShiftId,
      type: 'swap',
      status: 'pending',
      visibility: scenario.visibility,
      recipient_response: scenario.recipientResponse,
      request_kind: 'standard',
      message: scenario.message,
      created_at: createdAt,
    })

    if (error) throw error
  }

  return scenarios
}

async function seedEmployeeRoster(managerId, rosterRows) {
  const rows = rosterRows
    .filter((row) => row.role === 'therapist' || row.role === 'lead')
    .map((row) => ({
      full_name: row.full_name,
      normalized_full_name: normalizeRosterName(row.full_name),
      role: row.role,
      shift_type: row.shift_type,
      employment_type: row.employment_type,
      max_work_days_per_week: row.max_work_days_per_week,
      is_lead_eligible: row.is_lead_eligible,
      is_active: row.is_active,
      matched_profile_id: row.id,
      matched_email: row.email,
      matched_at: new Date().toISOString(),
      created_by: managerId,
      updated_by: managerId,
    }))

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('employee_roster')
    .upsert(rows, { onConflict: 'normalized_full_name' })
  if (error) throw error
  return rows.length
}

async function seedCycleTemplates(managerId) {
  const templateName = `${DEMO_LABEL_PREFIX} Baseline 6-week template`
  const shiftData = {
    version: 1,
    cycleLengthDays: 42,
    slots: Array.from({ length: 42 }, (_, dayOffset) => [
      { dayOffset, shiftType: 'day', role: 'lead', count: 1 },
      { dayOffset, shiftType: 'day', role: 'staff', count: 4 },
      { dayOffset, shiftType: 'night', role: 'lead', count: 1 },
      { dayOffset, shiftType: 'night', role: 'staff', count: 4 },
    ]).flat(),
  }

  const { error: deleteError } = await supabase
    .from('cycle_templates')
    .delete()
    .eq('name', templateName)
  if (deleteError) throw deleteError

  const { error: insertError } = await supabase.from('cycle_templates').insert({
    name: templateName,
    description: 'Seeded baseline coverage template for local UAT and branch E2E data.',
    created_by: managerId,
    shift_data: shiftData,
  })
  if (insertError) throw insertError
  return templateName
}

async function seedPickupInterestScenarios({ publishedCycleId }) {
  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('id, user_id, date, shift_type')
    .eq('cycle_id', publishedCycleId)
    .eq('shift_type', 'night')
    .eq('status', 'scheduled')
    .eq('assignment_status', 'scheduled')
    .not('user_id', 'is', null)
    .order('date', { ascending: true })
    .order('user_id', { ascending: true })
    .limit(8)
  if (shiftsError) throw shiftsError

  const sourceShift = (shifts ?? [])[0]
  const claimantRows = (shifts ?? [])
    .map((shift) => shift.user_id)
    .filter((id) => id && id !== sourceShift?.user_id)
    .slice(0, 3)

  if (!sourceShift?.id || !sourceShift.user_id || claimantRows.length < 2) {
    console.log('Skipped seeded pickup interests: not enough night-shift rows.')
    return null
  }

  const { data: post, error: postError } = await supabase
    .from('shift_posts')
    .insert({
      shift_id: sourceShift.id,
      posted_by: sourceShift.user_id,
      claimed_by: null,
      type: 'pickup',
      status: 'pending',
      visibility: 'team',
      recipient_response: null,
      request_kind: 'standard',
      message: 'Seeded pickup queue with primary and backup claimants',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
  if (postError) throw postError

  const { error: interestError } = await supabase.from('shift_post_interests').insert(
    claimantRows.map((therapistId, index) => ({
      shift_post_id: post.id,
      therapist_id: therapistId,
      status: index === 0 ? 'selected' : 'pending',
      created_at: new Date(Date.now() - (20 - index) * 60 * 1000).toISOString(),
      responded_at: null,
    }))
  )
  if (interestError) throw interestError

  return { postId: post.id, interestCount: claimantRows.length }
}

export async function seedFunctionalDemo(options = {}) {
  const domain = String(options.domain ?? defaultDomain)
    .trim()
    .toLowerCase()
  const password = String(options.password ?? defaultPassword).trim()

  console.log('Removing any prior Teamwise UAT demo cycles, then seeding users + schedules.')
  await wipeDemoCycles()
  await ensureSite(DEMO_SITE_ID, 'Teamwise UAT')

  const authUsers = await listAllAuthUsers()
  const userByEmail = new Map(authUsers.map((u) => [String(u.email ?? '').toLowerCase(), u]))

  const seededRoster = []
  const undisclosedPassword = generateUndisclosedPassword()

  for (const member of FUNCTIONAL_DEMO_ROSTER) {
    const email = toSeedEmail(member, domain)
    const accountPassword = member.login ? password : undisclosedPassword
    const isLeadEligible = member.role === 'lead'
    const id = await ensureAuthUser(userByEmail, email, accountPassword, {
      full_name: member.fullName,
      role: member.role,
      shift_type: member.shiftType,
    })

    const profileRow = {
      id,
      full_name: member.fullName,
      email,
      role: member.role,
      shift_type: member.shiftType,
      site_id: DEMO_SITE_ID,
      employment_type: member.employmentType,
      max_work_days_per_week: maxWorkDaysFor(member),
      is_active: true,
      is_lead_eligible: isLeadEligible,
      on_fmla: member.onFmla === true,
      fmla_return_date: null,
      access_status: 'approved',
      staff_onboarding_required: false,
      staff_onboarding_completed_at: null,
    }
    await upsertProfile(profileRow)

    if (member.role === 'therapist' || member.role === 'lead') {
      if (member.employmentType === 'prn') {
        await ensureWorkPattern(id, [])
      } else {
        await ensureWorkPattern(id, [1, 2, 3, 4, 5])
      }
      seededRoster.push({
        ...profileRow,
        requestWorkflowAnchor: member.requestWorkflowAnchor === true,
      })
    }
  }

  const managerEmail = toSeedEmail(
    FUNCTIONAL_DEMO_ROSTER.find((row) => row.role === 'manager'),
    domain
  )
  const managerId = userByEmail.get(managerEmail)?.id
  const requestAnchor = getFunctionalDemoRequestAnchor(domain)
  const requestAnchorEmail = requestAnchor?.email

  if (!managerId) {
    throw new Error('Functional demo manager was not seeded.')
  }
  if (!requestAnchorEmail) {
    throw new Error('Functional demo request workflow anchor was not configured.')
  }

  const rosterForShifts = seededRoster

  const today = new Date()
  const publishedStart = sundayOfWeekContaining(addDays(today, -3))
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
      site_id: DEMO_SITE_ID,
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
      site_id: DEMO_SITE_ID,
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
  const draftCount = 0
  const seededSwapScenarios = await seedSwapRequestScenarios({
    publishedCycleId,
    requestAnchorEmail,
  })
  const rosterCount = await seedEmployeeRoster(managerId, rosterForShifts)
  const templateName = await seedCycleTemplates(managerId)
  const seededPickupScenario = await seedPickupInterestScenarios({ publishedCycleId })

  console.log('')
  console.log('Functional demo seed complete.')
  console.log(`  Published cycle: ${publishedLabel} (${publishedCycleId}) — ${pubCount} shift rows`)
  console.log(`  Draft cycle:     ${draftLabel} (${draftCycleId}) - empty for Auto-draft testing`)
  console.log('')
  if (seededSwapScenarios.length > 0) {
    console.log('Seeded swap requests:')
    for (const scenario of seededSwapScenarios) {
      console.log(`  - ${scenario.label}: "${scenario.message}"`)
    }
    console.log('')
  }
  console.log(`Seeded employee roster rows: ${rosterCount}`)
  console.log(`Seeded cycle template: ${templateName}`)
  if (seededPickupScenario) {
    console.log(
      `Seeded pickup interest queue: ${seededPickupScenario.postId} (${seededPickupScenario.interestCount} claimant rows)`
    )
  }
  console.log('')
  console.log('Sign in (selected demo accounts):')
  for (const example of getFunctionalDemoLoginExamples(domain)) {
    console.log(`  ${example.label}: ${example.email} / ${password} (${example.name})`)
  }

  return {
    managerEmail,
    loginEmails: FUNCTIONAL_DEMO_ROSTER.filter((member) => member.login).map((member) =>
      toSeedEmail(member, domain)
    ),
    staffEmail: requestAnchorEmail,
    password,
    publishedLabel,
    draftLabel,
    publishedCycleId,
    draftCycleId,
    publishedShiftCount: pubCount,
    draftShiftCount: draftCount,
  }
}

async function main() {
  await seedFunctionalDemo()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('seed-functional-demo failed:', error.message ?? error)
    process.exit(1)
  })
}
