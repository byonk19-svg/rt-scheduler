import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('therapist schedule route', () => {
  it('renders a real therapist schedule page instead of re-exporting the legacy redirect', () => {
    const filePath = resolve(process.cwd(), 'src/app/therapist/schedule/page.tsx')
    const source = readFileSync(filePath, 'utf8')

    expect(source).not.toContain("export { default } from '../../staff/schedule/page'")
    expect(source).toContain('My Schedule')
    expect(source).toContain('buildCalendarWeeks')
    expect(source).toContain('shift?: string | string[]')
    expect(source).toContain('No scheduled therapists')
    expect(source).toContain(".from('shifts')")
    expect(source).toContain(".in('id', shiftUserIds)")
    expect(source).toContain('createAdminClient')
  })
})
