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

        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 lg:gap-y-12">
            <div className="flex flex-col gap-10 lg:col-span-7">
              <div className="fade-up space-y-6 border-l-[5px] border-primary/40 pl-5 sm:pl-7">
                <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-primary/80">
                  Scheduling for RT teams
                </p>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--attention)]/30 bg-card/80 px-4 py-2 text-xs font-semibold tracking-[0.02em] text-[var(--attention)] shadow-tw-sm">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Built for respiratory therapy teams
                </div>

                <div className="space-y-7">
                  <h1 className="max-w-[14ch] text-balance font-display text-[3.65rem] font-bold leading-[0.92] tracking-[-0.058em] text-foreground sm:max-w-[18ch] sm:text-[5.1rem] lg:max-w-[13ch] lg:text-[6.85rem] xl:text-[7.35rem]">
                    Keep your schedule, availability, and coverage in one calm view.
                  </h1>
                  <p className="max-w-xl text-[1.08rem] font-medium leading-8 text-foreground/75 sm:text-lg sm:leading-8">
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
                  className="h-12 min-h-11 min-w-[180px] rounded-xl text-base font-semibold shadow-tw-primary-glow"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 min-h-11 min-w-[180px] rounded-xl border-border/70 bg-card/80 text-base font-semibold hover:bg-card"
                >
                  <Link href="/signup">Create account</Link>
                </Button>
              </div>

              <div className="fade-up flex flex-col gap-4" style={{ animationDelay: '120ms' }}>
                <p className="text-sm text-muted-foreground">
                  Your manager will need to approve your account before your first sign-in.
                </p>
                <ul className="flex flex-col gap-3 border-l border-border/60 pl-4 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:border-l-0 sm:pl-0">
                  {trustNotes.map((note) => (
                    <li key={note} className="flex min-w-0 items-start gap-2.5 sm:items-center">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-[var(--primary)]/80 sm:mt-0 sm:h-1.5 sm:w-1.5 sm:rounded-full" />
                      <span className="text-sm font-medium leading-snug text-foreground/70">
                        {note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className="fade-up relative mt-2 w-full lg:col-span-5 lg:mt-0 lg:pt-4"
              style={{ animationDelay: '160ms' }}
            >
              <div
                aria-hidden
                className="absolute inset-x-6 -bottom-8 h-20 rounded-full bg-[var(--home-glow-cool)]/55 blur-3xl lg:inset-x-2"
              />
              <div className="teamwise-home-preview-shell relative overflow-hidden rounded-[2rem] p-3 ring-1 ring-primary/15 md:p-4">
                <div
                  aria-hidden
                  className="teamwise-home-preview-sheen pointer-events-none absolute inset-x-0 top-0 h-28"
                />
                <div className="relative min-h-[300px] overflow-hidden rounded-[1.5rem] border border-border/50 bg-card/90 sm:min-h-[380px] lg:min-h-[420px]">
                  <Image
                    src="/images/app-preview.png"
                    alt="Teamwise schedule view"
                    fill
                    className="object-cover object-top"
                    priority
                    unoptimized
                  />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[var(--background)] via-[rgba(245,241,234,0.88)] to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
