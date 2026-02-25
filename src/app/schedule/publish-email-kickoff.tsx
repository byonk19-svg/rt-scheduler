'use client'

import { useEffect } from 'react'

type PublishEmailKickoffProps = {
  publishEventId: string
  enabled: boolean
}

export function PublishEmailKickoff({ publishEventId, enabled }: PublishEmailKickoffProps) {
  useEffect(() => {
    if (!enabled) return
    if (!publishEventId) return

    void fetch('/api/publish/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_event_id: publishEventId, batch_size: 25 }),
    }).catch((error) => {
      console.error('Failed to kick off publish email delivery:', error)
    })
  }, [enabled, publishEventId])

  return null
}

