import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('proxy public route allowlist', () => {
  it('keeps inbound availability webhook public for provider delivery', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8')

    expect(source).toContain(
      "const PUBLIC_API_ROUTES = ['/api/inbound/availability-email'] as const"
    )
    expect(source).toContain('[...PUBLIC_ROUTES, ...PUBLIC_API_ROUTES]')
  })

  it('treats the mock schedule roster screen as a public route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8')

    expect(source).toContain("'/schedule'")
  })
})
