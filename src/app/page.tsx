import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
const DAY_COUNTS = [5, 4, 3, 5, 4] as const
const NIGHT_COUNTS = [3, 3, 3, 3, 3] as const
const TODAY_IDX = 1

const TOTAL_FILLED = DAY_COUNTS.reduce((a, b) => a + b, 0) + NIGHT_COUNTS.reduce((a, b) => a + b, 0)
const TOTAL_SLOTS = DAYS.length * 5 + DAYS.length * 4
const FILL_PCT = Math.round((TOTAL_FILLED / TOTAL_SLOTS) * 100)

const STEPS = [
  {
    step: 1,
    icon: Users,
    title: 'Team submits availability',
    desc: 'Therapists add blackout dates and requests before each cycle closes.',
  },
  {
    step: 2,
    icon: Sparkles,
    title: 'Manager auto-generates draft',
    desc: 'Teamwise creates balanced day/night schedules based on rules and requests.',
  },
  {
    step: 3,
    icon: CalendarDays,
    title: 'Fill holes and publish',
    desc: 'Drag and drop final adjustments, review violations, and publish final schedules.',
  },
]

export default function Home() {
  return (
    <main className="teamwise-aurora-bg min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
        {/* ── Nav ─────────────────────────────────────────────── */}
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

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="teamwise-grid-bg teamwise-surface grid gap-8 rounded-3xl border border-border px-6 py-10 shadow-sm md:grid-cols-2 md:px-10 md:py-14">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-md border border-[var(--primary)]/20 bg-[var(--tw-soft-tint)] px-3 py-1 text-xs font-semibold text-[var(--tw-deep-blue)]">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Built for Healthcare Teams
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

          {/* Mock schedule preview */}
          <Card className="overflow-hidden border-[var(--tw-soft-tint)] p-0">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Coverage Snapshot</span>
              <span className="flex items-center gap-1.5 rounded-full bg-[var(--success-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--success-text)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
                Live
              </span>
            </div>
            {/* Day column headers */}
            <div className="flex border-b border-border">
              <div className="w-14 shrink-0 border-r border-border" />
              {DAYS.map((day, i) => (
                <div
                  key={day}
                  className={`flex-1 py-2 text-center text-xs font-semibold ${
                    i === TODAY_IDX ? 'bg-primary/5 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* Day shift row */}
            <div className="flex border-b border-border/60">
              <div className="flex w-14 shrink-0 items-center justify-center border-r border-border py-5 text-xs font-medium text-muted-foreground">
                Day
              </div>
              {DAY_COUNTS.map((count, i) => (
                <div
                  key={i}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-5 ${
                    i === TODAY_IDX ? 'bg-primary/5' : ''
                  }`}
                >
                  <span
                    className={`text-base font-bold leading-none ${
                      count < 4 ? 'text-[var(--warning-text)]' : 'text-foreground'
                    }`}
                  >
                    {count}
                  </span>
                  <span className="text-xs leading-none text-muted-foreground">/5</span>
                </div>
              ))}
            </div>
            {/* Night shift row */}
            <div className="flex">
              <div className="flex w-14 shrink-0 items-center justify-center border-r border-border py-5 text-xs font-medium text-muted-foreground">
                Night
              </div>
              {NIGHT_COUNTS.map((count, i) => (
                <div
                  key={i}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-5 ${
                    i === TODAY_IDX ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="text-base font-bold leading-none text-foreground">{count}</span>
                  <span className="text-xs leading-none text-muted-foreground">/4</span>
                </div>
              ))}
            </div>
            {/* Fill rate footer */}
            <div className="flex items-center gap-3 border-t border-border bg-muted/60 px-4 py-3">
              <span className="shrink-0 text-xs text-muted-foreground">Fill rate</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-[var(--success)]"
                  style={{ width: `${FILL_PCT}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold text-[var(--success-text)]">
                {FILL_PCT}%
              </span>
            </div>
          </Card>
        </section>

        {/* ── Stats strip ─────────────────────────────────────── */}
        <div className="teamwise-surface grid grid-cols-3 divide-x divide-border rounded-2xl border border-border shadow-sm">
          {[
            { value: '14', label: 'Active staff' },
            { value: '3–5', label: 'Coverage target per slot' },
            { value: '28-day', label: 'Planning cycles' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 px-4 py-5 text-center"
            >
              <span className="text-xl font-bold text-foreground md:text-2xl">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* ── Feature cards ────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-t-2 border-t-primary transition-shadow hover:shadow-md">
            <CardContent className="space-y-3 pt-6">
              <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Collect requests once</h2>
              <p className="text-sm text-muted-foreground">
                Blackout dates and reasons are submitted in one place with duplicate protection.
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-[var(--success)] transition-shadow hover:shadow-md">
            <CardContent className="space-y-3 pt-6">
              <div className="inline-flex items-center justify-center rounded-lg bg-[var(--success-subtle)] p-2.5">
                <Sparkles className="h-5 w-5 text-[var(--success-text)]" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Generate faster schedules</h2>
              <p className="text-sm text-muted-foreground">
                Start with auto-generated schedules, then use drag-and-drop to patch coverage gaps.
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-[var(--warning)] transition-shadow hover:shadow-md">
            <CardContent className="space-y-3 pt-6">
              <div className="inline-flex items-center justify-center rounded-lg bg-[var(--warning-subtle)] p-2.5">
                <ShieldCheck className="h-5 w-5 text-[var(--warning-text)]" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Keep staffing safe</h2>
              <p className="text-sm text-muted-foreground">
                Enforce per-therapist weekly limits and 3–5 shift coverage with manager override.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="teamwise-surface rounded-3xl border border-border p-6 shadow-sm md:p-10">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">How Teamwise works</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              From availability to published schedule in three steps
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-4 ring-primary/10">
                    {step}
                  </div>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <section className="mt-8 bg-primary px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Ready to build better schedules?
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Join Teamwise and eliminate scheduling chaos for good.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="gap-2 font-semibold">
              <Link href="/login">
                Open Teamwise
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-white hover:bg-card/10 hover:text-white"
            >
              <Link href="/signup">Request account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-primary/5 px-4 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center md:flex-row md:text-left">
          <TeamwiseLogo size="small" />
          <p className="text-xs text-muted-foreground">
            © 2026 Teamwise. Built for respiratory therapy teams.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Request access
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
