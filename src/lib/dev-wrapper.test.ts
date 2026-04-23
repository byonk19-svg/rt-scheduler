import { describe, expect, it } from 'vitest'

import packageJson from '../../package.json'
import {
  buildNextDevInvocation,
  resolveDevDistDir,
  resolveExternalWindowsDevCacheTarget,
} from '../../scripts/lib/dev-wrapper.mjs'

describe('dev wrapper wiring', () => {
  it('routes npm run dev through the repository wrapper', () => {
    const scripts = packageJson.scripts as Record<string, string>
    expect(scripts.dev).toBe('node scripts/dev.mjs')
  })
})

describe('buildNextDevInvocation', () => {
  it('avoids cmd.exe reparsing on Windows and preserves forwarded args', () => {
    const forwardedArgs = [
      '--hostname',
      'local host',
      '--experimental-https-key',
      "C:\\Users\\O'Brien\\certs\\dev key.pem",
    ] as string[]

    const invocation = buildNextDevInvocation({
      platform: 'win32',
      forwardedArgs,
    })

    expect(invocation.command).not.toBe('cmd.exe')
    expect(invocation.args).toEqual([
      expect.stringMatching(/node_modules[\\/]next[\\/]dist[\\/]bin[\\/]next$/),
      'dev',
      '--webpack',
      '--hostname',
      'local host',
      '--experimental-https-key',
      "C:\\Users\\O'Brien\\certs\\dev key.pem",
    ])
  })
})

describe('resolveDevDistDir', () => {
  it('keeps explicit NEXT_DIST_DIR overrides', () => {
    expect(
      resolveDevDistDir(
        'C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler',
        'C:\\custom-next-cache',
        'win32'
      )
    ).toBe('C:\\custom-next-cache')
  })

  it('uses an external cache path for OneDrive workspaces on Windows', () => {
    expect(
      resolveDevDistDir('C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler', undefined, 'win32')
    ).toBe('.next-dev')

    const externalTarget = resolveExternalWindowsDevCacheTarget(
      'C:\\Users\\byonk\\OneDrive\\Desktop\\rt-scheduler',
      'C:\\Users\\byonk\\AppData\\Local',
      'C:\\Temp'
    )

    expect(externalTarget).toContain('C:\\Users\\byonk\\AppData\\Local')
    expect(externalTarget).toContain('Teamwise\\next-dev')
    expect(externalTarget).toContain('rt-scheduler-')
    expect(externalTarget).not.toContain('OneDrive')
  })

  it('keeps .next for non-OneDrive workspaces', () => {
    expect(resolveDevDistDir('C:\\dev\\rt-scheduler', undefined, 'win32')).toBe('.next')
    expect(resolveDevDistDir('/workspace/rt-scheduler', undefined, 'linux')).toBe('.next')
  })
})
