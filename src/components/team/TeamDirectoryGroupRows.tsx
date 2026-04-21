'use client'

import { TeamPersonRow } from '@/components/team/team-person-row'
import type { TeamProfileRecord } from '@/components/team/team-directory-model'

export function TeamDirectoryGroupRows({
  onOpen,
  onToggleSelected,
  profiles,
  selectedIds,
  showSelectionControls,
}: {
  onOpen: (id: string) => void
  onToggleSelected: (id: string) => void
  profiles: TeamProfileRecord[]
  selectedIds: Set<string>
  showSelectionControls: boolean
}) {
  if (profiles.length === 0) return null

  return profiles.map((profile) => (
    <TeamPersonRow
      key={profile.id}
      profile={profile}
      onOpen={onOpen}
      isSelected={selectedIds.has(profile.id)}
      onToggle={() => onToggleSelected(profile.id)}
      showSelectionControl={showSelectionControls}
    />
  ))
}
