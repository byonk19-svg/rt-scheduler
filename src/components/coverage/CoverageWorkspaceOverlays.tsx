'use client'

import dynamic from 'next/dynamic'

import {
  applyTemplateAction,
  createCycleAction,
  deleteCycleAction,
} from '@/app/schedule/actions'
import type {
  CycleRow,
  PrintTherapist,
  TherapistOption,
} from '@/app/(app)/coverage/coverage-page-snapshot'
import type { DayItem } from '@/lib/coverage/selectors'
import type { ShiftStatus } from '@/lib/shift-types'

const ClearDraftConfirmDialog = dynamic(() =>
  import('@/components/coverage/ClearDraftConfirmDialog').then((module) => module.ClearDraftConfirmDialog)
)
const PreFlightDialog = dynamic(() =>
  import('@/components/coverage/PreFlightDialog').then((module) => module.PreFlightDialog)
)
const PrintSchedule = dynamic(() =>
  import('@/components/print-schedule').then((module) => module.PrintSchedule)
)
const SaveAsTemplateDialog = dynamic(() =>
  import('@/components/coverage/SaveAsTemplateDialog').then((module) => module.SaveAsTemplateDialog)
)
const StartFromTemplateDialog = dynamic(() =>
  import('@/components/coverage/StartFromTemplateDialog').then((module) => module.StartFromTemplateDialog)
)
const CycleManagementDialog = dynamic(() =>
  import('@/components/coverage/CycleManagementDialog').then((module) => module.CycleManagementDialog)
)
const ShiftEditorDialog = dynamic(() =>
  import('@/components/coverage/ShiftEditorDialog').then((module) => module.ShiftEditorDialog)
)

export function CoverageWorkspaceOverlays({
  activeCycleId,
  activeCyclePublished,
  allTherapists,
  applyAutoDraft,
  assigning,
  availableCycles,
  canManageCoverage,
  clearDraftDialogOpen,
  clearDraftFormRef,
  cycleDialogOpen,
  handleAssignTherapist,
  handleClose,
  handleUnassign,
  hasOperationalEntries,
  isPastDate,
  preFlightDialogOpen,
  printCycle,
  printCycleDates,
  printDayTeam,
  printNightTeam,
  printShiftByUserDate,
  printUsers,
  saveAsTemplateDialogOpen,
  selectedDay,
  setClearDraftDialogOpen,
  setCycleDialogOpen,
  setPreFlightDialogOpen,
  setSaveAsTemplateDialogOpen,
  setTemplateTarget,
  showFullPrintRoster,
  templateTarget,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignError,
}: {
  activeCycleId: string | null
  activeCyclePublished: boolean
  allTherapists: TherapistOption[]
  applyAutoDraft: () => void
  assigning: boolean
  availableCycles: CycleRow[]
  canManageCoverage: boolean
  clearDraftDialogOpen: boolean
  clearDraftFormRef: React.RefObject<HTMLFormElement | null>
  cycleDialogOpen: boolean
  handleAssignTherapist: (userId: string, role: 'lead' | 'staff') => Promise<void>
  handleClose: () => void
  handleUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void>
  hasOperationalEntries: boolean
  isPastDate: boolean
  preFlightDialogOpen: boolean
  printCycle: { label: string; start_date: string; end_date: string } | null
  printCycleDates: string[]
  printDayTeam: PrintTherapist[]
  printNightTeam: PrintTherapist[]
  printShiftByUserDate: Record<string, ShiftStatus>
  printUsers: PrintTherapist[]
  saveAsTemplateDialogOpen: boolean
  selectedDay: (DayItem & { shiftType: 'Day' | 'Night' }) | null
  setClearDraftDialogOpen: (open: boolean) => void
  setCycleDialogOpen: (open: boolean) => void
  setPreFlightDialogOpen: (open: boolean) => void
  setSaveAsTemplateDialogOpen: (open: boolean) => void
  setTemplateTarget: (target: { cycleId: string; startDate: string } | null) => void
  showFullPrintRoster: boolean
  templateTarget: { cycleId: string; startDate: string } | null
  unassigningShiftId: string | null
  weeklyTherapistCounts: Map<string, number>
  assignError: string
}) {
  return (
    <>
      {selectedDay ? (
        <ShiftEditorDialog
          open
          selectedDay={selectedDay}
          therapists={allTherapists}
          canEdit={Boolean(canManageCoverage && activeCycleId)}
          coverageCycleId={activeCycleId}
          isPastDate={isPastDate}
          hasOperationalEntries={hasOperationalEntries}
          assigning={assigning}
          unassigningShiftId={unassigningShiftId}
          weeklyTherapistCounts={weeklyTherapistCounts}
          onOpenChange={(open) => {
            if (!open) handleClose()
          }}
          onAssignTherapist={handleAssignTherapist}
          assignError={assignError}
          onUnassign={handleUnassign}
        />
      ) : null}
      {preFlightDialogOpen ? (
        <PreFlightDialog
          open
          onClose={() => setPreFlightDialogOpen(false)}
          cycleId={activeCycleId ?? ''}
          onConfirm={applyAutoDraft}
        />
      ) : null}
      {clearDraftDialogOpen ? (
        <ClearDraftConfirmDialog
          open
          onOpenChange={setClearDraftDialogOpen}
          applyFormRef={clearDraftFormRef}
          cycleId={activeCycleId ?? ''}
          cycleLabel={printCycle?.label ?? null}
          isPublished={activeCyclePublished}
        />
      ) : null}
      {saveAsTemplateDialogOpen && activeCycleId ? (
        <SaveAsTemplateDialog
          open
          onClose={() => setSaveAsTemplateDialogOpen(false)}
          cycleId={activeCycleId}
        />
      ) : null}
      {templateTarget ? (
        <StartFromTemplateDialog
          open
          onClose={() => setTemplateTarget(null)}
          newCycleId={templateTarget.cycleId}
          newCycleStartDate={templateTarget.startDate}
          applyTemplateAction={applyTemplateAction}
        />
      ) : null}
      {cycleDialogOpen ? (
        <CycleManagementDialog
          key={`cycle-dialog-${cycleDialogOpen ? 'open' : 'closed'}-${availableCycles[0]?.end_date ?? 'none'}`}
          cycles={availableCycles}
          open
          onOpenChange={setCycleDialogOpen}
          createCycleAction={createCycleAction}
          deleteCycleAction={deleteCycleAction}
          onStartFromTemplate={(cycleId, startDate) =>
            setTemplateTarget({ cycleId, startDate })
          }
        />
      ) : null}
      <PrintSchedule
        activeCycle={printCycle}
        cycleDates={printCycleDates}
        dayTeam={printDayTeam}
        nightTeam={printNightTeam}
        printUsers={printUsers}
        shiftByUserDate={printShiftByUserDate}
        isManager={showFullPrintRoster}
      />
    </>
  )
}
