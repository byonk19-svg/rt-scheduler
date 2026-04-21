import Link from 'next/link'
import { ChevronRight, Send, Sparkles } from 'lucide-react'

import { StatusPill } from '@/components/coverage/AssignmentStatusPopover'
import {
  CoverageSurfaceBanner,
  type WorkspaceMetricTone,
} from '@/components/coverage/coverage-workspace-chrome'
import { Button } from '@/components/ui/button'

export function CoverageWorkspaceBanners({
  activeCycleId,
  activeCyclePublished,
  canManageCoverage,
  canRunAutoDraft,
  canStartFromTemplate,
  nextActionLabel,
  noCycleSelected,
  planningNotices,
  preliminaryLive,
  preliminarySentLabel,
  publishAction,
  publishOverrideConfig,
  renderedViewMode,
  showEmptyDraftState,
  showPlanningDetails,
  weekRosterHref,
  workspaceStatusTone,
  onAssignFirstDay,
  onOpenCycleDialog,
  onOpenPreflight,
  onOpenTemplateTarget,
  onTogglePlanningDetails,
}: {
  activeCycleId: string | null
  activeCyclePublished: boolean
  canManageCoverage: boolean
  canRunAutoDraft: boolean
  canStartFromTemplate: boolean
  nextActionLabel: string
  noCycleSelected: boolean
  planningNotices: string[]
  preliminaryLive: boolean
  preliminarySentLabel: string | null
  publishAction: (formData: FormData) => void | Promise<void>
  publishOverrideConfig:
    | {
        weekly: string
        shift: string
        label: string
        description: string
      }
    | null
  renderedViewMode: 'week' | 'roster'
  showEmptyDraftState: boolean
  showPlanningDetails: boolean
  weekRosterHref: string
  workspaceStatusTone: WorkspaceMetricTone
  onAssignFirstDay: () => void
  onOpenCycleDialog: () => void
  onOpenPreflight: () => void
  onOpenTemplateTarget: () => void
  onTogglePlanningDetails: () => void
}) {
  return (
    <div className="space-y-2">
      {!noCycleSelected ? (
        <CoverageSurfaceBanner
          tone={workspaceStatusTone}
          title="Next step"
          description={nextActionLabel}
          actions={
            planningNotices.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={onTogglePlanningDetails}>
                {showPlanningDetails ? 'Hide details' : `Show details (${planningNotices.length})`}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {activeCyclePublished ? (
        <>
          <CoverageSurfaceBanner
            tone="success"
            title="Live schedule"
            description="Staff see operational status updates as you save. Operational updates visible to everyone: on-call, leave early, cancelled, and call-in."
            actions={
              <Link
                href={weekRosterHref}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[var(--success-text)] underline-offset-2 transition-colors hover:underline"
              >
                View published schedule
                <ChevronRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
              </Link>
            }
          />
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Operational updates visible to everyone:
            </span>
            <StatusPill status="oncall" />
            <StatusPill status="leave_early" />
            <StatusPill status="cancelled" />
            <StatusPill status="call_in" />
          </div>
        </>
      ) : null}

      {showPlanningDetails && planningNotices.length > 0 ? (
        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
          <ul className="space-y-1 text-xs text-foreground/85">
            {planningNotices.map((notice) => (
              <li key={notice} className="leading-5">
                {notice}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManageCoverage && publishOverrideConfig && !activeCyclePublished ? (
        <CoverageSurfaceBanner
          tone="warning"
          title="Override publish block"
          description={publishOverrideConfig.description}
          actions={
            <form action={publishAction}>
              <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
              <input type="hidden" name="view" value="week" />
              <input type="hidden" name="show_unavailable" value="false" />
              <input
                type="hidden"
                name="currently_published"
                value={activeCyclePublished ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="override_weekly_rules"
                value={publishOverrideConfig.weekly}
              />
              <input
                type="hidden"
                name="override_shift_rules"
                value={publishOverrideConfig.shift}
              />
              <input type="hidden" name="return_to" value="coverage" />
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" />
                {publishOverrideConfig.label}
              </Button>
            </form>
          }
        />
      ) : null}

      {preliminaryLive && !activeCyclePublished ? (
        <CoverageSurfaceBanner
          tone="neutral"
          title={`Preliminary schedule is live${preliminarySentLabel ? ` as of ${preliminarySentLabel}` : ''}.`}
          description="Therapists can review tentative shifts, claim open help-needed slots, and send change requests while you keep approval control."
        />
      ) : null}

      {noCycleSelected ? (
        <CoverageSurfaceBanner
          title={canManageCoverage ? 'Ready to build your first cycle' : 'No team schedule yet'}
          description={
            canManageCoverage
              ? '6-week cycles are your scheduling windows. Create one to open the planning surface and start staffing.'
              : 'Nothing is wrong with your account. A manager has not created a schedule block yet — the team calendar will appear here when they do. Your published shifts are always available under My shifts.'
          }
          actions={
            canManageCoverage ? (
              <>
                <Button type="button" size="sm" className="gap-1.5" onClick={onOpenCycleDialog}>
                  <Sparkles className="h-3.5 w-3.5" />
                  New 6-week block
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/publish/history">Delivery history</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/staff/my-schedule">My shifts</Link>
              </Button>
            )
          }
        />
      ) : showEmptyDraftState ? (
        <CoverageSurfaceBanner
          tone="warning"
          title={canManageCoverage ? 'No shifts assigned yet' : 'No staffing published yet'}
          description={
            canManageCoverage
              ? renderedViewMode === 'roster'
                ? 'No shifts assigned yet. Run Auto-draft or open the first day to assign.'
                : 'No shifts assigned yet. Run Auto-draft or click a day to assign manually.'
              : 'This schedule block exists, but no staffing has been published yet.'
          }
          actions={
            canManageCoverage ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={!canRunAutoDraft}
                  onClick={onOpenPreflight}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onAssignFirstDay}
                >
                  {renderedViewMode === 'roster' ? 'Open first day' : 'Assign manually'}
                </Button>
                {canStartFromTemplate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={onOpenTemplateTarget}
                  >
                    Start from template
                  </Button>
                ) : null}
              </>
            ) : undefined
          }
        />
      ) : null}
    </div>
  )
}
