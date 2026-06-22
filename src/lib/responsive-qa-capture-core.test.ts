import { describe, expect, it } from 'vitest'

import {
  RESPONSIVE_QA_DEFAULT_AUTH,
  RESPONSIVE_QA_ROUTE_GROUPS,
  buildResponsiveQaAuthInstructions,
  isResponsiveQaBlockedAuthenticatedUrl,
  isResponsiveQaNextStaticAssetUrl,
  buildResponsiveQaCaptureConfig,
  buildResponsiveQaDisposableAuthPlan,
  parseResponsiveQaArgs,
  shouldFailResponsiveQaRun,
  shouldIgnoreResponsiveQaStaticAssetFailure,
  summarizeResponsiveQaAuthError,
  summarizeResponsiveQaPageValidation,
} from '../../scripts/lib/responsive-qa-capture-core.mjs'

type ResponsiveQaConfig = {
  requestedMode: 'auto' | 'public' | 'seeded'
  effectiveMode: 'public' | 'seeded'
  reducedMode: boolean
  requiresAuthenticatedCoverage: boolean
  baseURL: string
  outputDir: string
  provisionAuth: boolean
  manager: { email: string; password: string }
  therapist: { email: string; password: string }
  viewports: Array<{ name: string; options: { viewport: { width: number; height: number } } }>
  personas: string[]
  routes: Array<{ persona: string; name: string; path: string }>
}

const buildConfig = buildResponsiveQaCaptureConfig as unknown as (args: {
  argv?: string[]
  env?: Record<string, string>
  cwd?: string
}) => ResponsiveQaConfig
const shouldFailRun = shouldFailResponsiveQaRun as unknown as (summary: {
  errors?: unknown[]
  authFailures?: number
}) => boolean
const isBlockedAuthenticatedUrl = isResponsiveQaBlockedAuthenticatedUrl as unknown as (
  value: string
) => boolean
const buildAuthInstructions = buildResponsiveQaAuthInstructions as unknown as (
  config?: Partial<ResponsiveQaConfig>
) => string[]
const summarizeAuthError = summarizeResponsiveQaAuthError as unknown as (
  error: unknown,
  config?: Partial<ResponsiveQaConfig>
) => string
const buildDisposableAuthPlan = buildResponsiveQaDisposableAuthPlan as unknown as (args?: {
  managerEmail?: string
  therapistEmail?: string
  managerUserId?: string
  therapistUserId?: string
}) => {
  site: { id: string; name: string }
  profiles: Array<Record<string, unknown>>
  workPatterns: Array<Record<string, unknown>>
}
const shouldIgnoreStaticAssetFailure = shouldIgnoreResponsiveQaStaticAssetFailure as unknown as (
  failure?: Record<string, unknown>
) => boolean
const summarizePageValidation = summarizeResponsiveQaPageValidation as unknown as (args: {
  staticAssetFailures?: Array<Record<string, unknown>>
  cssProbe?: {
    hasRequiredCssVariables: boolean
    presentVariables: string[]
    linkedNextStylesheets?: string[]
    loadedNextStylesheetCount?: number
    styleTagCount?: number
  }
}) => {
  ok: boolean
  errors: Array<{ type: string; message: string }>
  warnings: Array<{ type: string; message: string }>
}

describe('responsive QA capture config', () => {
  it('parses flag values with space, equals, and booleans', () => {
    expect(
      parseResponsiveQaArgs(['--mode', 'public', '--viewports=mobile,tablet', '--headed'])
    ).toEqual({
      mode: 'public',
      viewports: 'mobile,tablet',
      headed: 'true',
    })
  })

  it('builds the seeded route set across desktop, tablet, and mobile when auth env is present', () => {
    const config = buildConfig({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      },
    })

    expect(config.effectiveMode).toBe('seeded')
    expect(config.requiresAuthenticatedCoverage).toBe(true)
    expect(config.manager.email).toBe(RESPONSIVE_QA_DEFAULT_AUTH.managerEmail)
    expect(config.therapist.email).toBe(RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail)
    expect(config.viewports.map((viewport) => viewport.name)).toEqual([
      'desktop',
      'tablet',
      'mobile',
    ])
    expect(config.routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        '/',
        '/login',
        '/signup',
        '/dashboard/manager',
        '/schedule',
        '/availability',
        '/team/import',
        '/settings/audit-log',
        '/dashboard/staff',
        '/therapist/schedule',
        '/therapist/availability',
      ])
    )
  })

  it('keeps explicit authenticated credentials ahead of disposable defaults', () => {
    const config = buildConfig({
      argv: ['--mode=seeded', '--manager-email=manager@example.test', '--password=Secret123!'],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SHOT_STAFF_EMAIL: 'staff@example.test',
        SHOT_PASSWORD: 'EnvPassword123!',
      },
    })

    expect(config.manager).toEqual({
      email: 'manager@example.test',
      password: 'Secret123!',
    })
    expect(config.therapist).toEqual({
      email: 'staff@example.test',
      password: 'Secret123!',
    })
  })

  it('requires an explicit flag before provisioning disposable auth profiles', () => {
    const baseEnv = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    }

    expect(buildConfig({ argv: ['--mode=seeded'], env: baseEnv }).provisionAuth).toBe(false)
    expect(
      buildConfig({ argv: ['--mode=seeded', '--provision-auth'], env: baseEnv }).provisionAuth
    ).toBe(true)
  })

  it('builds a narrow approved profile plan for the disposable responsive QA users', () => {
    const plan = buildDisposableAuthPlan({
      managerUserId: 'manager-id',
      therapistUserId: 'therapist-id',
    })

    expect(plan.site).toEqual({
      id: RESPONSIVE_QA_DEFAULT_AUTH.siteId,
      name: RESPONSIVE_QA_DEFAULT_AUTH.siteName,
    })
    expect(plan.profiles).toMatchObject([
      {
        id: 'manager-id',
        email: RESPONSIVE_QA_DEFAULT_AUTH.managerEmail,
        role: 'manager',
        site_id: RESPONSIVE_QA_DEFAULT_AUTH.siteId,
        access_status: 'approved',
        is_active: true,
      },
      {
        id: 'therapist-id',
        email: RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail,
        role: 'therapist',
        site_id: RESPONSIVE_QA_DEFAULT_AUTH.siteId,
        access_status: 'approved',
        staff_onboarding_completed_at: expect.any(String),
      },
    ])
    expect(plan.workPatterns).toEqual([
      expect.objectContaining({
        therapist_id: 'therapist-id',
        pattern_type: 'weekly_fixed',
      }),
    ])
  })

  it('rejects disposable provisioning for non-disposable account emails', () => {
    expect(() =>
      buildDisposableAuthPlan({
        managerEmail: 'manager@example.test',
        therapistEmail: RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail,
      })
    ).toThrow(/limited to the default responsive-qa\.teamwise\.test accounts/)
  })

  it('documents the non-destructive disposable auth setup and cleanup path', () => {
    const instructions = buildAuthInstructions().join('\n')

    expect(instructions).toContain('seed:users')
    expect(instructions).toContain('cleanup:seed-users')
    expect(instructions).toContain(RESPONSIVE_QA_DEFAULT_AUTH.managerEmail)
    expect(instructions).toContain(RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail)
    expect(instructions).toContain('--domain=responsive-qa.teamwise.test')
    expect(instructions).not.toContain('seed:functional')
  })

  it('turns rejected auth into safe deterministic remediation guidance', () => {
    const reason = summarizeAuthError(new Error('Invalid login credentials'), {
      manager: {
        email: RESPONSIVE_QA_DEFAULT_AUTH.managerEmail,
        password: RESPONSIVE_QA_DEFAULT_AUTH.password,
      },
      therapist: {
        email: RESPONSIVE_QA_DEFAULT_AUTH.therapistEmail,
        password: RESPONSIVE_QA_DEFAULT_AUTH.password,
      },
    })

    expect(reason).toContain('Responsive QA credentials were rejected')
    expect(reason).toContain('npm run seed:users')
    expect(reason).toContain('npm run cleanup:seed-users')
    expect(reason).not.toContain('seed:functional')
  })

  it('falls back to public-only reduced mode when auth env is missing', () => {
    const config = buildConfig({ env: {} })

    expect(config.effectiveMode).toBe('public')
    expect(config.reducedMode).toBe(true)
    expect(config.requiresAuthenticatedCoverage).toBe(false)
    expect(config.personas).toEqual(['public'])
    expect(config.routes).toEqual(
      RESPONSIVE_QA_ROUTE_GROUPS.public.map((route) => ({ ...route, persona: 'public' }))
    )
  })

  it('supports selecting a reduced viewport and persona subset', () => {
    const config = buildConfig({
      argv: ['--mode=seeded', '--viewports=tablet', '--personas=manager', '--base-url=/custom'],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      },
    })

    expect(config.baseURL).toBe('/custom')
    expect(config.viewports.map((viewport) => viewport.name)).toEqual(['tablet'])
    expect(config.personas).toEqual(['manager'])
    expect(config.routes.map((route) => route.persona)).toEqual([
      'manager',
      'manager',
      'manager',
      'manager',
      'manager',
    ])
    expect(config.requiresAuthenticatedCoverage).toBe(true)
  })

  it('does not require authenticated coverage when only public routes are selected', () => {
    const config = buildConfig({
      argv: ['--personas=public'],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      },
    })

    expect(config.effectiveMode).toBe('seeded')
    expect(config.personas).toEqual(['public'])
    expect(config.requiresAuthenticatedCoverage).toBe(false)
  })

  it('fails runs when authenticated coverage was required but auth failed', () => {
    expect(shouldFailRun({ errors: [], authFailures: 1 })).toBe(true)
    expect(shouldFailRun({ errors: [{}], authFailures: 0 })).toBe(true)
    expect(shouldFailRun({ errors: [], authFailures: 0 })).toBe(false)
  })

  it('rejects seeded mode without Supabase auth env vars', () => {
    expect(() => buildConfig({ argv: ['--mode=seeded'], env: {} })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/
    )
  })

  it('rejects explicit authenticated personas when auth env is missing', () => {
    expect(() => buildConfig({ argv: ['--personas=manager'], env: {} })).toThrow(
      /Authenticated responsive QA personas require Supabase auth env vars/
    )
  })

  it('rejects unknown viewport names', () => {
    expect(() =>
      buildConfig({
        argv: ['--viewports=watch'],
        env: {},
      })
    ).toThrow(/Unknown responsive QA viewport/)
  })
})

describe('responsive QA page validation', () => {
  it('classifies login and setup landings as blocked authenticated coverage', () => {
    expect(isBlockedAuthenticatedUrl('http://127.0.0.1:3000/login?redirectTo=%2Fschedule')).toBe(
      true
    )
    expect(isBlockedAuthenticatedUrl('/pending-setup')).toBe(true)
    expect(isBlockedAuthenticatedUrl('/onboarding?success=signed_in')).toBe(true)
    expect(isBlockedAuthenticatedUrl('/dashboard/manager')).toBe(false)
    expect(isBlockedAuthenticatedUrl('/schedule')).toBe(false)
  })

  it('identifies Next static asset urls only', () => {
    expect(isResponsiveQaNextStaticAssetUrl('/_next/static/chunks/app/page.js')).toBe(true)
    expect(
      isResponsiveQaNextStaticAssetUrl('http://127.0.0.1:3000/_next/static/css/app.css?v=1')
    ).toBe(true)
    expect(
      isResponsiveQaNextStaticAssetUrl('/_next/static/webpack/app.webpack.hot-update.json')
    ).toBe(false)
    expect(isResponsiveQaNextStaticAssetUrl('/_next/image?url=%2Flogo.png')).toBe(false)
    expect(isResponsiveQaNextStaticAssetUrl('/api/schedule')).toBe(false)
  })

  it('passes when required CSS variables are present and static assets loaded', () => {
    expect(
      summarizePageValidation({
        staticAssetFailures: [],
        cssProbe: {
          hasRequiredCssVariables: true,
          presentVariables: ['--background', '--foreground', '--border'],
          linkedNextStylesheets: ['/_next/static/css/app.css'],
          loadedNextStylesheetCount: 1,
          styleTagCount: 0,
        },
      })
    ).toEqual({ ok: true, errors: [], warnings: [] })
  })

  it('fails when any Next static asset request failed', () => {
    const validation = summarizePageValidation({
      staticAssetFailures: [
        {
          kind: 'requestfailed',
          url: '/_next/static/css/app.css',
          resourceType: 'stylesheet',
          errorText: 'net::ERR_ABORTED',
        },
      ],
      cssProbe: {
        hasRequiredCssVariables: true,
        presentVariables: ['--background', '--foreground', '--border'],
      },
    })

    expect(validation.ok).toBe(false)
    expect(validation.errors.map((error) => error.type)).toContain('next-static-asset-failed')
  })

  it('warns on browser-aborted Next script chunk requests without hiding real failures', () => {
    expect(
      shouldIgnoreStaticAssetFailure({
        kind: 'requestfailed',
        url: '/_next/static/chunks/app/page.js',
        resourceType: 'script',
        errorText: 'net::ERR_ABORTED',
      })
    ).toBe(true)
    expect(
      shouldIgnoreStaticAssetFailure({
        kind: 'requestfailed',
        url: '/_next/static/css/app.css',
        resourceType: 'stylesheet',
        errorText: 'net::ERR_ABORTED',
      })
    ).toBe(false)
    expect(
      shouldIgnoreStaticAssetFailure({
        kind: 'response',
        url: '/_next/static/chunks/app/page.js',
        resourceType: 'script',
        status: 404,
      })
    ).toBe(false)

    const validation = summarizePageValidation({
      staticAssetFailures: [
        {
          kind: 'requestfailed',
          url: '/_next/static/chunks/app/page.js',
          method: 'GET',
          resourceType: 'script',
          errorText: 'net::ERR_ABORTED',
        },
      ],
      cssProbe: {
        hasRequiredCssVariables: true,
        presentVariables: ['--background', '--foreground', '--border'],
      },
    })

    expect(validation.ok).toBe(true)
    expect(validation.errors).toEqual([])
    expect(validation.warnings).toMatchObject([
      {
        type: 'next-static-script-aborted',
      },
    ])
  })

  it('fails when app CSS variables were not applied', () => {
    const validation = summarizePageValidation({
      staticAssetFailures: [],
      cssProbe: {
        hasRequiredCssVariables: false,
        presentVariables: [],
        linkedNextStylesheets: ['/_next/static/css/app.css'],
        loadedNextStylesheetCount: 0,
        styleTagCount: 0,
      },
    })

    expect(validation.ok).toBe(false)
    expect(validation.errors).toMatchObject([
      {
        type: 'missing-applied-css',
      },
    ])
    expect(validation.errors[0]?.message).toContain('--background')
  })
})
