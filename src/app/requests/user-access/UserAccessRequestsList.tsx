'use client'

import { useMemo, useState } from 'react'

import {
  approvePendingAccessRequestAction,
  declinePendingAccessRequestAction,
} from '@/app/requests/user-access/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type PendingAccessRequest = {
  id: string
  fullName: string
  email: string
  phoneNumber: string | null
  signupDateLabel: string
}

export function UserAccessRequestsList({ requests }: { requests: PendingAccessRequest[] }) {
  const [approveOpenFor, setApproveOpenFor] = useState<string | null>(null)
  const [declineOpenFor, setDeclineOpenFor] = useState<string | null>(null)
  const [role, setRole] = useState<'therapist' | 'lead'>('therapist')

  const approveRequest = useMemo(
    () => requests.find((row) => row.id === approveOpenFor) ?? null,
    [approveOpenFor, requests]
  )
  const declineRequest = useMemo(
    () => requests.find((row) => row.id === declineOpenFor) ?? null,
    [declineOpenFor, requests]
  )

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card px-5 py-8 text-center">
        <p className="text-sm font-medium text-foreground">No pending access requests.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden rounded-xl border border-border/70 bg-card md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Phone number</th>
              <th className="px-4 py-3 font-semibold">Signup date</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => (
              <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{row.fullName}</td>
                <td className="px-4 py-3 text-sm text-foreground/80">{row.email}</td>
                <td className="px-4 py-3 text-sm text-foreground/80">{row.phoneNumber ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-foreground/80">{row.signupDateLabel}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <Button size="sm" onClick={() => setApproveOpenFor(row.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeclineOpenFor(row.id)}>
                      Decline
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {requests.map((row) => (
          <article key={row.id} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-semibold text-foreground">{row.fullName}</p>
            <p className="mt-1 text-sm text-foreground/80">{row.email}</p>
            <p className="mt-1 text-sm text-foreground/80">
              Phone number: {row.phoneNumber ?? '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Signed up {row.signupDateLabel}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setApproveOpenFor(row.id)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setDeclineOpenFor(row.id)}
              >
                Decline
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={Boolean(approveRequest)}
        onOpenChange={(open) => !open && setApproveOpenFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve access request</DialogTitle>
            <DialogDescription>Choose a role before approving this account.</DialogDescription>
          </DialogHeader>
          <form action={approvePendingAccessRequestAction} className="space-y-4">
            <input type="hidden" name="profile_id" value={approveRequest?.id ?? ''} />
            <div className="space-y-1.5">
              <label htmlFor="approval-role" className="text-sm font-medium text-foreground">
                Role
              </label>
              <select
                id="approval-role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'therapist' | 'lead')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              >
                <option value="therapist">Therapist</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApproveOpenFor(null)}>
                Cancel
              </Button>
              <Button type="submit">Approve</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(declineRequest)}
        onOpenChange={(open) => !open && setDeclineOpenFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline access request</DialogTitle>
            <DialogDescription>This will delete the pending account entirely.</DialogDescription>
          </DialogHeader>
          <form action={declinePendingAccessRequestAction}>
            <input type="hidden" name="profile_id" value={declineRequest?.id ?? ''} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeclineOpenFor(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Decline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
