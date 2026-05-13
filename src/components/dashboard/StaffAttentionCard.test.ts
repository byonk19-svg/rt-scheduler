import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', { href, ...props }, children),
}))

import { StaffAttentionCard } from '@/components/dashboard/StaffAttentionCard'

describe('StaffAttentionCard', () => {
  it('renders one primary CTA and keeps secondary routes in a quieter follow-up section', () => {
    const html = renderToStaticMarkup(
      createElement(StaffAttentionCard, {
        workflow: {
          state: 'availability_draft',
          stateLabel: 'Draft saved',
          primaryTitle: 'Finish and send your availability',
          primaryDescription:
            'You already started the next schedule. Finish it and send it so it counts.',
          actionCycle: {
            id: 'cycle-1',
            label: 'May 2026',
            start_date: '2026-05-10',
            end_date: '2026-06-20',
            published: false,
            availability_due_at: '2026-05-01T23:59:59.000Z',
          },
          cycleLabel: 'May 2026',
          cycleRangeLabel: 'May 10 - Jun 20',
          cycleReason: 'This is the next 6-week cycle still waiting on your response.',
          primaryAction: {
            href: '/therapist/availability?cycle=cycle-1',
            label: 'Finish and send availability',
          },
          secondaryAction: {
            href: '/schedule',
            label: 'View schedule',
          },
          scheduleAction: {
            href: '/schedule',
            label: 'View schedule',
          },
          swapSummary: {
            pendingCount: 0,
            totalCount: 0,
          },
          publishedShiftSummary: {
            cycleId: null,
            upcomingCount: 0,
          },
        },
        submissionUi: {
          isSubmitted: false,
          submittedAtDisplay: null,
          lastEditedDisplay: null,
        },
        availabilityDueStatus: {
          label: 'Past due',
          tone: 'past',
        },
        availabilityDueLine: 'Past due',
        workflowAlreadyLinksToSchedule: true,
      })
    )

    expect(html).toContain('What needs your attention now')
    expect(html).toContain('Finish and send availability')
    expect(html).toContain('Need something else?')
    expect(html).toContain('Past due')
    expect(html).toContain('Draft saved')
    expect(html).not.toContain('View schedule</a></div></div></div><div class="mt-5 space-y-3"><a')
  })
})
