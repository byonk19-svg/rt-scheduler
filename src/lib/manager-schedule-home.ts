import { formatHumanCycleRange } from '@/lib/calendar-utils'
import type { ManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'
import type { StatusBadgeVariant } from '@/components/ui/status-badge'

export type ManagerScheduleHomeMetric = {
  label: string
  value: string
  detail: string
  tone: StatusBadgeVariant
}

export type ManagerScheduleHomeLink = {
  label: string
  href: string
  description: string
  status: string
  tone: StatusBadgeVariant
}

export type ManagerScheduleHomeAction = {
  label: string
  href: string
  description: string
}

export type ManagerScheduleHomeModel = {
  cycleLabel: string
  cycleRange: string | null
  cycleStatus: string
  cycleStatusTone: StatusBadgeVariant
  summary: string
  primaryAction: ManagerScheduleHomeAction
  blockers: ManagerScheduleHomeMetric[]
  workflowCards: ManagerScheduleHomeLink[]
  secondaryLinks: ManagerScheduleHomeLink[]
}

function toCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function buildManagerScheduleHomeModel(
  snapshot: ManagerAttentionSnapshot
): ManagerScheduleHomeModel {
  const activeCycle = snapshot.activeCycle
  const cycleRange = activeCycle
    ? formatHumanCycleRange(activeCycle.start_date, activeCycle.end_date)
    : null

  const primaryAction = !activeCycle
    ? {
        label: 'Create next 6-week block',
        href: '/coverage',
        description:
          'There is no active cycle yet, so the next step is starting the scheduling block.',
      }
    : snapshot.coverageIssues > 0
      ? {
          label: 'Continue staffing current block',
          href: snapshot.resolveBlockersLink,
          description: 'Coverage blockers are preventing this cycle from being publish-ready.',
        }
      : snapshot.pendingApprovals > 0
        ? {
            label: 'Review pending approvals',
            href: snapshot.links.approvalsPending,
            description:
              'Coverage is in better shape, but approvals still need a decision before publish.',
          }
        : snapshot.publishReady
          ? {
              label: 'Finalize schedule',
              href: '/publish',
              description:
                'Coverage and approvals are clear. Finalize the schedule and review delivery history if needed.',
            }
          : {
              label: 'Review current schedule',
              href: snapshot.links.coverage,
              description:
                'Open the detailed staffing workspace to continue reviewing the active block.',
            }

  const blockers: ManagerScheduleHomeMetric[] = [
    {
      label: 'Coverage issues',
      value: String(snapshot.coverageIssues),
      detail:
        snapshot.coverageIssues === 0
          ? 'No staffing blockers'
          : toCountLabel(snapshot.coverageIssues, 'blocker', 'blockers'),
      tone: snapshot.coverageIssues === 0 ? 'success' : 'warning',
    },
    {
      label: 'Missing lead days',
      value: String(snapshot.missingLeadShifts),
      detail:
        snapshot.missingLeadShifts === 0
          ? 'Lead coverage clear'
          : toCountLabel(snapshot.missingLeadShifts, 'day missing a lead', 'days missing a lead'),
      tone: snapshot.missingLeadShifts === 0 ? 'success' : 'warning',
    },
    {
      label: 'Pending approvals',
      value: String(snapshot.pendingApprovals),
      detail:
        snapshot.pendingApprovals === 0
          ? 'No pending review'
          : toCountLabel(snapshot.pendingApprovals, 'request waiting', 'requests waiting'),
      tone: snapshot.pendingApprovals === 0 ? 'success' : 'pending',
    },
    {
      label: 'Publish readiness',
      value: snapshot.publishReady ? 'Ready' : 'Blocked',
      detail: snapshot.publishReady
        ? 'No blocker is preventing publish'
        : 'Resolve staffing or approvals before publish',
      tone: snapshot.publishReady ? 'success' : 'warning',
    },
  ]

  const workflowCards: ManagerScheduleHomeLink[] = [
    {
      label: 'Coverage',
      href: snapshot.links.coverage,
      description: 'Work the staffing grid and resolve daily coverage gaps.',
      status:
        snapshot.coverageIssues === 0
          ? 'Coverage clear'
          : toCountLabel(snapshot.coverageIssues, 'blocker', 'blockers'),
      tone: snapshot.coverageIssues === 0 ? 'success' : 'warning',
    },
    {
      label: 'Approvals',
      href: snapshot.links.approvalsPending,
      description: 'Review preliminary requests and other approval decisions.',
      status:
        snapshot.pendingApprovals === 0
          ? 'No pending approvals'
          : toCountLabel(snapshot.pendingApprovals, 'pending request', 'pending requests'),
      tone: snapshot.pendingApprovals === 0 ? 'success' : 'pending',
    },
    {
      label: 'Lottery',
      href: MANAGER_WORKFLOW_LINKS.lottery,
      description:
        'Review same-day low-census requests, confirm the fixed order, and apply on-call reductions.',
      status: activeCycle ? 'Manager workflow' : 'No active cycle selected',
      tone: activeCycle ? 'info' : 'neutral',
    },
    {
      label: 'Publish',
      href: '/publish',
      description: 'Finalize the active block and confirm the live schedule state.',
      status: snapshot.publishReady ? 'Ready to finalize' : 'Blocked by open issues',
      tone: snapshot.publishReady ? 'success' : 'warning',
    },
    {
      label: 'Availability',
      href: '/availability',
      description: 'Review availability planning details and therapist responses for this cycle.',
      status: activeCycle ? 'Cycle inputs available' : 'No active cycle selected',
      tone: activeCycle ? 'info' : 'neutral',
    },
  ]

  const secondaryLinks: ManagerScheduleHomeLink[] = [
    {
      label: 'Roster',
      href: '/coverage?view=roster',
      description: 'Open the roster layout inside the main schedule workspace.',
      status: 'Reference view',
      tone: 'neutral',
    },
    {
      label: 'Delivery history',
      href: '/publish/history',
      description:
        'Review delivery logs and archived publish activity outside the finalization step.',
      status: 'Supporting history',
      tone: 'neutral',
    },
    {
      label: 'Analytics',
      href: '/analytics',
      description: 'Review fill-rate and force-date insight outside the active staffing loop.',
      status: 'Supporting insight',
      tone: 'neutral',
    },
  ]

  return {
    cycleLabel: activeCycle?.label ?? 'No active cycle',
    cycleRange,
    cycleStatus: !activeCycle
      ? 'No active cycle'
      : snapshot.publishReady
        ? 'Ready to finalize'
        : snapshot.coverageIssues > 0
          ? 'Needs staffing'
          : snapshot.pendingApprovals > 0
            ? 'Waiting on approvals'
            : activeCycle.published
              ? 'Published'
              : 'In progress',
    cycleStatusTone: !activeCycle
      ? 'warning'
      : snapshot.publishReady
        ? 'success'
        : snapshot.coverageIssues > 0 || snapshot.pendingApprovals > 0
          ? 'warning'
          : 'info',
    summary: !activeCycle
      ? 'Start the next 6-week block to begin scheduling work.'
      : primaryAction.description,
    primaryAction,
    blockers,
    workflowCards,
    secondaryLinks,
  }
}
