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

  it('keeps the read-only schedule roster behind authenticated app-shell routes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8')

    expect(source).not.toContain("'/schedule'")
    expect(source).toContain("const STAFF_ROUTES = ['/staff', '/dashboard/staff', '/requests/new'] as const")
  })
})
