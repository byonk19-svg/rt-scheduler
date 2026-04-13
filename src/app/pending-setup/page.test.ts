import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(path.join(process.cwd(), 'src/app/pending-setup/page.tsx'), 'utf8')

describe('pending-setup page copy', () => {
  it('uses the calm sit-tight waiting copy', () => {
    expect(src).toContain('No action needed on your end.')
    expect(src).toContain('Sit tight while your manager reviews your')
    expect(src).toContain('account \u2014')
    expect(src).toContain('you\u2019ll be able to log in once you&apos;re approved.')
  })

  it('keeps the h1 unchanged', () => {
    expect(src).toContain('Your account is waiting for approval')
  })

  it('keeps the access_requested success callout', () => {
    expect(src).toContain('Access request received.')
  })
})
