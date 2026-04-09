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
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center p-4 sm:p-6">
        <div className="w-full rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <TeamwiseLogo size="small" />
              <div>
                <h1 className="app-page-title text-[clamp(1.55rem,2.7vw,2rem)]">
                  Your account is waiting for approval
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground/80">
                  No action needed on your end. Sit tight while your manager reviews your account —
                  you’ll be able to log in once you&apos;re approved.
                </p>
              </div>
            </div>

            {requestReceived && (
              <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success-text)]">
                Access request received. Most approvals are completed within one business day.
              </p>
            )}

            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
