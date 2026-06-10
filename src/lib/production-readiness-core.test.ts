import { describe, expect, it } from 'vitest'

import {
  evaluateProductionReadiness,
  formatProductionReadinessReport,
} from '../../scripts/lib/production-readiness-core.mjs'

type ReadinessResult = {
  mode: 'local' | 'production'
  checks: Array<{
    status: 'pass' | 'warn' | 'fail'
    label: string
    message: string
    remediation: string
  }>
  summary: { pass: number; warn: number; fail: number }
  ok: boolean
}

const evaluate = evaluateProductionReadiness as unknown as (args: {
  env?: Record<string, string>
  vercelConfig?: Record<string, unknown>
  mode?: string
}) => ReadinessResult
const formatReport = formatProductionReadinessReport as unknown as (
  result: ReadinessResult
) => string

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  NEXT_PUBLIC_APP_URL: 'https://www.teamwise.work',
}

const productionIntegrationEnv = {
  RESEND_API_KEY: 'resend-key',
  RESEND_WEBHOOK_SECRET: 'webhook-secret',
  OPENAI_API_KEY: 'openai-key',
  PUBLISH_WORKER_KEY: 'worker-key',
  PUBLISH_WORKER_SIGNING_KEY: 'worker-signing-key',
  CRON_SECRET: 'cron-secret',
  SENTRY_DSN: 'server-dsn',
  NEXT_PUBLIC_SENTRY_DSN: 'browser-dsn',
}

describe('evaluateProductionReadiness', () => {
  it('fails production mode when production integrations are missing', () => {
    const result = evaluate({
      env: baseEnv,
      vercelConfig: { crons: [{ path: '/api/cron/shift-reminders', schedule: '0 6 * * *' }] },
      mode: 'production',
    })

    expect(result.ok).toBe(false)
    expect(result.summary.fail).toBeGreaterThanOrEqual(7)
    expect(
      result.checks.filter((check) => check.status === 'fail').map((check) => check.label)
    ).toEqual(
      expect.arrayContaining([
        'Resend API key',
        'Resend webhook secret',
        'OpenAI OCR key',
        'PUBLISH_WORKER_KEY',
        'PUBLISH_WORKER_SIGNING_KEY',
        'CRON_SECRET',
        'Sentry DSNs',
      ])
    )
  })

  it('warns instead of failing local/demo mode for optional production integrations', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      },
      vercelConfig: { crons: [{ path: '/api/cron/shift-reminders', schedule: '0 6 * * *' }] },
      mode: 'local',
    })

    expect(result.ok).toBe(true)
    expect(result.summary.fail).toBe(0)
    expect(result.summary.warn).toBeGreaterThan(0)
    expect(result.checks.find((check) => check.label === 'CRON_SECRET')?.status).toBe('warn')
  })

  it('fails invalid Supabase URL shape', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      },
      mode: 'local',
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.some(
        (check) => check.status === 'fail' && check.label === 'NEXT_PUBLIC_SUPABASE_URL format'
      )
    ).toBe(true)
  })

  it('requires https app URL in production mode', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        ...productionIntegrationEnv,
        NEXT_PUBLIC_APP_URL: 'http://teamwise.example.test',
      },
      mode: 'production',
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.some(
        (check) => check.status === 'fail' && check.label === 'NEXT_PUBLIC_APP_URL HTTPS'
      )
    ).toBe(true)
  })

  it('fails missing OCR key in local mode when OCR intake is explicitly enabled', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        ENABLE_OCR_INTAKE: 'true',
      },
      mode: 'local',
    })

    expect(result.ok).toBe(false)
    expect(result.checks.find((check) => check.label === 'OpenAI OCR key')?.status).toBe('fail')
  })

  it('fails production Sentry pair mismatches', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        ...productionIntegrationEnv,
        NEXT_PUBLIC_SENTRY_DSN: '',
      },
      mode: 'production',
    })

    expect(result.ok).toBe(false)
    expect(result.checks.find((check) => check.label === 'Sentry DSN pair')?.status).toBe('fail')
  })

  it('flags seeded credentials in production without printing secret values', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        ...productionIntegrationEnv,
        SHOT_STAFF_EMAIL: 'demo-therapist01@teamwise.test',
        SHOT_PASSWORD: 'Teamwise123!',
      },
      mode: 'production',
    })
    const report = formatReport(result)

    expect(result.ok).toBe(false)
    expect(result.checks.find((check) => check.label === 'Seeded/demo credentials')?.status).toBe(
      'fail'
    )
    expect(report).toContain('SHOT_STAFF_EMAIL')
    expect(report).toContain('SHOT_PASSWORD')
    expect(report).not.toContain('demo-therapist01@teamwise.test')
    expect(report).not.toContain('Teamwise123!')
  })

  it('passes a fully configured production-shaped environment', () => {
    const result = evaluate({
      env: {
        ...baseEnv,
        ...productionIntegrationEnv,
      },
      vercelConfig: { crons: [{ path: '/api/cron/shift-reminders', schedule: '0 6 * * *' }] },
      mode: 'production',
    })

    expect(result.ok).toBe(true)
    expect(result.summary.fail).toBe(0)
  })
})
