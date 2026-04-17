'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TemplateListRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  shift_count: number
  day_count: number
}

type Props = {
  open: boolean
  onClose: () => void
  newCycleId: string
  newCycleStartDate: string
  applyTemplateAction: (formData: FormData) => void | Promise<void>
}

export function StartFromTemplateDialog({
  open,
  onClose,
  newCycleId,
  newCycleStartDate,
  applyTemplateAction,
}: Props) {
  const [templates, setTemplates] = useState<TemplateListRow[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true

    async function loadTemplates() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/schedule/templates')
        const payload = (await response.json().catch(() => null)) as
          | TemplateListRow[]
          | { error?: string }
          | null
        if (!response.ok) {
          throw new Error(
            !Array.isArray(payload) && payload?.error ? payload.error : 'Could not load templates.'
          )
        }
        const rows = Array.isArray(payload) ? payload : []
        if (!active) return
        setTemplates(rows)
        setSelectedTemplateId(rows[0]?.id ?? null)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load templates.')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void loadTemplates()

    return () => {
      active = false
    }
  }, [open])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-[38rem]">
        <form action={applyTemplateAction} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle>Start from template</DialogTitle>
            <DialogDescription>
              Apply a saved staffing template to this draft cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-sm text-[var(--warning-text)]">
            Note: availability settings are not included in templates.
          </div>

          <input type="hidden" name="new_cycle_id" value={newCycleId} />
          <input type="hidden" name="new_cycle_start_date" value={newCycleStartDate} />
          <input type="hidden" name="template_id" value={selectedTemplateId ?? ''} />

          {loading ? <p className="text-sm text-muted-foreground">Loading templates...</p> : null}
          {error ? <p className="text-sm text-[var(--error-text)]">{error}</p> : null}

          {!loading && !error ? (
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left ${
                    selectedTemplateId === template.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{template.name}</p>
                  {template.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.shift_count} shifts • {template.day_count} days •{' '}
                    {new Date(template.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {selectedTemplate ? (
            <p className="text-sm text-muted-foreground">
              This template assigns {selectedTemplate.shift_count} shifts across{' '}
              {selectedTemplate.day_count} days.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedTemplateId}>
              Apply template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
