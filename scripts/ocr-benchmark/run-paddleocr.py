import argparse
import json
import time
from pathlib import Path


DEFAULT_MANIFEST = "scripts/ocr-benchmark/manifest.local.json"
DEFAULT_OUTPUT = "output/ocr-benchmark/paddleocr.json"


def parse_args():
    parser = argparse.ArgumentParser(description="Run PaddleOCR against the OCR benchmark manifest.")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--lang", default="en")
    return parser.parse_args()


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def to_plain(value):
    if value is None:
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {str(key): to_plain(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [to_plain(item) for item in value]

    if hasattr(value, "tolist"):
        return value.tolist()

    if hasattr(value, "to_json"):
        try:
            return to_plain(value.to_json())
        except TypeError:
            pass

    if hasattr(value, "json"):
        try:
            return to_plain(value.json)
        except TypeError:
            pass

    if hasattr(value, "__dict__"):
        return to_plain(value.__dict__)

    return str(value)


def collect_text_and_scores(value):
    texts = []
    scores = []

    def visit(node):
        if node is None:
            return

        if isinstance(node, dict):
            rec_texts = node.get("rec_texts")
            if isinstance(rec_texts, list):
                for text in rec_texts:
                    if isinstance(text, str) and text.strip():
                        texts.append(text.strip())

            rec_scores = node.get("rec_scores")
            if isinstance(rec_scores, list):
                for score in rec_scores:
                    if isinstance(score, (int, float)):
                        scores.append(float(score))

            for key in ("text", "transcription"):
                text = node.get(key)
                if isinstance(text, str) and text.strip():
                    texts.append(text.strip())

            score = node.get("score")
            if isinstance(score, (int, float)):
                scores.append(float(score))

            for child in node.values():
                visit(child)
            return

        if isinstance(node, (list, tuple)):
            # PaddleOCR 2.x commonly returns entries shaped like:
            # [box, ("recognized text", score)].
            if (
                len(node) >= 2
                and isinstance(node[1], (list, tuple))
                and len(node[1]) >= 1
                and isinstance(node[1][0], str)
            ):
                text = node[1][0].strip()
                if text:
                    texts.append(text)
                if len(node[1]) >= 2 and isinstance(node[1][1], (int, float)):
                    scores.append(float(node[1][1]))

            for child in node:
                visit(child)

    visit(value)

    deduped_texts = []
    seen = set()
    for text in texts:
        key = text.lower()
        if key not in seen:
            seen.add(key)
            deduped_texts.append(text)

    confidence = sum(scores) / len(scores) if scores else None
    return "\n".join(deduped_texts).strip() or None, confidence


def build_paddle_ocr(lang):
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR is not installed. Install it in a local venv with: "
            'python -m pip install "paddleocr[all]"'
        ) from exc

    try:
        return PaddleOCR(
            lang=lang,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
        )
    except TypeError:
        return PaddleOCR(lang=lang, use_angle_cls=True)


def run_ocr(ocr, file_path):
    if hasattr(ocr, "predict"):
        result = ocr.predict(input=str(file_path))
    elif hasattr(ocr, "ocr"):
        result = ocr.ocr(str(file_path), cls=True)
    else:
        raise RuntimeError("Unsupported PaddleOCR object: no predict() or ocr() method.")

    plain = to_plain(result)
    text, confidence = collect_text_and_scores(plain)
    return text, confidence


def main():
    args = parse_args()
    repo_root = Path.cwd()
    manifest_path = (repo_root / args.manifest).resolve()
    manifest = load_json(manifest_path)
    samples_dir = (repo_root / manifest.get("samplesDir", manifest_path.parent)).resolve()
    output_path = (repo_root / args.output).resolve()

    if not isinstance(manifest.get("cases"), list):
        raise RuntimeError("Manifest must contain a cases array.")

    ocr = build_paddle_ocr(args.lang)
    cases = []

    for test_case in manifest["cases"]:
        started_at = time.perf_counter()
        filename = test_case["filename"]
        file_path = samples_dir / filename

        try:
            text, confidence = run_ocr(ocr, file_path)
            cases.append(
                {
                    "id": test_case.get("id"),
                    "filename": filename,
                    "provider": "paddleocr",
                    "durationMs": round((time.perf_counter() - started_at) * 1000),
                    "status": "completed" if text else "skipped",
                    "text": text,
                    "model": "paddleocr",
                    "confidence": confidence,
                    "error": None if text else "PaddleOCR produced no readable text.",
                }
            )
        except Exception as exc:
            cases.append(
                {
                    "id": test_case.get("id"),
                    "filename": filename,
                    "provider": "paddleocr",
                    "durationMs": round((time.perf_counter() - started_at) * 1000),
                    "status": "failed",
                    "text": None,
                    "model": "paddleocr",
                    "confidence": None,
                    "error": str(exc),
                }
            )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "manifest": str(manifest_path.relative_to(repo_root)),
                "provider": "paddleocr",
                "cases": cases,
            },
            handle,
            indent=2,
        )
        handle.write("\n")

    print(f"Wrote {len(cases)} PaddleOCR result(s) to {output_path.relative_to(repo_root)}")


if __name__ == "__main__":
    main()
