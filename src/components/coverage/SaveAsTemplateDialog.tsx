'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  onClose: () => void
  cycleId: string
}

export function SaveAsTemplateDialog({ open, onClose, cycleId }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cycleId || !name.trim()) return

    setSubmitting(true)
    setFeedback(null)
    setError(null)

    try {
      const response = await fetch('/api/schedule/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId,
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not save template.')
      }

      setFeedback('Template saved.')
      setName('')
      setDescription('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save template.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-[34rem]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Save this published cycle as a reusable staffing template.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-sm text-[var(--warning-text)]">
            Note: availability settings are not included in templates.
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <textarea
              id="template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {feedback ? (
            <p className="text-sm text-[var(--success-text)]">{feedback}</p>
          ) : null}
          {error ? <p className="text-sm text-[var(--error-text)]">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={!cycleId || !name.trim() || submitting}>
              {submitting ? 'Saving...' : 'Save template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
