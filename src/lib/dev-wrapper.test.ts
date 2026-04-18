import { describe, expect, it } from 'vitest'

import packageJson from '../../package.json'
import { buildNextDevInvocation } from '../../scripts/lib/dev-wrapper.mjs'

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
