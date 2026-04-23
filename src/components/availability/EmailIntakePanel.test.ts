import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

import { EmailIntakePanel } from '@/components/availability/EmailIntakePanel'

const emailIntakePanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakePanel.tsx'),
  'utf8'
)
const emailIntakeBatchCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeBatchCard.tsx'),
  'utf8'
)
const emailIntakeBatchHeaderSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeBatchHeader.tsx'),
  'utf8'
)
const emailIntakeOriginalSourcePanelSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeOriginalSourcePanel.tsx'),
  'utf8'
)
const emailIntakeItemSectionSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeItemSection.tsx'),
  'utf8'
)
const emailIntakeItemCardSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeItemCard.tsx'),
  'utf8'
)
const emailIntakeMatchFormSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeMatchForm.tsx'),
  'utf8'
)
const emailIntakeItemSummarySource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeItemSummary.tsx'),
  'utf8'
)
const emailIntakeRequestChipListSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/EmailIntakeRequestChipList.tsx'),
  'utf8'
)

const baseRow = {
  id: 'intake-1',
  fromEmail: 'employee@example.com',
  fromName: 'Employee Example',
  subject: 'Need off Mar 24',
  receivedAt: '2026-03-20T12:00:00Z',
  originalEmailText: 'Please mark me off on Mar 24.\nThanks.',
  attachmentTexts: [
    {
      filename: 'form-1.jpg',
      ocrText: '03/24 Need off for appointment',
      ocrStatus: 'completed' as const,
    },
  ],
  batchStatus: 'needs_review' as const,
  parseSummary: '2 items | 1 parsed | 1 need review | 0 failed',
  itemCount: 2,
  autoAppliedCount: 1,
  needsReviewCount: 1,
  failedCount: 0,
  reviewItems: [
    {
      id: 'item-1',
      sourceType: 'attachment' as const,
      sourceLabel: 'form-1.jpg',
      parseStatus: 'needs_review' as const,
      confidenceLevel: 'medium' as const,
      confidenceReasons: ['employee_match_ambiguous'],
      extractedEmployeeName: 'Brianna Brown',
      matchedTherapistId: null,
      matchedTherapistName: null,
      matchedCycleId: null,
      matchedCycleLabel: null,
      rawText: '03/24 Need off for appointment',
      manuallyEdited: true,
      parsedRequests: [
        {
          date: '2026-03-24',
          override_type: 'force_off' as const,
          shift_type: 'both' as const,
        },
        {
          date: '2026-03-25',
          override_type: 'force_on' as const,
          shift_type: 'day' as const,
        },
      ],
    },
  ],
  autoAppliedItems: [
    {
      id: 'item-2',
      sourceType: 'body' as const,
      sourceLabel: 'Email body',
      parseStatus: 'auto_applied' as const,
      confidenceLevel: 'high' as const,
      confidenceReasons: [],
      extractedEmployeeName: 'Employee Example',
      matchedTherapistId: 'therapist-1',
      matchedTherapistName: 'Adrienne Solt',
      matchedCycleId: 'cycle-1',
      matchedCycleLabel: 'Critique Cycle (2026-03-17 to 2026-04-27)',
      rawText: 'Please mark me off on Mar 24.',
      parsedRequests: [
        {
          date: '2026-03-24',
          override_type: 'force_off' as const,
          shift_type: 'both' as const,
        },
      ],
    },
  ],
}

describe('EmailIntakePanel', () => {
  it('renders separate review and auto-applied sections for a batch', () => {
    const html = renderToStaticMarkup(
      createElement(EmailIntakePanel, {
        rows: [baseRow],
        applyEmailAvailabilityImportAction: async () => {},
        updateEmailIntakeItemRequestAction: async () => {},
        deleteAvailabilityEmailIntakeAction: async () => {},
        reparseAvailabilityEmailIntakeAction: async () => {},
        updateEmailIntakeTherapistAction: async () => {},
        therapistOptions: [{ id: 'therapist-1', fullName: 'Adrienne Solt' }],
        cycleOptions: [{ id: 'cycle-1', label: 'Critique Cycle (2026-03-17 to 2026-04-27)' }],
      })
    )

    expect(html).toContain('Needs review')
    expect(html).toContain('auto-applied - show')
    expect(html).toContain('form-1.jpg')
    expect(html).toContain('Email body')
    expect(html).toContain('Name match uncertain')
    expect(html).toContain('Reparse')
    expect(html).toContain('Delete')
    expect(html).toContain('View original email')
    expect(html).toContain('Please mark me off on Mar 24.')
    expect(html).toContain('03/24 Need off for appointment')
  })

  it('shows per-item apply only when the item is matched and has parsed requests', () => {
    const html = renderToStaticMarkup(
      createElement(EmailIntakePanel, {
        rows: [
          {
            ...baseRow,
            reviewItems: [
              {
                ...baseRow.reviewItems[0],
                matchedTherapistId: 'therapist-1',
                matchedTherapistName: 'Adrienne Solt',
                matchedCycleId: 'cycle-1',
                matchedCycleLabel: 'Critique Cycle (2026-03-17 to 2026-04-27)',
              },
            ],
          },
        ],
        applyEmailAvailabilityImportAction: async () => {},
        updateEmailIntakeItemRequestAction: async () => {},
        deleteAvailabilityEmailIntakeAction: async () => {},
        reparseAvailabilityEmailIntakeAction: async () => {},
        updateEmailIntakeTherapistAction: async () => {},
        therapistOptions: [{ id: 'therapist-1', fullName: 'Adrienne Solt' }],
        cycleOptions: [{ id: 'cycle-1', label: 'Critique Cycle (2026-03-17 to 2026-04-27)' }],
      })
    )

    expect(html).toContain('Needs review')
    expect(html).toContain('1 auto-applied - show')
    expect(html).toContain('form-1.jpg')
    expect(html).toContain('Email body')
    expect(html).toContain('Name match uncertain')
  })

  it('renders each parsed request as an editable chip button with payload and edited marker', () => {
    const html = renderToStaticMarkup(
      createElement(EmailIntakePanel, {
        rows: [
          {
            ...baseRow,
            reviewItems: [
              {
                ...baseRow.reviewItems[0],
                matchedTherapistId: 'therapist-1',
                matchedTherapistName: 'Adrienne Solt',
                matchedCycleId: 'cycle-1',
                matchedCycleLabel: 'Critique Cycle (2026-03-17 to 2026-04-27)',
              },
            ],
          },
        ],
        applyEmailAvailabilityImportAction: async () => {},
        updateEmailIntakeItemRequestAction: async () => {},
        deleteAvailabilityEmailIntakeAction: async () => {},
        reparseAvailabilityEmailIntakeAction: async () => {},
        updateEmailIntakeTherapistAction: async () => {},
        therapistOptions: [{ id: 'therapist-1', fullName: 'Adrienne Solt' }],
        cycleOptions: [{ id: 'cycle-1', label: 'Critique Cycle (2026-03-17 to 2026-04-27)' }],
      })
    )

    expect(html).toContain('Edited')
    expect(html).toContain('Mar 24 off')
    expect(html).toContain('Mar 25 work (day)')
    expect(html).toContain('type="button"')
    expect(html).toContain('>Remove</button>')
    expect(html).toContain('Switch between day off and available to work')
    expect(html).toContain('border-destructive/30')
    expect(html).toContain('bg-destructive/10')
    expect(html).toContain('text-destructive')
    expect(html).toContain('border-info-border')
    expect(html).toContain('bg-info-subtle')
    expect(html).toContain('text-info-text')
  })

  it('keeps the therapist/cycle matching workflow in a dedicated component', () => {
    expect(emailIntakeMatchFormSource).toContain('Action needed')
    expect(emailIntakeMatchFormSource).toContain('Save matches')
    expect(emailIntakeItemCardSource).toContain('EmailIntakeMatchForm')
  })

  it('keeps the top item summary and apply CTA in a dedicated component', () => {
    expect(emailIntakeItemSummarySource).toContain('Detected employee:')
    expect(emailIntakeItemSummarySource).toContain('Apply dates')
    expect(emailIntakeItemSummarySource).toContain('confidence')
    expect(emailIntakeItemCardSource).toContain('EmailIntakeItemSummary')
  })

  it('keeps parsed request chip interactions in a dedicated component', () => {
    expect(emailIntakeRequestChipListSource).toContain(
      'Switch between day off and available to work'
    )
    expect(emailIntakeRequestChipListSource).toContain('Remove')
    expect(emailIntakeItemCardSource).toContain('EmailIntakeRequestChipList')
  })

  it('keeps per-email batch review chrome in a dedicated component', () => {
    expect(emailIntakePanelSource).toContain('EmailIntakeBatchCard')
    expect(emailIntakeBatchCardSource).toContain('EmailIntakeBatchHeader')
    expect(emailIntakeBatchCardSource).toContain('auto-applied - show')
  })

  it('keeps intake item grouping in a dedicated section component', () => {
    expect(emailIntakeBatchCardSource).toContain('EmailIntakeItemSection')
    expect(emailIntakeItemSectionSource).toContain('summaryLabel ?? title')
    expect(emailIntakeItemSectionSource).toContain('collapsible = false')
  })

  it('keeps original-email source disclosure in a dedicated component', () => {
    expect(emailIntakeBatchCardSource).toContain('EmailIntakeOriginalSourcePanel')
    expect(emailIntakeOriginalSourcePanelSource).toContain('View original email')
    expect(emailIntakeOriginalSourcePanelSource).toContain('Email body')
  })

  it('keeps batch sender/status/actions in a dedicated header component', () => {
    expect(emailIntakeBatchCardSource).toContain('EmailIntakeBatchHeader')
    expect(emailIntakeBatchHeaderSource).toContain('Received')
    expect(emailIntakeBatchHeaderSource).toContain('Reparse')
  })
})
