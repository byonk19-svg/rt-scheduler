import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Scheduling that keeps care moving — Teamwise',
  description:
    "Coverage planning, availability, and shift management — built for RT departments that can't afford gaps.",
}

const features = [
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
      {/* ── Hero: full-bleed dark teal (--marketing-hero-bg, hue 174 16%) ── */}
      <section className="relative overflow-hidden bg-[var(--marketing-hero-bg)]">
        {/* grid texture */}
        <div
          aria-hidden
          className="teamwise-public-grid-bg teamwise-public-grid-bg-lg pointer-events-none absolute inset-0 opacity-[0.04]"
        />
        <div className="relative mx-auto w-full max-w-5xl px-12 pb-20 pt-16">
          {/* eyebrow */}
          <div className="mb-8 flex items-center gap-3">
            <div className="h-[2.5px] w-8 shrink-0 rounded-full bg-[var(--attention)]" />
            <p className="text-hero-subtle text-[0.65rem] font-bold uppercase tracking-[0.18em]">
              Scheduling for RT teams
            </p>
          </div>

          {/* headline */}
          <h1 className="mb-7 max-w-[16ch] font-display text-[4.5rem] font-normal leading-[1.0] tracking-[-0.01em] text-white sm:text-[5.5rem] lg:text-[6rem]">
            Scheduling that keeps care moving.
          </h1>

          {/* subtext */}
          <p className="text-hero-muted mb-12 max-w-[34ch] text-[1.06rem] leading-[1.65]">
            Coverage planning, availability, and shift management — built for RT departments that
            can&apos;t afford gaps.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-[52px] min-w-[140px] rounded-lg bg-[var(--attention)] px-8 text-base font-bold text-[var(--marketing-hero-bg)] shadow-none hover:bg-[var(--attention)]/90"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-[52px] min-w-[140px] rounded-lg border-[1.5px] border-white/[0.22] bg-transparent px-8 text-base font-medium text-white hover:bg-white/[0.08] hover:text-white"
            >
              <Link href="/signup">Request access</Link>
            </Button>
            <span className="text-hero-subtle text-sm">Manager approval required.</span>
          </div>
        </div>

        {/* section break with amber dot — exact match to design */}
        <div className="relative h-px bg-white/[0.07]">
          <div className="absolute left-12 top-[-4px] h-2 w-2 rounded-full bg-[var(--attention)]" />
        </div>
      </section>

      {/* ── Feature strip (per design handoff) ── */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-5xl px-12 py-14">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
            {features.map(({ title, body }) => (
              <div key={title}>
                <div className="mb-3.5 h-[3px] w-7 rounded-full bg-[var(--attention)]" />
                <p className="mb-2 text-sm font-bold text-foreground">{title}</p>
                <p className="text-[0.81rem] leading-[1.65] text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
