'use client'

import { ChevronRight, Shield, User } from 'lucide-react'

import { formatEmployeeDate } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'

import {
  TEAM_LEAD_ROLE_LABEL,
  teamMemberHasAppAccess,
  type TeamProfileRecord,
} from '@/components/team/team-directory-model'

function initials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function employmentLabel(type: TeamProfileRecord['employment_type']): string {
  if (type === 'part_time') return 'Part-time'
  if (type === 'prn') return 'PRN'
  return 'Full-time'
}

function roleLabel(role: TeamProfileRecord['role']): string {
  if (role === 'manager') return 'Manager'
  if (role === 'lead') return TEAM_LEAD_ROLE_LABEL
  return 'Therapist'
}

function roleBadgeClass(role: TeamProfileRecord['role']): string {
  if (role === 'manager') return 'bg-secondary text-secondary-foreground'
  if (role === 'lead') return 'bg-primary/10 text-primary'
  return 'bg-muted text-muted-foreground'
}

function shiftLabel(type: TeamProfileRecord['shift_type']): string {
  return type === 'night' ? 'Night shift' : 'Day shift'
}

type TeamPersonRowProps = {
  profile: TeamProfileRecord
  onOpen: (profileId: string) => void
  isSelected?: boolean
  onToggle?: () => void
  showSelectionControl?: boolean
}

export function TeamPersonRow({
  profile,
  onOpen,
  isSelected = false,
  onToggle,
  showSelectionControl = false,
}: TeamPersonRowProps) {
  const isActive = teamMemberHasAppAccess(profile)
  const showLeadEligibleTag = profile.role === 'therapist' && profile.is_lead_eligible

  const row = (
    <button
      type="button"
      onClick={() => onOpen(profile.id)}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/45 hover:bg-card/95 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        profile.role === 'lead' && 'border-primary/25 bg-primary/[0.03]',
        !isActive && 'opacity-80',
        showSelectionControl && onToggle && isSelected && 'ring-2 ring-primary/25'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          profile.role === 'lead'
            ? 'border border-primary/20 bg-primary/10 text-primary'
            : profile.role === 'manager'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground'
        )}
      >
        {initials(profile.full_name)}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="truncate font-semibold text-foreground">
            {profile.full_name ?? 'Unknown'}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold',
              roleBadgeClass(profile.role)
            )}
          >
            {profile.role === 'lead' ? (
              <Shield className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <User className="h-2.5 w-2.5" aria-hidden />
            )}
            {roleLabel(profile.role)}
          </span>
          {profile.on_fmla && (
            <span className="inline-flex shrink-0 rounded-full bg-[var(--warning-subtle)] px-1.5 py-0 text-[10px] font-medium text-[var(--warning-text)]">
              FMLA
            </span>
          )}
          {!isActive && (
            <span className="inline-flex shrink-0 rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                profile.shift_type === 'night' ? 'bg-[var(--warning)]' : 'bg-[var(--info)]'
              )}
            />
            {shiftLabel(profile.shift_type)}
          </span>
          <span className="text-border">·</span>
          <span>{employmentLabel(profile.employment_type)}</span>
          {showLeadEligibleTag && (
            <>
              <span className="text-border">·</span>
              <span className="truncate">Lead eligible</span>
            </>
          )}
          {profile.on_fmla && profile.fmla_return_date && (
            <>
              <span className="text-border">·</span>
              <span className="shrink-0">
                Return {formatEmployeeDate(profile.fmla_return_date)}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary/60 group-focus-visible:text-primary/70"
        aria-hidden
      />
    </button>
  )

  if (!showSelectionControl || !onToggle) return row

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        className="h-11 w-11 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring sm:h-6 sm:w-6"
        checked={isSelected}
        onChange={() => onToggle()}
        aria-label={`Select ${profile.full_name ?? 'team member'}`}
      />
      <div className="min-w-0 flex-1">{row}</div>
    </div>
  )
}
