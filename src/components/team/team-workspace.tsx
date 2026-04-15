'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { EmployeeRosterPanel } from '@/components/team/EmployeeRosterPanel'
import {
  TeamDirectory,
  type TeamProfileRecord,
  type WorkPatternRecord,
} from '@/components/team/TeamDirectory'
import type { EmployeeRosterTableRow } from '@/components/team/employee-roster-table'
import type { TeamSummaryCounts } from '@/components/team/team-directory-model'
import { cn } from '@/lib/utils'

export type TeamWorkspaceTab = 'directory' | 'roster'

type TeamWorkspaceProps = {
  summary: TeamSummaryCounts
  profiles: TeamProfileRecord[]
  workPatterns: Record<string, WorkPatternRecord>
  initialEditProfileId: string | null
  roster: EmployeeRosterTableRow[]
  archiveTeamMemberAction: (formData: FormData) => void | Promise<void>
  saveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
  upsertEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
  bulkUpsertEmployeeRosterAction: (formData: FormData) => void | Promise<void>
  replaceTherapistRosterAction: (formData: FormData) => void | Promise<void>
  deleteEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
}

function tabFromSearch(searchParams: URLSearchParams): TeamWorkspaceTab {
  return searchParams.get('tab') === 'roster' ? 'roster' : 'directory'
}

export function TeamWorkspace({
  summary,
  profiles,
  workPatterns,
  initialEditProfileId,
  roster,
  archiveTeamMemberAction,
  saveTeamQuickEditAction,
  upsertEmployeeRosterEntryAction,
  bulkUpsertEmployeeRosterAction,
  replaceTherapistRosterAction,
  deleteEmployeeRosterEntryAction,
}: TeamWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = tabFromSearch(searchParams)

  const setTab = useCallback(
    (next: TeamWorkspaceTab) => {
      const nextParams = new URLSearchParams(searchParams.toString())
      if (next === 'directory') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', 'roster')
      }
      const qs = nextParams.toString()
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Team workspace"
        className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/20 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'directory'}
          id="team-tab-directory"
          aria-controls="team-panel-directory"
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'directory'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setTab('directory')}
        >
          Team directory
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roster'}
          id="team-tab-roster"
          aria-controls="team-panel-roster"
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'roster'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setTab('roster')}
        >
          Roster admin
        </button>
      </div>

      <div
        id="team-panel-directory"
        role="tabpanel"
        aria-labelledby="team-tab-directory"
        hidden={activeTab !== 'directory'}
        className={activeTab === 'directory' ? 'space-y-4' : 'hidden'}
      >
        <TeamDirectory
          summary={summary}
          profiles={profiles}
          workPatterns={workPatterns}
          initialEditProfileId={initialEditProfileId}
          archiveTeamMemberAction={archiveTeamMemberAction}
          saveTeamQuickEditAction={saveTeamQuickEditAction}
        />
      </div>

      <div
        id="team-panel-roster"
        role="tabpanel"
        aria-labelledby="team-tab-roster"
        hidden={activeTab !== 'roster'}
        className={activeTab === 'roster' ? 'space-y-4' : 'hidden'}
      >
        <EmployeeRosterPanel
          roster={roster}
          upsertEmployeeRosterEntryAction={upsertEmployeeRosterEntryAction}
          bulkUpsertEmployeeRosterAction={bulkUpsertEmployeeRosterAction}
          replaceTherapistRosterAction={replaceTherapistRosterAction}
          deleteEmployeeRosterEntryAction={deleteEmployeeRosterEntryAction}
        />
      </div>
    </div>
  )
}
