#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const quick = args.has('--quick')
const includeE2E = args.has('--e2e')
const skipSecurity = args.has('--skip-security')
const skipTypecheck = args.has('--skip-typecheck')

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'ci-placeholder-anon-key',
}

const securityRegressionTests = [
  'src/lib/security/request-origin.test.ts',
  'src/lib/security/worker-auth.test.ts',
  'src/app/auth/signout/route.test.ts',
  'src/app/api/schedule/assignment-status/route.test.ts',
  'src/app/api/schedule/drag-drop/route.test.ts',
]

/** @type {Array<{name:string, cmd:string, args:string[]}>} */
const steps = [
  { name: 'Format check', cmd: 'npm', args: ['run', 'format:check'] },
  { name: 'Lint', cmd: 'npm', args: ['run', 'lint'] },
]

if (!quick && !skipTypecheck) {
  steps.push({ name: 'Type check', cmd: 'npx', args: ['tsc', '--noEmit'] })
}

steps.push({ name: 'Build', cmd: 'npm', args: ['run', 'build'] })

if (!quick && !skipSecurity) {
  steps.push({
    name: 'Security regression tests',
    cmd: 'npm',
    args: ['run', 'test:unit', '--', ...securityRegressionTests],
  })
}

if (includeE2E) {
  steps.push({
    name: 'Playwright E2E',
    cmd: 'npm',
    args: ['run', 'test:e2e'],
  })
}

console.log(
  `\nRunning local CI fallback (${quick ? 'quick' : 'full'} mode${includeE2E ? ' + e2e' : ''})\n`
)

function resolveExecutable(command) {
  if (process.platform !== 'win32') return command
  if (command === 'npm' || command === 'npx') return `${command}.cmd`
  return command
}

function quoteArg(value) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `"${value.replaceAll('"', '\\"')}"`
}

for (const step of steps) {
  console.log(`==> ${step.name}`)
  const commandLine = [resolveExecutable(step.cmd), ...step.args.map(quoteArg)].join(' ')
  const result = spawnSync(commandLine, {
    stdio: 'inherit',
    env,
    shell: true,
  })

  if (result.status !== 0) {
    const code = result.status ?? 1
    console.error(`\nLocal CI fallback failed at step: ${step.name} (exit ${code})`)
    process.exit(code)
  }
}

console.log('\nLocal CI fallback passed.')
