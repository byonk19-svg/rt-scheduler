'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

type AuditLogFiltersProps = {
  action: string
  actor: string
}

export function AuditLogFilters({ action, actor }: AuditLogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [actionDraft, setActionDraft] = useState(action)
  const [actorDraft, setActorDraft] = useState(actor)

  function pushFilters() {
    const params = new URLSearchParams(searchParams.toString())
    const a = actionDraft.trim()
    const b = actorDraft.trim()
    if (a) params.set('action', a)
    else params.delete('action')
    if (b) params.set('actor', b)
    else params.delete('actor')
    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    pushFilters()
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Action contains</span>
        <input
          type="text"
          value={actionDraft}
          onChange={(event) => setActionDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. shift_added"
          className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
        />
      </label>
      <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Actor profile ID</span>
        <input
          type="text"
          value={actorDraft}
          onChange={(event) => setActorDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="profile UUID"
          className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
        />
      </label>
      <Button type="button" size="sm" onClick={pushFilters}>
        Apply filters
      </Button>
    </div>
  )
}
