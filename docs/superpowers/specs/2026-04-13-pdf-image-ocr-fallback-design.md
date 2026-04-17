# PDF Image OCR Fallback for Availability Intake

## Goal

When PDF extraction returns no text for scanned request forms, render all PDF pages to images and run image OCR so intake items can be parsed and auto‑applied.

## Non-Goals

- Changing the upstream inbound delivery flow.
- Introducing background jobs or async processing.
- Adding page caps or cost controls (explicitly requested “no cap”).

## Current State

- Inbound intake uses `extractTextFromPdfAttachment` for PDFs and `extractTextFromImageAttachment` for images.
- If PDF extraction returns `NO_TEXT`, the attachment is marked `skipped` and produces no parsed requests.
- Scanned PDFs often return `NO_TEXT` because they contain images, not text.

## Approach

If PDF extraction yields no text, convert the PDF to images and OCR all pages using the existing image OCR path. Concatenate per‑page OCR text and feed the result into the existing parser and auto‑apply logic.

## Design

### 1) PDF to Image OCR Fallback

- Detect the `NO_TEXT` result from PDF extraction.
- Render **all** pages to images (no page cap).
- Run `extractTextFromImageAttachment` on each page.
- Concatenate text in page order with clear separators.
- Store the combined text as the attachment’s `ocr_text` and mark `ocr_status = completed` (or a new distinct fallback status).
- Feed combined text into `parseAvailabilityEmailItem` to produce intake items.

### 2) Resilience

- If one page OCR fails, continue with other pages and still store partial results.
- If all pages fail, keep `ocr_status = failed` and preserve error metadata for review.
- Preserve existing attachment size limits and error handling.

## Testing

- Unit test: PDF extraction returns `NO_TEXT`, fallback image OCR runs, parsed requests are produced.
- Unit test: one page OCR fails, others succeed; combined text still yields parsed requests.

## Risks

- Higher latency and cost per scanned PDF.
- Large PDFs could exceed processing time in a single webhook call.

## Acceptance Criteria

- Scanned PDF attachments yield non‑empty `ocr_text`.
- Intake items are created and parsing succeeds when dates are present.
- Auto‑apply works for high‑confidence matches as before.
