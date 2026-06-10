const PRODUCTION_MODES = new Set(['prod', 'production'])
const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled'])
const PLACEHOLDER_PATTERN =
  /^(?:your-|replace-|placeholder|changeme|todo|example$)|(?:example\.com|yourdomain\.com|your-project|your-.*-here)/i
const DEMO_VALUE_PATTERN =
  /(?:teamwise\.test|\.test$|example\.com|demo-|seed-|employee|teamwise123!)/i

const CORE_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const DEMO_CREDENTIAL_ENV_KEYS = [
  'DEMO_MANAGER_EMAIL',
  'DEMO_STAFF_EMAIL',
  'DEMO_USER_EMAIL',
  'DEMO_PASSWORD',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'SHOT_MANAGER_EMAIL',
  'SHOT_STAFF_EMAIL',
  'SHOT_PASSWORD',
  'SEED_DOMAIN',
  'SEED_PASSWORD',
  'SEED_USERS_DOMAIN',
  'SEED_USERS_PASSWORD',
  'SEED_USERS_PREFIX',
]

function isProductionMode(mode) {
  return PRODUCTION_MODES.has(
    String(mode ?? '')
      .trim()
      .toLowerCase()
  )
}

function readEnv(env, key) {
  const value = env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function isPlaceholder(value) {
  return !value || PLACEHOLDER_PATTERN.test(value)
}

function isTruthyEnv(env, keys) {
  return keys.some((key) => TRUTHY_VALUES.has(readEnv(env, key).toLowerCase()))
}

function hasCronEntries(vercelConfig) {
  return Array.isArray(vercelConfig?.crons) && vercelConfig.crons.length > 0
}

function addCheck(checks, status, label, message, remediation) {
  checks.push({ status, label, message, remediation })
}

function addRequiredEnvCheck(checks, env, key, { required, label = key, remediation }) {
  const value = readEnv(env, key)
  if (!isPlaceholder(value)) {
    addCheck(checks, 'pass', label, `${key} is configured.`, '')
    return
  }

  addCheck(
    checks,
    required ? 'fail' : 'warn',
    label,
    `${key} is missing or still uses a placeholder value.`,
    remediation ?? `Set ${key} in the target deployment environment.`
  )
}

function validateHttpUrl(value) {
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function validateCoreEnvironment(checks, env) {
  for (const key of CORE_ENV_KEYS) {
    addRequiredEnvCheck(checks, env, key, {
      required: true,
      remediation: `Set ${key} to the production Supabase project value.`,
    })
  }

  const supabaseUrl = readEnv(env, 'NEXT_PUBLIC_SUPABASE_URL')
  if (supabaseUrl && !validateHttpUrl(supabaseUrl)) {
    addCheck(
      checks,
      'fail',
      'NEXT_PUBLIC_SUPABASE_URL format',
      'NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL.',
      'Use the Supabase project URL, for example https://<project-ref>.supabase.co.'
    )
  }
}

function validateAppUrl(checks, env, productionMode) {
  const appUrl = readEnv(env, 'NEXT_PUBLIC_APP_URL')
  if (isPlaceholder(appUrl)) {
    addCheck(
      checks,
      productionMode ? 'fail' : 'warn',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_APP_URL is missing or still uses a placeholder value.',
      'Set NEXT_PUBLIC_APP_URL to the deployed application origin.'
    )
    return
  }

  const parsed = validateHttpUrl(appUrl)
  if (!parsed) {
    addCheck(
      checks,
      'fail',
      'NEXT_PUBLIC_APP_URL format',
      'NEXT_PUBLIC_APP_URL must be a valid http(s) URL.',
      'Set NEXT_PUBLIC_APP_URL to a full origin such as https://app.example.com.'
    )
    return
  }

  if (productionMode && parsed.protocol !== 'https:') {
    addCheck(
      checks,
      'fail',
      'NEXT_PUBLIC_APP_URL HTTPS',
      'NEXT_PUBLIC_APP_URL must use https in production mode.',
      'Set NEXT_PUBLIC_APP_URL to the HTTPS production origin.'
    )
    return
  }

  addCheck(checks, 'pass', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_APP_URL is configured.', '')
}

function validateEmailIntegrations(checks, env, productionMode) {
  const emailFeatureEnabled =
    productionMode ||
    isTruthyEnv(env, [
      'ENABLE_EMAIL_FEATURES',
      'EMAIL_FEATURES_ENABLED',
      'ENABLE_PUBLISH_EMAILS',
      'PUBLISH_EMAIL_ENABLED',
      'ENABLE_INBOUND_AVAILABILITY_EMAIL',
      'INBOUND_AVAILABILITY_EMAIL_ENABLED',
    ])
  const inboundFeatureEnabled =
    productionMode ||
    isTruthyEnv(env, [
      'ENABLE_INBOUND_AVAILABILITY_EMAIL',
      'INBOUND_AVAILABILITY_EMAIL_ENABLED',
      'ENABLE_AVAILABILITY_EMAIL_INTAKE',
      'AVAILABILITY_EMAIL_INTAKE_ENABLED',
    ])
  const ocrFeatureEnabled =
    productionMode ||
    isTruthyEnv(env, ['ENABLE_OCR_INTAKE', 'OCR_INTAKE_ENABLED', 'ENABLE_OPENAI_OCR'])

  addRequiredEnvCheck(checks, env, 'RESEND_API_KEY', {
    required: emailFeatureEnabled,
    label: 'Resend API key',
    remediation:
      'Set RESEND_API_KEY when publish email, approval email, reminders, or inbound email intake is enabled.',
  })

  addRequiredEnvCheck(checks, env, 'RESEND_WEBHOOK_SECRET', {
    required: inboundFeatureEnabled,
    label: 'Resend webhook secret',
    remediation:
      'Set RESEND_WEBHOOK_SECRET to the Resend webhook signing secret for inbound availability email intake.',
  })

  addRequiredEnvCheck(checks, env, 'OPENAI_API_KEY', {
    required: ocrFeatureEnabled,
    label: 'OpenAI OCR key',
    remediation: 'Set OPENAI_API_KEY when OCR intake is enabled.',
  })
}

function validateWorkerAndCron(checks, env, productionMode, vercelConfig) {
  const publishWorkerEnabled =
    productionMode ||
    isTruthyEnv(env, [
      'ENABLE_PUBLISH_WORKER',
      'PUBLISH_WORKER_ENABLED',
      'ENABLE_PUBLISH_WORKER_PROCESSING',
    ])

  for (const key of ['PUBLISH_WORKER_KEY', 'PUBLISH_WORKER_SIGNING_KEY']) {
    addRequiredEnvCheck(checks, env, key, {
      required: publishWorkerEnabled,
      remediation: `Set ${key} when publish worker processing is enabled.`,
    })
  }

  if (vercelConfig?._readError) {
    addCheck(
      checks,
      'warn',
      'vercel.json',
      'vercel.json could not be read, so cron configuration was not verified.',
      'Run this command from the repository root or restore vercel.json.'
    )
  } else if (hasCronEntries(vercelConfig)) {
    addRequiredEnvCheck(checks, env, 'CRON_SECRET', {
      required: productionMode,
      remediation:
        'Set CRON_SECRET because vercel.json contains cron entries that call protected cron routes.',
    })
  } else {
    addCheck(checks, 'pass', 'Vercel cron config', 'No vercel.json cron entries were found.', '')
  }
}

function validateSentry(checks, env, productionMode) {
  const hasServerDsn = !isPlaceholder(readEnv(env, 'SENTRY_DSN'))
  const hasBrowserDsn = !isPlaceholder(readEnv(env, 'NEXT_PUBLIC_SENTRY_DSN'))

  if (hasServerDsn && hasBrowserDsn) {
    addCheck(
      checks,
      'pass',
      'Sentry DSNs',
      'Both server and browser Sentry DSNs are configured.',
      ''
    )
    return
  }

  if (!hasServerDsn && !hasBrowserDsn) {
    addCheck(
      checks,
      productionMode ? 'fail' : 'warn',
      'Sentry DSNs',
      'SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN are not both configured.',
      productionMode
        ? 'Set both SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN for production error reporting.'
        : 'Optional for local/demo. Set both DSNs before production launch.'
    )
    return
  }

  addCheck(
    checks,
    productionMode ? 'fail' : 'warn',
    'Sentry DSN pair',
    'Only one of SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is configured.',
    'Set both DSNs together, or unset both for local/demo environments.'
  )
}

function validateDemoCredentials(checks, env, productionMode) {
  const configuredDemoKeys = DEMO_CREDENTIAL_ENV_KEYS.filter((key) => readEnv(env, key))
  const suspiciousEmailKeys = Object.keys(env ?? {}).filter((key) => {
    if (!/_EMAIL$/i.test(key)) return false
    const value = readEnv(env, key)
    return Boolean(value) && DEMO_VALUE_PATTERN.test(value)
  })
  const keys = [...new Set([...configuredDemoKeys, ...suspiciousEmailKeys])].sort()

  if (keys.length === 0) {
    addCheck(
      checks,
      'pass',
      'Seeded/demo credentials',
      'No seeded or demo credential env vars were detected.',
      ''
    )
    return
  }

  addCheck(
    checks,
    productionMode ? 'fail' : 'warn',
    'Seeded/demo credentials',
    `Seeded or demo credential env vars are configured: ${keys.join(', ')}.`,
    productionMode
      ? 'Remove demo, seed, screenshot, and E2E credential env vars from production deployments.'
      : 'Expected for local/demo. Do not reuse these env vars as production user credentials.'
  )
}

export function evaluateProductionReadiness({ env = {}, vercelConfig = {}, mode = 'local' } = {}) {
  const checks = []
  const productionMode = isProductionMode(mode)

  validateCoreEnvironment(checks, env)
  validateAppUrl(checks, env, productionMode)
  validateEmailIntegrations(checks, env, productionMode)
  validateWorkerAndCron(checks, env, productionMode, vercelConfig)
  validateSentry(checks, env, productionMode)
  validateDemoCredentials(checks, env, productionMode)

  const summary = checks.reduce(
    (counts, check) => {
      counts[check.status] += 1
      return counts
    },
    { pass: 0, warn: 0, fail: 0 }
  )

  return {
    mode: productionMode ? 'production' : 'local',
    checks,
    summary,
    ok: summary.fail === 0,
  }
}

export function formatProductionReadinessReport(result) {
  const lines = [
    '',
    `Teamwise production readiness check (mode: ${result.mode})`,
    '------------------------------------------------',
  ]

  for (const check of result.checks) {
    lines.push(`${check.status.toUpperCase().padEnd(5)} ${check.label}: ${check.message}`)
    if (check.remediation) {
      lines.push(`      Remediation: ${check.remediation}`)
    }
  }

  lines.push(
    '',
    `Summary: ${result.summary.pass} pass, ${result.summary.warn} warn, ${result.summary.fail} fail.`
  )

  if (result.mode !== 'production') {
    lines.push(
      'Local/demo mode reports optional production integrations as warnings unless they are explicitly enabled.'
    )
  }

  return lines.join('\n')
}
