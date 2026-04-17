'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

type ProcessQueuedButtonProps = {
  publishEventId: string
}

export function ProcessQueuedButton({ publishEventId }: ProcessQueuedButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/publish/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_event_id: publishEventId, batch_size: 20 }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(details || 'Failed to process queued emails.')
      }

      setSuccessMessage('Re-send triggered — refreshing status...')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process queued emails.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button size="sm" variant="outline" onClick={() => void run()} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Processing…
          </>
        ) : (
          'Process queued'
        )}
      </Button>
      {error && (
        <p
          className="text-right text-[11px] font-medium"
          style={{ color: 'var(--error-text)' }}
          role="alert"
        >
          {error}
        </p>
      )}
      {successMessage && (
        <p className="text-right text-[11px] font-medium text-[var(--success-text)]" role="status">
          {successMessage}
        </p>
      )}
    </div>
  )
}
