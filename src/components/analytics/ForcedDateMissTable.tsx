import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ForcedDateMissRow = {
  therapistName: string
  date: string
  cycleLabel: string
  missed: boolean
}

type Props = {
  rows: ForcedDateMissRow[]
}

export function ForcedDateMissTable({ rows }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-tw-sm">
      <div className="border-b border-border px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Forced-date miss patterns
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Therapist</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Missed?</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.therapistName}-${row.date}-${index}`}>
              <TableCell className="font-medium text-foreground">{row.therapistName}</TableCell>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.cycleLabel}</TableCell>
              <TableCell>
                <span
                  className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={
                    row.missed
                      ? {
                          backgroundColor: 'var(--error-subtle)',
                          color: 'var(--error-text)',
                          borderColor: 'var(--error-border)',
                        }
                      : {
                          backgroundColor: 'var(--success-subtle)',
                          color: 'var(--success-text)',
                          borderColor: 'var(--success-border)',
                        }
                  }
                >
                  {row.missed ? 'Missed' : 'Covered'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
