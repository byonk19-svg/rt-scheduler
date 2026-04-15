'use client'

import { cn } from '@/lib/utils'

import type { TeamSummaryCounts } from '@/components/team/team-directory-model'

export type DirectoryChipFilter =
  | 'all'
  | 'managers'
  | 'leads'
  | 'therapists'
  | 'day'
  | 'night'
  | 'inactive'
  | 'fmla'

type TeamDirectorySummaryChipsProps = {
  summary: TeamSummaryCounts
  activeChip: DirectoryChipFilter
  onChipChange: (chip: DirectoryChipFilter) => void
}

function Chip({
  label,
  value,
  selected,
  onClick,
}: {
  label: string
  value: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected
          ? 'border-primary/70 bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]'
          : 'border-border/70 bg-card text-muted-foreground hover:border-primary/35 hover:bg-muted/30 hover:text-foreground'
      )}
    >
      <span>{label}</span>
      <span className={cn('tabular-nums', selected ? 'text-primary' : 'text-foreground/90')}>
        {value}
      </span>
    </button>
  )
}

export function TeamDirectorySummaryChips({
  summary,
  activeChip,
  onChipChange,
}: TeamDirectorySummaryChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Team summary">
      <Chip
        label="Total"
        value={summary.totalStaff}
        selected={activeChip === 'all'}
        onClick={() => onChipChange('all')}
      />
      <Chip
        label="Managers"
        value={summary.managers}
        selected={activeChip === 'managers'}
        onClick={() => onChipChange('managers')}
      />
      <Chip
        label="Lead therapists"
        value={summary.leadTherapists}
        selected={activeChip === 'leads'}
        onClick={() => onChipChange('leads')}
      />
      <Chip
        label="Therapists"
        value={summary.therapists}
        selected={activeChip === 'therapists'}
        onClick={() => onChipChange('therapists')}
      />
      <Chip
        label="Day shift"
        value={summary.dayShift}
        selected={activeChip === 'day'}
        onClick={() => onChipChange('day')}
      />
      <Chip
        label="Night shift"
        value={summary.nightShift}
        selected={activeChip === 'night'}
        onClick={() => onChipChange('night')}
      />
      {summary.inactive > 0 && (
        <Chip
          label="Inactive"
          value={summary.inactive}
          selected={activeChip === 'inactive'}
          onClick={() => onChipChange('inactive')}
        />
      )}
      {summary.onFmla > 0 && (
        <Chip
          label="FMLA"
          value={summary.onFmla}
          selected={activeChip === 'fmla'}
          onClick={() => onChipChange('fmla')}
        />
      )}
    </div>
  )
}
