#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { buildLocalArtifactCleanupPlan } from './lib/local-artifact-cleanup-core.mjs'

const execute = process.argv.includes('--execute')
const cwd = process.cwd()

function toPosix(value) {
  return String(value ?? '').replace(/\\/g, '/')
}

function ensureWithinCwd(targetPath) {
  const relative = path.relative(cwd, targetPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside repo root: ${targetPath}`)
  }
}

function readRegisteredWorktreePaths() {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd,
      encoding: 'utf8',
    })

    return output
      .split(/\r?\n/)
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length).trim())
  } catch (error) {
    console.warn(
      'Could not read git worktree registrations; stale .worktrees cleanup will be skipped:',
      error instanceof Error ? error.message : error
    )
    return []
  }
}

async function readRootEntries() {
  const entries = await readdir(cwd, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
  }))
}

async function readWorktreeHelperPaths() {
  const helpersRoot = path.join(cwd, '.worktrees')

  try {
    const entries = await readdir(helpersRoot, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join('.worktrees', entry.name))
  } catch {
    return []
  }
}

function logSection(title, entries) {
  if (entries.length === 0) return
  console.log(title)
  for (const entry of entries) {
    console.log(`- ${toPosix(entry)}`)
  }
  console.log('')
}

async function removeTarget(relativePath) {
  const absolutePath = path.resolve(cwd, relativePath)
  ensureWithinCwd(absolutePath)
  await rm(absolutePath, { recursive: true, force: true })
}

async function main() {
  const [rootEntries, worktreeHelperPaths] = await Promise.all([
    readRootEntries(),
    readWorktreeHelperPaths(),
  ])
  const registeredWorktreePaths = readRegisteredWorktreePaths()

  const plan = buildLocalArtifactCleanupPlan({
    rootEntries,
    worktreeHelperPaths,
    registeredWorktreePaths,
  })

  if (plan.targets.length === 0) {
    console.log('No local artifacts matched the cleanup plan.')
    return
  }

  logSection('Generated directories:', plan.directories)
  logSection('Root temp/log files:', plan.files)
  logSection('Stale unregistered .worktrees helpers:', plan.staleWorktrees)

  if (!execute) {
    console.log('Dry run only. Re-run with --execute to delete these local artifacts.')
    return
  }

  for (const target of plan.targets) {
    await removeTarget(target)
    console.log(`Removed ${toPosix(target)}`)
  }
}

main().catch((error) => {
  console.error('cleanup:local failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
