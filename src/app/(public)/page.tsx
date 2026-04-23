import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Scheduling for respiratory therapy teams',
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
    <div className="min-h-screen bg-background" style={{ fontFamily: 'inherit' }}>
      {/* ── Hero: full-bleed dark teal ── */}
      <div className="relative overflow-hidden bg-[var(--sidebar)]">
        {/* Grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Amber right stripe */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-[5px] opacity-80"
          style={{ background: 'var(--attention)' }}
        />

        {/* Nav */}
        <nav className="relative flex h-[62px] items-center justify-between px-[52px]">
          <Link href="/" className="flex items-center gap-2.5 hover:no-underline">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px]"
              style={{ background: 'var(--attention)' }}
            >
              <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                <rect
                  x="2.5"
                  y="4"
                  width="15"
                  height="13"
                  rx="2"
                  stroke="white"
                  strokeWidth="1.6"
                />
                <line x1="2.5" y1="8" x2="17.5" y2="8" stroke="white" strokeWidth="1.6" />
                <line
                  x1="7"
                  y1="2"
                  x2="7"
                  y2="5.5"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <line
                  x1="13"
                  y1="2"
                  x2="13"
                  y2="5.5"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-tight text-white">Teamwise</span>
              <span
                className="block text-[11px] leading-none"
                style={{ color: 'rgba(255,255,255,0.45)', marginTop: 1 }}
              >
                Respiratory Therapy
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-lg px-[14px] py-2 text-[13.5px] font-medium hover:no-underline"
              style={{ color: 'rgba(255,255,255,0.55)', background: 'none' }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg px-5 py-[9px] text-[13.5px] font-bold hover:brightness-110 hover:no-underline"
              style={{
                background: 'var(--attention)',
                color: 'var(--sidebar)',
                whiteSpace: 'nowrap',
              }}
            >
              Create account
            </Link>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="relative mx-auto max-w-[900px] px-[52px] pb-[84px] pt-[72px]">
          <div className="mb-[30px] flex items-center gap-3">
            <div
              className="h-[2.5px] w-8 shrink-0 rounded-sm"
              style={{ background: 'var(--attention)' }}
            />
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.18em]"
              style={{
                color: 'rgba(255,255,255,0.45)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.18em',
              }}
            >
              Scheduling for RT teams
            </span>
          </div>

          <h1
            className="font-display mb-7 max-w-[780px] text-[80px] font-normal leading-[1.0] text-white"
            style={{ letterSpacing: '-0.01em' }}
          >
            Scheduling that keeps care moving.
          </h1>

          <p
            className="mb-12 max-w-[480px] text-[17px] leading-[1.65]"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Coverage planning, availability, and shift management — built for RT departments that
            can&apos;t afford gaps.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-8 py-[14px] text-[15px] font-bold hover:brightness-110 hover:no-underline"
              style={{
                background: 'var(--attention)',
                color: 'var(--sidebar)',
                whiteSpace: 'nowrap',
              }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border px-8 py-[14px] text-[15px] font-medium text-white hover:no-underline"
              style={{
                borderColor: 'rgba(255,255,255,0.22)',
                background: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Request access
            </Link>
            <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Manager approval required.
            </span>
          </div>
        </div>

        {/* Section break */}
        <div className="relative h-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="absolute left-[52px] top-[-4px] h-2 w-2 rounded-full"
            style={{ background: 'var(--attention)' }}
          />
        </div>
      </div>

      {/* ── Feature strip ── */}
      <div className="mx-auto max-w-[900px] px-[52px] pb-16 pt-[52px]">
        <div className="grid grid-cols-3 gap-12">
          {features.map(({ title, body }) => (
            <div key={title}>
              <div
                className="mb-[14px] h-[3px] w-7 rounded-sm"
                style={{ background: 'var(--attention)' }}
              />
              <div className="mb-2 text-[14px] font-bold text-foreground">{title}</div>
              <div className="text-[13px] leading-[1.65] text-muted-foreground">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
