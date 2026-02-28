'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintButton } from '@/components/print-button'
import { FormMenuSubmitButton, FormSubmitButton } from '@/components/form-submit-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { buildScheduleUrl } from '@/lib/schedule-helpers'

type Role = UiRole
type ViewMode = 'grid' | 'list' | 'calendar' | 'week'

type PublishSummary = {
  cycleLabel: string
  startDate: string
  endDate: string
  totalScheduledShifts: number
  dayShifts: number
  nightShifts: number
  missingLead: number
  underCoverage: number
  overCoverage: number
}

type ScheduleHeaderProps = {
  role: Role
  viewMode: ViewMode
  activeCycleId?: string
  activeCyclePublished: boolean
  showUnavailable?: boolean
  setupHref?: string
  title: string
  description: string
  toggleCyclePublishedAction: (formData: FormData) => void | Promise<void>
  generateDraftScheduleAction: (formData: FormData) => void | Promise<void>
  resetDraftScheduleAction: (formData: FormData) => void | Promise<void>
  publishSummary?: PublishSummary | null
  canViewMonth?: boolean
}

const menuActionClass =
  'block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50'

function tabClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-sm font-medium text-[#b45309]'
  }

  return 'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground'
}

export function ScheduleHeader({
  role,
  viewMode,
  activeCycleId,
  activeCyclePublished,
  showUnavailable = false,
  setupHref,
  title,
  description,
  toggleCyclePublishedAction,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  publishSummary = null,
  canViewMonth = can(role, 'manage_schedule'),
}: ScheduleHeaderProps) {
  const canManageSchedule = can(role, 'manage_schedule')
  const hasActiveCycle = Boolean(activeCycleId)
  const canPublish = hasActiveCycle && !activeCyclePublished
  const autoGenerateHelperMessage = !hasActiveCycle
    ? 'Select a cycle to auto-generate a draft.'
    : activeCyclePublished
      ? 'Draft actions are disabled for published cycles.'
      : null
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishConfirmationText, setPublishConfirmationText] = useState('')
  const publishConfirmEnabled = publishConfirmationText.trim().toUpperCase() === 'PUBLISH'

  return (
    <div className="no-print space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="app-page-title">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageSchedule && (
            <>
              <form action={generateDraftScheduleAction}>
                <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                <input type="hidden" name="view" value={viewMode} />
                <input
                  type="hidden"
                  name="show_unavailable"
                  value={showUnavailable ? 'true' : 'false'}
                />
                <FormSubmitButton
                  type="submit"
                  variant="outline"
                  disabled={!hasActiveCycle || activeCyclePublished}
                  pendingText="Generating..."
                >
                  Auto-generate draft
                </FormSubmitButton>
              </form>

              <FormSubmitButton
                type="button"
                disabled={!canPublish}
                onClick={() => setPublishDialogOpen(true)}
                className="bg-[#d97706] text-white hover:bg-[#b45309] disabled:opacity-50"
              >
                Publish
              </FormSubmitButton>

              <details className="relative">
                <summary className="list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary">
                    <ChevronDown className="h-4 w-4" />
                    Options
                  </span>
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-border bg-white p-1 shadow-lg">
                  <form action={toggleCyclePublishedAction}>
                    <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                    <input type="hidden" name="view" value={viewMode} />
                    <input
                      type="hidden"
                      name="show_unavailable"
                      value={showUnavailable ? 'true' : 'false'}
                    />
                    <input type="hidden" name="currently_published" value="false" />
                    <input type="hidden" name="override_weekly_rules" value="true" />
                    <FormMenuSubmitButton
                      type="submit"
                      className={menuActionClass}
                      disabled={!canPublish}
                      pendingText="Publishing..."
                    >
                      Publish with overrides
                    </FormMenuSubmitButton>
                  </form>
                  <form action={toggleCyclePublishedAction}>
                    <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                    <input type="hidden" name="view" value={viewMode} />
                    <input
                      type="hidden"
                      name="show_unavailable"
                      value={showUnavailable ? 'true' : 'false'}
                    />
                    <input type="hidden" name="currently_published" value="false" />
                    <input type="hidden" name="override_weekly_rules" value="false" />
                    <FormMenuSubmitButton
                      type="submit"
                      className={menuActionClass}
                      disabled={!canPublish}
                      pendingText="Publishing..."
                    >
                      Publish draft
                    </FormMenuSubmitButton>
                  </form>
                </div>
              </details>

              {setupHref && (
                <Button asChild type="button" variant="secondary">
                  <Link href={setupHref}>Setup</Link>
                </Button>
              )}
              <Button asChild type="button" variant="outline">
                <Link href="/publish">Publish history</Link>
              </Button>
            </>
          )}

          {canManageSchedule && (
            <MoreActionsMenu>
              <form action={resetDraftScheduleAction}>
                <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                <input type="hidden" name="view" value={viewMode} />
                <input
                  type="hidden"
                  name="show_unavailable"
                  value={showUnavailable ? 'true' : 'false'}
                />
                <FormMenuSubmitButton
                  type="submit"
                  className={`${menuActionClass} text-[var(--warning-text)]`}
                  disabled={!hasActiveCycle || activeCyclePublished}
                  pendingText="Clearing..."
                >
                  Clear draft and start over
                </FormMenuSubmitButton>
              </form>
            </MoreActionsMenu>
          )}

          <PrintButton variant="outline" label="Print schedule" />

          {canManageSchedule && autoGenerateHelperMessage && (
            <p className="w-full text-xs text-muted-foreground">{autoGenerateHelperMessage}</p>
          )}
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-white p-1">
        <Link
          href={buildScheduleUrl(activeCycleId, 'week')}
          className={tabClass(viewMode === 'week')}
        >
          Week
        </Link>
        {canViewMonth ? (
          <Link
            href={buildScheduleUrl(activeCycleId, 'calendar')}
            className={tabClass(viewMode === 'calendar')}
          >
            Month
          </Link>
        ) : (
          <span className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/70">
            Month
          </span>
        )}
      </nav>

      <Dialog
        open={publishDialogOpen}
        onOpenChange={(open) => {
          setPublishDialogOpen(open)
          if (!open) setPublishConfirmationText('')
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm publish</DialogTitle>
            <DialogDescription>Review this summary before publishing the cycle.</DialogDescription>
          </DialogHeader>

          {publishSummary ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-secondary/30 p-3">
                <p className="font-medium text-foreground">{publishSummary.cycleLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {publishSummary.startDate} to {publishSummary.endDate}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-muted-foreground">
                  Total scheduled shifts:{' '}
                  <span className="font-medium text-foreground">
                    {publishSummary.totalScheduledShifts}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Day shifts:{' '}
                  <span className="font-medium text-foreground">{publishSummary.dayShifts}</span>
                </p>
                <p className="text-muted-foreground">
                  Night shifts:{' '}
                  <span className="font-medium text-foreground">{publishSummary.nightShifts}</span>
                </p>
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Remaining warnings
                </p>
                <p className="mt-1 text-muted-foreground">
                  Missing leads:{' '}
                  <span className="font-medium text-foreground">{publishSummary.missingLead}</span>
                </p>
                <p className="text-muted-foreground">
                  Under coverage:{' '}
                  <span className="font-medium text-foreground">
                    {publishSummary.underCoverage}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Over coverage:{' '}
                  <span className="font-medium text-foreground">{publishSummary.overCoverage}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cycle summary unavailable.</p>
          )}

          <form action={toggleCyclePublishedAction} className="space-y-3">
            <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
            <input type="hidden" name="view" value={viewMode} />
            <input
              type="hidden"
              name="show_unavailable"
              value={showUnavailable ? 'true' : 'false'}
            />
            <input type="hidden" name="currently_published" value="false" />
            <input type="hidden" name="override_weekly_rules" value="false" />

            <div className="space-y-1">
              <label
                htmlFor="publish-confirmation"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Type PUBLISH to confirm
              </label>
              <Input
                id="publish-confirmation"
                value={publishConfirmationText}
                onChange={(event) => setPublishConfirmationText(event.target.value)}
                placeholder="PUBLISH"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <FormSubmitButton
                type="button"
                variant="outline"
                onClick={() => setPublishDialogOpen(false)}
              >
                Cancel
              </FormSubmitButton>
              <FormSubmitButton
                type="submit"
                disabled={!publishConfirmEnabled}
                pendingText="Publishing..."
              >
                Confirm publish cycle
              </FormSubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
