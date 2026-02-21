import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

function startOfNextMonday() {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = base.getDay()
  const daysUntilMonday = (8 - day) % 7 || 7
  return addDays(base, daysUntilMonday)
}

async function getOrCreateCycle(label, startDate, endDate, published) {
  const { data: existing, error: fetchError } = await supabase
    .from('schedule_cycles')
    .select('id, label')
    .eq('label', label)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from('schedule_cycles')
    .insert({
      label,
      start_date: startDate,
      end_date: endDate,
      published,
    })
    .select('id')
    .single()

  if (createError) throw createError
  return created.id
}

async function main() {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, shift_type')
    .order('full_name', { ascending: true })

  if (profileError) throw profileError

  const therapists = (profiles ?? []).filter((profile) => profile.role === 'therapist')
  if (therapists.length === 0) {
    console.error('No therapist profiles found. Create at least one user first.')
    process.exit(1)
  }

  const cycleStart = startOfNextMonday()
  const cycleEnd = addDays(cycleStart, 41)
  const draftStart = addDays(cycleStart, 42)
  const draftEnd = addDays(draftStart, 41)

  const publishedCycleId = await getOrCreateCycle(
    `Demo Cycle ${formatDate(cycleStart)}`,
    formatDate(cycleStart),
    formatDate(cycleEnd),
    true
  )
  const draftCycleId = await getOrCreateCycle(
    `Draft Cycle ${formatDate(draftStart)}`,
    formatDate(draftStart),
    formatDate(draftEnd),
    false
  )

  const shiftRows = []
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = formatDate(addDays(cycleStart, dayOffset))
    for (const therapist of therapists) {
      const shiftType = therapist.shift_type ?? (dayOffset % 2 === 0 ? 'day' : 'night')
      shiftRows.push({
        cycle_id: publishedCycleId,
        user_id: therapist.id,
        date,
        shift_type: shiftType,
        status: 'scheduled',
      })
    }
  }

  for (const shift of shiftRows) {
    const { data: existingShift, error: shiftCheckError } = await supabase
      .from('shifts')
      .select('id')
      .eq('cycle_id', shift.cycle_id)
      .eq('user_id', shift.user_id)
      .eq('date', shift.date)
      .eq('shift_type', shift.shift_type)
      .maybeSingle()
    if (shiftCheckError) throw shiftCheckError

    if (!existingShift) {
      const { error: insertShiftError } = await supabase.from('shifts').insert(shift)
      if (insertShiftError) throw insertShiftError
    }
  }

  for (let i = 0; i < therapists.length; i++) {
    const therapist = therapists[i]
    const requestDate = formatDate(addDays(cycleStart, 3 + i))

    const { data: existingRequest, error: requestCheckError } = await supabase
      .from('availability_requests')
      .select('id')
      .eq('user_id', therapist.id)
      .eq('cycle_id', publishedCycleId)
      .eq('date', requestDate)
      .maybeSingle()
    if (requestCheckError) throw requestCheckError

    if (!existingRequest) {
      const { error: requestInsertError } = await supabase.from('availability_requests').insert({
        user_id: therapist.id,
        cycle_id: publishedCycleId,
        date: requestDate,
        reason: 'Demo blackout date',
      })
      if (requestInsertError) throw requestInsertError
    }
  }

  const firstTherapist = therapists[0]
  const { data: firstShift, error: firstShiftError } = await supabase
    .from('shifts')
    .select('id')
    .eq('user_id', firstTherapist.id)
    .eq('cycle_id', publishedCycleId)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (firstShiftError) throw firstShiftError

  if (firstShift) {
    const { data: existingPost, error: postCheckError } = await supabase
      .from('shift_posts')
      .select('id')
      .eq('shift_id', firstShift.id)
      .eq('posted_by', firstTherapist.id)
      .eq('type', 'swap')
      .eq('message', 'Demo swap request')
      .maybeSingle()
    if (postCheckError) throw postCheckError

    if (!existingPost) {
      const { error: postInsertError } = await supabase.from('shift_posts').insert({
        shift_id: firstShift.id,
        posted_by: firstTherapist.id,
        message: 'Demo swap request',
        type: 'swap',
        status: 'pending',
      })
      if (postInsertError) throw postInsertError
    }
  }

  console.log('Demo data seed complete.')
  console.log(`Published cycle: ${publishedCycleId}`)
  console.log(`Draft cycle: ${draftCycleId}`)
  console.log(`Therapists seeded: ${therapists.length}`)
}

main().catch((error) => {
  console.error('Seed failed:', error.message)
  process.exit(1)
})
