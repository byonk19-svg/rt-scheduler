'use client'

import { type ReactNode } from 'react'

import { TeamQuickEditBasicsSection } from '@/components/team/TeamQuickEditBasicsSection'
import { FormSubmitButton } from '@/components/form-submit-button'
import { TeamQuickEditSchedulingSection } from '@/components/team/TeamQuickEditSchedulingSection'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TEAM_LEAD_ROLE_LABEL,
  TEAM_QUICK_EDIT_DIALOG_CLASS,
  type TeamProfileRecord,
  type WorkPatternRecord,
} from '@/components/team/team-directory-model'

type EditableRole = 'manager' | 'lead' | 'therapist'

type DayOption = {
  label: string
  value: number
}

export function TeamQuickEditDialog({
  accessContent,
  archiveTeamMemberAction,
  dayOptions,
  draftRole,
  editProfile,
  editProfileIsActive,
  hasPattern,
  neverDays,
  onClose,
  onToggleDay,
  onToggleNeverDay,
  onTogglePattern,
  onWeekendRotationChange,
  onWorksDowModeChange,
  onFmlaChange,
  onRoleChange,
  onSetEditProfileId,
  onSetHasPattern,
  onSetNeverDays,
  onSetOnFmla,
  onSetSelectedDays,
  onSetWeekendRotation,
  onSetWorksDowMode,
  onSaveTeamQuickEditAction,
  onFmla,
  selectedDays,
  weekendRotation,
  workPattern,
  worksDowMode,
}: {
  accessContent: ReactNode
  archiveTeamMemberAction: (formData: FormData) => void | Promise<void>
  dayOptions: DayOption[]
  draftRole: EditableRole
  editProfile: TeamProfileRecord | null
  editProfileIsActive: boolean
  hasPattern: boolean
  neverDays: number[]
  onClose: () => void
  onToggleDay: (value: number) => void
  onToggleNeverDay: (value: number) => void
  onTogglePattern: (checked: boolean) => void
  onWeekendRotationChange: (value: 'none' | 'every_other') => void
  onWorksDowModeChange: (value: 'hard' | 'soft') => void
  onFmlaChange: (checked: boolean) => void
  onRoleChange: (value: EditableRole) => void
  onSetEditProfileId: (id: string | null) => void
  onSetHasPattern: (value: boolean) => void
  onSetNeverDays: (value: number[]) => void
  onSetOnFmla: (value: boolean) => void
  onSetSelectedDays: (value: number[]) => void
  onSetWeekendRotation: (value: 'none' | 'every_other') => void
  onSetWorksDowMode: (value: 'hard' | 'soft') => void
  onSaveTeamQuickEditAction: (formData: FormData) => void | Promise<void>
  onFmla: boolean
  selectedDays: number[]
  weekendRotation: 'none' | 'every_other'
  workPattern: WorkPatternRecord | null
  worksDowMode: 'hard' | 'soft'
}) {
  if (!editProfile) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onSetEditProfileId(null)}>
      <DialogContent className={TEAM_QUICK_EDIT_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle>Quick Edit Team Member</DialogTitle>
          <DialogDescription>
            Update access, staffing, and leave details without leaving the team roster.
          </DialogDescription>
        </DialogHeader>

        <form key={editProfile.id} action={onSaveTeamQuickEditAction} className="space-y-4">
          <input type="hidden" name="profile_id" value={editProfile.id} />

          <TeamQuickEditBasicsSection
            draftRole={draftRole}
            editProfile={editProfile}
            onFmla={onFmla}
            onFmlaChange={onFmlaChange}
            onRoleChange={onRoleChange}
          />

          {accessContent}

          <TeamQuickEditSchedulingSection
            dayOptions={dayOptions}
            hasPattern={hasPattern}
            neverDays={neverDays}
            onToggleDay={onToggleDay}
            onToggleNeverDay={onToggleNeverDay}
            onTogglePattern={onTogglePattern}
            onWeekendRotationChange={onWeekendRotationChange}
            onWorksDowModeChange={onWorksDowModeChange}
            selectedDays={selectedDays}
            weekendRotation={weekendRotation}
            weekendAnchorDate={workPattern?.weekend_anchor_date ?? ''}
            worksDowMode={worksDowMode}
          />

          <DialogFooter className="gap-2 sm:justify-between">
            {!editProfileIsActive ? (
              <Button type="submit" formAction={archiveTeamMemberAction} variant="outline">
                Archive employee
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <FormSubmitButton type="submit" pendingText="Saving...">
                Save changes
              </FormSubmitButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
