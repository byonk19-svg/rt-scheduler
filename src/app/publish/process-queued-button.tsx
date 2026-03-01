'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ProcessQueuedButtonProps = {
  publishEventId: string
}

export function ProcessQueuedButton({ publishEventId }: ProcessQueuedButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/publish/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_event_id: publishEventId, batch_size: 50 }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(details || 'Failed to process queued emails.')
      }

      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process queued emails.'
      window.alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={loading}
      className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-60"
    >
      {loading ? 'Processing...' : 'Process queued emails'}
    </button>
  )
}
