"""
Design merge audit tool: compare an existing web repo against a Lovable export (folder or zip).

Why this exists:
- When only *some* pages/components update, a directory diff is the fastest way to find what's still old.
- Produces a human-readable report plus optional JSON and a Codex-ready merge plan.

Usage examples:
  python tools/design_merge_audit.py --existing . --lovable path/to/lovable_export.zip
  python tools/design_merge_audit.py --existing . --lovable ../lovable_export --write-plan merge_plan.md
  python tools/design_merge_audit.py --existing . --lovable lovable.zip --json audit.json --grep OldHeader --grep legacy.css

Exit codes:
  0: success
  2: bad arguments / missing paths
"""

from __future__ import annotations

import argparse
import dataclasses
import fnmatch
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import textwrap
import zipfile
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Sequence, Set, Tuple


DEFAULT_EXCLUDES = [
    ".git/**",
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "out/**",
    ".turbo/**",
    ".vercel/**",
    ".netlify/**",
    "coverage/**",
    ".cache/**",
    "tmp/**",
    "temp/**",
    "**/*.log",
]


TEXT_FILE_EXTS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".css", ".scss", ".sass", ".less",
    ".html", ".md", ".mdx",
    ".json", ".yml", ".yaml",
    ".txt",
    ".graphql", ".gql",
}


@dataclasses.dataclass(frozen=True)
class FileInfo:
    relpath: str
    abspath: str
    size: int
    sha256: str


@dataclasses.dataclass
class AuditResult:
    existing_root: str
    lovable_root: str
    excludes: List[str]

    only_in_existing: List[str]
    only_in_lovable: List[str]
    different: List[str]
    same: int

    framework_hints: Dict[str, str]
    cache_hints: List[str]
    grep_hits: Dict[str, List[str]]  # term -> list of relpaths containing it


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _matches_any(path_rel_posix: str, patterns: Sequence[str]) -> bool:
    for pat in patterns:
        if fnmatch.fnmatch(path_rel_posix, pat):
            return True
    return False


def _iter_files(root: Path, excludes: Sequence[str]) -> Iterator[Tuple[str, Path]]:
    root = root.resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        dp = Path(dirpath)

        # Prune excluded directories early
        pruned: List[str] = []
        for d in list(dirnames):
            rel = (dp / d).relative_to(root).as_posix()
            if _matches_any(rel + "/**", excludes) or _matches_any(rel, excludes):
                pruned.append(d)
        for d in pruned:
            dirnames.remove(d)

        for fn in filenames:
            p = dp / fn
            rel = p.relative_to(root).as_posix()
            if _matches_any(rel, excludes):
                continue
            yield rel, p


def _build_index(root: Path, excludes: Sequence[str]) -> Dict[str, FileInfo]:
    idx: Dict[str, FileInfo] = {}
    for rel, p in _iter_files(root, excludes):
        try:
            stat = p.stat()
        except FileNotFoundError:
            continue
        if not p.is_file():
            continue
        idx[rel] = FileInfo(
            relpath=rel,
            abspath=str(p),
            size=stat.st_size,
            sha256=_sha256_file(p),
        )
    return idx


def _read_text_safely(path: Path, limit_bytes: int = 2_000_000) -> Optional[str]:
    try:
        data = path.read_bytes()
    except Exception:
        return None
    if len(data) > limit_bytes:
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return None


def _detect_framework(root: Path) -> Dict[str, str]:
    hints: Dict[str, str] = {}
    pkg = root / "package.json"
    if pkg.exists():
        txt = _read_text_safely(pkg)
        if txt:
            hints["package.json"] = "present"
            if re.search(r'"next"\s*:\s*"', txt):
                hints["framework"] = "Next.js (next)"
            elif re.search(r'"react-scripts"\s*:\s*"', txt):
                hints["framework"] = "Create React App (react-scripts)"
            elif re.search(r'"vite"\s*:\s*"', txt):
                hints["framework"] = "Vite"
            elif re.search(r'"remix"\s*:\s*"', txt):
                hints["framework"] = "Remix"
            elif re.search(r'"@sveltejs/kit"\s*:\s*"', txt):
                hints["framework"] = "SvelteKit"
            elif re.search(r'"nuxt"\s*:\s*"', txt):
                hints["framework"] = "Nuxt"
    for f in ["next.config.js", "vite.config.ts", "vite.config.js", "svelte.config.js", "nuxt.config.ts"]:
        if (root / f).exists():
            hints[f] = "present"
    # Tailwind
    for f in ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.ts"]:
        if (root / f).exists():
            hints["tailwind"] = f
    return hints


def _detect_cache_hints(root: Path, index: Dict[str, FileInfo]) -> List[str]:
    hints: List[str] = []
    candidates = [
        "public/sw.js",
        "public/service-worker.js",
        "src/service-worker.ts",
        "src/service-worker.js",
        "src/sw.ts",
        "src/sw.js",
        "workbox-config.js",
    ]
    for c in candidates:
        if (root / c).exists():
            hints.append(f"Service worker file present: {c} (may cause old assets to persist)")
    # Heuristic: workbox / next-pwa
    pkg = root / "package.json"
    txt = _read_text_safely(pkg) if pkg.exists() else None
    if txt:
        if "workbox" in txt:
            hints.append("Workbox mentioned in package.json (service worker caching likely)")
        if "next-pwa" in txt:
            hints.append("next-pwa mentioned in package.json (PWA/service worker caching likely)")
    # Manifest
    if (root / "public/manifest.json").exists() or (root / "public/manifest.webmanifest").exists():
        hints.append("Web app manifest present (possible PWA; confirm service worker behavior)")
    return hints


def _grep_terms(
    root: Path,
    index: Dict[str, FileInfo],
    terms: Sequence[str],
    excludes: Sequence[str],
) -> Dict[str, List[str]]:
    hits: Dict[str, List[str]] = {t: [] for t in terms}
    if not terms:
        return {}
    # Compile regexes (literal search, case-insensitive)
    regexes = {t: re.compile(re.escape(t), re.IGNORECASE) for t in terms}
    for rel, info in index.items():
        p = Path(info.abspath)
        if p.suffix.lower() not in TEXT_FILE_EXTS:
            continue
        txt = _read_text_safely(p)
        if not txt:
            continue
        for t, rx in regexes.items():
            if rx.search(txt):
                hits[t].append(rel)
    return {k: v for k, v in hits.items() if v}


def _extract_if_zip(path: Path) -> Tuple[Path, Optional[tempfile.TemporaryDirectory]]:
    if path.is_file() and path.suffix.lower() == ".zip":
        td = tempfile.TemporaryDirectory(prefix="lovable_export_")
        out = Path(td.name)
        with zipfile.ZipFile(path, "r") as zf:
            zf.extractall(out)
        # Some zips contain a single top-level folder; normalize to that folder when appropriate.
        children = [p for p in out.iterdir() if p.name not in {"__MACOSX"}]
        if len(children) == 1 and children[0].is_dir():
            return children[0], td
        return out, td
    return path, None


def audit(existing: Path, lovable: Path, excludes: Sequence[str], grep: Sequence[str]) -> AuditResult:
    existing = existing.resolve()
    lovable = lovable.resolve()

    existing_idx = _build_index(existing, excludes)
    lovable_idx = _build_index(lovable, excludes)

    existing_set = set(existing_idx.keys())
    lovable_set = set(lovable_idx.keys())

    only_in_existing = sorted(existing_set - lovable_set)
    only_in_lovable = sorted(lovable_set - existing_set)

    different: List[str] = []
    same = 0
    for rel in sorted(existing_set & lovable_set):
        if existing_idx[rel].sha256 != lovable_idx[rel].sha256:
            different.append(rel)
        else:
            same += 1

    framework_hints = {
        "existing": json.dumps(_detect_framework(existing), ensure_ascii=False),
        "lovable": json.dumps(_detect_framework(lovable), ensure_ascii=False),
    }
    cache_hints = _detect_cache_hints(existing, existing_idx)
    cache_hints += _detect_cache_hints(lovable, lovable_idx)

    grep_hits_existing = _grep_terms(existing, existing_idx, grep, excludes)
    grep_hits_lovable = _grep_terms(lovable, lovable_idx, grep, excludes)

    merged_grep: Dict[str, List[str]] = {}
    for term in set(grep_hits_existing.keys()) | set(grep_hits_lovable.keys()):
        merged: List[str] = []
        for rel in grep_hits_existing.get(term, []):
            merged.append(f"existing:{rel}")
        for rel in grep_hits_lovable.get(term, []):
            merged.append(f"lovable:{rel}")
        merged_grep[term] = merged

    return AuditResult(
        existing_root=str(existing),
        lovable_root=str(lovable),
        excludes=list(excludes),
        only_in_existing=only_in_existing,
        only_in_lovable=only_in_lovable,
        different=different,
        same=same,
        framework_hints=framework_hints,
        cache_hints=sorted(set(cache_hints)),
        grep_hits=merged_grep,
    )


def _write_text_report(res: AuditResult) -> str:
    lines: List[str] = []
    lines.append("=== Design Merge Audit ===")
    lines.append(f"Existing: {res.existing_root}")
    lines.append(f"Lovable:  {res.lovable_root}")
    lines.append("")
    lines.append("Framework hints:")
    lines.append(f"  existing: {res.framework_hints.get('existing', '{}')}")
    lines.append(f"  lovable:  {res.framework_hints.get('lovable', '{}')}")
    lines.append("")
    if res.cache_hints:
        lines.append("Cache/PWA hints (these often explain 'old design still showing'):")
        for h in res.cache_hints:
            lines.append(f"  - {h}")
        lines.append("")

    lines.append("File diff summary:")
    lines.append(f"  Same files:              {res.same}")
    lines.append(f"  Different files:         {len(res.different)}")
    lines.append(f"  Only in existing (old?): {len(res.only_in_existing)}")
    lines.append(f"  Only in lovable (new):   {len(res.only_in_lovable)}")
    lines.append("")

    def emit_list(title: str, items: Sequence[str], limit: int = 200) -> None:
        lines.append(title)
        if not items:
            lines.append("  (none)")
            lines.append("")
            return
        for i, rel in enumerate(items):
            if i >= limit:
                lines.append(f"  ... ({len(items) - limit} more)")
                break
            lines.append(f"  - {rel}")
        lines.append("")

    emit_list("Different files (existing != lovable):", res.different)
    emit_list("Only in lovable (new files you may need to add):", res.only_in_lovable)
    emit_list("Only in existing (legacy files to review/remove):", res.only_in_existing)

    if res.grep_hits:
        lines.append("Grep hits:")
        for term, refs in sorted(res.grep_hits.items(), key=lambda kv: kv[0].lower()):
            lines.append(f"  Term: {term}")
            for r in refs[:200]:
                lines.append(f"    - {r}")
            if len(refs) > 200:
                lines.append(f"    ... ({len(refs) - 200} more)")
        lines.append("")

    return "\n".join(lines)


def _write_merge_plan_md(res: AuditResult, out_path: Path) -> None:
    md = []
    md.append("# Merge Plan (Lovable -> Existing)")
    md.append("")
    md.append("## Goal")
    md.append("Make the existing app match the Lovable design by replacing changed files, adding missing files, and removing legacy design artifacts.")
    md.append("")
    md.append("## High-confidence actions")
    md.append("")
    md.append("### 1) Replace files that differ")
    if res.different:
        md.append("Copy these files from Lovable into Existing (they differ):")
        md.append("")
        for rel in res.different:
            md.append(f"- `{rel}`")
    else:
        md.append("No differing files detected.")
    md.append("")
    md.append("### 2) Add files that only exist in Lovable")
    if res.only_in_lovable:
        md.append("Add these files/directories from Lovable into Existing:")
        md.append("")
        for rel in res.only_in_lovable:
            md.append(f"- `{rel}`")
    else:
        md.append("No new-only Lovable files detected.")
    md.append("")
    md.append("### 3) Review/remove files that only exist in Existing (likely legacy design)")
    if res.only_in_existing:
        md.append("These exist only in Existing. If they are part of the old design, remove or stop importing them:")
        md.append("")
        for rel in res.only_in_existing:
            md.append(f"- `{rel}`")
    else:
        md.append("No existing-only files detected.")
    md.append("")
    if res.cache_hints:
        md.append("## Cache/PWA warning")
        md.append("If you still see old design after merging, unregister the service worker and clear site storage (PWA caching can pin old CSS/JS).")
        md.append("")
        for h in res.cache_hints:
            md.append(f"- {h}")
        md.append("")
    out_path.write_text("\n".join(md), encoding="utf-8")


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(
        prog="design_merge_audit",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=__doc__,
    )
    p.add_argument("--existing", required=True, help="Path to your current repo (the one showing old design).")
    p.add_argument("--lovable", required=True, help="Path to Lovable export folder OR a .zip export.")
    p.add_argument("--exclude", action="append", default=[], help="Glob to exclude (repeatable).")
    p.add_argument("--grep", action="append", default=[], help="Case-insensitive literal term to search for (repeatable).")
    p.add_argument("--json", dest="json_out", help="Write JSON output to this file.")
    p.add_argument("--write-plan", help="Write a merge plan markdown file to this path.")
    args = p.parse_args(argv)

    existing = Path(args.existing)
    lovable_input = Path(args.lovable)

    if not existing.exists():
        print(f"ERROR: --existing path does not exist: {existing}", file=sys.stderr)
        return 2
    if not lovable_input.exists():
        print(f"ERROR: --lovable path does not exist: {lovable_input}", file=sys.stderr)
        return 2

    excludes = DEFAULT_EXCLUDES + args.exclude

    lovable_root, td = _extract_if_zip(lovable_input)
    try:
        res = audit(existing, lovable_root, excludes=excludes, grep=args.grep)

        report = _write_text_report(res)
        print(report)

        if args.json_out:
            out = Path(args.json_out)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(dataclasses.asdict(res), indent=2), encoding="utf-8")

        if args.write_plan:
            out = Path(args.write_plan)
            out.parent.mkdir(parents=True, exist_ok=True)
            _write_merge_plan_md(res, out)

    finally:
        if td is not None:
            td.cleanup()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
