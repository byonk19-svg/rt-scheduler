'use client'

import type { DayItem, ShiftTab } from '@/lib/coverage/selectors'
import {
  getCandidatePriority,
  ShiftEditorTherapistRow,
} from '@/components/coverage/ShiftEditorTherapistRow'
import { shiftEditorDialogLayout } from '@/components/coverage/shift-editor-dialog-layout'

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  isLeadEligible: boolean
  employment_type: string | null
  max_work_days_per_week: number | null
}

type SelectedDay = DayItem & { shiftType: ShiftTab }

export { getCandidatePriority } from '@/components/coverage/ShiftEditorTherapistRow'

function TherapistSection({
  title,
  therapists,
  role,
  selectedDay,
  canEdit,
  assigning,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignedShiftMap,
  hasLead,
  onAssignTherapist,
  onUnassign,
}: {
  title: string
  therapists: TherapistOption[]
  role: 'lead' | 'staff'
  selectedDay: SelectedDay
  canEdit: boolean
  assigning: boolean
  unassigningShiftId: string | null
  weeklyTherapistCounts: Map<string, number>
  assignedShiftMap: Map<string, { shiftId: string; isLead: boolean }>
  hasLead: boolean
  onAssignTherapist: (userId: string, role: 'lead' | 'staff') => Promise<void> | void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}) {
  return (
    <section className={shiftEditorDialogLayout.section}>
      <div className="sticky top-0 z-[1] -mx-1 flex items-center justify-between gap-2 rounded-lg bg-background/95 px-1 py-1 backdrop-blur">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        <span className="text-[11px] text-muted-foreground">{therapists.length} options</span>
      </div>
      <div className={shiftEditorDialogLayout.rowList}>
        {therapists.map((therapist) => (
          <ShiftEditorTherapistRow
            key={`${role}-${therapist.id}`}
            therapist={therapist}
            role={role}
            selectedDay={selectedDay}
            canEdit={canEdit}
            assigning={assigning}
            unassigningShiftId={unassigningShiftId}
            weeklyTherapistCounts={weeklyTherapistCounts}
            assignedShiftMap={assignedShiftMap}
            hasLead={hasLead}
            onAssignTherapist={onAssignTherapist}
            onUnassign={onUnassign}
          />
        ))}
      </div>
    </section>
  )
}

export function ShiftEditorTherapistSections({
  leadTherapists,
  staffTherapists,
  selectedDay,
  canEdit,
  assigning,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignedShiftMap,
  hasLead,
  onAssignTherapist,
  onUnassign,
}: {
  leadTherapists: TherapistOption[]
  staffTherapists: TherapistOption[]
  selectedDay: SelectedDay
  canEdit: boolean
  assigning: boolean
  unassigningShiftId: string | null
  weeklyTherapistCounts: Map<string, number>
  assignedShiftMap: Map<string, { shiftId: string; isLead: boolean }>
  hasLead: boolean
  onAssignTherapist: (userId: string, role: 'lead' | 'staff') => Promise<void> | void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}) {
  return (
    <>
      <TherapistSection
        title="Lead therapists"
        therapists={leadTherapists}
        role="lead"
        selectedDay={selectedDay}
        canEdit={canEdit}
        assigning={assigning}
        unassigningShiftId={unassigningShiftId}
        weeklyTherapistCounts={weeklyTherapistCounts}
        assignedShiftMap={assignedShiftMap}
        hasLead={hasLead}
        onAssignTherapist={onAssignTherapist}
        onUnassign={onUnassign}
      />

      <TherapistSection
        title="Staff therapists"
        therapists={staffTherapists}
        role="staff"
        selectedDay={selectedDay}
        canEdit={canEdit}
        assigning={assigning}
        unassigningShiftId={unassigningShiftId}
        weeklyTherapistCounts={weeklyTherapistCounts}
        assignedShiftMap={assignedShiftMap}
        hasLead={hasLead}
        onAssignTherapist={onAssignTherapist}
        onUnassign={onUnassign}
      />
    </>
  )
}
