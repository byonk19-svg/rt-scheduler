import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadNextConfig() {
  vi.resetModules()
  const loaded = await import('../../next.config')
  return loaded.default
}

describe('next.config distDir', () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalNextDistDir = env.NEXT_DIST_DIR

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete env.NODE_ENV
    } else {
      env.NODE_ENV = originalNodeEnv
    }

    if (originalNextDistDir === undefined) {
      delete env.NEXT_DIST_DIR
    } else {
      env.NEXT_DIST_DIR = originalNextDistDir
    }
  })

  it('uses the OneDrive-safe development distDir when no override is set', async () => {
    env.NODE_ENV = 'development'
    delete env.NEXT_DIST_DIR

    const config = await loadNextConfig()

    expect(config.distDir).toBe('.next-dev')
  })

  it('still honors an explicit NEXT_DIST_DIR override', async () => {
    env.NODE_ENV = 'development'
    env.NEXT_DIST_DIR = '.next-custom'

    const config = await loadNextConfig()

    expect(config.distDir).toBe('.next-custom')
  })
})
