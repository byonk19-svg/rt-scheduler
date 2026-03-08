import Link from 'next/link'
import { CheckCircle2, CircleDashed, Clock3, RefreshCw } from 'lucide-react'

import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'

type PendingSetupSearchParams = {
  success?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function PendingSetupPage({
  searchParams,
}: {
  searchParams?: Promise<PendingSetupSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const requestReceived = getSearchParam(params?.success) === 'access_requested'

  return (
    <main className="teamwise-aurora-bg flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <TeamwiseLogo size="default" />

      <div className="teamwise-surface w-full max-w-md rounded-2xl border border-border p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)]">
          <Clock3 className="h-6 w-6 text-[var(--warning-text)]" />
        </div>

        <h1 className="text-center text-xl font-bold text-foreground">Account pending setup</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          Your account is created. A manager still needs to assign your Teamwise role before you can
          access schedules.
        </p>

        {requestReceived && (
          <p className="mt-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-center text-sm text-[var(--success-text)]">
            Access request received. Most approvals are completed within one business day.
          </p>
        )}

        <ol className="mt-5 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 text-[var(--success-text)]"
              aria-hidden="true"
            />
            <span className="text-foreground">Account created</span>
          </li>
          <li className="flex items-start gap-2">
            <CircleDashed
              className="mt-0.5 h-4 w-4 text-[var(--warning-text)]"
              aria-hidden="true"
            />
            <span className="text-foreground">Manager assigns your role</span>
          </li>
          <li className="flex items-start gap-2">
            <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Dashboard and schedule access unlock</span>
          </li>
        </ol>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need faster access? Ask your manager to update your role in the Team directory.
        </p>

        <div className="mt-6 grid gap-2">
          <Button asChild>
            <Link href="/pending-setup">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh approval status
            </Link>
          </Button>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">(c) 2026 Teamwise</p>
    </main>
  )
}
