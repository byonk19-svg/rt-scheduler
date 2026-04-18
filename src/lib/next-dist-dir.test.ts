import { describe, expect, it } from 'vitest'

import { resolveNextDistDir } from './next-dist-dir'

describe('resolveNextDistDir', () => {
  it('prefers an explicit NEXT_DIST_DIR override', () => {
    expect(
      resolveNextDistDir({
        envDistDir: 'C:\\custom-next-cache',
        nodeEnv: 'development',
        platform: 'win32',
        cwd: 'C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler',
        localAppData: 'C:\\Users\\byonk\\AppData\\Local',
        tempDir: 'C:\\Temp',
      })
    ).toBe('C:\\custom-next-cache')
  })

  it('moves development artifacts out of OneDrive on Windows', () => {
    expect(
      resolveNextDistDir({
        nodeEnv: 'development',
        platform: 'win32',
        cwd: 'C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler',
        localAppData: 'C:\\Users\\byonk\\AppData\\Local',
        tempDir: 'C:\\Temp',
      })
    ).toBe('.next-dev')
  })

  it('keeps the default .next directory outside Windows OneDrive development', () => {
    expect(
      resolveNextDistDir({
        nodeEnv: 'development',
        platform: 'linux',
        cwd: '/workspace/rt-scheduler',
        localAppData: undefined,
        tempDir: '/tmp',
      })
    ).toBe('.next')

    expect(
      resolveNextDistDir({
        nodeEnv: 'production',
        platform: 'win32',
        cwd: 'C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler',
        localAppData: 'C:\\Users\\byonk\\AppData\\Local',
        tempDir: 'C:\\Temp',
      })
    ).toBe('.next')
  })

  it('still prefers the explicit env override over the OneDrive-safe dev directory', () => {
    expect(
      resolveNextDistDir({
        nodeEnv: 'development',
        platform: 'win32',
        cwd: 'C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler',
        envDistDir: '.next-custom',
      })
    ).toBe('.next-custom')
  })
})
