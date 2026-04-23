import Link from 'next/link'
import type { ReactNode } from 'react'
import { Printer, Send, Sparkles } from 'lucide-react'

import { MoreActionsMenu } from '@/components/more-actions-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { WorkspaceMetricTone } from '@/components/coverage/coverage-workspace-chrome'
import { cn } from '@/lib/utils'

type CoverageWorkspaceHeaderProps = {
  activeCycleId: string | null
  activeCyclePublished: boolean
  actionBarStatusHint: string
  canManageCoverage: boolean
  canPublishCycle: boolean
  canRunAutoDraft: boolean
  canSendPreliminary: boolean
  coverageWorkflowSteps: readonly string[]
  cycleRangeLabel: string
  descriptionText: string
  onOpenClearDraft: () => void
  onOpenCycleDialog: () => void
  onOpenPreflight: () => void
  onOpenReviewStep: () => void
  onOpenSaveAsTemplate: () => void
  onPrint: () => void
  preliminaryLive: boolean
  publishAction: (formData: FormData) => void | Promise<void>
  sendPreliminaryAction: (formData: FormData) => void | Promise<void>
  showEmptyDraftState: boolean
  workspaceStatusLabel: string
  workspaceStatusTone: WorkspaceMetricTone
}

export function CoverageWorkspaceHeader({
  activeCycleId,
  activeCyclePublished,
  actionBarStatusHint,
  canManageCoverage,
  canPublishCycle,
  canRunAutoDraft,
  canSendPreliminary,
  coverageWorkflowSteps,
  cycleRangeLabel,
  descriptionText,
  onOpenClearDraft,
  onOpenCycleDialog,
  onOpenPreflight,
  onOpenReviewStep,
  onOpenSaveAsTemplate,
  onPrint,
  preliminaryLive,
  publishAction,
  sendPreliminaryAction,
  showEmptyDraftState,
  workspaceStatusLabel,
  workspaceStatusTone,
}: CoverageWorkspaceHeaderProps) {
  return (
    <header className="border-b border-border/70 bg-card/80 px-5 py-4 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-[1.35rem] font-semibold tracking-tight text-foreground">
              Schedule
            </h1>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                workspaceStatusTone === 'success' &&
                  'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
                workspaceStatusTone === 'warning' &&
                  'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
                workspaceStatusTone === 'neutral' &&
                  'border-border/70 bg-background text-muted-foreground'
              )}
            >
              {workspaceStatusLabel}
            </Badge>
            {preliminaryLive && !activeCyclePublished ? (
              <Badge
                variant="outline"
                className="rounded-full border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]"
              >
                Preliminary live
              </Badge>
            ) : null}
          </div>
          <p className="text-sm font-medium text-foreground/85">{cycleRangeLabel}</p>
          <div className="text-xs text-muted-foreground">{descriptionText}</div>
        </div>

        <div className="flex max-w-full flex-col items-stretch gap-2">
          {canManageCoverage && activeCycleId ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {coverageWorkflowSteps.map((step) => (
                <span
                  key={step}
                  className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  {step}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {canManageCoverage ? (
              !activeCycleId ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={onOpenCycleDialog}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    New 6-week block
                  </Button>
                  <Button asChild variant="outline" size="sm" className="text-xs">
                    <Link href="/publish/history">Delivery history</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant={showEmptyDraftState ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={!canRunAutoDraft}
                    onClick={onOpenPreflight}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    1 Draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={!activeCycleId}
                    onClick={onOpenReviewStep}
                  >
                    2 Review
                  </Button>
                  <form action={sendPreliminaryAction}>
                    <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                    <input type="hidden" name="view" value="week" />
                    <input type="hidden" name="show_unavailable" value="false" />
                    <input type="hidden" name="return_to" value="coverage" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={!canSendPreliminary}
                    >
                      <Send className="h-3.5 w-3.5" />
                      3 Send preliminary
                    </Button>
                  </form>
                  {activeCyclePublished ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-1 text-xs font-medium text-[var(--success-text)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-text)]" />
                      Published
                    </span>
                  ) : (
                    <form action={publishAction}>
                      <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                      <input type="hidden" name="view" value="week" />
                      <input type="hidden" name="show_unavailable" value="false" />
                      <input type="hidden" name="currently_published" value="false" />
                      <input type="hidden" name="override_weekly_rules" value="false" />
                      <input type="hidden" name="override_shift_rules" value="false" />
                      <input type="hidden" name="return_to" value="coverage" />
                      <Button
                        type="submit"
                        variant={showEmptyDraftState ? 'outline' : 'default'}
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={!canPublishCycle}
                      >
                        <Send className="h-3.5 w-3.5" />
                        4 Publish
                      </Button>
                    </form>
                  )}
                  <MoreActionsMenu
                    label="Cycle tools"
                    triggerClassName="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-secondary"
                  >
                    <button
                      type="button"
                      onClick={onOpenCycleDialog}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      New 6-week block
                    </button>
                    <button
                      type="button"
                      disabled={!activeCycleId || activeCyclePublished}
                      onClick={onOpenClearDraft}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                    >
                      Clear draft
                    </button>
                    {activeCyclePublished && activeCycleId ? (
                      <button
                        type="button"
                        onClick={onOpenSaveAsTemplate}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        Save as template
                      </button>
                    ) : null}
                    <Link
                      href="/publish/history"
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      Delivery history
                    </Link>
                    <button
                      type="button"
                      onClick={onPrint}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </button>
                  </MoreActionsMenu>
                </>
              )
            ) : activeCycleId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
                onClick={onPrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            ) : null}
          </div>
          {canManageCoverage ? (
            <p className="text-[11px] font-medium text-muted-foreground">{actionBarStatusHint}</p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
