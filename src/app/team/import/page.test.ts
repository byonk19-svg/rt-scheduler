import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('team import page source contract', () => {
  it('renders the import wizard and uses manager-only access', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/team/import/page.tsx'),
      'utf8'
    )

    expect(source).toContain('ImportWizard')
    expect(source).toContain('ManagerToolAccessDenied')
    expect(source).toContain('resolveManagerToolAccess(profileData)')
    expect(source).toContain("select('role, is_active, archived_at')")
    expect(source).toContain("redirect('/login?error=account_inactive')")
  })
})
