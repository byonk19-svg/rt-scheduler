# OCR Benchmark

This folder is for comparing the current availability intake OCR path against
PaddleOCR on the same local PTO/scheduling documents.

The benchmark is intentionally local-only. Do not commit real intake emails,
attachments, screenshots, PDFs, OCR output, or anything containing patient,
employee, or staffing details.

## Files

- `manifest.example.json` documents the manifest shape.
- `run-current-ocr.mjs` runs the app's current OCR path through
  `src/lib/openai-ocr.ts`.
- `run-paddleocr.py` runs PaddleOCR locally if you install it in a Python
  environment.
- `score-results.mjs` compares OCR output against expected field values.

## Local Setup

1. Create an ignored local sample folder:

   ```powershell
   New-Item -ItemType Directory -Force scripts/ocr-benchmark/samples
   ```

2. Copy redacted sample PDFs/images into that folder.

3. Copy the example manifest and edit it for those local files:

   ```powershell
   Copy-Item scripts/ocr-benchmark/manifest.example.json scripts/ocr-benchmark/manifest.local.json
   ```

4. Run the current app OCR path:

   ```powershell
   node --env-file=.env.local scripts/ocr-benchmark/run-current-ocr.mjs --manifest scripts/ocr-benchmark/manifest.local.json
   ```

5. Install PaddleOCR in a local virtual environment. On Windows, prefer Python
   3.12 and the pinned CPU versions below. The newer `paddlepaddle==3.3.0`
   CPU wheel has shown oneDNN/PIR inference failures on this benchmark.

   ```powershell
   py -3.12 -m venv scripts/ocr-benchmark/.venv312
   .\scripts\ocr-benchmark\.venv312\Scripts\python.exe -m pip install --upgrade pip
   .\scripts\ocr-benchmark\.venv312\Scripts\python.exe -m pip install paddlepaddle==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
   .\scripts\ocr-benchmark\.venv312\Scripts\python.exe -m pip install paddleocr==3.3.3
   ```

6. Run PaddleOCR:

   ```powershell
   .\scripts\ocr-benchmark\.venv312\Scripts\python.exe scripts/ocr-benchmark/run-paddleocr.py --manifest scripts/ocr-benchmark/manifest.local.json
   ```

7. Score both outputs:

   ```powershell
   node scripts/ocr-benchmark/score-results.mjs --manifest scripts/ocr-benchmark/manifest.local.json
   ```

## Scoring Rule

Treat field recovery as the source of truth:

- employee name
- requested dates
- request type (`force_off` or `force_on`)
- note text
- whether the OCR result is safe enough for auto-apply or must stay in manager
  review

Raw text volume is not a win if the dates or request intent are wrong.
