# Email PDF Intake Parsing and Manual Upload Removal

## Goal

Enable reliable parsing of emailed PDF request forms so high-confidence items can auto-apply, and remove the manual upload intake path from the UI and server actions.

## Non-Goals

- Changing the upstream inbound delivery provider behavior.
- Introducing a new background worker or queue.
- Modifying intake database tables beyond fields already in use.

## Current State Summary

- Inbound webhook `POST /api/inbound/availability-email` fetches email content + attachments from Resend, parses text and OCR results, and can auto-apply when confidence is high.
- PDFs are currently stored but not parsed, so they require manual review.
- Manual intake exists on `/availability` and uses the same tables as inbound.

## Approach

**Recommended approach:** In-process PDF text extraction inside the inbound webhook, then pass extracted PDF text through existing `parseAvailabilityEmailItem` logic, enabling auto-apply when confidence is high.

### Why

- Minimal architectural change.
- Reuses existing item-level parsing and auto-apply logic.
- Keeps intake processing synchronous and observable.

## Design

### 1) PDF Parsing in Inbound Intake

- For each PDF attachment, attempt text extraction before building parsed items.
- Use extracted text as the attachment `rawText` source fed into `parseAvailabilityEmailItem`.
- Preserve attachment storage; store extracted text into the same attachment text field used for OCR (`ocr_text`), along with a distinct `ocr_status` value indicating PDF text extraction where possible.
- Auto-apply remains gated by existing high-confidence rules:
  - `confidenceLevel === 'high'`
  - `matchedTherapistId` present
  - `matchedCycleId` present
  - `requests.length > 0`

### 2) Manual Upload Removal

- Remove the manual intake UI from `/availability`.
- Remove server actions and UI components that power manual intake.
- Keep intake tables in the database; only eliminate the manual entry path.
- Update docs to reflect email‑only intake.

## Data Flow

1. Resend posts `email.received` webhook to `/api/inbound/availability-email`.
2. Server fetches email content and attachments.
3. For PDF attachments, extract text (if possible) and feed into parser.
4. Parser produces item(s) with confidence and match metadata.
5. Intake items are stored; high-confidence items auto-apply to `availability_overrides`.

## Edge Cases

- PDFs with no extractable text should fall back to `ocr_status = 'failed'` and require manager review.
- Large PDFs or oversized attachments should continue to respect current size limits.

## Testing

- Unit test: inbound webhook with a PDF attachment yields parsed items and auto-applies when confidence is high.
- UI test: `/availability` no longer renders manual intake controls.

## Risks

- Some PDFs are scans without embedded text; they will still require manual review.
- Removing manual intake eliminates a fallback path for operations; must ensure inbound is stable before rollout.

## Acceptance Criteria

- PDF attachments produce parsed items in `availability_email_intake_items`.
- High-confidence PDF items auto-apply to `availability_overrides`.
- Manual intake UI/actions are removed and no longer reachable.
- Tests cover PDF parsing and manual intake removal.
