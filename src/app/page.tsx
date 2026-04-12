import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--attention)]">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-heading text-sm font-bold tracking-[-0.02em] text-foreground">
                Teamwise
              </p>
              <p className="text-[0.7rem] font-medium text-muted-foreground">Respiratory Therapy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="teamwise-aurora-bg relative overflow-hidden">
        <div aria-hidden className="teamwise-hero-grid-bg absolute inset-0" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 lg:py-24">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--attention)]/30 bg-[var(--attention)]/10 px-3.5 py-1.5 text-xs font-semibold text-[var(--attention)]">
              <CalendarDays className="h-3 w-3" />
              Respiratory therapy scheduling
            </div>
            <h1 className="font-display text-[3rem] font-bold leading-[1.0] tracking-[-0.04em] text-foreground sm:text-[4.5rem] lg:text-[6rem]">
              Scheduling,
              <br />
              availability,
              <br />
              and coverage.
            </h1>
            <p className="max-w-md text-lg font-light text-foreground/70">
              A single workspace for therapists and managers to stay aligned on staffing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 min-w-[160px] text-base">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 min-w-[160px] text-base">
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Your manager will need to approve your account before your first sign-in.
          </p>
          <div className="relative h-[400px] w-full overflow-hidden rounded-2xl border border-border/60 shadow-tw-hero-media">
            <Image
              src="/images/app-preview.png"
              alt="Teamwise schedule view"
              fill
              className="object-cover object-top"
              priority
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-[var(--background)]" />
          </div>
        </div>
      </section>
    </main>
  )
}
