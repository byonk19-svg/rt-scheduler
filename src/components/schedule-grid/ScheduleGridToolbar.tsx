'use client'

import { useState, type FormEvent } from 'react'
import {
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  Layers,
  Moon,
  Printer,
  Save,
  Send,
  Sun,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getScheduleBlockLifecycleLabel } from '@/lib/schedule-block-state'
import { cn } from '@/lib/utils'

import type { ScheduleInteractionMode } from './schedule-grid-types'

type ScheduleGridToolbarProps = {
  cycleId: string
  cycleDateRangeLabel: string
  availableCycles: Array<{ id: string; label: string }>
  isPublished: boolean
  cycleStatus: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  shiftTab: 'Day' | 'Night'
  isPending: boolean
  interactionMode: ScheduleInteractionMode
  onCycleChange: (cycleId: string) => void
  onShiftTabChange: (tab: 'Day' | 'Night') => void
  onAutoDraft?: () => void
  onPreFlight?: () => void
  onSendPreliminary?: () => void
  onPrint: () => void
  onPublish?: () => void
  publishLabel?: string
  templateOptions?: Array<{ id: string; name: string; shiftCount: number; dayCount: number }>
  templateAction?: (formData: FormData) => void | Promise<void>
}

function getScheduleToolbarNextStep(args: {
  isPublished: boolean
  cycleStatus: ScheduleGridToolbarProps['cycleStatus']
  canUseManagerToolbar: boolean
  hasAutoDraft: boolean
  hasPreFlight: boolean
  hasPreliminary: boolean
  hasPublish: boolean
}) {
  if (!args.canUseManagerToolbar) {
    return 'Review the schedule. Your available actions are shown on the cells you can use.'
  }
  if (args.isPublished || args.cycleStatus === 'final') {
    return 'Posted for staff. Print if needed, or make post-publish updates from the grid.'
  }
  if (args.cycleStatus === 'offline') {
    return 'Offline from staff. Review changes, then republish when the schedule is ready.'
  }
  if (args.hasAutoDraft) {
    return 'Start with Auto-draft, then check the schedule before sending it to staff.'
  }
  if (args.hasPreFlight) {
    return 'Run Pre-flight before sending or publishing so blockers are visible.'
  }
  if (args.hasPreliminary) {
    return 'Send preliminary when managers are ready for staff review.'
  }
  if (args.hasPublish) {
    return 'Publish only after the schedule and readiness checks look right.'
  }
  return 'Work left to right: choose block, review day or night, then act when ready.'
}

export function ScheduleGridToolbar({
  cycleId,
  cycleDateRangeLabel,
  availableCycles,
  isPublished,
  cycleStatus,
  shiftTab,
  isPending,
  interactionMode,
  onCycleChange,
  onShiftTabChange,
  onAutoDraft,
  onPreFlight,
  onSendPreliminary,
  onPrint,
  onPublish,
  publishLabel = 'Publish',
  templateOptions = [],
  templateAction,
}: ScheduleGridToolbarProps) {
  const [templateName, setTemplateName] = useState('')
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const preliminaryLabel =
    cycleStatus === 'preliminary' ? 'Refresh preliminary' : 'Send preliminary'
  const scheduleBlockStateLabel = getScheduleBlockLifecycleLabel({
    published: isPublished,
    status: cycleStatus,
  })
  const isLiveState = scheduleBlockStateLabel === 'Published'
  const isPausedState =
    scheduleBlockStateLabel === 'Offline' || scheduleBlockStateLabel === 'Archived'
  const nextStep = getScheduleToolbarNextStep({
    isPublished,
    cycleStatus,
    canUseManagerToolbar: interactionMode.canUseManagerToolbar,
    hasAutoDraft: Boolean(onAutoDraft),
    hasPreFlight: Boolean(onPreFlight),
    hasPreliminary: Boolean(onSendPreliminary),
    hasPublish: Boolean(onPublish),
  })
  const canUseTemplates = interactionMode.canUseManagerToolbar
  const canApplyTemplate =
    canUseTemplates && Boolean(templateAction) && !isPublished && cycleStatus === 'draft'

  async function handleSaveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = templateName.trim()
    if (!name || savingTemplate) return

    setSavingTemplate(true)
    setTemplateFeedback(null)
    setTemplateError(null)
    try {
      const response = await fetch('/api/schedule/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cycleId, name }),
      })
      const body = (await response.json().catch(() => null)) as { shift_count?: number } | null
      if (!response.ok) {
        throw new Error('save_failed')
      }
      setTemplateName('')
      setTemplateFeedback(
        `Template saved with ${body?.shift_count ?? 0} ${
          body?.shift_count === 1 ? 'assignment' : 'assignments'
        }.`
      )
    } catch {
      setTemplateError('Could not save the template. Review this Schedule Block and try again.')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card/95 px-3 py-2 shadow-tw-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="schedule-cycle">
            Schedule Block
          </label>
          <div className="flex min-h-8 min-w-[14rem] items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 shadow-tw-2xs [@media(pointer:coarse)]:min-h-11">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <select
              id="schedule-cycle"
              value={cycleId}
              disabled={isPending}
              onChange={(event) => onCycleChange(event.target.value)}
              className="h-6 min-w-0 flex-1 bg-transparent text-xs font-bold text-foreground outline-none disabled:opacity-60 [@media(pointer:coarse)]:h-11"
              aria-label="Schedule Block"
            >
              {availableCycles.length > 0 ? (
                availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label}
                  </option>
                ))
              ) : (
                <option value={cycleId}>{cycleDateRangeLabel}</option>
              )}
            </select>
          </div>
          <span
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-black',
              isLiveState
                ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                : isPausedState
                  ? 'border-border bg-muted text-muted-foreground'
                  : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
            )}
          >
            {scheduleBlockStateLabel}
          </span>
          <div className="flex min-h-7 gap-1 rounded-md border border-border bg-background p-0.5 shadow-tw-2xs [@media(pointer:coarse)]:min-h-11">
            {(['Day', 'Night'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={shiftTab === tab}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-black transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11',
                  shiftTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() => onShiftTabChange(tab)}
                disabled={isPending}
                aria-label={`${tab} shift`}
              >
                {tab === 'Day' ? (
                  <Sun className="h-3 w-3" aria-hidden />
                ) : (
                  <Moon className="h-3 w-3" aria-hidden />
                )}
                {tab} shift
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {interactionMode.canUseManagerToolbar && !isPublished ? (
            <>
              {onAutoDraft ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-muted-foreground"
                  onClick={onAutoDraft}
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Auto-draft
                </Button>
              ) : null}
              {onPreFlight ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-muted-foreground"
                  onClick={onPreFlight}
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Pre-flight
                </Button>
              ) : null}
              {onSendPreliminary ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-muted-foreground"
                  onClick={onSendPreliminary}
                >
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {preliminaryLabel}
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-muted-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11"
            onClick={onPrint}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Print
          </Button>
          {interactionMode.canUseManagerToolbar && !isPublished && onPublish ? (
            <Button size="sm" className="h-8 px-3 font-bold shadow-tw-sm" onClick={onPublish}>
              <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {publishLabel}
            </Button>
          ) : null}
        </div>
      </div>
      {canUseTemplates ? (
        <details className="mt-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-foreground">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Templates
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <form className="space-y-2" onSubmit={handleSaveTemplate}>
              <label className="block text-[11px] font-bold text-muted-foreground">
                Template name
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  disabled={isPending || savingTemplate}
                />
              </label>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 text-muted-foreground"
                disabled={!templateName.trim() || isPending || savingTemplate}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {savingTemplate ? 'Saving template' : 'Save as template'}
              </Button>
            </form>
            <form action={templateAction} className="space-y-2">
              <input type="hidden" name="new_cycle_id" value={cycleId} />
              <label className="block text-[11px] font-bold text-muted-foreground">
                Saved template
                <select
                  name="template_id"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  disabled={!canApplyTemplate || templateOptions.length === 0 || isPending}
                >
                  {templateOptions.length > 0 ? (
                    templateOptions.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.shiftCount} assignments)
                      </option>
                    ))
                  ) : (
                    <option value="">No saved templates</option>
                  )}
                </select>
              </label>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 text-muted-foreground"
                disabled={!canApplyTemplate || templateOptions.length === 0 || isPending}
              >
                <Layers className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Apply template
              </Button>
              {!canApplyTemplate ? (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Templates can be applied to draft Schedule Blocks.
                </p>
              ) : null}
            </form>
          </div>
          {templateFeedback ? (
            <p className="mt-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-1.5 font-medium text-[var(--success-text)]">
              {templateFeedback}
            </p>
          ) : null}
          {templateError ? (
            <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-2 py-1.5 font-medium text-[var(--error-text)]">
              {templateError}
            </p>
          ) : null}
        </details>
      ) : null}
      <div className="mt-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-bold text-foreground">Next step: </span>
        {nextStep}
      </div>
    </div>
  )
}
