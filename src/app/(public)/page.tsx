import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Scheduling that keeps care moving — Teamwise',
  description:
    "Coverage planning, availability, and shift management — built for RT departments that can't afford gaps.",
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero: dark teal ── */}
      <section className="relative overflow-hidden bg-[var(--primary)]">
        {/* subtle grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* amber right stripe */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0 w-[5px] bg-[var(--attention)] opacity-80"
        />

        <div className="relative mx-auto w-full max-w-5xl px-12 pb-20 pt-16">
          {/* eyebrow */}
          <div className="mb-8 flex items-center gap-3">
            <div className="h-[2.5px] w-8 shrink-0 rounded-full bg-[var(--attention)]" />
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/70">
              Scheduling for RT teams
            </p>
          </div>

          {/* headline */}
          <h1 className="mb-7 max-w-[16ch] font-display text-[4.5rem] font-normal leading-[1.0] tracking-[-0.01em] text-white sm:text-[5.5rem] lg:text-[6rem]">
            Scheduling that keeps care moving.
          </h1>

          {/* subtext */}
          <p className="mb-12 max-w-[34ch] text-[1.06rem] leading-[1.65] text-white/85">
            Coverage planning, availability, and shift management — built for RT departments that
            can&apos;t afford gaps.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-[52px] min-w-[140px] rounded-lg bg-[var(--attention)] px-8 text-base font-bold text-[var(--primary)] shadow-none hover:bg-[var(--attention)]/90"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-[52px] min-w-[140px] rounded-lg border-[1.5px] border-white/40 bg-transparent px-8 text-base font-medium text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/signup">Request access</Link>
            </Button>
            <span className="text-sm text-white/85">Manager approval required.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
