# Handwritten PDF Zone Extraction Design

Date: 2026-04-13
Routes: `/availability`, `/api/inbound/availability-email`

## Goal

Improve inbound availability intake for handwritten multi-page request forms so each scanned PDF page has a much better chance of yielding usable employee names and dates without requiring managers to manually retype the form.

## Approved Direction

- Keep the existing inbound email intake workflow and database model.
- Treat each PDF page as one employee request item.
- Use the known form template to isolate likely handwriting regions instead of OCRing the whole page as one giant block.
- Apply aggressive preprocessing to those regions before OCR.
- Merge the strongest recognized region text back into a single per-page transcript.
- Run the existing employee/date parser on the per-page transcript.
- Stop after this stronger recovery pass; if the page is still unreadable, mark it failed clearly instead of looping forever.

## Non-Goals

- No generic support for arbitrary handwritten documents with unknown layouts.
- No promise that every bad scan can be recovered automatically.
- No manager retyping workflow as the primary answer to OCR failures.
- No changes to the email delivery path, webhook signature flow, or availability override model.
- No all-pages-or-nothing behavior where one unreadable page blocks readable pages from the same email.

## Current Problem

The inbound pipeline is now operational end-to-end:

- email delivery works
- the webhook executes
- PDFs download successfully
- PDFs can be rasterized to page images
- OCR runs on those page images

But the real test document still fails because whole-page OCR on the rendered images returns no useful text. The latest production evidence shows:

- the scanned HCA PDF has 21 pages
- each page is a different employee
- OCR completes for every page variant but returns `NO_TEXT`
- the failure is now document readability, not delivery or packaging

That means generic whole-page OCR is still too blunt for this fixed form.

## Document Model

The uploaded document has these important properties:

- every page uses the same form template
- every page is a different employee
- handwriting can vary in placement inside the form, but it stays within the form's writing areas
- the employee name is handwritten
- the request dates are handwritten

This is a strong signal that we should use a template-aware extraction strategy rather than treating each page as an unconstrained handwritten image.

## Recommended Product Model

Keep one page = one intake item, but change how page text is recovered.

### Today

- render page
- OCR whole page
- parse OCR transcript

### Proposed

- render page
- crop the page into a small set of handwriting zones based on the known template
- create multiple preprocessing variants for each zone
- OCR each zone variant
- keep the strongest text per zone
- merge zone text into one page transcript
- parse that page transcript

This keeps the item-level review and auto-apply flow intact while replacing the weakest step in the pipeline.

## Zone-Based Extraction

### Why Zones

Whole-page OCR has to understand:

- logos
- printed form labels
- empty whitespace
- scan noise
- handwritten content in relatively small regions

That makes it easy for the model to decide there is "no readable scheduling text."

Template-aware cropping improves the signal-to-noise ratio by focusing OCR on the parts of the page that actually matter:

- employee name area
- handwritten request/date area
- optional comment/note area if the form has one

### Zone Definitions

Define a small set of rectangular page zones in normalized coordinates so the same layout works regardless of image resolution.

Suggested first pass:

- `employee_name`
- `request_lines_top`
- `request_lines_mid`
- `request_lines_bottom`
- optional `comments`

Each zone should be intentionally generous rather than too tight, because handwriting placement varies.

### Zone Output

Each zone produces:

- the chosen OCR text
- the variant label that produced it
- a score for how useful the text appears

Those zone outputs are then merged into one per-page transcript in a predictable order:

1. employee name
2. request zones top-to-bottom
3. optional comments

## Aggressive Preprocessing

Each zone should be transformed into multiple OCR candidates before recognition.

### Recommended Variants

- original crop
- grayscale with boosted contrast
- black/white threshold
- inverted threshold
- rotated 90 degrees
- rotated 270 degrees

These variants target the most likely scan problems:

- low contrast
- gray background wash
- dark handwriting on poor paper
- light handwriting on darkened scan
- sideways or skewed page content

### What Not To Overdo

Do not create an unbounded number of variants. Start with a fixed, small set. The system must stay synchronous in the webhook and avoid exploding latency.

## OCR Selection Logic

For each zone:

1. OCR the variants in a stable order.
2. Score each completed transcript.
3. Keep the best-scoring result.
4. Stop early if a result looks clearly usable.

### Simple Scoring Signals

Useful signals for a higher score:

- has two or more name-like words
- contains request words such as `off`, `need off`, `pto`, `available`, `work`
- contains date-like tokens
- has more than a trivial amount of text

This score does not replace the parser. It only chooses the strongest OCR candidate among variants.

## Per-Page Transcript Assembly

Once the best result for each zone is selected, combine them into one transcript for the page.

Example shape:

```text
Employee Name: Brianna Brown

Request Area:
Need off Apr 14, Apr 16
Can work Apr 18
```

This transcript is what feeds the existing parsing pipeline.

## Parsing And Matching

Keep the current item parser and employee/date parsing rules. The main change is the quality of the source text.

Expected downstream benefits:

- employee-name detection should improve because the name zone is isolated
- date extraction should improve because request lines are isolated
- confidence should improve because noise is reduced before parsing

## Auto-Apply Policy

Do not relax the current safety gates.

An item can still auto-apply only when:

- OCR produced usable transcript text
- employee match is unique and high confidence
- cycle match is unique
- one or more valid requests were parsed

Unreadable pages should still fail cleanly instead of forcing low-confidence auto-apply.

## Failure Handling

When the stronger recovery pass still fails, the item should store enough evidence to avoid future blind debugging.

At minimum preserve:

- item OCR status
- OCR error
- selected variant label per zone if available
- merged page transcript if any text was recovered

Failure reasons should clearly distinguish:

- page could not be rendered
- zones produced no readable handwriting
- transcript existed but parser still found no usable employee/date data

## Observability

This pipeline should be inspectable from the database and logs without extra manual instrumentation.

Recommended additions to stored metadata:

- per-zone extraction summaries
- best variant chosen per zone
- per-page transcript length
- count of zones with usable text

This does not need a huge schema redesign. A JSON blob on the item row is acceptable if that keeps the rollout small.

## Testing Strategy

### Unit Tests

- zone extraction returns the expected number of zones for a rendered page
- variant generation produces the expected candidate set
- OCR selection chooses a later variant when earlier variants return `NO_TEXT`
- merged page transcript preserves stable zone order

### Integration Tests

- one scanned PDF page with `NO_TEXT` on early variants but usable text on a later variant becomes `completed`
- multi-page scanned PDF still yields one intake item per page
- one unreadable page does not block another readable page
- OCR failure metadata is stored when all variants fail

### Production Validation

Use the existing replayable HCA scanned PDF as the first live acceptance test. Success is not theoretical; the new flow must improve that real document or clearly prove it is still unreadable after the stronger attempt.

## Acceptance Criteria

- The inbound email workflow still runs synchronously through the existing webhook.
- PDF pages are treated as separate employee request items.
- Each page is cropped into known template zones before OCR.
- Each zone is processed through multiple preprocessing variants.
- The best OCR result per zone is selected and merged into one page transcript.
- Existing employee/date parsing runs on the merged page transcript.
- Readable pages can still auto-apply when confidence is high.
- Unreadable pages fail with explicit stored failure reasons instead of silent `NO_TEXT`.
- The same replayable scanned PDF can be used as the live validation case for this design.

## Recommendation

Implement the zone-based handwritten extraction path before adding any manual rescue workflow.

Reason:

- the form layout is stable
- whole-page OCR has already proven insufficient
- asking managers to retype handwritten forms defeats the point of the scan intake feature
- this is the highest-value remaining automation attempt before conceding a page as unreadable
