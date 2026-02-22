import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { MoreActionsMenu } from '@/components/more-actions-menu'
import { PrintMenuItem } from '@/components/print-menu-item'
import { Button } from '@/components/ui/button'
import { buildScheduleUrl } from '@/lib/schedule-helpers'

type Role = 'manager' | 'therapist'
type ViewMode = 'grid' | 'list' | 'calendar'

type ScheduleHeaderProps = {
  role: Role
  viewMode: ViewMode
  activeCycleId?: string
  activeCyclePublished: boolean
  showUnavailable?: boolean
  title: string
  description: string
  toggleCyclePublishedAction: (formData: FormData) => void | Promise<void>
  generateDraftScheduleAction: (formData: FormData) => void | Promise<void>
  resetDraftScheduleAction: (formData: FormData) => void | Promise<void>
}

const menuActionClass = 'block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50'

function tabClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground'
  }

  return 'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground'
}

export function ScheduleHeader({
  role,
  viewMode,
  activeCycleId,
  activeCyclePublished,
  showUnavailable = false,
  title,
  description,
  toggleCyclePublishedAction,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
}: ScheduleHeaderProps) {
  const hasActiveCycle = Boolean(activeCycleId)
  const canPublish = hasActiveCycle && !activeCyclePublished

  return (
    <div className="no-print space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="app-page-title">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {role === 'manager' && (
            <>
              <form action={toggleCyclePublishedAction}>
                <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                <input type="hidden" name="view" value={viewMode} />
                <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />
                <input type="hidden" name="currently_published" value="false" />
                <input type="hidden" name="override_weekly_rules" value="false" />
                <Button type="submit" disabled={!canPublish}>
                  Publish
                </Button>
              </form>

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
                    <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />
                    <input type="hidden" name="currently_published" value="false" />
                    <input type="hidden" name="override_weekly_rules" value="true" />
                    <button type="submit" className={menuActionClass} disabled={!canPublish}>
                      Publish with overrides
                    </button>
                  </form>
                  <form action={toggleCyclePublishedAction}>
                    <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                    <input type="hidden" name="view" value={viewMode} />
                    <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />
                    <input type="hidden" name="currently_published" value="false" />
                    <input type="hidden" name="override_weekly_rules" value="false" />
                    <button type="submit" className={menuActionClass} disabled={!canPublish}>
                      Publish draft
                    </button>
                  </form>
                </div>
              </details>
            </>
          )}

          <MoreActionsMenu>
            {role === 'manager' && (
              <form action={generateDraftScheduleAction}>
                <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                <input type="hidden" name="view" value={viewMode} />
                <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />
                <button type="submit" className={menuActionClass} disabled={!hasActiveCycle || activeCyclePublished}>
                  Auto-generate draft
                </button>
              </form>
            )}
            {role === 'manager' && (
              <form action={resetDraftScheduleAction}>
                <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                <input type="hidden" name="view" value={viewMode} />
                <input type="hidden" name="show_unavailable" value={showUnavailable ? 'true' : 'false'} />
                <button
                  type="submit"
                  className={`${menuActionClass} text-[var(--warning-text)]`}
                  disabled={!hasActiveCycle || activeCyclePublished}
                >
                  Clear draft and start over
                </button>
              </form>
            )}
            <PrintMenuItem />
          </MoreActionsMenu>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-white p-1">
        <Link href={buildScheduleUrl(activeCycleId, 'grid')} className={tabClass(viewMode === 'grid')}>
          Grid
        </Link>
        <Link href={buildScheduleUrl(activeCycleId, 'list')} className={tabClass(viewMode === 'list')}>
          List
        </Link>
        {role === 'manager' ? (
          <Link href={buildScheduleUrl(activeCycleId, 'calendar')} className={tabClass(viewMode === 'calendar')}>
            Month
          </Link>
        ) : (
          <span className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/70">Month</span>
        )}
      </nav>
    </div>
  )
}
