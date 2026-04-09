import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="font-heading text-sm font-bold tracking-[-0.02em] text-foreground">
                Teamwise
              </p>
              <p className="text-[0.7rem] font-medium text-muted-foreground">Respiratory Therapy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 lg:py-20">
        <div className="max-w-2xl space-y-4">
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            Scheduling, availability, and coverage in one place
          </h1>
          <p className="max-w-xl text-base text-foreground/80">
            A simple way for therapists and managers to stay aligned on staffing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="min-w-[140px]">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="min-w-[140px]">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Your manager will need to approve your account before your first sign-in.
        </p>
        <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-border/60 shadow-sm">
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
      </section>
    </main>
  )
}
