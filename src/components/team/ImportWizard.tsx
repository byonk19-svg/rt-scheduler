'use client'

import { useMemo, useState } from 'react'

import { ImportFieldMapper, guessField } from '@/components/team/ImportFieldMapper'
import {
  parseRawCsv,
  validateMappedRows,
  type FieldMapping,
  type MappedRow,
} from '@/lib/csv-import-parser'

type Props = {
  bulkImportRosterAction: (formData: FormData) => void | Promise<void>
}

type Step = 1 | 2 | 3 | 4

export function ImportWizard({ bulkImportRosterAction }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<FieldMapping>({})
  const [validRows, setValidRows] = useState<MappedRow[]>([])
  const [errors, setErrors] = useState<Array<{ rowIndex: number; field: string; message: string }>>(
    []
  )

  const fullNameMapped = useMemo(() => Object.values(mapping).includes('full_name'), [mapping])

  function readTextFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const parsed = parseRawCsv(text)
      const initialMapping = Object.fromEntries(
        parsed.headers.map((header) => [header, guessField(header)])
      )

      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(initialMapping)
      setStep(2)
    }
    reader.readAsText(file)
  }

  function handleValidate() {
    const result = validateMappedRows(rows, headers, mapping)
    setValidRows(result.valid)
    setErrors(result.errors)
    setStep(3)
  }

  return (
    <div className="space-y-6">
      {step === 1 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Upload CSV</h2>
          <label className="flex min-h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-card/70 px-4 py-6 text-sm text-muted-foreground">
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) readTextFile(file)
              }}
            />
            Drop a CSV here or click to choose a file
          </label>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Map fields</h2>
          <ImportFieldMapper headers={headers} mapping={mapping} onChange={setMapping} />
          <button
            type="button"
            disabled={!fullNameMapped}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-40"
            onClick={handleValidate}
          >
            Next
          </button>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Preview + validate</h2>
          <p className="text-sm text-muted-foreground">
            {validRows.length} valid rows, {errors.length} errors
          </p>

          <div className="overflow-x-auto rounded-xl border border-border bg-card/70">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Full name</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Employment</th>
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 20).map((row, index) => (
                  <tr key={`${row.full_name}-${index}`} className="border-b border-border/50">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">{row.full_name ?? ''}</td>
                    <td className="px-3 py-2">{row.shift_type ?? ''}</td>
                    <td className="px-3 py-2">{row.role ?? ''}</td>
                    <td className="px-3 py-2">{row.employment_type ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm text-[var(--error-text)]">
              {errors.map((error) => (
                <p key={`${error.rowIndex}-${error.field}`}>
                  Row {error.rowIndex}: {error.message}
                </p>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={validRows.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              onClick={() => setStep(4)}
            >
              {errors.length > 0
                ? `Skip errors and import ${validRows.length} rows`
                : `Import ${validRows.length} rows`}
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Apply import</h2>
          <p className="text-sm text-muted-foreground">
            {validRows.length} rows are ready to import.
          </p>
          <form action={bulkImportRosterAction} className="space-y-3">
            <input type="hidden" name="rows_json" value={JSON.stringify(validRows)} />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Import roster rows
            </button>
          </form>
        </section>
      ) : null}
    </div>
  )
}
