'use client'

import { TEAMWISE_FIELDS, type FieldMapping } from '@/lib/csv-import-parser'

type Props = {
  headers: string[]
  mapping: FieldMapping
  onChange: (nextMapping: FieldMapping) => void
}

export function guessField(header: string): string {
  const normalized = header.trim().toLowerCase()
  if (normalized === 'name' || normalized === 'full name' || normalized === 'employee name') {
    return 'full_name'
  }
  if (normalized === 'shift' || normalized === 'shift type') return 'shift_type'
  if (normalized === 'role') return 'role'
  if (normalized === 'employment' || normalized === 'employment type') return 'employment_type'
  if (normalized === 'phone' || normalized === 'phone number') return 'phone_number'
  if (
    normalized === 'max work days/week' ||
    normalized === 'max days' ||
    normalized === 'max work days'
  ) {
    return 'max_work_days_per_week'
  }
  return ''
}

export function ImportFieldMapper({ headers, mapping, onChange }: Props) {
  return (
    <div className="space-y-3">
      {headers.map((header) => (
        <div key={header} className="grid gap-2 sm:grid-cols-[1fr_16rem] sm:items-center">
          <div>
            <p className="text-sm font-medium text-foreground">{header}</p>
          </div>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={mapping[header] ?? ''}
            onChange={(event) =>
              onChange({
                ...mapping,
                [header]: event.target.value,
              })
            }
          >
            <option value="">Skip</option>
            {TEAMWISE_FIELDS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
