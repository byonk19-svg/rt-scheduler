import Link from 'next/link'
import { CheckCircle2, CircleDashed, Clock3, RefreshCw, ShieldCheck } from 'lucide-react'

import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'

type PendingSetupSearchParams = {
  success?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function ProgressStep({
  icon,
  label,
  description,
  done = false,
}: {
  icon: React.ReactNode
  label: string
  description: string
  done?: boolean
}) {
  return (
    <li className="rounded-xl border border-border bg-card/70 p-3">
      <div className="flex items-start gap-2.5">
        <span
          className={done ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </li>
  )
}

export default async function PendingSetupPage({
  searchParams,
}: {
  searchParams?: Promise<PendingSetupSearchParams>
}) {
  const params = searchParams ? await searchParams : undefined
  const requestReceived = getSearchParam(params?.success) === 'access_requested'

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute left-0 top-4 h-64 w-64 rounded-full bg-[color:rgba(6,103,169,0.14)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[color:rgba(239,180,79,0.14)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center p-4 sm:p-6 lg:p-10">
        <div className="w-full rounded-3xl border border-border/80 bg-card/95 p-6 shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-7">
            <div className="space-y-4">
              <TeamwiseLogo size="small" />
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1 text-xs font-semibold text-[var(--warning-text)]">
                <Clock3 className="h-3.5 w-3.5" />
                Access request in review
              </div>
              <div>
                <h1 className="app-page-title text-[clamp(1.55rem,2.7vw,2rem)]">
                  Account pending setup
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Your account is created. A manager still needs to assign your Teamwise role before
                  schedule and dashboard access unlock.
                </p>
              </div>
            </div>

            {requestReceived && (
              <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success-text)]">
                Access request received. Most approvals are completed within one business day.
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-[color-mix(in_oklch,var(--card)_92%,var(--secondary))] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Setup progress
                </p>
                <ol className="mt-3 space-y-2.5">
                  <ProgressStep
                    done
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    label="Account created"
                    description="Your profile and sign-in credentials are active."
                  />
                  <ProgressStep
                    icon={<CircleDashed className="h-4 w-4" />}
                    label="Manager assigns role"
                    description="A manager selects your site role and staffing defaults."
                  />
                  <ProgressStep
                    icon={<CircleDashed className="h-4 w-4 text-muted-foreground" />}
                    label="Schedule access unlocks"
                    description="You can open dashboard, schedule, and shift board pages."
                  />
                </ol>
              </div>

              <div className="rounded-2xl border border-border bg-[color-mix(in_oklch,var(--card)_92%,var(--secondary))] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  While you wait
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--info-text)]" />
                    Confirm your work email can receive Teamwise notifications.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success-text)]" />
                    Let your manager know your preferred shift type if it changed.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Clock3 className="mt-0.5 h-4 w-4 text-[var(--warning-text)]" />
                    Refresh this page after approval to check your status.
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
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

            <p className="text-center text-xs text-muted-foreground">
              Need faster access? Ask your manager to update your role in Team Directory.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
