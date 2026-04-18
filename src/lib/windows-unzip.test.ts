import { describe, expect, it } from 'vitest'

import { buildExpandArchiveInvocation } from '../../scripts/lib/windows-unzip.mjs'

describe('buildExpandArchiveInvocation', () => {
  it('passes zip paths and destination paths as separate PowerShell arguments', () => {
    const zipFile = "C:\\Users\\O'Brien\\Downloads\\archive!.zip"
    const destinationDir = 'C:\\Temp\\dest!dir'

    const invocation = buildExpandArchiveInvocation({
      zipFile,
      destinationDir,
    })

    expect(invocation.command).toBe('powershell.exe')
    expect(invocation.args).toEqual([
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      expect.stringMatching(/expand-archive\.ps1$/),
      '-LiteralPath',
      zipFile,
      '-DestinationPath',
      destinationDir,
    ])
  })
})
