import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/settings/page.tsx'),
  'utf8'
)

describe('therapist settings route', () => {
  it('renders a therapist-owned preferences and work rules page', () => {
    expect(source).toContain('Preferences / Work Rules')
    expect(source).toContain('Edit recurring pattern')
    expect(source).toContain('/therapist/recurring-pattern')
    expect(source).toContain('Max consecutive days')
    expect(source).toContain('Notification preferences')
    expect(source).not.toContain("export { default } from '../../profile/page'")
  })
})
