import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const loginPageSource = readFileSync(
  resolve(process.cwd(), 'src/app/(public)/login/page.tsx'),
  'utf8'
)
const loginBrandPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/public/LoginBrandPanel.tsx'),
  'utf8'
)
const loginFormPanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/public/LoginFormPanel.tsx'),
  'utf8'
)

describe('LoginPage framing', () => {
  it('keeps the brand panel in a dedicated component', () => {
    expect(loginBrandPanelSource).toContain('Scheduling that keeps care moving.')
    expect(loginPageSource).toContain('LoginBrandPanel')
  })

  it('keeps the login form panel in a dedicated component', () => {
    expect(loginFormPanelSource).toContain('Forgot password?')
    expect(loginFormPanelSource).toContain('Request access')
    expect(loginPageSource).toContain('LoginFormPanel')
  })
})
