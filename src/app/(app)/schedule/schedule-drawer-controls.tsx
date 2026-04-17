'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { FormSubmitButton } from '@/components/form-submit-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { buildScheduleUrl } from '@/lib/schedule-helpers'
import type { Cycle, ViewMode } from '@/app/schedule/types'

type ActivePanel = 'setup' | null

type ScheduleDrawerControlsProps = {
  cycles: Cycle[]
  activeCycleId?: string
  viewMode: ViewMode
  showUnavailable: boolean
  activePanel: ActivePanel
  inlineErrorMessage?: string
  createCycleAction: (formData: FormData) => void | Promise<void>
}

export function ScheduleDrawerControls({
  cycles,
  activeCycleId,
  viewMode,
  showUnavailable,
  activePanel,
  inlineErrorMessage,
  createCycleAction,
}: ScheduleDrawerControlsProps) {
  const router = useRouter()

  const baseParams = showUnavailable ? { show_unavailable: 'true' } : undefined
  const baseUrl = buildScheduleUrl(activeCycleId, viewMode, baseParams)

  function closePanel() {
    router.push(baseUrl)
  }

  return (
    <>
      <Dialog open={activePanel === 'setup'} onOpenChange={(open) => !open && closePanel()}>
        <DialogContent
          showCloseButton
          className="top-0 right-0 left-auto h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 rounded-none border-l p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:duration-300 data-[state=closed]:duration-200"
        >
          <div className="h-full space-y-6 overflow-y-auto p-6">
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Coverage Setup</DialogTitle>
                <DialogDescription>
                  Select a cycle, create a new one, and adjust advanced visibility options.
                </DialogDescription>
              </DialogHeader>

              {inlineErrorMessage && (
                <p className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                  {inlineErrorMessage}
                </p>
              )}
            </div>

            <section className="space-y-3">
              <h3 className="app-section-title">Cycle Selection</h3>
              {cycles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No schedule cycles yet. Create your first cycle below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cycles.map((cycle) => {
                    const isActive = activeCycleId === cycle.id
                    return (
                      <Button
                        asChild
                        key={cycle.id}
                        variant="outline"
                        size="sm"
                        className={
                          isActive ? 'border-primary/40 bg-secondary text-foreground' : undefined
                        }
                      >
                        <Link href={buildScheduleUrl(cycle.id, viewMode, baseParams)}>
                          {cycle.label} ({cycle.start_date} to {cycle.end_date})
                        </Link>
                      </Button>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h3 className="app-section-title">Create Schedule Cycle</h3>
              <form action={createCycleAction} className="space-y-4">
                <input type="hidden" name="view" value={viewMode} />
                <input type="hidden" name="panel" value="setup" />
                <div className="space-y-2">
                  <Label htmlFor="drawer-cycle-label">Label</Label>
                  <Input
                    id="drawer-cycle-label"
                    name="label"
                    placeholder="Mar 1 - Apr 12"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="drawer-cycle-start-date">Start Date</Label>
                    <Input id="drawer-cycle-start-date" name="start_date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="drawer-cycle-end-date">End Date</Label>
                    <Input id="drawer-cycle-end-date" name="end_date" type="date" required />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="published" />
                  Publish immediately
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="copy_from_last_cycle" />
                  Copy shift assignments from last cycle
                </label>
                <p className="text-xs text-muted-foreground">
                  Imported cycles are created as drafts and skip inactive or FMLA employees.
                </p>
                <FormSubmitButton type="submit" pendingText="Creating...">
                  Create cycle
                </FormSubmitButton>
              </form>
            </section>

            <section className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
              <h3 className="app-section-title">Advanced</h3>
              <p className="text-xs text-muted-foreground">
                {showUnavailable
                  ? 'Unavailable employees (FMLA/inactive) are currently visible in assignment pickers.'
                  : 'Unavailable employees (FMLA/inactive) are hidden in assignment pickers.'}
              </p>
              <Button asChild size="sm" variant="ghost" className="px-2">
                <Link
                  href={buildScheduleUrl(activeCycleId, viewMode, {
                    panel: 'setup',
                    show_unavailable: showUnavailable ? 'false' : 'true',
                  })}
                >
                  {showUnavailable ? 'Hide unavailable' : 'Show unavailable'}
                </Link>
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
