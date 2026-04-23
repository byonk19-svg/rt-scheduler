import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Scheduling for respiratory therapy teams',
  description:
    "Coverage planning, availability, and shift management — built for RT departments that can't afford gaps.",
}

const featureItems = [
  {
    title: 'Shift coverage',
    body: 'Availability stays visible before the next handoff — no chasing threads.',
  },
  {
    title: 'Manager control',
    body: "Sign-in and roster access stay under your manager's control at all times.",
  },
  {
    title: 'Clear handoffs',
    body: 'Coverage changes stay clear without the back-and-forth.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-[var(--sidebar)] text-sidebar-primary">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in srgb, white 85%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, white 85%, transparent) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div aria-hidden className="absolute inset-y-0 right-0 w-[5px] bg-[var(--attention)]/80" />

        <div className="relative mx-auto flex w-full max-w-[1004px] flex-col px-[52px] pb-[84px] pt-[72px]">
          <div className="mb-[30px] flex items-center gap-3">
            <span className="h-[2.5px] w-8 rounded-full bg-[var(--attention)]" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">
              Scheduling for RT teams
            </span>
          </div>

          <h1 className="max-w-[780px] font-display text-[80px] font-normal leading-none tracking-[-0.01em] text-sidebar-primary">
            Scheduling that keeps care moving.
          </h1>

          <p className="mb-12 mt-7 max-w-[480px] text-[17px] leading-[1.65] text-sidebar-foreground/55">
            Coverage planning, availability, and shift management — built for RT departments that
            can&apos;t afford gaps.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-[52px] items-center rounded-md bg-[var(--attention)] px-8 text-[15px] font-bold text-[var(--sidebar)] hover:no-underline hover:brightness-105"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[52px] items-center rounded-md border border-white/22 px-8 text-[15px] font-medium text-sidebar-primary hover:bg-white/8 hover:no-underline"
            >
              Request access
            </Link>
            <span className="text-xs text-sidebar-foreground/35">Manager approval required.</span>
          </div>
        </div>

        <div className="relative h-px bg-white/7">
          <span className="absolute left-[52px] top-[-4px] h-2 w-2 rounded-full bg-[var(--attention)]" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1004px] px-[52px] pb-16 pt-[52px]">
        <div className="grid gap-12 md:grid-cols-3">
          {featureItems.map((item) => (
            <article key={item.title}>
              <div className="mb-3.5 h-[3px] w-7 rounded-full bg-[var(--attention)]" />
              <h2 className="mb-2 text-sm font-bold text-foreground">{item.title}</h2>
              <p className="text-[13px] leading-[1.65] text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
