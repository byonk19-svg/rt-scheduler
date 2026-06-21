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

  it('explains the approval queue before the user leaves signup', () => {
    expect(signupPageSource).toContain('What happens next?')
    expect(signupPageSource).toContain('Your account will be reviewed by a manager.')
    expect(signupPageSource).toContain('receive access once')
  })

  it('stacks required name fields on narrow screens', () => {
    expect(signupPageSource).toContain('grid grid-cols-1 gap-2 sm:grid-cols-2')
  })

  it('keeps the submit action touch-safe on mobile', () => {
    expect(signupPageSource).toContain('className="min-h-11 w-full"')
  })
})
