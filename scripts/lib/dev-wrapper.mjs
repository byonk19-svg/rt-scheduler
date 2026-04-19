import { createHash } from 'node:crypto'
import { mkdir, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const nextBinPath = fileURLToPath(new URL('../../node_modules/next/dist/bin/next', import.meta.url))

/**
 * @param {string} cwd
 * @param {NodeJS.Platform} [platform]
 */
export function isWindowsOneDriveWorkspace(cwd, platform = process.platform) {
  return platform === 'win32' && cwd.replaceAll('/', '\\').toLowerCase().includes('\\onedrive\\')
}

function sanitizeWorkspaceName(cwd) {
  const baseName = path.win32.basename(cwd.replaceAll('/', '\\')) || 'workspace'
  const normalized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'workspace'
}

function hashWorkspacePath(cwd) {
  return createHash('sha1').update(cwd.toLowerCase()).digest('hex').slice(0, 8)
}

export function resolveExternalWindowsDevCacheTarget(
  cwd,
  localAppData = process.env.LOCALAPPDATA,
  tempDir = process.env.TEMP || process.env.TMPDIR || os.tmpdir()
) {
  const baseDir = localAppData || tempDir
  if (!baseDir) return path.resolve(cwd, '.next-dev')

  return path.join(
    baseDir,
    'Teamwise',
    'next-dev',
    `${sanitizeWorkspaceName(cwd)}-${hashWorkspacePath(cwd)}`
  )
}

/**
 * @param {string} cwd
 * @param {string | undefined} [envDistDir]
 * @param {NodeJS.Platform} [platform]
 */
export function resolveDevDistDir(
  cwd,
  envDistDir = process.env.NEXT_DIST_DIR,
  platform = process.platform
) {
  if (envDistDir) return envDistDir
  if (isWindowsOneDriveWorkspace(cwd, platform)) return '.next-dev'
  return '.next'
}

/**
 * @param {{ nodePath?: string, platform?: NodeJS.Platform, forwardedArgs?: string[] }} [options]
 */
export function buildNextDevInvocation({ nodePath = process.execPath, forwardedArgs = [] } = {}) {
  return {
    command: nodePath,
    args: [nextBinPath, 'dev', '--webpack', ...forwardedArgs],
  }
}

/**
 * @param {{ cwd?: string, envDistDir?: string | undefined, platform?: NodeJS.Platform }} [options]
 */
export async function prepareDevDistDir({
  cwd = process.cwd(),
  envDistDir = process.env.NEXT_DIST_DIR,
  platform = process.platform,
} = {}) {
  const distDir = resolveDevDistDir(cwd, envDistDir, platform)

  if (!envDistDir && isWindowsOneDriveWorkspace(cwd, platform)) {
    const linkPath = path.resolve(cwd, '.next-dev')
    const externalTarget = resolveExternalWindowsDevCacheTarget(cwd)
    const externalNodeModulesLink = path.join(externalTarget, 'node_modules')
    const workspaceNodeModulesPath = path.resolve(cwd, 'node_modules')

    await rm(linkPath, { recursive: true, force: true })
    await rm(externalTarget, { recursive: true, force: true })
    await mkdir(path.dirname(externalTarget), { recursive: true })
    await mkdir(externalTarget, { recursive: true })
    // Keep React/Next resolution stable when dist artifacts live outside workspace root.
    await symlink(workspaceNodeModulesPath, externalNodeModulesLink, 'junction')
    await symlink(externalTarget, linkPath, 'junction')
  }

  return distDir
}

/**
 * @param {{
 *   cwd?: string,
 *   env?: NodeJS.ProcessEnv,
 *   forwardedArgs?: string[],
 *   spawnImpl?: typeof spawn
 * }} [options]
 */
export function spawnNextDev({
  cwd = process.cwd(),
  env = process.env,
  forwardedArgs = process.argv.slice(2),
  spawnImpl = spawn,
} = {}) {
  const invocation = buildNextDevInvocation({ forwardedArgs })

  return spawnImpl(invocation.command, invocation.args, {
    cwd,
    env,
    stdio: 'inherit',
  })
}
