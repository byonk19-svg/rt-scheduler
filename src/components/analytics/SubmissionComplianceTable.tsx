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
          <TableRow className="bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                  className={
                    row.submittedCount >= row.totalActive
                      ? 'inline-flex rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)]'
                      : 'inline-flex rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]'
                  }
                >
                  {row.submittedCount >= row.totalActive ? 'Complete' : 'Pending'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
