#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const cwd = process.cwd()
const buildInfoPath = path.join(cwd, 'tsconfig.tsbuildinfo')

if (existsSync(buildInfoPath)) {
  rmSync(buildInfoPath, { force: true })
}

const command = process.platform === 'win32' ? 'npx.cmd tsc --noEmit' : 'npx tsc --noEmit'
const result = spawnSync(command, {
  stdio: 'inherit',
  cwd,
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
