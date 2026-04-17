import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SubmissionComplianceRow = {
  cycleId: string
  label: string
  submittedCount: number
  totalActive: number
  compliancePercent: number
}

type Props = {
  rows: SubmissionComplianceRow[]
}

function getBadgeStyle(percent: number) {
  if (percent >= 80) {
    return {
      backgroundColor: 'var(--success-subtle)',
      color: 'var(--success-text)',
      borderColor: 'var(--success-border)',
    }
  }
  if (percent >= 50) {
    return {
      backgroundColor: 'var(--warning-subtle)',
      color: 'var(--warning-text)',
      borderColor: 'var(--warning-border)',
    }
  }
  return {
    backgroundColor: 'var(--error-subtle)',
    color: 'var(--error-text)',
    borderColor: 'var(--error-border)',
  }
}

export function SubmissionComplianceTable({ rows }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-tw-sm">
      <div className="border-b border-border px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Submission compliance
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cycle</TableHead>
            <TableHead className="text-right">Submitted</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Compliance %</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.cycleId}>
              <TableCell className="font-medium text-foreground">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">{row.submittedCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.totalActive}</TableCell>
              <TableCell className="text-right tabular-nums">{row.compliancePercent}%</TableCell>
              <TableCell>
                <span
                  className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={getBadgeStyle(row.compliancePercent)}
                >
                  {row.compliancePercent >= 80
                    ? 'Healthy'
                    : row.compliancePercent >= 50
                      ? 'Watch'
                      : 'At risk'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
