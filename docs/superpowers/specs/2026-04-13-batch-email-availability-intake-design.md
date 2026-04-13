# Batch Email Availability Intake Design

Date: 2026-04-13
Routes: `/availability`, `/api/inbound/availability-email`

## Goal

Allow a manager to email multiple PTO or availability forms at once and have the app ingest both the email body and attachments, auto-apply clear requests to staff availability, and route only unclear items into a manager review queue.

## Approved Direction

- Extend the existing availability email intake flow instead of building a separate subsystem.
- Treat one inbound email as a batch that can produce many independently processed intake items.
- Read both the email body and attachments.
- Use the employee named on each form as the primary identity signal.
- Auto-apply only high-confidence items.
- Route unclear items into a manager review queue without blocking the rest of the batch.
- Preserve source text, OCR results, confidence reasons, and apply results for every item.

## Non-Goals

- No attempt to support arbitrary document workflows outside staff availability intake.
- No fully autonomous approval of low-confidence forms.
- No replacement of the current `/availability` workspace.
- No dependency on sender email as the primary employee identifier.
- No all-or-nothing batch behavior where one bad form blocks the rest.

## Current Problem

The current intake path already supports:

- inbound email webhook processing
- OCR for image attachments
- manager-side intake review and apply flow

But it is currently shaped around a single email-level parse result:

- one inbound email becomes one intake row
- attachment OCR text is merged into one combined parse payload
- parsing assumes a mostly text-first request rather than many independent forms
- the manager queue does not distinguish clean items from unclear items inside the same email

That structure is too coarse for the desired workflow. One email may contain:

- multiple attached forms for different employees
- usable body text plus attachments
- some forms that are clear and safe to apply
- other forms that are unreadable or ambiguous

The system needs item-level processing, not just email-level processing.

## Target Experience

### Manager Workflow

1. Manager sends or forwards one email containing one or more forms.
2. The system receives the email and creates one email batch.
3. The system creates one intake item for the body when the body has request content.
4. The system creates one intake item per attachment.
5. Each item is OCR'd or normalized independently, then interpreted into structured requests.
6. High-confidence items auto-apply to availability.
7. Unclear items appear in a review queue on `/availability`.
8. The manager reviews only the exceptions, fixes employee/date/cycle matches when needed, and applies them.

### System Behavior

- One bad attachment does not block the rest of the email.
- One ambiguous form does not prevent clean forms in the same email from auto-applying.
- Every applied date remains traceable to its source email and source item.

## Recommended Product Model

Keep the existing email intake concept, but split it into two levels:

### Email Batch

Represents the inbound message itself:

- sender
- subject
- received timestamp
- raw body metadata
- aggregate counts
- overall batch status

### Intake Item

Represents one actionable source inside the email:

- source type: `body` or `attachment`
- source label: attachment filename or `Email body`
- normalized text used for parsing
- OCR metadata
- extracted employee name candidates
- matched employee id
- matched cycle id
- parsed requests
- confidence status and reasons
- item apply status

This preserves the useful current inbox model while making the unit of work small enough to process safely.

## Data Model

### Recommended Schema Shape

Keep `availability_email_intakes` as the batch-level record for backward compatibility, and add a child table for item-level processing.

Suggested child table: `availability_email_intake_items`

Suggested columns:

- `id`
- `intake_id`
- `source_type` (`body`, `attachment`)
- `source_label`
- `attachment_id` nullable
- `raw_text`
- `ocr_status`
- `ocr_model`
- `ocr_error`
- `parse_status` (`parsed`, `auto_applied`, `needs_review`, `failed`)
- `confidence_level` (`high`, `medium`, `low`)
- `confidence_reasons` jsonb
- `extracted_employee_name`
- `employee_match_candidates` jsonb
- `matched_therapist_id`
- `matched_cycle_id`
- `parsed_requests` jsonb
- `unresolved_lines` jsonb
- `auto_applied_at`
- `auto_applied_by`
- `apply_error`
- `reviewed_at`
- `reviewed_by`

Suggested batch-level additions to `availability_email_intakes`:

- `batch_status`
- `item_count`
- `auto_applied_count`
- `needs_review_count`
- `failed_count`

### Why This Shape

- It avoids forcing a full rewrite of the existing intake infrastructure.
- It allows the manager UI to summarize by email while still acting on each item independently.
- It makes audits and retries straightforward.

## Extraction Pipeline

Each inbound email should run through these stages:

### 1. Source Expansion

Generate candidate intake items from:

- email body text
- each attachment

Do not merge all OCR and body text into one parse payload anymore.

### 2. Source Normalization

For each item:

- body text is cleaned to plain text
- image attachments go through the existing OCR path
- PDFs are text-extracted when possible, with OCR fallback when text extraction yields no usable content
- normalization output is stored as `raw_text`

### 3. Structured Interpretation

For each normalized item, extract:

- employee name
- request intent
- one or more dates
- optional notes/source lines
- confidence reasons

The parser should continue using the existing date and intent parsing logic where possible, but employee extraction becomes a first-class concern instead of assuming the sender identity.

## Employee Matching

Employee matching must prioritize the employee named in the form or body text.

### Matching Rules

1. Exact full-name match against active employee profiles.
2. Normalized-name match that ignores punctuation, repeated spaces, and case.
3. Fuzzy match only as a review aid, not an auto-apply path, unless it resolves uniquely and confidently.
4. Sender email may be stored as supporting context, but should not override a conflicting form name.

### Auto-Apply Safety Rule

Auto-apply requires exactly one employee match from form content.

If the extracted name maps to:

- zero employees: `needs_review`
- multiple employees: `needs_review`
- one employee with weak extraction confidence: `needs_review`

## Request Interpretation

The parser should support both the current text-style requests and form-style PTO edits.

### Supported Request Sources

- freeform email body text such as "Need off Apr 14 and Apr 16"
- PTO edit form text extracted by OCR
- mixed-content emails where the body and attachments both contain requests

### Default Request Meaning

For PTO-style forms, the default interpretation should be `force_off` unless the content clearly indicates availability or must-work language.

### Date Rules

- Parse multiple dates from the same item.
- Resolve dates to exactly one cycle when possible.
- If parsed dates span multiple cycles, send the item to review.
- Preserve unresolved source lines so the manager can inspect them.

## Confidence Model

Do not use a confidence score as a black box. Store explicit reasons that explain why an item is safe or unsafe.

### High Confidence

All of the following are true:

- exactly one employee match from the form/body content
- at least one valid request date
- exactly one cycle match for all parsed dates
- request intent is clear
- no unresolved lines that materially change meaning

### Medium Confidence

Useful data was extracted, but one of these remains:

- fuzzy employee match
- partial date resolution
- extra unresolved lines
- weak form readability

Medium-confidence items go to review.

### Low Confidence

Examples:

- employee missing or ambiguous
- no usable dates
- contradictory intent
- OCR output too noisy to trust

Low-confidence items go to review or fail if no actionable data exists.

## Auto-Apply Policy

Auto-apply an item only when:

- confidence is high
- employee match is unique
- cycle match is unique
- at least one parsed request exists

When auto-applying:

- write the requests into `availability_overrides`
- mark the item as `auto_applied`
- preserve source metadata in the note/audit trail
- update the parent batch counts

Auto-apply should happen per item, not per batch.

## Review Queue

The manager-facing queue on `/availability` should become exception-oriented.

### Batch Summary

For each email batch, show:

- sender
- subject
- received time
- total items found
- auto-applied count
- needs-review count
- failed count

### Review Item Card

For each review item, show:

- source type and source label
- extracted employee name
- matched employee or unresolved state
- extracted dates
- request type
- confidence level
- confidence reason badges
- OCR/parsed text preview

### Review Actions

- assign or correct employee
- assign or correct cycle
- edit or remove dates
- apply the item
- dismiss or mark failed if unusable

This keeps manager effort focused on exceptions instead of forcing manual confirmation for every form.

## Error Handling

Failures must be isolated to the item level.

### Item-Level Failure Cases

- attachment download failure
- OCR failure
- no readable text
- no employee extracted
- no usable dates
- apply mutation failure

### Batch-Level Behavior

- continue processing remaining items even if one item fails
- mark the batch summary from child item outcomes
- never lose the source record just because one step failed

## Audit And Traceability

Every applied override should remain explainable later.

Recommended trace fields in notes or audit metadata:

- inbound email batch id
- intake item id
- source label
- extracted employee name
- whether the item was auto-applied or manager-reviewed

This is important for schedule disputes and later debugging.

## Migration Strategy

Prefer an additive migration path:

1. add item table
2. keep existing batch table and webhook route
3. update webhook processing to emit items instead of one combined parse result
4. update manager UI to render batch summaries plus item review cards
5. update apply actions to operate at the item level

This keeps the rollout reversible and minimizes disruption to the existing intake flow.

## Testing Strategy

- Unit tests for employee-name extraction and normalization
- Unit tests for exact, fuzzy, ambiguous, and missing employee matching
- Unit tests for form-style PTO parsing and mixed body-plus-attachment parsing
- Unit tests for confidence classification
- Integration tests for item-level auto-apply versus review routing
- Integration tests proving one email with multiple forms creates multiple intake items
- Integration tests proving one failed item does not block clean items in the same batch
- UI tests for review queue rendering and manual correction actions

## Acceptance Criteria

- One inbound email can produce multiple intake items from both body text and attachments.
- The system identifies employees primarily from form content, not sender email.
- High-confidence items auto-apply to `availability_overrides`.
- Ambiguous or unclear items go to a manager review queue.
- One failed or unclear item does not block the rest of the batch.
- Managers can review and fix unresolved items from `/availability`.
- Applied availability changes remain traceable to their source email and source item.
