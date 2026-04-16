'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

import type { TeamProfileRecord, WorkPatternRecord } from '@/components/team/TeamDirectory'
import type { EmployeeRosterTableRow } from '@/components/team/employee-roster-table'
import type { TeamSummaryCounts } from '@/components/team/team-directory-model'
import { cn } from '@/lib/utils'

const TeamDirectory = dynamic(() =>
  import('@/components/team/TeamDirectory').then((module) => module.TeamDirectory)
)
const EmployeeRosterPanel = dynamic(() =>
  import('@/components/team/EmployeeRosterPanel').then((module) => module.EmployeeRosterPanel)
)

export type TeamWorkspaceTab = 'directory' | 'roster'

type TeamWorkspaceClientProps = {
  initialTab: TeamWorkspaceTab
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

function TeamWorkspaceClient({
  initialTab,
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
}: TeamWorkspaceClientProps) {
  const [activeTab, setActiveTab] = useState<TeamWorkspaceTab>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const setTab = useCallback((next: TeamWorkspaceTab) => {
    setActiveTab(next)
    if (typeof window === 'undefined') return
    const nextParams = new URLSearchParams(window.location.search)
    if (next === 'directory') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', 'roster')
    }
    const qs = nextParams.toString()
    const nextUrl = qs.length > 0 ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [])

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

      {activeTab === 'directory' ? (
        <div
          id="team-panel-directory"
          role="tabpanel"
          aria-labelledby="team-tab-directory"
          className="space-y-4"
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
      ) : (
        <div
          id="team-panel-roster"
          role="tabpanel"
          aria-labelledby="team-tab-roster"
          className="space-y-4"
        >
          <EmployeeRosterPanel
            roster={roster}
            upsertEmployeeRosterEntryAction={upsertEmployeeRosterEntryAction}
            bulkUpsertEmployeeRosterAction={bulkUpsertEmployeeRosterAction}
            replaceTherapistRosterAction={replaceTherapistRosterAction}
            deleteEmployeeRosterEntryAction={deleteEmployeeRosterEntryAction}
          />
        </div>
      )}
    </div>
  )
}

export { TeamWorkspaceClient }
export default TeamWorkspaceClient
