# PDF image OCR fallback (availability intake)

**Status:** Implemented (2026-04-13). Canonical product spec: `docs/superpowers/specs/2026-04-13-pdf-image-ocr-fallback-design.md`.

## Summary

When OpenAI `input_file` PDF extraction returns no usable text (`NO_TEXT` / skipped), rasterize every PDF page with `pdf-to-img`, run the existing image OCR path per page, concatenate with `--- Page N ---` separators, and return `ocr_status: completed` with combined `ocr_text` for the parser.

## Code

- `src/lib/pdf-render-pages.ts` — `renderPdfToPngPages` (dynamic `import('pdf-to-img')`).
- `src/lib/openai-ocr.ts` — `extractTextFromPdfViaInputFile`, `extractTextFromPdfViaRenderedPages`, `extractTextFromPdfAttachment` orchestration.
- `next.config.ts` — `serverExternalPackages: ['pdf-to-img', 'pdfjs-dist']`.
- `src/lib/openai-ocr.test.ts` — fallback and partial page failure coverage (mocked rasterizer).

## Dependency

- `pdf-to-img` (pulls `pdfjs-dist`).
