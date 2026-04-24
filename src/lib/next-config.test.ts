import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveNextDistDir } from '@/lib/next-dist-dir'

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

  it('uses the OneDrive-safe development distDir for Windows OneDrive workspaces', () => {
    expect(
      resolveNextDistDir({
        cwd: 'C:\\Users\\byonk\\OneDrive\\Projects\\rt-scheduler',
        nodeEnv: 'development',
        platform: 'win32',
      })
    ).toBe('.next-dev')
  })

  it('still honors an explicit NEXT_DIST_DIR override', async () => {
    env.NODE_ENV = 'development'
    env.NEXT_DIST_DIR = '.next-custom'

    const config = await loadNextConfig()

    expect(config.distDir).toBe('.next-custom')
  })
})
