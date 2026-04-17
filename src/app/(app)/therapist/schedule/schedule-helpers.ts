import type { OperationalCode } from '@/lib/operational-codes'

const CODE_LABELS: Record<OperationalCode, string> = {
  on_call: 'OC',
  call_in: 'CI',
  cancelled: 'CX',
  left_early: 'LE',
}

/** Returns the PRD short label (OC/CI/CX/LE) or null if not an operational code. */
export function operationalCodeLabel(code: string): string | null {
  return CODE_LABELS[code as OperationalCode] ?? null
}
