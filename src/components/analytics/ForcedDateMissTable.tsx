import { cn } from '@/lib/utils'

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

type TherapistSummary = {
  name: string
  misses: number
  met: number
  total: number
  missRate: number
}

function groupByTherapist(rows: ForcedDateMissRow[]): TherapistSummary[] {
  const map = new Map<string, { misses: number; met: number }>()
  for (const row of rows) {
    const entry = map.get(row.therapistName) ?? { misses: 0, met: 0 }
    if (row.missed) {
      entry.misses++
    } else {
      entry.met++
    }
    map.set(row.therapistName, entry)
  }
  return [...map.entries()]
    .map(([name, { misses, met }]) => ({
      name,
      misses,
      met,
      total: misses + met,
      missRate: misses + met > 0 ? Math.round((misses / (misses + met)) * 100) : 0,
    }))
    .sort((a, b) => b.misses - a.misses || a.name.localeCompare(b.name))
}

export function ForcedDateMissTable({ rows }: Props) {
  const grouped = groupByTherapist(rows)
  const totalMisses = rows.filter((r) => r.missed).length
  const totalRequests = rows.length

  return (
    <section className="rounded-xl border border-border bg-card shadow-tw-sm">
      <div className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Force-on miss patterns
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Requested dates that were not assigned in the draft.
          </p>
        </div>
        {totalRequests > 0 ? (
          <p
            className={cn(
              'shrink-0 text-sm font-semibold tabular-nums',
              totalMisses === 0 ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'
            )}
          >
            {totalMisses} of {totalRequests} missed
          </p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <TableHead>Therapist</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead className="text-right">Misses</TableHead>
            <TableHead className="text-right">Met</TableHead>
            <TableHead>Miss rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((t) => {
            const barClass =
              t.missRate === 0
                ? 'bg-[var(--success)]'
                : t.missRate >= 50
                  ? 'bg-[var(--error)]'
                  : 'bg-[var(--warning)]'
            const rateTextClass =
              t.missRate === 0
                ? 'text-[var(--success-text)]'
                : t.missRate >= 50
                  ? 'text-[var(--error-text)]'
                  : 'text-[var(--warning-text)]'

            return (
              <TableRow key={t.name}>
                <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                <TableCell className="text-right tabular-nums">{t.total}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={t.misses > 0 ? 'text-[var(--error-text)]' : undefined}>
                    {t.misses}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={t.met > 0 ? 'text-[var(--success-text)]' : undefined}>
                    {t.met}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border">
                      <div
                        className={cn('h-full rounded-full transition-[width]', barClass)}
                        style={{ width: `${t.missRate}%` }}
                      />
                    </div>
                    <span className={cn('tabular-nums text-sm', rateTextClass)}>{t.missRate}%</span>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {grouped.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                No force-on requests found.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  )
}
