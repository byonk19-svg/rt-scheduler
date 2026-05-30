import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'

import { Button } from '@/components/ui/button'

type ManagerToolAccessDeniedProps = {
  toolName?: string
}

export function ManagerToolAccessDenied({
  toolName = 'this manager tool',
}: ManagerToolAccessDeniedProps) {
  return (
    <main className="mx-auto flex min-h-[56vh] max-w-3xl items-center px-4 py-12 md:px-6">
      <section className="w-full rounded-xl border border-border/70 bg-card p-6 shadow-tw-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Manager access required
            </p>
            <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground">
              You do not have access to this manager tool.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {toolName} is restricted to active managers. Your current account can still use the
              staff scheduling areas available to your role.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/dashboard/staff">Open staff dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/staff/my-schedule">View my schedule</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
