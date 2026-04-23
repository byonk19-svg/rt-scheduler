'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { EMPLOYEE_META_BADGE_CLASS, LEAD_ELIGIBLE_BADGE_CLASS } from '@/lib/employee-tag-badges'
import { cn } from '@/lib/utils'

export function ProfileSummaryCard({
  canAccessManagerUi,
  email,
  employmentType,
  fullName,
  isTherapist,
  leadEligible,
  role,
  shiftType,
  weeklyLimit,
}: {
  canAccessManagerUi: boolean
  email: string
  employmentType: 'full_time' | 'part_time' | 'prn'
  fullName: string
  isTherapist: boolean
  leadEligible: boolean
  role: string
  shiftType: 'day' | 'night'
  weeklyLimit: number
}) {
  return (
    <>
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <div className="mb-3">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your account details and role configuration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="neutral" className="capitalize">
            {role}
          </StatusBadge>
          <StatusBadge variant="neutral" className="capitalize">
            {shiftType} shift
          </StatusBadge>
          <StatusBadge variant="neutral" className="capitalize">
            {employmentType.replace('_', ' ')}
          </StatusBadge>
          {isTherapist ? <StatusBadge variant="neutral">Max {weeklyLimit}/week</StatusBadge> : null}
        </div>
      </div>

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
          <CardDescription>
            Account and staffing metadata used across scheduling tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                canAccessManagerUi
                  ? cn(
                      'capitalize',
                      'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                    )
                  : 'capitalize'
              }
            >
              {role}
            </Badge>
            <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
              {shiftType} shift
            </Badge>
            <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
              {employmentType.replace('_', ' ')}
            </Badge>
            {isTherapist ? (
              <Badge
                variant={leadEligible ? 'default' : 'outline'}
                className={leadEligible ? LEAD_ELIGIBLE_BADGE_CLASS : undefined}
              >
                {leadEligible ? 'Lead' : 'Staff only'}
              </Badge>
            ) : null}
            {isTherapist ? <Badge variant="outline">Max {weeklyLimit}/week</Badge> : null}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
