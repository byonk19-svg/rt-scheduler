export type ShiftBoardSection = 'needs-action' | 'open-shifts' | 'waiting' | 'history'

export const BOARD_SECTIONS: Array<{ id: ShiftBoardSection; label: string }> = [
  { id: 'needs-action', label: 'Needs Action' },
  { id: 'open-shifts', label: 'Open coverage requests' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'history', label: 'History' },
]

export function resolveShiftBoardTab(value: string | null): ShiftBoardSection {
  return BOARD_SECTIONS.some((section) => section.id === value)
    ? (value as ShiftBoardSection)
    : 'needs-action'
}
