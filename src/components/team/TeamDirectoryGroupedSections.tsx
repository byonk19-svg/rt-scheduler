'use client'

import { TeamDirectoryGroupSection } from '@/components/team/TeamDirectoryGroupSection'
import { TeamDirectoryGroupRows } from '@/components/team/TeamDirectoryGroupRows'
import type { TeamProfileRecord } from '@/components/team/team-directory-model'
import { cn } from '@/lib/utils'

type TeamDirectorySectionKey =
  | 'managers'
  | 'dayLeads'
  | 'dayTherapists'
  | 'nightLeads'
  | 'nightTherapists'
  | 'inactive'

type TeamSections = Record<TeamDirectorySectionKey, TeamProfileRecord[]>
type TeamDirectorySectionOpenState = Record<TeamDirectorySectionKey, boolean>

export function TeamDirectoryGroupedSections({
  bulkMode,
  effectiveSectionOpenState,
  hasActiveFilters,
  onOpenEditor,
  onToggleGroupSelected,
  onToggleSection,
  onToggleSelected,
  sections,
  selectedIds,
}: {
  bulkMode: boolean
  effectiveSectionOpenState: TeamDirectorySectionOpenState
  hasActiveFilters: boolean
  onOpenEditor: (id: string) => void
  onToggleGroupSelected: (ids: string[], checked: boolean) => void
  onToggleSection: (sectionKey: TeamDirectorySectionKey, nextOpen: boolean) => void
  onToggleSelected: (id: string) => void
  sections: TeamSections
  selectedIds: Set<string>
}) {
  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border border-border/60 bg-card/30 p-2',
        selectedIds.size > 0 && 'pb-24'
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground">Grouped staff directory</h2>
        {hasActiveFilters ? (
          <span className="text-xs font-medium text-muted-foreground">Filtered view</span>
        ) : null}
      </div>

      <TeamDirectoryGroupSection
        sectionKey="managers"
        title="Managers"
        count={sections.managers.length}
        isOpen={effectiveSectionOpenState.managers}
        onToggle={onToggleSection}
        showSelectionControls={bulkMode}
        allSelected={
          sections.managers.length > 0 &&
          sections.managers.every((profile) => selectedIds.has(profile.id))
        }
        onToggleSelectAll={(checked) =>
          onToggleGroupSelected(
            sections.managers.map((profile) => profile.id),
            checked
          )
        }
      >
        <TeamDirectoryGroupRows
          profiles={sections.managers}
          onOpen={onOpenEditor}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          showSelectionControls={bulkMode}
        />
      </TeamDirectoryGroupSection>

      <TeamDirectoryGroupSection
        sectionKey="dayLeads"
        title="Day shift leads"
        count={sections.dayLeads.length}
        isOpen={effectiveSectionOpenState.dayLeads}
        onToggle={onToggleSection}
        showSelectionControls={bulkMode}
        allSelected={
          sections.dayLeads.length > 0 &&
          sections.dayLeads.every((profile) => selectedIds.has(profile.id))
        }
        onToggleSelectAll={(checked) =>
          onToggleGroupSelected(
            sections.dayLeads.map((profile) => profile.id),
            checked
          )
        }
      >
        <TeamDirectoryGroupRows
          profiles={sections.dayLeads}
          onOpen={onOpenEditor}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          showSelectionControls={bulkMode}
        />
      </TeamDirectoryGroupSection>

      <TeamDirectoryGroupSection
        sectionKey="dayTherapists"
        title="Day shift therapists"
        count={sections.dayTherapists.length}
        isOpen={effectiveSectionOpenState.dayTherapists}
        onToggle={onToggleSection}
        showSelectionControls={bulkMode}
        allSelected={
          sections.dayTherapists.length > 0 &&
          sections.dayTherapists.every((profile) => selectedIds.has(profile.id))
        }
        onToggleSelectAll={(checked) =>
          onToggleGroupSelected(
            sections.dayTherapists.map((profile) => profile.id),
            checked
          )
        }
      >
        <TeamDirectoryGroupRows
          profiles={sections.dayTherapists}
          onOpen={onOpenEditor}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          showSelectionControls={bulkMode}
        />
      </TeamDirectoryGroupSection>

      <TeamDirectoryGroupSection
        sectionKey="nightLeads"
        title="Night shift leads"
        count={sections.nightLeads.length}
        isOpen={effectiveSectionOpenState.nightLeads}
        onToggle={onToggleSection}
        showSelectionControls={bulkMode}
        allSelected={
          sections.nightLeads.length > 0 &&
          sections.nightLeads.every((profile) => selectedIds.has(profile.id))
        }
        onToggleSelectAll={(checked) =>
          onToggleGroupSelected(
            sections.nightLeads.map((profile) => profile.id),
            checked
          )
        }
      >
        <TeamDirectoryGroupRows
          profiles={sections.nightLeads}
          onOpen={onOpenEditor}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          showSelectionControls={bulkMode}
        />
      </TeamDirectoryGroupSection>

      <TeamDirectoryGroupSection
        sectionKey="nightTherapists"
        title="Night shift therapists"
        count={sections.nightTherapists.length}
        isOpen={effectiveSectionOpenState.nightTherapists}
        onToggle={onToggleSection}
        showSelectionControls={bulkMode}
        allSelected={
          sections.nightTherapists.length > 0 &&
          sections.nightTherapists.every((profile) => selectedIds.has(profile.id))
        }
        onToggleSelectAll={(checked) =>
          onToggleGroupSelected(
            sections.nightTherapists.map((profile) => profile.id),
            checked
          )
        }
      >
        <TeamDirectoryGroupRows
          profiles={sections.nightTherapists}
          onOpen={onOpenEditor}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          showSelectionControls={bulkMode}
        />
      </TeamDirectoryGroupSection>

      <TeamDirectoryGroupSection
        sectionKey="inactive"
        title="Inactive and off roster"
        count={sections.inactive.length}
        isOpen={effectiveSectionOpenState.inactive}
        onToggle={onToggleSection}
        showSelectionControls={bulkMode}
        allSelected={
          sections.inactive.length > 0 &&
          sections.inactive.every((profile) => selectedIds.has(profile.id))
        }
        onToggleSelectAll={(checked) =>
          onToggleGroupSelected(
            sections.inactive.map((profile) => profile.id),
            checked
          )
        }
      >
        <TeamDirectoryGroupRows
          profiles={sections.inactive}
          onOpen={onOpenEditor}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
          showSelectionControls={bulkMode}
        />
      </TeamDirectoryGroupSection>
    </div>
  )
}
