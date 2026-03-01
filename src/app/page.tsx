import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="teamwise-aurora-bg min-h-screen p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="teamwise-surface flex items-center justify-between rounded-2xl border border-border px-4 py-3 shadow-sm md:px-6 md:py-4">
          <TeamwiseLogo size="default" />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Request access</Link>
            </Button>
          </div>
        </header>

        <section className="teamwise-grid-bg teamwise-surface grid gap-8 rounded-3xl border border-border px-6 py-10 shadow-sm md:grid-cols-2 md:px-10 md:py-14">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-md border border-[var(--primary)]/20 bg-[var(--tw-soft-tint)] px-3 py-1 text-xs font-semibold text-[var(--tw-deep-blue)]">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Teamwise Brand Kit
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Manage smarter,
              <span className="block text-primary">not harder.</span>
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              Centralize approvals and coverage in one dashboard. Give your team the self-service
              convenience they deserve.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg" className="gap-2">
                <Link href="/login">
                  Open Teamwise
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">Request account</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Auto-generate drafts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Drag/drop hole filling
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Coverage rules built in
              </span>
            </div>
          </div>

          <Card className="overflow-hidden border-[var(--tw-soft-tint)]">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Coverage Snapshot</h2>
                <span className="rounded-md bg-[var(--tw-soft-tint)] px-2.5 py-1 text-xs font-medium text-[var(--tw-deep-blue)]">
                  Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Day Shift</p>
                  <p className="text-2xl font-bold text-foreground">4/5</p>
                  <p className="text-xs text-[var(--tw-deep-blue)]">Within target</p>
                </div>
                <div className="rounded-xl border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Night Shift</p>
                  <p className="text-2xl font-bold text-foreground">3/5</p>
                  <p className="text-xs text-[var(--tw-deep-blue)]">Within target</p>
                </div>
                <div className="rounded-xl border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Weekly rule</p>
                  <p className="text-2xl font-bold text-foreground">3 days</p>
                  <p className="text-xs text-muted-foreground">Sun-Sat target</p>
                </div>
                <div className="rounded-xl border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Open requests</p>
                  <p className="text-2xl font-bold text-foreground">6</p>
                  <p className="text-xs text-muted-foreground">Awaiting review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                Availability
              </span>
              <h2 className="text-xl font-semibold text-foreground">Collect requests once</h2>
              <p className="text-sm text-muted-foreground">
                Blackout dates and reasons are submitted in one place with duplicate protection.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Smart Drafts
              </span>
              <h2 className="text-xl font-semibold text-foreground">Generate faster schedules</h2>
              <p className="text-sm text-muted-foreground">
                Start with auto-generated schedules, then use drag-and-drop to patch coverage gaps.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Guardrails
              </span>
              <h2 className="text-xl font-semibold text-foreground">Keep staffing safe</h2>
              <p className="text-sm text-muted-foreground">
                Enforce per-therapist weekly limits and 3-5 shift coverage with manager override.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="teamwise-surface rounded-3xl border border-border p-6 shadow-sm md:p-8">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                1. Team submits availability
              </h3>
              <p className="text-sm text-muted-foreground">
                Therapists add blackout dates and requests before each cycle closes.
              </p>
            </div>
            <div className="space-y-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                2. Manager auto-generates draft
              </h3>
              <p className="text-sm text-muted-foreground">
                Teamwise creates balanced day/night schedules based on rules and requests.
              </p>
            </div>
            <div className="space-y-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">3. Fill holes and publish</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop final adjustments, review violations, and publish final schedules.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
