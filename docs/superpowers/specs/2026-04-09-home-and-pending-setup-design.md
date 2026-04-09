# Home Page & Pending-Setup Polish

**Date:** 2026-04-09  
**Status:** Approved for implementation

## Background

Two public-facing pages have minor UX gaps that are worth fixing before production UAT:

1. **Home page (`/`)** — the hero section has ~500px of empty space below the CTAs. The page is otherwise clean and should stay that way.
2. **Pending-setup page (`/pending-setup`)** — copy is functional but doesn't reassure the user that no action is needed on their end.

Note: `.gitignore` already covers `/artifacts/` and `.superpowers/` — no changes needed there.

---

## 1. Home Page

### Goal

Fill the empty space below the CTAs with:

- A one-line approval expectation note (muted text)
- A faded screenshot of the app so new staff know what they're signing into

### Design decisions

- **No layout change** — header, hero h1, subtitle, and CTA buttons stay exactly as-is
- **Approval note** — single muted line between the CTAs and the preview: _"Your manager will need to approve your account before your first sign-in."_ Uses `text-muted-foreground text-sm`
- **App preview image** — the coverage calendar screenshot (`public/images/app-preview.png`) displayed below, cropped from the top, with a CSS gradient fade from transparent → `bg-background` covering the bottom ~50% so it bleeds into the page background naturally
- **Image source** — copy `artifacts/screen-capture/latest/11-manager-coverage-week.png` to `public/images/app-preview.png` (committed to git so it's available in production). Create `public/images/` directory if it doesn't exist.
- **Component** — use `next/image` with `fill` prop inside a `relative` container with an explicit height (e.g. `h-[420px]`). Set `object-position="top"` so the top of the calendar is always visible. Wrap the container in `relative overflow-hidden` for the fade overlay.
- **Fade overlay** — absolutely positioned `div` covering the bottom 50% of the container: `bg-gradient-to-b from-transparent to-[var(--background)]`. Do not use `to-white` — must reference the CSS var to stay correct if theme changes.

### Files changed

- `src/app/page.tsx` — add approval note + preview image section
- `public/images/app-preview.png` — new static asset (copied from artifacts)

---

## 2. Pending-Setup Page

### Goal

Make the "sit tight" state feel calm and clear. No new actions, no links — just better copy.

### Design decisions

- **Default state** (no `?success=access_requested`):
  - h1 unchanged: _"Your account is waiting for approval"_
  - Body copy changes from: _"Thanks for signing up. You'll be able to use the app once your account is approved."_
  - To: _"No action needed on your end. Sit tight while your manager reviews your account — you'll be able to log in once you're approved."_

- **`access_requested` success state** — already has a green callout: _"Access request received. Most approvals are completed within one business day."_ — keep as-is, it's already good

- **Sign out button** — unchanged

### Files changed

- `src/app/pending-setup/page.tsx` — copy update only, no structural changes
