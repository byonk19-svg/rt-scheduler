import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const signupSource = fs.readFileSync(path.join(process.cwd(), 'src/app/signup/page.tsx'), 'utf8')

describe('public signup flow hardening', () => {
  it('does not use the manager roster lookup from the public signup client', () => {
    expect(signupSource).not.toContain('checkNameRosterMatchAction')
    expect(signupSource).not.toContain('status=matched')
    expect(signupSource).toContain('/login?status=requested')
  })
})
