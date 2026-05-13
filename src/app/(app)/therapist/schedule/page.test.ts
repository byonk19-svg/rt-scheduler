import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const therapistScheduleSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/(app)/therapist/schedule/page.tsx'),
  'utf8'
)

describe('therapist schedule route', () => {
  it('redirects to the unified schedule page instead of shared coverage', () => {
    expect(therapistScheduleSource).toContain("redirect('/schedule')")
    expect(therapistScheduleSource).not.toContain(
      "redirect(query ? `/coverage?${query}` : '/coverage')"
    )
  })

  it('sets redirect metadata for the unified schedule surface', () => {
    expect(therapistScheduleSource).toContain("title: 'Schedule'")
    expect(therapistScheduleSource).toContain('unified Schedule grid')
  })
})
