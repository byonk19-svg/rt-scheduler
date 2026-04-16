import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'

const trustNotes = [
  'Availability stays visible before the next handoff.',
  'Coverage changes stay clear without the back-and-forth.',
]

const therapistSubcopy =
  'Built for respiratory therapists who need quick shift clarity, fewer back-and-forth messages, and a workspace they can trust before the next handoff.'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="teamwise-home-luminous relative overflow-hidden">
        <div aria-hidden className="teamwise-home-grid absolute inset-0" />
        <div
          aria-hidden
          className="absolute left-[4%] top-24 h-40 w-40 rounded-full bg-[var(--home-glow-warm)] blur-3xl"
        />
        <div
          aria-hidden
          className="absolute right-[8%] top-16 h-56 w-56 rounded-full bg-[var(--home-glow-cool)] blur-3xl"
        />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-16 lg:gap-14 lg:pb-24 lg:pt-24">
          <div className="max-w-3xl space-y-6 fade-up">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--attention)]/25 bg-card/70 px-3.5 py-1.5 text-xs font-semibold tracking-[0.01em] text-[var(--attention)]">
              <CalendarDays className="h-3 w-3" />
              Built for respiratory therapy teams
            </div>

            <div className="space-y-6">
              <h1 className="max-w-[12ch] font-display text-[3.4rem] font-bold leading-[0.97] tracking-[-0.055em] text-foreground sm:text-[4.8rem] lg:text-[6.4rem]">
                Keep your schedule, availability, and coverage in one calm view.
              </h1>
              <p className="max-w-xl text-[1.05rem] leading-7 text-foreground/72 sm:text-lg">
                {therapistSubcopy}
              </p>
            </div>
          </div>

          <div
            className="fade-up flex flex-col gap-4 sm:flex-row sm:items-center"
            style={{ animationDelay: '80ms' }}
          >
            <Button
              asChild
              size="lg"
              className="h-12 min-h-11 min-w-[170px] rounded-xl text-base shadow-tw-primary-glow"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 min-h-11 min-w-[170px] rounded-xl border-border/70 bg-card/75 text-base hover:bg-card"
            >
              <Link href="/signup">Create account</Link>
            </Button>
          </div>

          <div className="fade-up flex flex-col gap-3" style={{ animationDelay: '120ms' }}>
            <p className="text-sm text-muted-foreground">
              Your manager will need to approve your account before your first sign-in.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-foreground/62 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {trustNotes.map((note) => (
                <li key={note} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]/70" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="fade-up relative mt-2 w-full" style={{ animationDelay: '160ms' }}>
            <div
              aria-hidden
              className="absolute inset-x-10 -bottom-10 h-16 rounded-full bg-[var(--home-glow-cool)]/60 blur-3xl"
            />
            <div className="teamwise-home-preview-shell relative overflow-hidden rounded-[2rem] p-3 md:p-4">
              <div
                aria-hidden
                className="teamwise-home-preview-sheen pointer-events-none absolute inset-x-0 top-0 h-24"
              />
              <div className="relative min-h-[320px] overflow-hidden rounded-[1.5rem] border border-border/50 bg-card/85 sm:min-h-[420px] lg:min-h-[500px]">
                <Image
                  src="/images/app-preview.png"
                  alt="Teamwise schedule view"
                  fill
                  className="object-cover object-top"
                  priority
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--background)] via-[rgba(245,241,234,0.84)] to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
