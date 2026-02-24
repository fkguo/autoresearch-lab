# research-writer — M2 Review Packet (end-to-end minimal)

Milestone goal: implement an end-to-end, minimal working research-writer that can scaffold a compilable RevTeX4-2 paper from a research-team-style project (fixture), including provenance wiring, BibTeX hygiene, and deterministic math-escape checks.

## Acceptance criteria
- CLI scaffold works from a fixture project and generates paper/ with main.tex, references.bib, figures/, latexmkrc, README.md
- Paper compiles via latexmk when latexmk exists; otherwise smoke tests skip
- BibTeX hygiene: RevTeX4-2 @article journal workaround exists and is exercised
- Double-backslash-in-math check exists and is exercised
- Results provenance table is generated (links to artifact paths + keys)

## Evidence

### File tree (subset)
```text
./README.md
./ROADMAP.md
./RUNBOOK.md
./SKILL.md
./assets/review/review_packet_template.md
./assets/review/reviewer_output_contract.md
./assets/style/style_profile.md
./assets/style/style_sources_used.md
./assets/style/writing_voice_system_prompt.txt
./assets/templates/latexmkrc
./assets/templates/paper_README.md
./assets/templates/references.bib
./assets/templates/revtex4-2_onecolumn_main.tex
./scripts/bin/check_md_double_backslash.sh
./scripts/bin/fix_bibtex_revtex4_2.py
./scripts/bin/fix_md_double_backslash_math.py
./scripts/bin/research_writer_scaffold.py
./scripts/bin/research_writer_scaffold.sh
./scripts/dev/run_all_smoke_tests.sh
./team/reviewer_system_prompt_claude_opus.md
./team/reviewer_system_prompt_gemini_pro.md
./team/reviews/M0-r1/gemini_prompt.txt
./team/reviews/M0-r1/packet.md
./team/reviews/M0-r1/reviewer_a_claude_opus.md
./team/reviews/M0-r1/reviewer_b_gemini.md
./team/reviews/M1-r1/file_tree.txt
./team/reviews/M1-r1/gemini_prompt.txt
./team/reviews/M1-r1/packet.md
./team/reviews/M1-r1/reviewer_a_claude_opus.md
./team/reviews/M1-r1/reviewer_b_gemini.md
./team/reviews/M1-r1/smoke_output.txt
./team/reviews/M1-r2/file_tree.txt
./team/reviews/M1-r2/gemini_prompt.txt
./team/reviews/M1-r2/packet.md
./team/reviews/M1-r2/reviewer_a_claude_opus.md
./team/reviews/M1-r2/reviewer_b_gemini.md
./team/reviews/M1-r2/smoke_output.txt
./team/reviews/M2-r1/file_tree.txt
./team/reviews/M2-r1/smoke_output.txt
```

### Smoke test output
```text
[smoke] help: scaffold CLI
[smoke] help: bibtex fixer
[smoke] help: double-backslash fixer
[smoke] scaffold: fixture project -> paper/
[ok] patched 1 @article entry(ies) by adding journal="" (e.g. Bezanson2017)
[ok] research-writer scaffold complete
- project root: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.O21CZoARY9/project
- tag: M2-smoke
- out: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.O21CZoARY9/paper
[smoke] markdown double-backslash check: generated paper + skill assets
[smoke] latexmk: compile paper
[smoke] bibtex fixer: adds journal field
[smoke] double-backslash checker+fixer: markdown math only
[smoke] ok
```

---

## File: SKILL.md
```markdown
---
name: research-writer
description: Turn a `research-team` project into an arXiv-ready RevTeX4-2 (12pt, onecolumn) paper draft with provenance tables, BibTeX hygiene, and deterministic Markdown/LaTeX escape checks.
---

# Research Writer

Agent-first skill: given an existing `research-team` project root (with `Draft_Derivation.md`, `knowledge_base/`, and `artifacts/`), scaffold a **coherent, arXiv-ready paper folder** and provide deterministic hygiene checks so the draft is auditable and safe to iterate.

Default paper style:
- RevTeX 4.2, `12pt`, `onecolumn` (English-first).

## Quick start (one-shot scaffold)

```bash
bash scripts/bin/research_writer_scaffold.sh \
  --project-root /path/to/research-team-project \
  --tag M1-r1 \
  --out paper/
```

Optional (best-effort online BibTeX fetch from INSPIRE/DOI; writes `paper/bibtex_trace.jsonl`):

```bash
bash scripts/bin/research_writer_scaffold.sh \
  --project-root /path/to/research-team-project \
  --tag M1-r1 \
  --out paper/ \
  --fetch-bibtex
```

This generates `paper/` containing:
- `paper/main.tex`
- `paper/references.bib`
- `paper/figures/` (symlinks ok)
- `paper/latexmkrc` (or `paper/Makefile`)
- `paper/README.md`

## What it does (conceptually)

1) Reads `Draft_Derivation.md` and builds a paper skeleton that **points back to source sections** (no hallucinated derivations).
2) Pulls headline numbers/figures from `artifacts/` manifests/summaries and writes a **Results provenance** table (artifact path + JSON/CSV key).
3) Produces a BibTeX file with **RevTeX4-2 hygiene** (APS-style safety: ensure `@article` has `journal = ""` if unknown).
4) Runs deterministic hygiene checks, including the **double-backslash-in-math** bug (`\\Delta` instead of `\Delta`) with optional auto-fix.

## Hard policies (must follow)

1) **Scientific skepticism is mandatory**: any external claim used in core reasoning/headline results must be either:
   - independently validated (derivation, limit check, or artifact reproduction), or
   - labeled `UNVERIFIED` with a validation plan + kill criterion.
2) **No hard cutoff on real workflows**: citations/links to software/data archives are allowed (Zenodo/Figshare/institutional repos/experiment pages). Prefer stable anchors; require trace logging rather than forbidding.
3) **Network/DNS robustness**: if metadata/BibTeX fetch fails, degrade gracefully by writing stable links + minimal placeholders for later backfill.
4) **Markdown/LaTeX hygiene**: avoid accidental LaTeX over-escaping in math; provide deterministic check + optional deterministic fix.

## Artifact contract (inputs)

This skill assumes a `research-team`-style project root, with best-effort fallbacks.

### Required
- `Draft_Derivation.md` — primary derivation notebook (source of equations/definitions; paper must cite/point to sections, not invent missing steps).

### Strongly recommended
- `knowledge_base/` — background, priors, methodology traces, and reference notes (for auditability and “UNVERIFIED” validation plans).
- `artifacts/` — reproducibility outputs for a given tag (see below).

### Artifacts: accepted layouts (best-effort detection)

For a given `--tag <TAG>`, the scaffold searches (in order):
- `artifacts/runs/<TAG>/` (preferred)
- `artifacts/<TAG>/`
- `artifacts/<TAG>_manifest.json` + `artifacts/<TAG>_analysis.json` (demo layout)

Within an artifacts run dir, common files are recognized:
- `manifest.json` / `*_manifest.json`
- `summary.json` / `summary.csv`
- `analysis.json` / `*_analysis.json`

Minimum expectations for provenance:
- A manifest lists produced outputs (plots/tables/data paths) and (ideally) parameters/versions.
- A summary/analysis provides headline numbers with definitions/keys.

## Deterministic hygiene tools

- Double-backslash math check/fix (Markdown math only): see `scripts/bin/check_md_double_backslash.sh` and `scripts/bin/fix_md_double_backslash_math.py`.
- BibTeX RevTeX 4.2 hygiene: see `scripts/bin/fix_bibtex_revtex4_2.py`.
- BibTeX fetch trace (when `--fetch-bibtex` is used): see `paper/bibtex_trace.jsonl`.

## Style profile (FK voice)

Use the FK style guide when drafting or rewriting text:
- `assets/style/style_profile.md`
- `assets/style/writing_voice_system_prompt.txt`

## Operational docs

- Quickstart: `README.md`
- Workflows/debugging: `RUNBOOK.md`
- Milestones/acceptance criteria: `ROADMAP.md`
```

## File: README.md
```markdown
# research-writer (Codex skill)

`research-writer` scaffolds an arXiv-ready paper draft from a `research-team` project:
- RevTeX4-2, `12pt`, `onecolumn`
- deterministic provenance table wiring
- BibTeX hygiene (RevTeX4-2)
- deterministic Markdown math escape checks (e.g. `\\Delta` → `\Delta`)

## Prereqs

- `bash`, `python3`
- Optional: `latexmk` (for compilation in smoke tests)

## One-shot scaffold

```bash
bash scripts/bin/research_writer_scaffold.sh \
  --project-root /path/to/research-team-project \
  --tag M1-r1 \
  --out paper/
```

Then (optional build):

```bash
cd paper && latexmk -pdf main.tex
```
```

## File: RUNBOOK.md
```markdown
# research-writer — Runbook

## Common workflows

### 1) Scaffold a paper from a research-team project

```bash
bash scripts/bin/research_writer_scaffold.sh --project-root /path/to/project --tag M1-r1 --out paper/
```

### 2) Compile (if TeX toolchain exists)

```bash
cd paper
latexmk -pdf main.tex
```

### 3) BibTeX hygiene (RevTeX4-2)

If BibTeX fails on `@article` entries without a `journal` field:

```bash
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib paper/references.bib --in-place
```

### 4) Markdown double-backslash math check (and fix)

Check (warn-only by default):

```bash
bash scripts/bin/check_md_double_backslash.sh --root paper
```

Fix (in-place):

```bash
python3 scripts/bin/fix_md_double_backslash_math.py --root paper --in-place
```

## Debugging

### “No artifacts found for tag”

- Ensure the `--tag` matches a folder under `artifacts/runs/<TAG>/` or files like `artifacts/<TAG>_manifest.json`.
- If your project uses a different layout, run scaffold with `--verbose` (if implemented) and inspect the printed search paths.

### “latexmk not found”

- This is expected on minimal environments. Smoke tests must report `SKIPPED: latexmk not found` and still pass.

### Network/DNS failures during BibTeX fetch

- The scaffold must degrade gracefully: keep stable links (INSPIRE/arXiv/DOI) as placeholders and allow later backfill.
```

## File: scripts/bin/research_writer_scaffold.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${SCRIPT_DIR}/research_writer_scaffold.py" "$@"

```

## File: scripts/bin/research_writer_scaffold.py
```python
#!/usr/bin/env python3
"""
research_writer_scaffold.py

Minimal scaffold CLI for the `research-writer` skill.

Milestone note:
- M1: creates a paper folder from templates (compilable skeleton).
- M2: enriches the skeleton by reading `Draft_Derivation.md` + `artifacts/` and adding provenance wiring.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen


def _skill_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

def _latex_escape_texttt(s: str) -> str:
    """
    Minimal LaTeX escaping suitable for use inside \\texttt{...}.
    """
    out = str(s)
    out = out.replace("\\", r"\textbackslash{}")
    out = out.replace("{", r"\{").replace("}", r"\}")
    out = out.replace("_", r"\_")
    out = out.replace("%", r"\%")
    out = out.replace("&", r"\&")
    out = out.replace("#", r"\#")
    out = out.replace("$", r"\$")
    return out


def _rel_to_project(path: Path, project_root: Path) -> Path:
    try:
        return path.resolve().relative_to(project_root.resolve())
    except Exception:
        return path


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception as exc:
        print(f"[warn] failed to parse JSON: {path} ({exc})", file=sys.stderr)
        return None


def _find_artifact_run_dir(project_root: Path, tag: str) -> Path | None:
    for cand in (
        project_root / "artifacts" / "runs" / tag,
        project_root / "artifacts" / tag,
    ):
        if cand.is_dir():
            return cand
    return None


def _pick_first_json(dir_path: Path, names: list[str]) -> Path | None:
    for name in names:
        p = dir_path / name
        if p.is_file():
            return p
    return None


def _find_artifacts(project_root: Path, tag: str) -> tuple[Path | None, Path | None]:
    """
    Return (manifest_json_path, analysis_json_path), best-effort.
    """
    run_dir = _find_artifact_run_dir(project_root, tag)
    if run_dir is not None:
        manifest = _pick_first_json(run_dir, ["manifest.json", f"{tag}_manifest.json"])
        analysis = _pick_first_json(run_dir, ["analysis.json", f"{tag}_analysis.json"])
        if manifest or analysis:
            return manifest, analysis

        # Fallback: any *manifest*.json / *analysis*.json in run dir.
        cands = sorted([p for p in run_dir.glob("*.json") if p.is_file()], key=lambda p: p.name)
        manifest2 = next((p for p in cands if "manifest" in p.name.lower()), None)
        analysis2 = next((p for p in cands if "analysis" in p.name.lower()), None)
        return manifest2, analysis2

    # Demo layout: artifacts/<tag>_{manifest,analysis}.json
    art_dir = project_root / "artifacts"
    manifest = art_dir / f"{tag}_manifest.json"
    analysis = art_dir / f"{tag}_analysis.json"
    return (manifest if manifest.is_file() else None, analysis if analysis.is_file() else None)


def _extract_manifest_outputs(manifest: dict[str, Any] | None) -> list[str]:
    if not isinstance(manifest, dict):
        return []
    out = manifest.get("outputs")
    paths: list[str] = []
    if isinstance(out, list):
        for item in out:
            if isinstance(item, str):
                paths.append(item)
            elif isinstance(item, dict) and isinstance(item.get("path"), str):
                paths.append(item["path"])
    elif isinstance(out, dict):
        for _, v in out.items():
            if isinstance(v, str):
                paths.append(v)
            elif isinstance(v, dict) and isinstance(v.get("path"), str):
                paths.append(v["path"])
    return [p for p in paths if str(p).strip()]


def _extract_analysis_results(analysis: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(analysis, dict):
        return {}
    res = analysis.get("results")
    return res if isinstance(res, dict) else {}


def _symlink_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() or dst.is_symlink():
        return
    try:
        rel = os.path.relpath(str(src), str(dst.parent))
        dst.symlink_to(rel)
    except Exception:
        shutil.copy2(src, dst)


def _choose_figure(outputs: list[Path]) -> Path | None:
    exts = {".pdf", ".png", ".jpg", ".jpeg", ".eps"}
    for p in outputs:
        if p.suffix.lower() in exts and p.is_file():
            return p
    return None


def _read_draft_outline(project_root: Path) -> list[str]:
    notes = project_root / "Draft_Derivation.md"
    if not notes.is_file():
        return []
    text = notes.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    headings: list[str] = []
    for ln in text.splitlines():
        if not ln.startswith("#"):
            continue
        stripped = ln.lstrip("#").strip()
        if not stripped:
            continue
        headings.append(stripped)
        if len(headings) >= 40:
            break
    return headings


def _first_display_math_block(project_root: Path) -> str:
    """
    Return the first $$...$$ display-math block (content only), or "".
    """
    notes = project_root / "Draft_Derivation.md"
    if not notes.is_file():
        return ""
    text = notes.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.splitlines()
    in_block = False
    buf: list[str] = []
    for ln in lines:
        if ln.strip() == "$$":
            if not in_block:
                in_block = True
                buf = []
                continue
            # close
            return "\n".join(buf).strip()
        if in_block:
            buf.append(ln.rstrip("\n"))
    return ""


def _find_existing_bib(project_root: Path) -> Path | None:
    for rel in (
        "references.bib",
        "refs.bib",
        "paper/references.bib",
        "paper/refs.bib",
    ):
        p = project_root / rel
        if p.is_file():
            return p
    return None


def _http_get_text(url: str, *, headers: dict[str, str] | None = None, timeout_s: int = 20) -> str:
    req = Request(url, headers=headers or {})
    with urlopen(req, timeout=timeout_s) as r:  # nosec - intended for controlled metadata fetch
        return r.read().decode("utf-8", errors="replace")


def _fetch_inspire_bibtex(texkey: str) -> str | None:
    q = quote(f"texkey:{texkey}")
    url = f"https://inspirehep.net/api/literature?q={q}"
    obj = json.loads(_http_get_text(url, headers={"Accept": "application/json"}))
    hits = obj.get("hits", {}).get("hits", [])
    if not isinstance(hits, list) or not hits:
        return None
    first = hits[0] if isinstance(hits[0], dict) else {}
    bib_url = (first.get("links", {}) or {}).get("bibtex")
    if not isinstance(bib_url, str) or not bib_url.strip():
        return None
    return _http_get_text(bib_url.strip(), headers={"Accept": "application/x-bibtex"})


def _fetch_doi_bibtex(doi: str) -> str | None:
    doi = doi.strip()
    if not doi:
        return None
    url = "https://doi.org/" + quote(doi, safe="/")
    return _http_get_text(url, headers={"Accept": "application/x-bibtex"})


def _bib_from_kb_literature(project_root: Path, *, fetch_bibtex: bool, trace: list[dict[str, Any]]) -> str:
    lit_dir = project_root / "knowledge_base" / "literature"
    if not lit_dir.is_dir():
        return ""

    entries: list[str] = []
    for p in sorted(lit_dir.glob("*.md"), key=lambda x: x.name):
        txt = p.read_text(encoding="utf-8", errors="replace")
        refkey = ""
        title = ""
        authors = ""
        year = ""
        doi = ""
        inspire_texkey = ""
        for raw in txt.splitlines():
            ln = raw.strip()
            if ln.lower().startswith("refkey:"):
                refkey = ln.split(":", 1)[1].strip()
            elif ln.lower().startswith(("citekey:", "texkey:")):
                inspire_texkey = ln.split(":", 1)[1].strip()
            elif ln.lower().startswith("title:"):
                title = ln.split(":", 1)[1].strip()
            elif ln.lower().startswith("authors:"):
                authors = ln.split(":", 1)[1].strip()
            elif ln.lower().startswith("year:"):
                year = ln.split(":", 1)[1].strip()
            elif "doi.org/" in ln.lower():
                m = re.search(r"doi\.org/([^\\s)]+)", ln, flags=re.IGNORECASE)
                if m:
                    doi = m.group(1).strip().rstrip(".")
            elif ln.lower().startswith("doi:"):
                v = ln.split(":", 1)[1].strip()
                doi = v.replace("https://doi.org/", "").replace("http://doi.org/", "").strip()

        if not refkey:
            continue

        bibtex = None
        if fetch_bibtex:
            if inspire_texkey:
                try:
                    bibtex = _fetch_inspire_bibtex(inspire_texkey)
                    trace.append(
                        {
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "method": "inspire_texkey",
                            "texkey": inspire_texkey,
                            "status": "ok" if bibtex else "not_found",
                            "source_file": str(_rel_to_project(p, project_root)),
                        }
                    )
                except Exception as exc:
                    trace.append(
                        {
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "method": "inspire_texkey",
                            "texkey": inspire_texkey,
                            "status": "error",
                            "error": str(exc),
                            "source_file": str(_rel_to_project(p, project_root)),
                        }
                    )
                    bibtex = None
            elif doi:
                try:
                    bibtex = _fetch_doi_bibtex(doi)
                    trace.append(
                        {
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "method": "doi",
                            "doi": doi,
                            "status": "ok" if bibtex else "not_found",
                            "source_file": str(_rel_to_project(p, project_root)),
                        }
                    )
                except Exception as exc:
                    trace.append(
                        {
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "method": "doi",
                            "doi": doi,
                            "status": "error",
                            "error": str(exc),
                            "source_file": str(_rel_to_project(p, project_root)),
                        }
                    )
                    bibtex = None

        if isinstance(bibtex, str) and bibtex.strip():
            entries.append(bibtex.strip() + "\n")
            continue

        fields: list[str] = []
        if authors:
            fields.append(f"  author = {{{authors}}}")
        if title:
            fields.append(f"  title = {{{title}}}")
        if year:
            fields.append(f"  year = {{{year}}}")
        if doi:
            fields.append(f"  doi = {{{doi}}}")
            fields.append(f"  url = {{{'https://doi.org/' + doi}}}")
        # RevTeX safety field (even if later re-fixed).
        fields.append('  journal = ""')
        body = ",\n".join(fields)
        entries.append(f"@article{{{refkey},\n{body}\n}}\n")

    return "\n".join(entries).strip() + ("\n" if entries else "")


def _run_bibtex_fix(fixer: Path, bib_path: Path) -> None:
    try:
        subprocess.check_call([sys.executable, str(fixer), "--bib", str(bib_path), "--in-place"])
    except Exception as exc:
        print(f"[warn] bibtex hygiene fixer failed (continuing): {exc}", file=sys.stderr)


def _render_main_tex(template: str, *, title: str, authors: str, project_root: Path, tag: str) -> str:
    out = template
    out = out.replace("TITLE (placeholder)", title.strip() or "TITLE (placeholder)")
    out = out.replace("AUTHOR(S) (placeholder)", authors.strip() or "AUTHOR(S) (placeholder)")
    out = out.replace("<tag>", tag.strip() or "<tag>")
    banner = f"% Generated by research-writer from project_root={project_root} tag={tag}\n"
    return banner + out.lstrip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project-root", required=True, help="Path to a research-team project root.")
    ap.add_argument("--tag", required=True, help="Milestone/run tag (e.g., M1-r1).")
    ap.add_argument("--out", required=True, help="Output paper directory (e.g., paper/).")
    ap.add_argument("--title", default="", help="Optional paper title override.")
    ap.add_argument("--authors", default="", help="Optional authors override (RevTeX format).")
    ap.add_argument("--fetch-bibtex", action="store_true", help="Best-effort online BibTeX fetch (INSPIRE/DOI).")
    ap.add_argument("--force", action="store_true", help="Overwrite output directory if it exists.")
    args = ap.parse_args()

    project_root = Path(args.project_root).expanduser().resolve()
    if not project_root.is_dir():
        print(f"ERROR: --project-root is not a directory: {project_root}", file=sys.stderr)
        return 2

    tag = args.tag.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", tag):
        print(f"ERROR: unsafe --tag value: {args.tag!r} (allowed: [A-Za-z0-9][A-Za-z0-9._-]*)", file=sys.stderr)
        return 2

    if not (project_root / "Draft_Derivation.md").is_file():
        print("[warn] Draft_Derivation.md not found under project root (scaffold will be a template-only skeleton).", file=sys.stderr)

    out_dir = Path(args.out).expanduser().resolve()
    if out_dir.exists():
        if not args.force:
            print(f"ERROR: output already exists: {out_dir} (use --force to overwrite)", file=sys.stderr)
            return 2
        shutil.rmtree(out_dir)

    out_dir.mkdir(parents=True, exist_ok=True)

    root = _skill_root()
    tpl_dir = root / "assets" / "templates"
    main_tpl = tpl_dir / "revtex4-2_onecolumn_main.tex"
    bib_tpl = tpl_dir / "references.bib"
    readme_tpl = tpl_dir / "paper_README.md"
    latexmkrc_tpl = tpl_dir / "latexmkrc"
    bib_fixer = root / "scripts" / "bin" / "fix_bibtex_revtex4_2.py"

    for p in (main_tpl, bib_tpl, readme_tpl, latexmkrc_tpl):
        if not p.is_file():
            print(f"ERROR: missing template: {p}", file=sys.stderr)
            return 2
    if not bib_fixer.is_file():
        print(f"ERROR: missing bibtex fixer: {bib_fixer}", file=sys.stderr)
        return 2

    title = args.title.strip() or f"{project_root.name}: draft"
    authors = args.authors.strip() or "AUTHOR(S) (placeholder)"

    draft_outline = _read_draft_outline(project_root)
    first_math = _first_display_math_block(project_root)
    manifest_path, analysis_path = _find_artifacts(project_root, tag)
    manifest = _load_json(manifest_path) if manifest_path is not None else None
    analysis = _load_json(analysis_path) if analysis_path is not None else None

    manifest_rel = _rel_to_project(manifest_path, project_root) if manifest_path is not None else None
    analysis_rel = _rel_to_project(analysis_path, project_root) if analysis_path is not None else None

    # Figures (best-effort: pick first image-like output from manifest outputs).
    output_paths: list[Path] = []
    for raw in _extract_manifest_outputs(manifest):
        p = Path(raw)
        if not p.is_absolute():
            p = (project_root / p).resolve()
        if p.is_file():
            output_paths.append(p)
    fig_src = _choose_figure(output_paths)
    fig_dst_rel = None
    if fig_src is not None:
        fig_dst = out_dir / "figures" / fig_src.name
        _symlink_or_copy(fig_src, fig_dst)
        fig_dst_rel = Path("figures") / fig_src.name

    # Results + provenance.
    results = _extract_analysis_results(analysis)
    results_keys = sorted([str(k) for k in results.keys()], key=lambda x: x)

    provenance_rows: list[str] = []
    results_lines: list[str] = []

    if analysis_rel is not None and results_keys:
        results_lines.append("We summarize the headline numbers and provide provenance pointers (Appendix).")
        results_lines.append("\\begin{itemize}")
        for k in results_keys:
            v = results.get(k)
            prov = f"{analysis_rel.as_posix()}:results.{k}"
            results_lines.append(
                f"  \\item \\texttt{{{_latex_escape_texttt(k)}}} = {v} \\, (\\texttt{{{_latex_escape_texttt(prov)}}})"
            )
            provenance_rows.append(
                f"\\texttt{{{_latex_escape_texttt(k)}}} & \\texttt{{{_latex_escape_texttt(prov)}}} \\\\"
            )
        results_lines.append("\\end{itemize}")
    else:
        src_hint = "artifacts/<tag>_analysis.json" if analysis_rel is None else f"{analysis_rel.as_posix()}"
        results_lines.append(
            rf"\textbf{{[TODO: results | source: \texttt{{{_latex_escape_texttt(src_hint)}}}]}}"
        )

    if fig_dst_rel is not None:
        fig_caption = "Demo figure (auto-linked from artifacts)."
        results_lines.append(r"\begin{figure}[tb]")
        results_lines.append(r"  \centering")
        results_lines.append(rf"  \includegraphics[width=0.5\linewidth]{{{fig_dst_rel.as_posix()}}}")
        if manifest_rel is not None:
            results_lines.append(
                rf"  \caption{{{fig_caption} Source: \texttt{{{_latex_escape_texttt(manifest_rel.as_posix())}}}.}}"
            )
        else:
            results_lines.append(rf"  \caption{{{fig_caption}}}")
        results_lines.append(r"\end{figure}")

    prov_block = "\n".join(provenance_rows) if provenance_rows else "% (no provenance rows found; fill manually)"
    results_block = "\n".join(results_lines)

    # Main TeX from template with deterministic insertion points.
    main_tex = _render_main_tex(_read_text(main_tpl), title=title, authors=authors, project_root=project_root, tag=tag)
    if draft_outline:
        outline_lines = ["% Draft_Derivation.md outline (for drafting; not compiled):"]
        outline_lines.extend([f"% - {h}" for h in draft_outline])
        main_tex = "\n".join(outline_lines) + "\n" + main_tex
    if first_math.strip() and "\\begin{" not in first_math:
        excerpt = []
        excerpt.append("% Excerpted from Draft_Derivation.md (first $$...$$ block; verify in context):")
        excerpt.append("\\begin{equation}")
        excerpt.append(first_math.strip())
        excerpt.append("\\end{equation}")
        main_tex = main_tex.replace("% __DERIVATION_EXCERPT__", "\n".join(excerpt))
    else:
        main_tex = main_tex.replace("% __DERIVATION_EXCERPT__", "% (no safe display-math excerpt found)")
    main_tex = main_tex.replace("% __RESULTS_SECTION_BODY__", results_block)
    main_tex = main_tex.replace("% __PROVENANCE_ROWS__", prov_block)
    _write_text(out_dir / "main.tex", main_tex)

    # BibTeX: prefer project-local file; else KB-derived minimal entries; else template.
    bib_out = out_dir / "references.bib"
    bib_src = _find_existing_bib(project_root)
    if bib_src is not None:
        shutil.copy2(bib_src, bib_out)
    else:
        trace: list[dict[str, Any]] = []
        kb_bib = _bib_from_kb_literature(project_root, fetch_bibtex=bool(args.fetch_bibtex), trace=trace)
        if kb_bib.strip():
            _write_text(bib_out, kb_bib)
        else:
            _write_text(bib_out, _read_text(bib_tpl))
        if trace:
            trace_path = out_dir / "bibtex_trace.jsonl"
            trace_path.write_text("\n".join(json.dumps(x, sort_keys=True) for x in trace) + "\n", encoding="utf-8")
    _run_bibtex_fix(bib_fixer, bib_out)

    _write_text(out_dir / "latexmkrc", _read_text(latexmkrc_tpl))
    (out_dir / "figures").mkdir(parents=True, exist_ok=True)
    readme = _read_text(readme_tpl).rstrip() + "\n"
    readme += "\n## Generation\n\n"
    readme += f"- project root: `{project_root}`\n"
    readme += f"- tag: `{tag}`\n"
    readme += f"- generated_at: `{datetime.now(timezone.utc).isoformat()}`\n"
    if manifest_rel is not None:
        readme += f"- manifest: `{manifest_rel.as_posix()}`\n"
    if analysis_rel is not None:
        readme += f"- analysis: `{analysis_rel.as_posix()}`\n"
    _write_text(out_dir / "README.md", readme)

    print("[ok] research-writer scaffold complete")
    print(f"- project root: {project_root}")
    print(f"- tag: {args.tag}")
    print(f"- out: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## File: scripts/bin/fix_bibtex_revtex4_2.py
```python
#!/usr/bin/env python3
"""
fix_bibtex_revtex4_2.py

Deterministic BibTeX hygiene helper for APS RevTeX 4.2 workflows.

Why:
- In some RevTeX/BibTeX toolchains (notably APS styles), `@article{...}` entries without a `journal` field can
  trigger a BibTeX error. INSPIRE BibTeX exports for arXiv preprints are often `@article` without `journal`.

What it does:
- For each `@article{...}` / `@article(... )` entry that lacks a top-level `journal = ...` field, insert:
    journal = ""

Scope:
- Conservative: does not reformat or normalize entries beyond inserting the missing field.

Exit codes:
  0  ok (or fixed with --in-place)
  1  fixes needed (when not using --in-place)
  2  input error
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Patch:
    key: str


_RE_ENTRY_START = re.compile(r"@([A-Za-z]+)\s*([({])", re.MULTILINE)


def _find_entry(text: str, at: int) -> tuple[int, int, str, str, int] | None:
    """
    Return (start, end, entry_type_lower, key, body_start_index) or None.
    """
    m = _RE_ENTRY_START.match(text, at)
    if not m:
        return None
    entry_type = m.group(1).strip().lower()
    open_ch = m.group(2)
    close_ch = "}" if open_ch == "{" else ")"

    i = at + m.end()
    n = len(text)
    while i < n and text[i].isspace():
        i += 1
    key_start = i
    comma = text.find(",", key_start)
    if comma < 0:
        return None
    key = text[key_start:comma].strip()
    body_start = comma + 1

    level = 1
    in_quote = False
    j = at + m.end()
    while j < n:
        ch = text[j]
        if ch == '"' and (j == 0 or text[j - 1] != "\\"):
            in_quote = not in_quote
            j += 1
            continue
        if in_quote:
            j += 1
            continue
        if ch == open_ch:
            level += 1
        elif ch == close_ch:
            level -= 1
            if level == 0:
                return at, j + 1, entry_type, key, body_start
        j += 1
    return None


def _has_top_level_journal(body: str) -> bool:
    brace = 0
    in_quote = False
    i = 0
    n = len(body)
    while i < n:
        ch = body[i]
        if ch == '"' and (i == 0 or body[i - 1] != "\\"):
            in_quote = not in_quote
            i += 1
            continue
        if in_quote:
            i += 1
            continue
        if ch == "{":
            brace += 1
            i += 1
            continue
        if ch == "}":
            brace = max(0, brace - 1)
            i += 1
            continue
        if brace == 0 and body[i : i + 7].lower() == "journal":
            prev = body[i - 1] if i > 0 else ""
            if prev and (prev.isalnum() or prev in ("_", "-")):
                i += 1
                continue
            j = i + 7
            while j < n and body[j].isspace():
                j += 1
            if j < n and body[j] == "=":
                k = i - 1
                while k >= 0 and body[k].isspace():
                    k -= 1
                if k < 0 or body[k] == ",":
                    return True
        i += 1
    return False


def _insert_journal(entry_text: str, body_start: int, entry_end: int) -> str:
    # Insert after the key comma; avoid double blank lines if the body already starts with newline.
    prefix = entry_text[:body_start]
    body = entry_text[body_start:entry_end]
    if body.startswith("\n"):
        body = body[1:]
    return prefix + "\n  journal = \"\",\n" + body


def normalize_revtex4_2_bibtex(text: str) -> tuple[str, list[Patch]]:
    patches: list[Patch] = []
    out_parts: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        at = text.find("@", i)
        if at < 0:
            out_parts.append(text[i:])
            break
        out_parts.append(text[i:at])
        found = _find_entry(text, at)
        if not found:
            out_parts.append(text[at : at + 1])
            i = at + 1
            continue
        start, end, entry_type, key, body_start = found
        entry = text[start:end]
        if entry_type != "article":
            out_parts.append(entry)
            i = end
            continue

        body = entry[body_start : len(entry) - 1]
        if _has_top_level_journal(body):
            out_parts.append(entry)
            i = end
            continue

        patches.append(Patch(key=key or "<unknown>"))
        out_parts.append(_insert_journal(entry, body_start=body_start - start, entry_end=len(entry) - 1))
        out_parts.append(entry[-1])  # closing delimiter
        i = end

    return "".join(out_parts), patches


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bib", type=Path, required=True, help="BibTeX file to check/fix.")
    ap.add_argument("--in-place", action="store_true", help="Rewrite the file in place.")
    args = ap.parse_args()

    bib = args.bib
    if not bib.is_file():
        print(f"ERROR: bib file not found: {bib}", file=sys.stderr)
        return 2

    old = bib.read_text(encoding="utf-8", errors="replace")
    new, patches = normalize_revtex4_2_bibtex(old)
    if not patches:
        print("[ok] revtex4-2 bibtex hygiene: no missing journal fields in @article entries")
        return 0

    if args.in_place:
        bib.write_text(new, encoding="utf-8")
        keys = ", ".join([p.key for p in patches[:8]]) + (" ..." if len(patches) > 8 else "")
        print(f"[ok] patched {len(patches)} @article entry(ies) by adding journal=\"\" (e.g. {keys})")
        return 0

    print("[warn] revtex4-2 bibtex hygiene: found @article entries missing journal=... (likely to break BibTeX)")
    for p in patches[:50]:
        print(f"- {p.key}")
    if len(patches) > 50:
        print(f"- ... ({len(patches) - 50} more)")
    print("[hint] Apply deterministic fix: python3 fix_bibtex_revtex4_2.py --bib <path> --in-place")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

```

## File: scripts/bin/check_md_double_backslash.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="."
FAIL=0

usage() {
  cat <<'EOF'
check_md_double_backslash.sh

Detect common double-backslash LaTeX escapes inside Markdown math regions
that frequently get introduced by TOC generators or LLM over-escaping, e.g. \\Delta, \\gamma\\_{\\rm lin}, k^\\*.

Usage:
  check_md_double_backslash.sh [--root PATH] [--fail]

Options:
  --root PATH   File or directory to scan (default: .)
  --fail        Exit non-zero if any matches are found (default: warn-only)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="${2:-}"; shift 2 ;;
    --fail) FAIL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXER="${SCRIPT_DIR}/fix_md_double_backslash_math.py"

if [[ ! -e "${ROOT}" ]]; then
  echo "ERROR: path not found: ${ROOT}" >&2
  exit 2
fi
if [[ ! -f "${FIXER}" ]]; then
  echo "ERROR: fixer script not found: ${FIXER}" >&2
  exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found in PATH" >&2
  exit 2
fi

set +e
python3 "${FIXER}" --root "${ROOT}"
code=$?
set -e

if [[ $code -eq 0 ]]; then
  exit 0
fi
if [[ $code -eq 1 ]]; then
  if [[ "${FAIL}" -eq 1 ]]; then
    exit 1
  fi
  exit 0
fi

exit $code

```

## File: scripts/bin/fix_md_double_backslash_math.py
```python
#!/usr/bin/env python3
r"""
fix_md_double_backslash_math.py

Deterministic helper to fix a common Markdown+LaTeX rendering hazard:
accidental double-backslash escapes in math, e.g. \\Delta, \\gamma\\_{\\rm lin}, k^\\*.

Policy:
- Only rewrite inside math regions (outside fenced code blocks):
  - inline math: $...$
  - fenced display math: $$ ... $$ where $$ is on its own line
- Only rewrite the safest patterns:
  - "\\\\" before letters: \\Delta -> \Delta
  - "\\\\" before "*_^": \\_ -> \_, \\^ -> \^, \\* -> \*
- Do NOT touch LaTeX line breaks (\\) or spacing (\\[2pt]) because they do not match the patterns above.

Exit codes:
  0  no changes needed (or changes applied with --in-place)
  1  changes needed (when NOT using --in-place)
  2  input error
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


_CODE_FENCE_PREFIXES = ("```", "~~~")
_STANDALONE_DOLLAR = re.compile(r"^\s*\$\$\s*$")

_RE_DOUBLE_BEFORE_LETTER = re.compile(r"\\\\(?=[A-Za-z])")
_RE_DOUBLE_BEFORE_SYMBOL = re.compile(r"\\\\(?=[*_^])")


def _iter_md_files_under(root: Path) -> list[Path]:
    if root.is_file():
        return [root]
    if not root.is_dir():
        return []
    out: list[Path] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if ".git" in p.parts:
            continue
        if p.suffix.lower() not in (".md", ".markdown"):
            continue
        out.append(p)
    return sorted(out)


def _iter_inline_code_spans(line: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] != "`":
            i += 1
            continue
        j = i
        while j < n and line[j] == "`":
            j += 1
        delim = line[i:j]
        k = j
        while k < n:
            if line[k] != "`":
                k += 1
                continue
            r = k
            while r < n and line[r] == "`":
                r += 1
            if line[k:r] == delim:
                spans.append((i, r))
                i = r
                break
            k = r
        else:
            i = j
    return spans


def _split_inline_code_segments(line: str) -> list[tuple[str, bool]]:
    spans = _iter_inline_code_spans(line)
    if not spans:
        return [(line, False)]
    out: list[tuple[str, bool]] = []
    pos = 0
    for a, b in spans:
        if a > pos:
            out.append((line[pos:a], False))
        out.append((line[a:b], True))
        pos = b
    if pos < len(line):
        out.append((line[pos:], False))
    return out


@dataclass(frozen=True)
class Change:
    path: Path
    line: int
    kind: str


def _fix_math_text(s: str) -> tuple[str, int]:
    n = 0
    s2, k1 = _RE_DOUBLE_BEFORE_LETTER.subn(r"\\", s)
    n += k1
    s3, k2 = _RE_DOUBLE_BEFORE_SYMBOL.subn(r"\\", s2)
    n += k2
    return s3, n


def _fix_inline_math_in_segment(seg: str) -> tuple[str, int]:
    if "$$" in seg:
        return seg, 0

    out: list[str] = []
    i = 0
    changes = 0
    while i < len(seg):
        ch = seg[i]
        if ch != "$":
            out.append(ch)
            i += 1
            continue

        if i > 0 and seg[i - 1] == "\\":
            out.append(ch)
            i += 1
            continue

        j = i + 1
        while j < len(seg):
            if seg[j] == "$" and seg[j - 1] != "\\":
                break
            j += 1
        if j >= len(seg):
            out.append(ch)
            i += 1
            continue

        content = seg[i + 1 : j]
        fixed, n = _fix_math_text(content)
        changes += n
        out.append("$")
        out.append(fixed)
        out.append("$")
        i = j + 1

    return "".join(out), changes


def _fix_text(path: Path, text: str) -> tuple[str, list[Change]]:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    had_trailing_nl = text.endswith("\n")
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]

    out_lines: list[str] = []
    changes: list[Change] = []
    in_code = False
    in_display = False

    for lineno, raw in enumerate(lines, start=1):
        stripped = raw.strip()

        if stripped.startswith(_CODE_FENCE_PREFIXES):
            in_code = not in_code
            out_lines.append(raw)
            continue
        if in_code:
            out_lines.append(raw)
            continue

        if _STANDALONE_DOLLAR.match(raw):
            in_display = not in_display
            out_lines.append(raw.rstrip())
            continue

        if in_display:
            fixed, n = _fix_math_text(raw)
            if n:
                changes.append(Change(path, lineno, "display_math_double_backslash"))
            out_lines.append(fixed)
            continue

        segs = _split_inline_code_segments(raw)
        new_parts: list[str] = []
        line_changes = 0
        for seg, is_code in segs:
            if is_code:
                new_parts.append(seg)
                continue
            fixed, n = _fix_inline_math_in_segment(seg)
            line_changes += n
            new_parts.append(fixed)
        new_ln = "".join(new_parts)
        if line_changes:
            changes.append(Change(path, lineno, "inline_math_double_backslash"))
        out_lines.append(new_ln)

    new_text = "\n".join(out_lines)
    if had_trailing_nl:
        new_text += "\n"
    return new_text, changes


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path("."), help="File or directory to scan (default: .).")
    ap.add_argument("--in-place", action="store_true", help="Rewrite files in place.")
    args = ap.parse_args()

    root = args.root
    if not root.exists():
        print(f"ERROR: path not found: {root}", file=sys.stderr)
        return 2

    files = _iter_md_files_under(root)
    if not files:
        print(f"[ok] No Markdown files found under: {root}")
        return 0

    any_changes = False
    all_changes: list[Change] = []

    for p in files:
        if p.suffix.lower() not in (".md", ".markdown"):
            continue
        try:
            old = p.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:
            print(f"[warn] failed to read {p}: {exc}", file=sys.stderr)
            continue

        new, changes = _fix_text(p, old)
        if changes:
            any_changes = True
            all_changes.extend(changes)
            if args.in_place:
                p.write_text(new, encoding="utf-8")

    if not any_changes:
        print("[ok] No obvious double-backslash LaTeX escapes found in math regions.")
        return 0

    if args.in_place:
        print(f"[ok] Rewrote {len({c.path for c in all_changes})} file(s); changes: {len(all_changes)} (math-region double backslash fixes).")
        return 0

    print("[warn] Found double-backslash LaTeX escapes in math regions (likely accidental).")
    for c in all_changes[:80]:
        print(f"- {c.path}:{c.line} ({c.kind})")
    if len(all_changes) > 80:
        print(f"- ... ({len(all_changes) - 80} more)")
    print("[hint] To apply fixes (math regions only): python3 fix_md_double_backslash_math.py --root <path> --in-place")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

```

## File: assets/templates/revtex4-2_onecolumn_main.tex
```tex
% RevTeX4-2 (12pt, onecolumn) skeleton — research-writer
\documentclass[aps,prd,preprint,12pt]{revtex4-2}

\usepackage{amsmath,amssymb}
\usepackage{bm}
\usepackage{graphicx}
\usepackage[colorlinks=true,linkcolor=blue,citecolor=blue,urlcolor=blue]{hyperref}

% Keep macros minimal and explicit (portable across engines).
\newcommand{\md}{\mathrm{d}}

\begin{document}

\title{TITLE (placeholder)}
\author{AUTHOR(S) (placeholder)}
% \date{\today}  % reproducibility: set a fixed date if you care about byte-identical builds
\date{}

\begin{abstract}
% Write a mechanism-first abstract:
% context → method/constraints → headline quantitative results → interpretation/limitations.
\textbf{[TODO: abstract | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}
\end{abstract}

\maketitle

\section{Introduction}
\textbf{[TODO: introduction | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}

\section{Theory / Formalism}
% Do not invent derivations. Point to the notebook sections that contain them.
\textbf{[TODO: formalism + key equations | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}
% __DERIVATION_EXCERPT__

\section{Results}
% Quote numbers only with provenance pointers:
%   artifact: <path>, key: <json/csv key>
% __RESULTS_SECTION_BODY__

\section{Discussion and outlook}
\textbf{[TODO: discussion | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}

\appendix

\section{Results provenance}
% Minimal, arXiv-safe provenance table (paths are internal to the project bundle).
\begin{table}[h]
\centering
\begin{tabular}{p{0.22\linewidth} p{0.60\linewidth}}
\hline
Quantity & Provenance (artifact path + key) \\
\hline
% __PROVENANCE_ROWS__
\hline
\end{tabular}
\caption{Results provenance (auto-generated; fill/extend as needed).}
\end{table}

\bibliographystyle{apsrev4-2}
\bibliography{references}

\end{document}
```

## File: assets/templates/latexmkrc
```text
$pdf_mode = 1;
$pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1 %O %S';
$bibtex = 'bibtex %O %B';

# RevTeX projects typically benefit from a full clean list.
$clean_ext = 'bbl blg fdb_latexmk fls synctex.gz run.xml bcf';
```

## File: scripts/dev/run_all_smoke_tests.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

tmp_root="$(mktemp -d)"
trap 'rm -rf "${tmp_root}"' EXIT

if command -v rg >/dev/null 2>&1; then
  grep_re() { rg -n "$1" "$2" >/dev/null; }
else
  grep_re() { grep -nE "$1" "$2" >/dev/null; }
fi

echo "[smoke] help: scaffold CLI"
bash scripts/bin/research_writer_scaffold.sh --help >/dev/null

echo "[smoke] help: bibtex fixer"
python3 scripts/bin/fix_bibtex_revtex4_2.py --help >/dev/null

echo "[smoke] help: double-backslash fixer"
python3 scripts/bin/fix_md_double_backslash_math.py --help >/dev/null

echo "[smoke] scaffold: fixture project -> paper/"
proj="${tmp_root}/project"
out="${tmp_root}/paper"
cp -R "scripts/dev/fixtures/minimal_project" "${proj}"

python3 "${proj}/scripts/make_artifacts.py" --tag M2-smoke >/dev/null

bash scripts/bin/research_writer_scaffold.sh --project-root "${proj}" --tag M2-smoke --out "${out}"
test -f "${out}/main.tex"
test -f "${out}/references.bib"
test -f "${out}/latexmkrc"
test -f "${out}/README.md"
test -d "${out}/figures"
grep_re '^[[:space:]]*journal[[:space:]]*=[[:space:]]*\"\"' "${out}/references.bib"

echo "[smoke] markdown double-backslash check: generated paper + skill assets"
bash scripts/bin/check_md_double_backslash.sh --root "${out}" --fail >/dev/null
bash scripts/bin/check_md_double_backslash.sh --root "assets" --fail >/dev/null

if command -v latexmk >/dev/null 2>&1; then
  echo "[smoke] latexmk: compile paper"
  latexmk_log="${tmp_root}/latexmk.log"
  if ! (cd "${out}" && latexmk -pdf main.tex >"${latexmk_log}" 2>&1); then
    echo "[smoke] FAIL: latexmk failed; log follows:" >&2
    cat "${latexmk_log}" >&2
    exit 1
  fi
else
  echo "[smoke] SKIPPED: latexmk not found"
fi

echo "[smoke] bibtex fixer: adds journal field"
bib="${tmp_root}/references.bib"
cat >"${bib}" <<'EOF'
@article{Key1,
  title = {Test entry},
  year = {2020}
}
EOF
set +e
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib "${bib}" >/dev/null 2>&1
code=$?
set -e
if [[ $code -ne 1 ]]; then
  echo "ERROR: expected exit 1 (fixes needed) for bibtex fixer; got ${code}" >&2
  exit 1
fi
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib "${bib}" --in-place >/dev/null
grep_re '^[[:space:]]*journal[[:space:]]*=[[:space:]]*\"\"' "${bib}"

echo "[smoke] double-backslash checker+fixer: markdown math only"
md_dir="${tmp_root}/md"
mkdir -p "${md_dir}"
cat >"${md_dir}/t.md" <<'EOF'
Inline math: $\\Delta = 1$, $k^\\* = 0$.
Code span (must not change): `\\Delta`
$$
\\gamma_{\\rm lin} = 2
$$
EOF
set +e
bash scripts/bin/check_md_double_backslash.sh --root "${md_dir}" --fail >/dev/null 2>&1
code=$?
set -e
if [[ $code -ne 1 ]]; then
  echo "ERROR: expected exit 1 for --fail with bad escapes; got ${code}" >&2
  exit 1
fi
python3 scripts/bin/fix_md_double_backslash_math.py --root "${md_dir}" --in-place >/dev/null
bash scripts/bin/check_md_double_backslash.sh --root "${md_dir}" --fail >/dev/null
grep_re '\\\\Delta' "${md_dir}/t.md"  # should still exist in code spans (fixer must not touch inline code)

echo "[smoke] ok"
```

## File: scripts/dev/fixtures/minimal_project/Draft_Derivation.md
```markdown
# Draft Derivation (minimal fixture)

This is a tiny `research-team`-style notebook used by `research-writer` smoke tests.

## Definitions

We define three demo observables $a$, $b$, and $c$.

## Demo result (to be pulled into the paper)

Headline numbers:

$$
a = 1,\quad b = 2,\quad c = 3.
$$

Minimal consistency check:

$$
a + b = 3.
$$

## Notes on provenance

- The authoritative values are stored in `artifacts/` for a specific tag.

```

## File: scripts/dev/fixtures/minimal_project/references.bib
```bibtex
@article{Bezanson2017,
  author = {Bezanson, Jeff and others},
  title  = {Julia: A Fresh Approach to Numerical Computing},
  year   = {2017},
  doi    = {10.1137/141000671}
}

```

## File: scripts/dev/fixtures/minimal_project/scripts/make_artifacts.py
```python
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import zlib
from datetime import datetime, timezone
from pathlib import Path


def _png_1x1_rgba(*, r: int = 0, g: int = 0, b: int = 0, a: int = 255) -> bytes:
    """
    Deterministically generate a valid 1x1 RGBA PNG with correct CRCs.
    """
    def chunk(typ: bytes, data: bytes) -> bytes:
        ln = len(data).to_bytes(4, "big")
        crc = zlib.crc32(typ + data) & 0xFFFFFFFF
        return ln + typ + data + crc.to_bytes(4, "big")

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = (1).to_bytes(4, "big") + (1).to_bytes(4, "big") + bytes([8, 6, 0, 0, 0])
    raw = bytes([0, r & 0xFF, g & 0xFF, b & 0xFF, a & 0xFF])  # filter=0 + RGBA
    comp = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate deterministic fixture artifacts for research-writer smoke tests.")
    ap.add_argument("--tag", required=True, help="Run tag (e.g., M2-fixture).")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    tag = args.tag.strip()
    run_dir = root / "artifacts" / "runs" / tag
    fig_dir = run_dir / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)

    fig_path = fig_dir / "demo.png"
    fig_path.write_bytes(_png_1x1_rgba(r=30, g=144, b=255, a=255))  # dodgerblue

    analysis_path = run_dir / "analysis.json"
    manifest_path = run_dir / "manifest.json"

    analysis = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "definitions": {
            "a": "demo scalar a (exact)",
            "b": "demo scalar b (exact)",
            "c": "demo scalar c (exact)",
        },
        "results": {"a": 1, "b": 2, "c": 3},
        "outputs": {"figure_demo": str(fig_path.relative_to(root))},
    }
    analysis_path.write_text(json.dumps(analysis, indent=2) + "\n", encoding="utf-8")

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "command": f"python3 scripts/make_artifacts.py --tag {tag}",
        "cwd": ".",
        "params": {"tag": tag},
        "outputs": [
            {"path": str(manifest_path.relative_to(root)), "kind": "manifest"},
            {"path": str(analysis_path.relative_to(root)), "kind": "analysis"},
            {"path": str(fig_path.relative_to(root)), "kind": "figure"},
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print("[ok] wrote fixture artifacts")
    print(f"- run dir: {run_dir}")
    print(f"- manifest: {manifest_path}")
    print(f"- analysis: {analysis_path}")
    print(f"- figure: {fig_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## File: team/reviews/M2-r1/generated_main.tex
```tex
% Draft_Derivation.md outline (for drafting; not compiled):
% - Draft Derivation (minimal fixture)
% - Definitions
% - Demo result (to be pulled into the paper)
% - Notes on provenance
% Generated by research-writer from project_root=/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.zJR83Luv6I/project tag=M2-smoke
% RevTeX4-2 (12pt, onecolumn) skeleton — research-writer
\documentclass[aps,prd,preprint,12pt]{revtex4-2}

\usepackage{amsmath,amssymb}
\usepackage{bm}
\usepackage{graphicx}
\usepackage[colorlinks=true,linkcolor=blue,citecolor=blue,urlcolor=blue]{hyperref}

% Keep macros minimal and explicit (portable across engines).
\newcommand{\md}{\mathrm{d}}

\begin{document}

\title{project: draft}
\author{AUTHOR(S) (placeholder)}
% \date{\today}  % reproducibility: set a fixed date if you care about byte-identical builds
\date{}

\begin{abstract}
% Write a mechanism-first abstract:
% context → method/constraints → headline quantitative results → interpretation/limitations.
\textbf{[TODO: abstract | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}
\end{abstract}

\maketitle

\section{Introduction}
\textbf{[TODO: introduction | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}

\section{Theory / Formalism}
% Do not invent derivations. Point to the notebook sections that contain them.
\textbf{[TODO: formalism + key equations | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}
% Excerpted from Draft_Derivation.md (first $$...$$ block; verify in context):
\begin{equation}
a = 1,\quad b = 2,\quad c = 3.
\end{equation}

\section{Results}
% Quote numbers only with provenance pointers:
%   artifact: <path>, key: <json/csv key>
We summarize the headline numbers and provide provenance pointers (Appendix).
\begin{itemize}
  \item \texttt{a} = 1 \, (\texttt{artifacts/runs/M2-smoke/analysis.json:results.a})
  \item \texttt{b} = 2 \, (\texttt{artifacts/runs/M2-smoke/analysis.json:results.b})
  \item \texttt{c} = 3 \, (\texttt{artifacts/runs/M2-smoke/analysis.json:results.c})
\end{itemize}
\begin{figure}[tb]
  \centering
  \includegraphics[width=0.5\linewidth]{figures/demo.png}
  \caption{Demo figure (auto-linked from artifacts). Source: \texttt{artifacts/runs/M2-smoke/manifest.json}.}
\end{figure}

\section{Discussion and outlook}
\textbf{[TODO: discussion | source: \texttt{Draft\_Derivation.md} Sec.(fill)]}

\appendix

\section{Results provenance}
% Minimal, arXiv-safe provenance table (paths are internal to the project bundle).
\begin{table}[h]
\centering
\begin{tabular}{p{0.22\linewidth} p{0.60\linewidth}}
\hline
Quantity & Provenance (artifact path + key) \\
\hline
\texttt{a} & \texttt{artifacts/runs/M2-smoke/analysis.json:results.a} \\
\texttt{b} & \texttt{artifacts/runs/M2-smoke/analysis.json:results.b} \\
\texttt{c} & \texttt{artifacts/runs/M2-smoke/analysis.json:results.c} \\
\hline
\end{tabular}
\caption{Results provenance (auto-generated; fill/extend as needed).}
\end{table}

\bibliographystyle{apsrev4-2}
\bibliography{references}

\end{document}
```

## File: team/reviews/M2-r1/generated_paper_README.md
```markdown
# Paper scaffold (research-writer)

This folder was generated from a `research-team` project.

## Build

```bash
latexmk -pdf main.tex
```

## Provenance

- All quoted numbers should have a provenance pointer: `artifact path + key`.
- Any external claim used in core reasoning must be validated or labeled `UNVERIFIED` with a validation plan + kill criterion.

## Scaffold level

- M1: minimal compilable skeleton (section TODOs remain).
- M2: populate TODOs from `Draft_Derivation.md` and `artifacts/` manifests/summaries.

## Generation

- project root: `/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.zJR83Luv6I/project`
- tag: `M2-smoke`
- generated_at: `2026-01-27T15:01:31.157529+00:00`
- manifest: `artifacts/runs/M2-smoke/manifest.json`
- analysis: `artifacts/runs/M2-smoke/analysis.json`
```

## File: team/reviews/M2-r1/generated_references.bib
```bibtex
@article{Bezanson2017,
  journal = "",
  author = {Bezanson, Jeff and others},
  title  = {Julia: A Fresh Approach to Numerical Computing},
  year   = {2017},
  doi    = {10.1137/141000671}
}

```

