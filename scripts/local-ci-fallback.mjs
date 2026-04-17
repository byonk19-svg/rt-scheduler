#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'

import {
  chunkPrettierTargets,
  parseTrackedFiles,
  selectPrettierCheckTargets,
} from './lib/prettier-check-targets.mjs'

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

/** @type {Array<{name:string, cmd:string, args:string[]} | {name:string, run:() => void}>} */
const steps = [
  {
    name: 'Format check',
    run: () => {
      const trackedFiles = parseTrackedFiles(
        execFileSync('git', ['ls-files', '-z'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        })
      )
      const prettierTargets = selectPrettierCheckTargets(trackedFiles)

      if (prettierTargets.length === 0) {
        console.log('No tracked Prettier targets found.')
        return
      }

      for (const chunk of chunkPrettierTargets(prettierTargets)) {
        const commandLine = [
          resolveExecutable('npx'),
          'prettier',
          '--check',
          ...chunk.map(quoteArg),
        ].join(' ')
        const result = spawnSync(commandLine, {
          stdio: 'inherit',
          env,
          shell: true,
        })

        if (result.status !== 0) {
          const code = result.status ?? 1
          throw new Error(`Prettier check failed (exit ${code})`)
        }
      }
    },
  },
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
  if ('run' in step) {
    try {
      step.run()
    } catch (error) {
      console.error(`\nLocal CI fallback failed at step: ${step.name}`)
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    }
  } else {
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
}

console.log('\nLocal CI fallback passed.')
