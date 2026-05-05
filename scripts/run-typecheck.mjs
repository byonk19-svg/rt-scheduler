#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { resolveTypecheckArtifactTargets } from './lib/typecheck-artifact-core.mjs'

const cwd = process.cwd()
const tsconfigPath = path.join(cwd, 'tsconfig.json')

for (const artifactPath of resolveTypecheckArtifactTargets({
  repoRootPath: cwd,
  tsconfigPath,
})) {
  if (existsSync(artifactPath)) {
    rmSync(artifactPath, { force: true })
  }
}

const localTscPath = path.join(cwd, 'node_modules', 'typescript', 'bin', 'tsc')
const hasLocalTsc = existsSync(localTscPath)
const command = hasLocalTsc ? process.execPath : process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = hasLocalTsc ? [localTscPath, '--noEmit'] : ['tsc', '--noEmit']

const result = spawnSync(command, args, {
  stdio: 'inherit',
  cwd,
  env: process.env,
  shell: !hasLocalTsc,
})

process.exit(result.status ?? 1)
