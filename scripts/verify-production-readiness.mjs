import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  evaluateProductionReadiness,
  formatProductionReadinessReport,
} from './lib/production-readiness-core.mjs'

function parseMode(argv, env) {
  if (argv.includes('--production')) return 'production'
  if (argv.includes('--prod')) return 'production'

  const modeArg = argv.find((arg) => arg.startsWith('--mode='))
  if (modeArg) {
    return modeArg.slice('--mode='.length)
  }

  return env.PRODUCTION_READINESS_MODE ?? env.VERCEL_ENV ?? env.NODE_ENV ?? 'local'
}

function readVercelConfig(repoRootPath) {
  try {
    const raw = readFileSync(path.join(repoRootPath, 'vercel.json'), 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    return {
      _readError: error instanceof Error ? error.message : 'Unable to read vercel.json',
    }
  }
}

function main() {
  const repoRootPath = process.cwd()
  const mode = parseMode(process.argv.slice(2), process.env)
  const vercelConfig = readVercelConfig(repoRootPath)
  const result = evaluateProductionReadiness({
    env: process.env,
    vercelConfig,
    mode,
  })

  const report = formatProductionReadinessReport(result)
  const output = result.ok ? console.log : console.error
  output(report)

  if (!result.ok) {
    process.exit(1)
  }
}

main()
