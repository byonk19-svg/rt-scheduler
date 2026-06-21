const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'y', 'on'])
export const RESPONSIVE_QA_REQUIRED_CSS_VARIABLES = ['--background', '--foreground', '--border']

export const RESPONSIVE_QA_VIEWPORTS = [
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

export function isTruthy(value) {
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
    manager: {
      email:
        args['manager-email'] ??
        env.SHOT_MANAGER_EMAIL ??
        env.E2E_USER_EMAIL ??
        'julie.d@teamwise.test',
      password: args.password ?? env.SHOT_PASSWORD ?? env.E2E_USER_PASSWORD ?? 'Teamwise123!',
    },
    therapist: {
      email: args['therapist-email'] ?? env.SHOT_STAFF_EMAIL ?? 'layne@teamwise.test',
      password: args.password ?? env.SHOT_PASSWORD ?? 'Teamwise123!',
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

export function summarizeResponsiveQaPageValidation({
  staticAssetFailures = [],
  cssProbe = null,
} = {}) {
  const errors = []
  const uniqueStaticAssetFailures = dedupeAssetFailures(staticAssetFailures)

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
  }
}

export function shouldFailResponsiveQaRun(summary = {}) {
  return (summary.errors?.length ?? 0) > 0 || (summary.authFailures ?? 0) > 0
}
