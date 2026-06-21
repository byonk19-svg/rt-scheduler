import { describe, expect, it } from 'vitest'

import {
  RESPONSIVE_QA_ROUTE_GROUPS,
  buildResponsiveQaCaptureConfig,
  parseResponsiveQaArgs,
  shouldFailResponsiveQaRun,
} from '../../scripts/lib/responsive-qa-capture-core.mjs'

type ResponsiveQaConfig = {
  requestedMode: 'auto' | 'public' | 'seeded'
  effectiveMode: 'public' | 'seeded'
  reducedMode: boolean
  requiresAuthenticatedCoverage: boolean
  baseURL: string
  outputDir: string
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
