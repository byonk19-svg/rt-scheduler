import { rm } from 'node:fs/promises'
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

  if (distDir === '.next-dev') {
    await rm(path.resolve(cwd, distDir), { recursive: true, force: true })
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
