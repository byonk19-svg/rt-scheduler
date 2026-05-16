import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('availability workflow action exports', () => {
  it('keeps callers pointed at workflow-specific action modules', () => {
    const managerPage = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/page.tsx'),
      'utf8'
    )
    const therapistPage = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/therapist/availability/page.tsx'),
      'utf8'
    )
    const intakePage = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/intake/page.tsx'),
      'utf8'
    )

    expect(managerPage).toContain('/availability/manager-planner-actions')
    expect(managerPage).toContain('/availability/manager-request-actions')
    expect(therapistPage).toContain('/availability/therapist-actions')
    expect(intakePage).toContain('/availability/email-intake-actions')
  })

  it('keeps the legacy actions file as a compatibility barrel, not the implementation owner', () => {
    const actionsFile = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/actions.ts'),
      'utf8'
    )

    expect(actionsFile).not.toContain('export async function')
    expect(actionsFile).toContain('./therapist-action-impl')
    expect(actionsFile).toContain('./manager-planner-action-impl')
    expect(actionsFile).toContain('./manager-request-action-impl')
    expect(actionsFile).toContain('./email-intake-action-impl')
  })

  it('keeps manager reminders scoped to active, unarchived staff who have not submitted', () => {
    const reminderAction = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/availability/manager-reminder-action-impl.ts'),
      'utf8'
    )

    expect(reminderAction).toContain(".from('profiles')")
    expect(reminderAction).toContain(".eq('is_active', true)")
    expect(reminderAction).toContain(".is('archived_at', null)")
    expect(reminderAction).toContain(".from('therapist_availability_submissions')")
    expect(reminderAction).toContain(".eq('schedule_cycle_id', cycleId)")
  })
})
