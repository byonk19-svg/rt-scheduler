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

const command = process.platform === 'win32' ? 'npx.cmd tsc --noEmit' : 'npx tsc --noEmit'
const result = spawnSync(command, {
  stdio: 'inherit',
  cwd,
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
