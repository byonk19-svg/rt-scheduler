# Design System — Teamwise (RT Scheduler)

## Product Context

- **What this is:** A web application for respiratory therapy scheduling — six-week coverage cycles, availability intake, publish workflows, and role-aware dashboards for managers and clinical staff.
- **Who it's for:** Hospital and department managers (planning, publish, roster edits) and therapists/leads (availability, schedule visibility, operational status).
- **Space/industry:** Healthcare operations / workforce scheduling SaaS — users expect trust, legibility under stress, and fast scanning of dense calendars.
- **Project type:** Web app / operational dashboard (Next.js App Router) with a smaller marketing/auth shell on public routes.

## Aesthetic Direction

- **Direction:** Industrial/utilitarian with calm warmth — “control room” clarity on schedule surfaces, softened by a paper-like canvas so the product feels human, not sterile ERP.
- **Decoration level:** Intentional but minimal — avoid heavy gradients, illustration clutter, or decorative noise behind data grids.
- **Mood:** Confident, calm, and direct. Managers should feel in control; staff should read status at a glance.
- **Reference research:** Healthcare scheduling UX emphasizes accessibility, reduced cognitive load, semantic status color, and mobile-friendly density (see industry write-ups on healthcare dashboards and nurse scheduling UX — patterns inform this doc; no single competitor is copied).

## Typography

- **Display/Hero (marketing + rare page titles):** Instrument Serif — editorial old-style serif loaded at weight 400 only; used on the landing hero h1, auth left panel headline, and any future display moments. CSS class: `font-display`.
- **Body/UI:** Plus Jakarta Sans — clean modern geometric sans; primary interface type for all app surfaces. Replaces DM Sans. Integrated via `globals.css` / Next font pipeline with CSS var `--font-plus-jakarta-sans`.
- **UI/Labels:** Same family as body; use weight (500–700) and letter-spacing for hierarchy instead of a third sans.
- **Data/Tables:** Plus Jakarta Sans with `font-variant-numeric: tabular-nums` on counts, times, and schedule columns so digits align in coverage views.
- **Code:** Geist Mono (or system monospace stack) for technical surfaces, IDs, and developer-facing diagnostics.
- **Loading:** Google Fonts via `next/font` — Instrument Serif (display, weight 400 normal+italic) in `(public)/layout.tsx`; Plus Jakarta Sans (all weights) in root `layout.tsx`.
- **Scale (initial targets):**
  - `text-xs` 0.75rem / labels, meta
  - `text-sm` 0.875rem / dense table cells
  - `text-base` 1rem / default body
  - `text-lg`–`text-xl` section headers
  - `text-2xl`+ reserved for page titles and marketing hero

## Color

- **Approach:** Restrained — one dominant primary for actions and wayfinding, neutrals for surfaces, semantic colors reserved for meaning.
- **Source of truth:** the `Refined.html` design handoff (see `Refined design handoff (2026-04-27)` below). Token values mirror that file. Do not "preserve the brand" by reverting to older HSL values found in git history — the design handoff is canonical.
- **Primary (button teal):** `#276e66` (HSL reference `174 48% 29%`) — primary buttons, key links, focus rings. Replaces the earlier `#1e5c64` / `hsl(187 55% 28%)` (a bluer teal that did not match the design).
- **Hero / auth-panel teal:** `#1b3836` (HSL reference `174 35% 16%`) — exposed as `--marketing-hero-bg`. Used by the homepage hero, both auth left brand panels, and the dark variant of `PublicHeader`. **Must not** be aliased back to `var(--primary)`; the hero needs the deeper near-black-green tone.
- **Attention / brand accent:** `#f0a030` (HSL reference `38 90% 55%`) — avatar, logo mark, subtle highlights; **not** a second competing CTA color on forms.
- **Neutrals:** Warm paper field (`#f0ebe1` ≈ `hsl(38 24% 91%)` background), off-white cards, cool-warm slate text (`~hsl(220 25% 12%)` foreground), muted lines at `~hsl(32 14% 86%)`.
- **Semantic:**
  - Success: green family for “live / healthy / complete” states
  - Warning: amber family for drafts, deadlines, “needs attention”
  - Error: red family for blockers and validation failures
  - Info: blue family for neutral informational callouts  
    Map to existing CSS variables (`--success-*`, `--warning-*`, etc.) and keep pairs legible in WCAG-ish terms.
- **Dark mode:** Reduce saturation ~10–20% on large fields; lift contrast on sidebar text; keep primary legible on dark surfaces (lighter teal is acceptable).

## Spacing

- **Base unit:** 8px (Tailwind default); prefer multiples of 4 only for fine alignment inside components.
- **Density:** Comfortable default for manager surfaces; consider a future “compact” calendar mode rather than shrinking global padding everywhere.
- **Scale:** `2xs` 4 · `xs` 8 · `sm` 12–16 · `md` 16–24 · `lg` 24–32 · `xl` 32–40 · `2xl` 48 · `3xl` 64 (map to Tailwind tokens in implementation).

## Layout

- **Approach:** Hybrid — strict grid alignment and predictable chrome inside the app; marketing may use slightly more expressive vertical rhythm while still sharing tokens.
- **Grid:** 12-column mental model at `lg+`; collapse to single column on mobile with bottom nav or drawer patterns as already established in the app shell.
- **Max content width:** Marketing `min(1120px, 100% - 2rem)`; tool pages often full-width with internal max width on prose blocks only.
- **Border radius:** Hierarchical — small controls 6–8px, cards 10–14px, pills 9999px; avoid one global “bubble radius” on every surface.

## Motion

- **Approach:** Minimal-functional — motion explains state change; no ornamental loops on data-heavy pages.
- **Easing:** Enter `ease-out`, exit `ease-in`, spatial moves `ease-in-out`.
- **Duration:** micro 50–100ms (hover), short 150–220ms (dialogs), medium 250–360ms (page transitions if any).

## Shadow map (elevation utilities)

All elevation uses **named classes** in `src/app/globals.css` (search for `Elevation shadows`). They compose `box-shadow` from **`color-mix(in srgb, var(--foreground) …)`** or **`var(--primary)`** / **`var(--attention)`** / **`var(--destructive)`** / **`var(--warning-border)`** — not hardcoded slate RGB.

**Rules for new UI**

- Prefer an existing **`shadow-tw-*`** class before adding a new one.
- If nothing fits, add a **new utility** next to the others in `globals.css` and document it in the table below — do not use ad-hoc `shadow-[0_…rgba(…)]` in JSX.
- **Print:** on the availability print surface, `shadow-tw-md` and `shadow-tw-md-strong` are stripped (see `@media print` in `globals.css`).

| Class                        | Basis                            | When to use                                                                         |
| ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| `shadow-tw-2xs`              | Foreground hairline (~2%)        | Default “paper edge” on dense cells (e.g. coverage day panel).                      |
| `shadow-tw-2xs-soft`         | Foreground hairline (~3%)        | Softer bottom edge on large bordered shells (e.g. therapist workspace container).   |
| `shadow-tw-xs`               | Foreground hairline (~4%)        | Slightly stronger section divider shadow (e.g. availability request strip).         |
| `shadow-tw-sm`               | Foreground ~5%, small blur       | **Default card** elevation — `Card`, list rows, publish tables, preliminary blocks. |
| `shadow-tw-md`               | Foreground ~6%                   | Cards that need a bit more separation (badges, nested cards).                       |
| `shadow-tw-md-soft`          | Foreground ~5%                   | **Metrics / stats** — `StatsCard`, schedule progress card shell.                    |
| `shadow-tw-md-strong`        | Foreground ~8%                   | **Workspace shells** — availability split, manager scheduling panel.                |
| `shadow-tw-float`            | Foreground ~6%, wider spread     | **Section shells** — shift board header area, notifications list container.         |
| `shadow-tw-float-lg`         | Foreground ~7%, larger spread    | **Hero / summary sections** — staff dashboard featured block.                       |
| `shadow-tw-float-tight`      | Foreground ~5%, 8px spread       | **Tiled cards** — inbox sidebar cards, manager triage secondary `Card`s.            |
| `shadow-tw-pill`             | Foreground ~6%, tight            | **Pills / chips** with numeric content (e.g. coverage headcount badge).             |
| `shadow-tw-inbox-hero`       | Large soft lift                  | **Single hero band** — manager inbox top banner.                                    |
| `shadow-tw-metric`           | Large soft lift                  | **Clickable metric tiles** — inbox KPI link cards.                                  |
| `shadow-tw-panel`            | Large panel depth                | **Primary analytics panel** — schedule progress outer container.                    |
| `shadow-tw-panel-inner`      | Medium depth                     | **Nested panel** inside a panel — schedule progress inner summary.                  |
| `shadow-tw-panel-inner-soft` | Softer medium                    | **Nested callout** — auto-draft dialog inner rule card.                             |
| `shadow-tw-modal`            | Deep modal                       | **Standard dialogs** — cycle management, clear draft confirm.                       |
| `shadow-tw-modal-lg`         | Deeper modal                     | **Large / full-bleed dialogs** — auto-draft confirm shell.                          |
| `shadow-tw-popover`          | Floating near-modal              | **Popovers / floating panels** — assignment status popover.                         |
| `shadow-tw-hero-media`       | Wide marketing lift              | **Marketing imagery** — homepage app preview frame.                                 |
| `shadow-tw-header`           | Double layer (tight + wide)      | **Deprecated page header** chrome — `PageHeader` legacy shell.                      |
| `shadow-tw-double-panel`     | Double layer (stacked)           | **Stacked elevation** — request composer panel on tinted surface.                   |
| `shadow-tw-day-hover`        | Lift on hover                    | **Coverage calendar** — day cell hover (non-warning).                               |
| `shadow-tw-day-warning`      | Hairline + `warning-border` ring | **Coverage** — constraint / warning day tone.                                       |
| `shadow-tw-day-selected`     | Primary ring + primary lift      | **Coverage** — selected day (keyboard / mouse focus).                               |
| `shadow-tw-ring-attention`   | `attention` 1px ring             | **Coverage** — missing-lead day (amber signal, no fill change alone).               |
| `shadow-tw-ring-error-soft`  | `destructive` 1px ring           | **Coverage** — under-staffed / error signal ring.                                   |
| `shadow-tw-cell-error`       | Neutral depth + error context    | **Therapist availability grid** — error cell (pairs with error border/bg).          |
| `shadow-tw-cell-info`        | Slightly lighter depth           | **Therapist availability grid** — info / neutral emphasis cell.                     |
| `shadow-tw-primary-glow`     | Primary-colored glow             | **Primary CTA emphasis** — high-impact actions (e.g. generate draft).               |
| `shadow-tw-inset-highlight`  | Inset top gloss                  | **Inset “specular”** on tinted callout surfaces (warning panel top edge).           |

## Implementation Alignment

- **Source of truth during migration:** `DESIGN.md` states intent; `src/app/globals.css` holds shipped tokens. When they diverge, update CSS in small, testable steps and keep CLAUDE.md constraints (no random hex literals in JSX — use tokens).
- **Anti-slop (explicit):** No purple gradient hero, no three-column “feature + icon circle” filler, no Inter-as-default without a deliberate reason.

### Shipped wiring (2026-04-11)

- **`src/app/layout.tsx`:** `DM_Sans` with CSS variable `--font-dm-sans` (body + UI); `Fraunces` with `--font-display` (loaded on `<html>`). Plus Jakarta removed per typography spec.
- **`src/app/globals.css`:** `--font-sans` resolves to DM Sans; `.font-heading` / `.app-page-title` use sans only; `.font-display` uses `var(--font-display)` for serif display.
- **Marketing / auth:** Homepage hero (`src/app/page.tsx`) and login/signup brand column use `.font-display` for the large line only; forms and page titles stay sans.
- **Data density:** Inbox metric card values use `tabular-nums` (`ManagerTriageDashboard`); extend the same class anywhere counts and dates should align in columns.
- **2026-04-11 (pass 2):** `tabular-nums` on `StatsCard` and shift-board `KpiTile` values; `Geist_Mono` loaded in `layout.tsx` with `--font-geist-mono` (see `@theme` `--font-mono`); decorative backgrounds in `globals.css` (`.teamwise-grid-bg*`, `.teamwise-aurora-bg`, table row hover, new `.teamwise-hero-grid-bg`) use `color-mix` with `var(--primary)` / `var(--muted)` instead of hardcoded RGB; homepage hero grid uses `.teamwise-hero-grid-bg`; `StatsCard` shadow uses `color-mix` with `var(--foreground)`.
- **2026-04-11 (pass 3 — elevation):** Legacy arbitrary slate shadows removed; canonical list and usage guidance is **Shadow map** above (source: `globals.css` → `Elevation shadows`).
- **2026-04-12 (homepage — luminous shell):** Public `/` originally added `--home-glow-warm`, `--home-glow-cool`, `--home-panel`, `--home-panel-border`, `--home-shadow` plus `.teamwise-home-luminous`, `.teamwise-home-grid`, `.teamwise-home-preview-shell`, `.teamwise-home-preview-sheen` utilities. **Removed 2026-04-27** when the homepage was redesigned to the dark-teal hero — these utilities are no longer present in `globals.css`.

### Shipped wiring (2026-04-25)

- **Typography reversal:** `DM_Sans` + `Fraunces` swapped back to **Plus Jakarta Sans** (body/UI, `--font-plus-jakarta-sans`) + **Instrument Serif** (display, `--font-display`). Reflects the updated typography section above; replaces the 2026-04-11 wiring entry.

### Shipped wiring (2026-04-27)

- **Public surface trim:** Homepage feature strip removed (no longer markets to a public audience — this is an internal RT-dept tool); auth-page brand panels stop duplicating the homepage hero copy. `/login` left panel says "Welcome back."; `/signup` left panel says "New here?" + the manager-approval explanation.
- **New tokens in `:root`:** `--marketing-hero-bg: var(--primary)` (single alias used by `/`, `/login`, `/signup` brand panels) and `--scrim: color-mix(in srgb, var(--foreground) 50%, transparent)` (used by `<DialogOverlay>` instead of `bg-black/50`).
- **Dark-mode brand color fix:** `--primary` (and `--ring`, `--highlight`, `--chart-1`) in `.dark` moved from `hsl(203 93% 35%)` (blue) → `hsl(187 60% 50%)` (lifted teal). Brand identity now stays in the 187° hue family across light/dark; `--primary-foreground` flipped to dark text in dark mode for AA contrast on the lighter teal.
- **Dead CSS removed:** `--home-glow-warm`, `--home-glow-cool`, `--home-panel`, `--home-panel-border`, `--home-shadow` tokens and `.teamwise-home-luminous`, `.teamwise-home-grid`, `.teamwise-home-preview-shell`, `.teamwise-home-preview-sheen` utilities deleted from `globals.css` (unused outside tests).
- **On-dark contrast pass:** All ad-hoc `text-white/22..50` opacity values on the dark teal hero/auth panels raised to `/70` (eyebrow / large-tracked) or `/85` (body) so on-dark text passes WCAG AA on `--primary`. Outline-button border bumped from `/22` to `/40`.

### Refined design handoff (2026-04-27)

This wiring entry **supersedes everything above for the public/auth surfaces** and is the new source of truth. The user pulled a design handoff bundle out of `claude.ai/design` (file: `Teamwise Refined.html`) and asked for it to be implemented as-shipped. Earlier sessions kept "preserving the brand" by re-deriving the older 187° teal from git history; that drift is now locked out by the regression guard in `src/app/globals.test.ts`.

- **Hue shift:** `--primary` moved from `hsl(187 55% 28%)` (bluer teal `#1e5c64`) → `hsl(174 48% 29%)` (greener teal `#276e66`, the design's `--teal-btn`). `--ring`, `--highlight`, `--chart-1`, and the entire `--info-*` family followed the same shift. Dark-mode `--primary` is now `hsl(174 60% 50%)` (lifted teal in the same hue family).
- **`--marketing-hero-bg` is no longer aliased to `--primary`.** It now resolves to `hsl(174 35% 16%)` (the design's `--teal-dark` `#1b3836`) — a deeper, near-black-green teal used by the homepage hero, the `/login` and `/signup` left brand panels, and the dark variant of `PublicHeader`. Re-aliasing it back to `--primary` is what produced the lighter "wrong teal" in earlier production builds.
- **Background warmer paper:** `--background` moved from `hsl(38 18% 96%)` (`#F8F4ED`) → `hsl(38 24% 91%)` (`#f0ebe1`, the design's `--bg-page`).
- **New token `--auth-form-bg`:** `hsl(40 12% 95%)` (≈ design's `--bg-form` `#f5f4f1`) for the auth right-side form-panel surface. Not yet adopted on `/login` and `/signup` (right side still uses `bg-background`); adopt opportunistically.
- **Hero structure restored from the design:** the homepage `/` brings back the 3-up amber-line feature strip below the hero with the design's exact copy. The `/login` and `/signup` left brand panels keep the canonical headline `"Scheduling that keeps care moving."` plus the design's subtext — this reverses the earlier "internal-tool trim" that replaced them with `Welcome back.` / `New here?`.
- **On-dark opacity values restored to design intent:** the design uses `text-white/45` (eyebrow), `text-white/50` (hero subtext), `text-white/30` (approval microcopy), `text-white/[0.42]` (auth-panel subtext), and `border-white/[0.22]` (outline-button border). On the deeper `#1b3836` background the math gives white/50 ≈ AA borderline and white/30 ≈ AA-large-fail by design — these are intentional atmospheric values, not mistakes. If a specific line ever needs to be louder for legibility, bump that line, not the system.

### Regression guard

`src/app/globals.test.ts` enforces:

- Every `--primary:` declaration (root, dark, print) must be in the **174°** hue family. `187°` and `203°` are explicit failures.
- `--marketing-hero-bg` must be a deep teal in the 174° family (lightness 10–19%) and must not alias `var(--primary)`.

`src/app/page.test.ts` enforces:

- The homepage uses `bg-[var(--marketing-hero-bg)]` on the hero `<section>`, not `bg-[var(--primary)]`.
- The 3-up feature strip is present (it is part of the canonical landing page).

## Decisions Log

| Date       | Decision                                                   | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-11 | Initial design system created                              | `/design-consultation` — product context + healthcare scheduling research                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-04-11 | Fraunces for display; DM Sans for UI                       | Split keeps marketing memorable and grids fast to read                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-04-11 | Warm canvas + teal primary + amber attention               | Matches category trust signals while staying distinct from cold gray SaaS                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-04-25 | Plus Jakarta Sans + Instrument Serif (reverses 2026-04-11) | Plus Jakarta reads better in dense schedule grids; Instrument Serif gives the hero a more editorial voice than Fraunces at the chosen size                                                                                                                                                                                                                                                                                                                                                                |
| 2026-04-27 | Stop marketing on public surfaces                          | Internal RT-dept tool, not a SaaS — homepage feature strip and auth-panel marketing copy were addressed at an audience that doesn't exist                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-04-27 | Dark-mode primary stays in teal hue family                 | Brand should not flip hues across light/dark; previous `hsl(203 …)` blue was a different color, not a darker teal                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-04-27 | **`Refined.html` design handoff is the source of truth**   | User pulled a design out of `claude.ai/design` and asked for it implemented as-shipped. `--primary` shifts 187° → 174°, `--marketing-hero-bg` becomes its own deep teal `hsl(174 35% 16%)` (no longer aliased), the homepage feature strip and auth-panel marketing copy are restored. **Reverses** the two preceding 2026-04-27 decisions where they conflict with the handoff — the handoff wins. Regression guard in `globals.test.ts` locks hue 174° and the deep `--marketing-hero-bg` independence. |
