import { prepareDevDistDir, spawnNextDev } from './lib/dev-wrapper.mjs'

async function main() {
  const cwd = process.cwd()
  const distDir = await prepareDevDistDir({ cwd })
  const child = spawnNextDev({
    cwd,
    env: {
      ...process.env,
      NEXT_DIST_DIR: distDir,
    },
    forwardedArgs: process.argv.slice(2),
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
