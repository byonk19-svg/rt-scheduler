import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  console.error(`Missing required env var(s): ${missing.join(', ')}`)
  process.exit(1)
}

const count = Number(process.env.SEED_USERS_COUNT ?? '8')
const domain = String(process.env.SEED_USERS_DOMAIN ?? 'teamwise.test').trim()
const prefix = String(process.env.SEED_USERS_PREFIX ?? 'employee').trim()
const defaultPassword = String(process.env.SEED_USERS_PASSWORD ?? 'Teamwise123!').trim()
const includeManager = String(process.env.SEED_INCLUDE_MANAGER ?? 'false').toLowerCase() === 'true'

if (!Number.isFinite(count) || count < 1) {
  console.error('SEED_USERS_COUNT must be a positive integer')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function pad(num) {
  return String(num).padStart(2, '0')
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

async function createOrGetUser({ email, password, fullName, role, shiftType }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      shift_type: shiftType,
    },
  })
  if (error) throw error

  return { userId: data.user.id }
}

async function upsertProfile({ id, fullName, email, role, shiftType }) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id,
      full_name: fullName,
      email,
      role,
      shift_type: shiftType,
    },
    { onConflict: 'id' }
  )

  if (error) throw error
}

async function main() {
  const allUsers = await listAllAuthUsers()
  const userByEmail = new Map(allUsers.map((user) => [String(user.email ?? '').toLowerCase(), user]))

  let createdCount = 0
  let reusedCount = 0

  for (let i = 1; i <= count; i += 1) {
    const email = `${prefix}${pad(i)}@${domain}`.toLowerCase()
    const fullName = `Test Employee ${i}`
    const role = 'therapist'
    const shiftType = i % 2 === 0 ? 'night' : 'day'

    const existing = userByEmail.get(email)
    const userId =
      existing?.id ??
      (
        await createOrGetUser({
          email,
          password: defaultPassword,
          fullName,
          role,
          shiftType,
        })
      ).userId

    if (existing) {
      reusedCount += 1
    } else {
      createdCount += 1
    }

    await upsertProfile({
      id: userId,
      fullName,
      email,
      role,
      shiftType,
    })
  }

  if (includeManager) {
    const email = `manager@${domain}`.toLowerCase()
    const fullName = 'Test Manager'
    const role = 'manager'
    const shiftType = 'day'

    const existing = userByEmail.get(email)
    const userId =
      existing?.id ??
      (
        await createOrGetUser({
          email,
          password: defaultPassword,
          fullName,
          role,
          shiftType,
        })
      ).userId

    if (existing) {
      reusedCount += 1
    } else {
      createdCount += 1
    }

    await upsertProfile({
      id: userId,
      fullName,
      email,
      role,
      shiftType,
    })
  }

  console.log('Seed users complete.')
  console.log(`Created: ${createdCount}`)
  console.log(`Reused: ${reusedCount}`)
  console.log(`Password for new users: ${defaultPassword}`)
  console.log(`Email pattern: ${prefix}01@${domain} ... ${prefix}${pad(count)}@${domain}`)
  if (includeManager) {
    console.log(`Manager user: manager@${domain}`)
  }
}

main().catch((error) => {
  console.error('seed:users failed:', error.message)
  process.exit(1)
})
