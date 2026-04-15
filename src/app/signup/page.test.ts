import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/signup/page.tsx'), 'utf8')

describe('signup security contract', () => {
  it('does not call the team roster matching action from the public signup page', () => {
    expect(pageSource).not.toContain('checkNameRosterMatchAction')
  })

  it('always redirects new signups to the generic requested status', () => {
    expect(pageSource).toContain("router.push('/login?status=requested')")
    expect(pageSource).not.toContain("'/login?status=matched'")
  })
})
