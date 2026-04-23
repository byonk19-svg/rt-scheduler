import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const layoutSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(public)/layout.tsx'),
  'utf8'
)
const signupPageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(public)/signup/page.tsx'),
  'utf8'
)
const signupBrandPanelSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/public/SignupBrandPanel.tsx'),
  'utf8'
)
const signupFormPanelSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/public/SignupFormPanel.tsx'),
  'utf8'
)

describe('public signup shell', () => {
  it('mounts the shared public header from the public layout', () => {
    expect(layoutSource).toContain('PublicHeader')
  })

  it('does not call the team roster matching action from the public signup page', () => {
    expect(signupPageSource).not.toContain('checkNameRosterMatchAction')
  })

  it('always redirects new signups to the generic requested status', () => {
    expect(signupPageSource).toContain("router.push('/login?status=requested')")
    expect(signupPageSource).not.toContain("'/login?status=matched'")
  })

  it('keeps the signup brand and form panels in dedicated components', () => {
    expect(signupBrandPanelSource).toContain('Scheduling that keeps care moving.')
    expect(signupFormPanelSource).toContain('Request access')
    expect(signupFormPanelSource).toContain('Already have an account?')
    expect(signupPageSource).toContain('SignupBrandPanel')
    expect(signupPageSource).toContain('SignupFormPanel')
  })
})
