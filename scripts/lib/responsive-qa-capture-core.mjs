const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'y', 'on'])
export const RESPONSIVE_QA_REQUIRED_CSS_VARIABLES = ['--background', '--foreground', '--border']
export const RESPONSIVE_QA_DEFAULT_AUTH = {
  domain: 'responsive-qa.teamwise.test',
  therapistPrefix: 'responsive-qa-therapist',
  siteId: 'teamwise-uat',
  siteName: 'Teamwise UAT',
  managerEmail: 'manager@responsive-qa.teamwise.test',
  therapistEmail: 'responsive-qa-therapist01@responsive-qa.teamwise.test',
  password: 'Teamwise123!',
}
const DISPOSABLE_AUTH_COMPLETED_AT = '2026-04-27T17:00:00.000Z'

const RESPONSIVE_QA_VIEWPORTS = [
  {
    name: 'desktop',
    options: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    },
  },
  {
    name: 'tablet',
    options: {
      viewport: { width: 834, height: 1112 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
  {
    name: 'mobile',
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
]

export const RESPONSIVE_QA_ROUTE_GROUPS = {
  public: [
    { name: 'public-homepage', path: '/' },
    { name: 'login', path: '/login' },
    { name: 'signup', path: '/signup' },
  ],
  manager: [
    { name: 'manager-dashboard', path: '/dashboard/manager' },
    { name: 'manager-schedule', path: '/schedule' },
    { name: 'manager-availability', path: '/availability' },
    { name: 'manager-team-import', path: '/team/import' },
    { name: 'manager-audit-log', path: '/settings/audit-log' },
  ],
  therapist: [
    { name: 'therapist-dashboard', path: '/dashboard/staff' },
    { name: 'therapist-schedule', path: '/therapist/schedule' },
    { name: 'therapist-availability', path: '/therapist/availability' },
  ],
}

export function parseResponsiveQaArgs(argv = []) {
  const args = {}

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue

    const eqIndex = token.indexOf('=')
    if (eqIndex >= 0) {
      args[token.slice(2, eqIndex)] = token.slice(eqIndex + 1)
      continue
    }

    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args[key] = next
      i += 1
    } else {
      args[key] = 'true'
    }
  }

  return args
}

function isTruthy(value) {
  return TRUTHY_VALUES.has(
    String(value ?? '')
      .trim()
      .toLowerCase()
  )
}

function normalizeCsv(value) {
  if (!value) return null
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function pickNamed(items, requested, label) {
  if (!requested) return items

  const byName = new Map(items.map((item) => [item.name, item]))
  const selected = requested.map((name) => {
    const item = byName.get(name)
    if (!item) {
      throw new Error(`Unknown responsive QA ${label}: ${name}`)
    }
    return item
  })

  return selected
}

function hasSupabaseAuthEnv(env) {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function resolvePassword(args, env) {
  return (
    args.password ??
    env.SHOT_PASSWORD ??
    env.E2E_USER_PASSWORD ??
    RESPONSIVE_QA_DEFAULT_AUTH.password
  )
}

export function buildResponsiveQaAuthInstructions(config = {}) {
  const managerEmail = config.manager?.email ?? RESPONSIVE_QA_DEFAULT_AUTH.managerEmail
  const therapistEmail = config.therapist?.email ?? RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail
  const password = config.manager?.password ?? RESPONSIVE_QA_DEFAULT_AUTH.password
  const defaultPasswordHint =
    password === RESPONSIVE_QA_DEFAULT_AUTH.password
      ? RESPONSIVE_QA_DEFAULT_AUTH.password
      : '<same password used for --password or SHOT_PASSWORD>'

  const seedCommand =
    `$env:SEED_USERS_DOMAIN="${RESPONSIVE_QA_DEFAULT_AUTH.domain}"; ` +
    `$env:SEED_USERS_PREFIX="${RESPONSIVE_QA_DEFAULT_AUTH.therapistPrefix}"; ` +
    '$env:SEED_USERS_COUNT="1"; ' +
    '$env:SEED_INCLUDE_MANAGER="true"; ' +
    `$env:SEED_USERS_PASSWORD="${defaultPasswordHint}"; ` +
    'npm run seed:users'

  const captureCommand =
    'npm run qa:responsive -- --mode=seeded ' +
    '--provision-auth ' +
    `--manager-email=${RESPONSIVE_QA_DEFAULT_AUTH.managerEmail} ` +
    `--therapist-email=${RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail} ` +
    `--password="${defaultPasswordHint}"`

  const cleanupCommand =
    `npm run cleanup:seed-users -- --domain=${RESPONSIVE_QA_DEFAULT_AUTH.domain} ` +
    `--prefix=${RESPONSIVE_QA_DEFAULT_AUTH.therapistPrefix} ` +
    `--email=${RESPONSIVE_QA_DEFAULT_AUTH.managerEmail} --execute`

  return [
    'Authenticated responsive QA uses disposable users and does not reset functional demo data.',
    `Current manager: ${managerEmail}`,
    `Current therapist: ${therapistEmail}`,
    `Default manager: ${RESPONSIVE_QA_DEFAULT_AUTH.managerEmail}`,
    `Default therapist: ${RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail}`,
    `Safe auth-user setup: ${seedCommand}`,
    `Safe provision + capture: ${captureCommand}`,
    `Cleanup: ${cleanupCommand}`,
  ]
}

export function summarizeResponsiveQaAuthError(error, config = {}) {
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid login credentials/i.test(message)) {
    return [
      'Responsive QA credentials were rejected.',
      ...buildResponsiveQaAuthInstructions(config),
    ].join(' ')
  }
  if (/(NEXT_PUBLIC_SUPABASE|SUPABASE_ANON)/i.test(message)) {
    return 'Supabase auth env vars are missing.'
  }
  return message
}

export function isResponsiveQaBlockedAuthenticatedUrl(value) {
  try {
    const url = new URL(String(value), 'http://responsive-qa.local')
    return /^\/(?:login|access|pending-setup|onboarding)(?:\/|$)/i.test(url.pathname)
  } catch {
    return false
  }
}

export function buildResponsiveQaDisposableAuthPlan({
  managerEmail = RESPONSIVE_QA_DEFAULT_AUTH.managerEmail,
  therapistEmail = RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail,
  managerUserId = 'manager-user-id',
  therapistUserId = 'therapist-user-id',
  siteId = RESPONSIVE_QA_DEFAULT_AUTH.siteId,
  siteName = RESPONSIVE_QA_DEFAULT_AUTH.siteName,
} = {}) {
  const normalizedManagerEmail = String(managerEmail).trim().toLowerCase()
  const normalizedTherapistEmail = String(therapistEmail).trim().toLowerCase()

  if (
    normalizedManagerEmail !== RESPONSIVE_QA_DEFAULT_AUTH.managerEmail ||
    normalizedTherapistEmail !== RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail
  ) {
    throw new Error(
      'Disposable responsive QA provisioning is limited to the default responsive-qa.teamwise.test accounts.'
    )
  }

  return {
    site: {
      id: siteId,
      name: siteName,
    },
    profiles: [
      {
        id: managerUserId,
        full_name: 'Responsive QA Manager',
        email: normalizedManagerEmail,
        role: 'manager',
        shift_type: 'day',
        site_id: siteId,
        employment_type: 'full_time',
        max_work_days_per_week: 5,
        is_active: true,
        is_lead_eligible: false,
        on_fmla: false,
        fmla_return_date: null,
        access_status: 'approved',
        preferred_work_days: [],
        preferred_work_days_mode: 'unset',
        staff_onboarding_required: false,
        staff_onboarding_preferences_confirmed_at: null,
        staff_onboarding_theme_confirmed_at: null,
        staff_onboarding_completed_at: null,
      },
      {
        id: therapistUserId,
        full_name: 'Responsive QA Therapist',
        email: normalizedTherapistEmail,
        role: 'therapist',
        shift_type: 'day',
        site_id: siteId,
        employment_type: 'full_time',
        max_work_days_per_week: 5,
        is_active: true,
        is_lead_eligible: false,
        on_fmla: false,
        fmla_return_date: null,
        access_status: 'approved',
        preferred_work_days: [],
        preferred_work_days_mode: 'no_preference',
        staff_onboarding_required: true,
        staff_onboarding_preferences_confirmed_at: DISPOSABLE_AUTH_COMPLETED_AT,
        staff_onboarding_theme_confirmed_at: DISPOSABLE_AUTH_COMPLETED_AT,
        staff_onboarding_completed_at: DISPOSABLE_AUTH_COMPLETED_AT,
      },
    ],
    workPatterns: [
      {
        therapist_id: therapistUserId,
        works_dow: [1, 2, 3, 4, 5],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'soft',
        shift_preference: 'either',
        pattern_type: 'weekly_fixed',
        weekly_weekdays: [1, 2, 3, 4, 5],
        weekend_rule: 'none',
        cycle_anchor_date: null,
        cycle_segments: [],
      },
    ],
  }
}

export function buildResponsiveQaCaptureConfig({ argv = [], env = {}, cwd = process.cwd() } = {}) {
  const args = parseResponsiveQaArgs(argv)
  const requestedMode = String(args.mode ?? env.RESPONSIVE_QA_MODE ?? 'auto').toLowerCase()
  if (!['auto', 'public', 'seeded'].includes(requestedMode)) {
    throw new Error('Invalid --mode. Use auto, public, or seeded.')
  }

  const authEnvAvailable = hasSupabaseAuthEnv(env)
  if (requestedMode === 'seeded' && !authEnvAvailable) {
    throw new Error(
      'Seeded responsive QA requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  const effectiveMode =
    requestedMode === 'public' || (!authEnvAvailable && requestedMode === 'auto')
      ? 'public'
      : 'seeded'

  const requestedViewports = normalizeCsv(args.viewports ?? env.RESPONSIVE_QA_VIEWPORTS)
  const selectedViewports = pickNamed(RESPONSIVE_QA_VIEWPORTS, requestedViewports, 'viewport')

  const defaultPersonas =
    effectiveMode === 'public' ? ['public'] : ['public', 'manager', 'therapist']
  const requestedPersonas = normalizeCsv(args.personas ?? env.RESPONSIVE_QA_PERSONAS)
  if (effectiveMode === 'public' && requestedPersonas?.some((persona) => persona !== 'public')) {
    throw new Error(
      'Authenticated responsive QA personas require Supabase auth env vars. Use --mode=seeded with auth env or --personas=public.'
    )
  }
  const selectedPersonas = pickNamed(
    Object.keys(RESPONSIVE_QA_ROUTE_GROUPS).map((name) => ({ name })),
    requestedPersonas ?? defaultPersonas,
    'persona'
  ).map((item) => item.name)

  const personas =
    effectiveMode === 'public'
      ? selectedPersonas.filter((persona) => persona === 'public')
      : selectedPersonas

  const routes = personas.flatMap((persona) =>
    RESPONSIVE_QA_ROUTE_GROUPS[persona].map((route) => ({ ...route, persona }))
  )
  const requiresAuthenticatedCoverage =
    effectiveMode === 'seeded' && personas.some((persona) => persona !== 'public')

  const baseURL = String(args['base-url'] ?? env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000')
    .trim()
    .replace(/\/$/, '')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = String(
    args.out ?? env.RESPONSIVE_QA_OUTPUT_DIR ?? `artifacts/responsive-qa/${stamp}`
  )

  return {
    requestedMode,
    effectiveMode,
    reducedMode: effectiveMode === 'public',
    requiresAuthenticatedCoverage,
    authEnvAvailable,
    baseURL,
    outputDir,
    latestDir: 'artifacts/responsive-qa/latest',
    headed: isTruthy(args.headed ?? env.RESPONSIVE_QA_HEADED),
    provisionAuth: isTruthy(args['provision-auth'] ?? env.RESPONSIVE_QA_PROVISION_AUTH),
    manager: {
      email:
        args['manager-email'] ??
        env.SHOT_MANAGER_EMAIL ??
        env.E2E_USER_EMAIL ??
        RESPONSIVE_QA_DEFAULT_AUTH.managerEmail,
      password: resolvePassword(args, env),
    },
    therapist: {
      email:
        args['therapist-email'] ??
        env.SHOT_STAFF_EMAIL ??
        RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail,
      password: resolvePassword(args, env),
    },
    viewports: selectedViewports,
    personas,
    routes,
    cwd,
  }
}

export function isResponsiveQaNextStaticAssetUrl(value) {
  try {
    const url = new URL(String(value), 'http://responsive-qa.local')
    if (/\.hot-update\.(?:js|json)$/i.test(url.pathname)) return false
    return url.pathname.startsWith('/_next/static/')
  } catch {
    return false
  }
}

function dedupeAssetFailures(failures) {
  const seen = new Set()
  const unique = []

  for (const failure of failures) {
    const key = [
      failure.kind,
      failure.url,
      failure.status ?? '',
      failure.errorText ?? '',
      failure.resourceType ?? '',
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(failure)
  }

  return unique
}

export function shouldIgnoreResponsiveQaStaticAssetFailure(failure = {}) {
  if (failure.kind !== 'requestfailed') return false
  if (failure.resourceType !== 'script') return false
  if (!/net::ERR_ABORTED/i.test(String(failure.errorText ?? ''))) return false
  return isResponsiveQaNextStaticAssetUrl(failure.url)
}

export function summarizeResponsiveQaPageValidation({
  staticAssetFailures = [],
  cssProbe = null,
} = {}) {
  const errors = []
  const staticAssetWarnings = dedupeAssetFailures(
    staticAssetFailures.filter((failure) => shouldIgnoreResponsiveQaStaticAssetFailure(failure))
  )
  const uniqueStaticAssetFailures = dedupeAssetFailures(
    staticAssetFailures.filter((failure) => !shouldIgnoreResponsiveQaStaticAssetFailure(failure))
  )

  if (uniqueStaticAssetFailures.length > 0) {
    const sampledFailures = uniqueStaticAssetFailures.slice(0, 10)
    errors.push({
      type: 'next-static-asset-failed',
      message: `${uniqueStaticAssetFailures.length} Next static asset request${
        uniqueStaticAssetFailures.length === 1 ? '' : 's'
      } failed during capture.`,
      staticAssetFailures: sampledFailures,
      truncatedStaticAssetFailures: Math.max(
        0,
        uniqueStaticAssetFailures.length - sampledFailures.length
      ),
    })
  }

  const presentVariables = Array.isArray(cssProbe?.presentVariables)
    ? cssProbe.presentVariables
    : []
  const missingVariables = RESPONSIVE_QA_REQUIRED_CSS_VARIABLES.filter(
    (variable) => !presentVariables.includes(variable)
  )

  if (cssProbe?.hasRequiredCssVariables !== true || missingVariables.length > 0) {
    errors.push({
      type: 'missing-applied-css',
      message:
        missingVariables.length > 0
          ? `Applied app CSS is missing required variables: ${missingVariables.join(', ')}.`
          : 'Applied app CSS could not be verified.',
      expectedVariables: RESPONSIVE_QA_REQUIRED_CSS_VARIABLES,
      presentVariables,
      missingVariables,
      linkedNextStylesheets: cssProbe?.linkedNextStylesheets ?? [],
      loadedNextStylesheetCount: cssProbe?.loadedNextStylesheetCount ?? 0,
      styleTagCount: cssProbe?.styleTagCount ?? 0,
      evaluationError: cssProbe?.evaluationError,
      bodyBackgroundColor: cssProbe?.bodyBackgroundColor,
      bodyColor: cssProbe?.bodyColor,
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings:
      staticAssetWarnings.length > 0
        ? [
            {
              type: 'next-static-script-aborted',
              message: `${staticAssetWarnings.length} Next script request${
                staticAssetWarnings.length === 1 ? '' : 's'
              } aborted during capture and were treated as navigation churn.`,
              staticAssetFailures: staticAssetWarnings.slice(0, 10),
              truncatedStaticAssetFailures: Math.max(0, staticAssetWarnings.length - 10),
            },
          ]
        : [],
  }
}

export function shouldFailResponsiveQaRun(summary = {}) {
  return (summary.errors?.length ?? 0) > 0 || (summary.authFailures ?? 0) > 0
}
