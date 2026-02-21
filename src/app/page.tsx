import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Teamwise Scheduling
          </p>
          <h1 className="text-4xl font-bold text-foreground">Team scheduling, without the chaos.</h1>
          <p className="text-muted-foreground">
            Collect availability, manage requests, and keep coverage clear in one place.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Sign in to view your schedule and requests.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-accent/20"
            >
              Request access
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
