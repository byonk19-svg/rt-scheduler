import { createClient } from '@supabase/supabase-js'

const allowNoEmail = process.argv.includes('--allow-no-email')

const requiredCoreEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
]
const requiredEmailEnvKeys = ['RESEND_API_KEY', 'PUBLISH_EMAIL_FROM']
const optionalEnvKeys = ['PUBLISH_WORKER_KEY']

const errors = []
const warnings = []
const infos = []

function isPlaceholder(value) {
  if (!value) return true
  return /your-|example|replace|changeme/i.test(value)
}

function readEnv(key) {
  const raw = process.env[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

function validateUrl(name, value) {
  try {
    const parsed = new URL(value)
    if (!parsed.protocol.startsWith('http')) {
      errors.push(`${name} must be an http(s) URL.`)
      return null
    }
    return parsed
  } catch {
    errors.push(`${name} is not a valid URL.`)
    return null
  }
}

function decodeServiceRoleProjectRef(serviceRoleKey) {
  try {
    const payload = JSON.parse(
      Buffer.from(serviceRoleKey.split('.')[1] ?? '', 'base64url').toString('utf8')
    )
    return typeof payload?.ref === 'string' ? payload.ref : ''
  } catch {
    return ''
  }
}

async function checkTableAccessible(supabase, table, selectColumns) {
  const { error } = await supabase
    .from(table)
    .select(selectColumns, { head: true, count: 'exact' })
    .limit(1)
  if (error) {
    errors.push(`${table} check failed: ${error.message}`)
    return
  }
  infos.push(`${table} table is reachable and expected columns are present.`)
}

async function main() {
  for (const key of requiredCoreEnvKeys) {
    const value = readEnv(key)
    if (!value || isPlaceholder(value)) {
      errors.push(`Missing or placeholder env var: ${key}`)
    }
  }

  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = readEnv('NEXT_PUBLIC_APP_URL')
  const resendApiKey = readEnv('RESEND_API_KEY')
  const publishEmailFrom = readEnv('PUBLISH_EMAIL_FROM')
  const workerKey = readEnv('PUBLISH_WORKER_KEY')

  const supabaseUrlParsed = supabaseUrl
    ? validateUrl('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
    : null
  if (appUrl) validateUrl('NEXT_PUBLIC_APP_URL', appUrl)

  if (supabaseUrlParsed && serviceRoleKey) {
    const urlRef = supabaseUrlParsed.hostname.split('.')[0] ?? ''
    const keyRef = decodeServiceRoleProjectRef(serviceRoleKey)
    if (urlRef && keyRef && urlRef !== keyRef) {
      errors.push(
        `SUPABASE_SERVICE_ROLE_KEY project ref (${keyRef}) does not match NEXT_PUBLIC_SUPABASE_URL ref (${urlRef}).`
      )
    }
  }

  const missingEmailKeys = requiredEmailEnvKeys.filter((key) => {
    const value = readEnv(key)
    return !value || isPlaceholder(value)
  })

  if (missingEmailKeys.length > 0) {
    const message = `Missing or placeholder email env var(s): ${missingEmailKeys.join(', ')}`
    if (allowNoEmail) {
      warnings.push(message)
    } else {
      errors.push(message)
    }
  }

  if (publishEmailFrom && !publishEmailFrom.includes('@')) {
    errors.push('PUBLISH_EMAIL_FROM should include a valid sender email address.')
  }

  if (!workerKey) {
    warnings.push(
      'PUBLISH_WORKER_KEY is not set. Manager-triggered processing still works, but cron/webhook processing cannot use key auth.'
    )
  } else if (isPlaceholder(workerKey)) {
    warnings.push('PUBLISH_WORKER_KEY appears to be a placeholder value.')
  }

  if (errors.length === 0 && supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await checkTableAccessible(
      supabase,
      'publish_events',
      'id, cycle_id, published_by, published_at, status, recipient_count, queued_count, sent_count, failed_count, error_message, channel'
    )
    await checkTableAccessible(
      supabase,
      'notification_outbox',
      'id, publish_event_id, user_id, email, name, channel, status, attempt_count, sent_at, last_error, created_at, updated_at'
    )
  }

  console.log('\nPublish readiness check')
  console.log('-----------------------')

  for (const key of requiredCoreEnvKeys) {
    const value = readEnv(key)
    const status = value && !isPlaceholder(value) ? 'OK' : 'MISSING'
    console.log(`${status.padEnd(8)} ${key}`)
  }
  for (const key of requiredEmailEnvKeys) {
    const value = readEnv(key)
    const status = value && !isPlaceholder(value) ? 'OK' : 'MISSING'
    console.log(`${status.padEnd(8)} ${key}`)
  }
  for (const key of optionalEnvKeys) {
    const value = readEnv(key)
    const status = value && !isPlaceholder(value) ? 'OK' : 'OPTIONAL'
    console.log(`${status.padEnd(8)} ${key}`)
  }

  if (infos.length > 0) {
    console.log('\nChecks passed:')
    for (const line of infos) {
      console.log(`- ${line}`)
    }
  }

  if (warnings.length > 0) {
    console.log('\nWarnings:')
    for (const line of warnings) {
      console.log(`- ${line}`)
    }
  }

  if (errors.length > 0) {
    console.error('\nReadiness failed:')
    for (const line of errors) {
      console.error(`- ${line}`)
    }
    process.exit(1)
  }

  if (!allowNoEmail && (!resendApiKey || !publishEmailFrom)) {
    process.exit(1)
  }

  console.log('\nPublish readiness is OK.')
}

void main()
