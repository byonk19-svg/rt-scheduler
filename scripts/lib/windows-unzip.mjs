import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const expandArchiveScriptPath = fileURLToPath(new URL('./expand-archive.ps1', import.meta.url))

/**
 * @param {{ zipFile?: string, destinationDir?: string }} options
 */
export function buildExpandArchiveInvocation({ zipFile, destinationDir }) {
  if (!zipFile) {
    throw new Error('Missing zip file path')
  }

  if (!destinationDir) {
    throw new Error('Missing destination path')
  }

  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      expandArchiveScriptPath,
      '-LiteralPath',
      zipFile,
      '-DestinationPath',
      destinationDir,
    ],
  }
}

/**
 * @param {{
 *   zipFile?: string,
 *   destinationDir?: string,
 *   spawnImpl?: typeof spawn
 * }} [options]
 */
export function runExpandArchive({ zipFile, destinationDir, spawnImpl = spawn } = {}) {
  const invocation = buildExpandArchiveInvocation({ zipFile, destinationDir })

  return new Promise((resolve, reject) => {
    const child = spawnImpl(invocation.command, invocation.args, {
      stdio: ['ignore', 'ignore', 'inherit'],
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Expand-Archive exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function main() {
  const [zipFile, destinationDir = '.'] = process.argv.slice(2)
  await runExpandArchive({ zipFile, destinationDir })
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null

if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
