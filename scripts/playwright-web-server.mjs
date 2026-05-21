#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'

const portArgIndex = process.argv.findIndex((value) => value === '--port')
const port =
  portArgIndex >= 0 && process.argv[portArgIndex + 1]
    ? Number(process.argv[portArgIndex + 1])
    : Number(process.env.PORT ?? 3000)

const cleanBeforeRun = process.env.PLAYWRIGHT_SKIP_CLEANUP !== '1'

function assertValidPort(value) {
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Invalid Playwright web server port: ${value}`)
  }
}

function assertPortIsFree(value) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', (error) => {
      reject(
        new Error(
          `Port ${value} is already in use. Stop the stale dev server or set a different PLAYWRIGHT_BASE_URL / PORT before rerunning.`
        )
      )
    })
    server.listen({ host: '127.0.0.1', port: value }, () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }
        resolve()
      })
    })
  })
}

function runCleanup() {
  execFileSync(process.execPath, ['scripts/cleanup-local-artifacts.mjs', '--execute'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
}

async function main() {
  assertValidPort(port)
  await assertPortIsFree(port)

  if (cleanBeforeRun) {
    runCleanup()
  }

  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
  const args =
    process.platform === 'win32'
      ? [
          '/d',
          '/s',
          '/c',
          'npm',
          'run',
          'dev',
          '--',
          '--hostname',
          '127.0.0.1',
          '--port',
          String(port),
        ]
      : ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)]

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: 'inherit',
  })

  const stop = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))

  child.once('error', (error) => {
    console.error(
      'Failed to start Playwright web server:',
      error instanceof Error ? error.message : error
    )
    process.exit(1)
  })

  child.once('exit', (code, signal) => {
    if (signal) {
      process.exit(1)
    }
    process.exit(code ?? 1)
  })
}

main().catch((error) => {
  console.error(
    'Playwright web server preflight failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
