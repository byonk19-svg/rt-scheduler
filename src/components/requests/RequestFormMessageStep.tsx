'use client'

import type { MyShift, RequestType, TeamMember } from '@/components/requests/request-types'

export function RequestFormMessageStep({
  message,
  requestType,
  selectedMember,
  selectedShiftData,
  setMessage,
}: {
  message: string
  requestType: RequestType
  selectedMember: TeamMember | null
  selectedShiftData: MyShift | null
  setMessage: (value: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-foreground">Step 3: Final message</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add context before posting your request.
        </p>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-muted/50 px-3 py-3">
        <p className="text-xs font-semibold text-foreground capitalize">Type: {requestType}</p>
        <p className="text-xs text-muted-foreground">
          Shift:{' '}
          {selectedShiftData
            ? `${selectedShiftData.date} - ${selectedShiftData.type}`
            : 'Not selected'}
        </p>
        <p className="text-xs text-muted-foreground">
          With: {selectedMember ? selectedMember.name : 'No specific teammate'}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground" htmlFor="request-message">
          Message
        </label>
        <textarea
          id="request-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Add details for your manager and team..."
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
        />
      </div>
    </div>
  )
}
