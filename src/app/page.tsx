import Link from 'next/link'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex items-center justify-between rounded-2xl border-2 border-border bg-card px-6 py-4 shadow-sm">
          <TeamwiseLogo size="default" />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Request access</Link>
            </Button>
          </div>
        </header>

        <section className="teamwise-grid-bg rounded-3xl border-2 border-border bg-card px-6 py-14 text-center shadow-sm md:px-12">
          <div className="mx-auto max-w-3xl space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              Team scheduling, without the chaos.
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Collect availability, manage requests, and keep coverage clear in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/login">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">Create account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 pt-6">
              <h2 className="text-lg font-semibold text-foreground">Availability in</h2>
              <p className="text-sm text-muted-foreground">
                Team members submit blackout dates and requests in one place.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <h2 className="text-lg font-semibold text-foreground">Coverage out</h2>
              <p className="text-sm text-muted-foreground">
                Managers auto-generate drafts and use drag-and-drop to fill holes.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <h2 className="text-lg font-semibold text-foreground">One shared board</h2>
              <p className="text-sm text-muted-foreground">
                Shift swaps and pickups stay visible to the right people at the right time.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
