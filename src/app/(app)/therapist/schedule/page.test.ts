import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const therapistScheduleSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/schedule/page.tsx'),
  'utf8'
)

describe('therapist schedule route', () => {
  it('stays on a therapist-owned page instead of redirecting to shared coverage', () => {
    expect(therapistScheduleSource).toContain('My Shifts')
    expect(therapistScheduleSource).toContain('/dashboard/staff')
    expect(therapistScheduleSource).not.toContain(
      "redirect(query ? `/coverage?${query}` : '/coverage')"
    )
  })
})
