# research-writer — M1 Review Packet (design + scaffold)

Milestone goal: create the skill skeleton (docs, templates, scripts layout, smoke harness) and reviewer prompt infrastructure.

## Acceptance criteria
- Required docs exist: SKILL.md, README.md, RUNBOOK.md, ROADMAP.md
- Templates exist under assets/templates (RevTeX4-2 12pt onecolumn, bib template, latexmkrc, paper README)
- Smoke harness exists: scripts/dev/run_all_smoke_tests.sh
- Reviewer system prompts exist and enforce strict output contract

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
```

### Smoke test output
```text
[smoke] help: scaffold CLI
[smoke] help: bibtex fixer
[smoke] help: double-backslash fixer
[smoke] NOTE: end-to-end fixture + latexmk build is implemented in milestone M2
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
cd paper && latexmk -pdf -interaction=nonstopmode main.tex
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
latexmk -pdf -interaction=nonstopmode main.tex
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

## File: ROADMAP.md
```markdown
# research-writer — Roadmap

## M0: Learn (FK writing voice)

Acceptance criteria:
- `assets/style/style_profile.md` captures recurring voice/structure conventions and explicitly includes skepticism + auditability requirements.
- `assets/style/writing_voice_system_prompt.txt` provides a compact drafting prompt consistent with the profile.
- No changes are made to the source Overleaf projects.

Status: done (see `team/reviews/M0-r1/`).

## M1: Design + scaffold

Acceptance criteria:
- Skill repo skeleton exists with required docs:
  - `SKILL.md`, `README.md`, `RUNBOOK.md`, `ROADMAP.md`
- Templates exist under `assets/`:
  - RevTeX4-2 `12pt,onecolumn` skeleton
  - BibTeX template
  - Reviewer prompt templates
- Smoke harness skeleton exists under `scripts/dev/` with a single entry `scripts/dev/run_all_smoke_tests.sh`.
- Reviewer system prompts exist and enforce the strict output contract.

## M2: End-to-end minimal working research-writer

Acceptance criteria:
- `bash scripts/bin/research_writer_scaffold.sh ...` generates a compilable RevTeX paper from a minimal fixture project.
- BibTeX hygiene is implemented (RevTeX4-2 `journal` workaround).
- Deterministic double-backslash math check exists and optional deterministic auto-fix works.
- `bash scripts/dev/run_all_smoke_tests.sh` passes locally:
  - CLI help works
  - fixture → `paper/` generation works
  - if `latexmk` exists: compilation succeeds; else: clear skip
  - runs the double-backslash-in-math check on generated outputs/templates

```

## File: team/reviewer_system_prompt_claude_opus.md
```markdown
You are Reviewer A (Claude Opus) in a two-reviewer clean-room convergence loop.

You must review the provided milestone packet for a Codex skill, focusing on:
- acceptance criteria completeness,
- realism for real research workflows,
- auditability and safety,
- and concrete patch suggestions.

Tools are disabled. You cannot access external files; use only the packet content.

OUTPUT CONTRACT (must follow exactly):
- First line must be exactly: "VERDICT: READY" or "VERDICT: NOT_READY"
- Then include these Markdown sections exactly (even if empty):
  - "## Blockers"
  - "## Non-blocking"
  - "## Real-research fit"
  - "## Robustness & safety"
  - "## Specific patch suggestions"
- "VERDICT: READY" is allowed only if "## Blockers" is empty and the milestone acceptance criteria are met.

Be concise but specific. Prefer actionable, file-level suggestions.

```

## File: team/reviewer_system_prompt_gemini_pro.md
```markdown
You are Reviewer B (Gemini 3.0 Pro) in a two-reviewer clean-room convergence loop.

You must review the provided milestone packet for a Codex skill, focusing on:
- acceptance criteria completeness,
- realism for real research workflows,
- auditability and safety,
- and concrete patch suggestions.

You cannot access external files; use only the packet content.

OUTPUT CONTRACT (must follow exactly):
- First line must be exactly: "VERDICT: READY" or "VERDICT: NOT_READY"
- Then include these Markdown sections exactly (even if empty):
  - "## Blockers"
  - "## Non-blocking"
  - "## Real-research fit"
  - "## Robustness & safety"
  - "## Specific patch suggestions"
- "VERDICT: READY" is allowed only if "## Blockers" is empty and the milestone acceptance criteria are met.

Be concise but specific. Prefer actionable, file-level suggestions.

```

## File: assets/review/reviewer_output_contract.md
```markdown
# Reviewer output contract (strict)

- First line exactly: `VERDICT: READY` or `VERDICT: NOT_READY`
- Required Markdown headers (exact):
  - `## Blockers`
  - `## Non-blocking`
  - `## Real-research fit`
  - `## Robustness & safety`
  - `## Specific patch suggestions`
- `READY` allowed only if Blockers is empty and acceptance criteria are met.

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
\date{\today}

\begin{abstract}
% Write a mechanism-first abstract:
% context → method/constraints → headline quantitative results → interpretation/limitations.
[TODO: abstract | source: Draft_Derivation.md §(fill)]
\end{abstract}

\maketitle

\section{Introduction}
[TODO: introduction | source: Draft_Derivation.md §(fill)]

\section{Theory / Formalism}
% Do not invent derivations. Point to the notebook sections that contain them.
[TODO: formalism + key equations | source: Draft_Derivation.md §(fill)]

\section{Results}
% Quote numbers only with provenance pointers:
%   artifact: <path>, key: <json/csv key>
[TODO: results | source: artifacts/<tag>_analysis.json §(fill)]

\section{Discussion and outlook}
[TODO: discussion | source: Draft_Derivation.md §(fill)]

\appendix

\section{Results provenance}
% Minimal, arXiv-safe provenance table (paths are internal to the project bundle).
\begin{table}[h]
\centering
\begin{tabular}{p{0.22\linewidth} p{0.60\linewidth}}
\hline
Quantity & Provenance (artifact path + key) \\
\hline
% Example:
% $a$ & \texttt{artifacts/M1-r1\_analysis.json:results.a} \\
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
$interaction = 'nonstopmode';
$pdflatex = 'pdflatex -interaction=%S -synctex=1 %O %S';
$bibtex = 'bibtex %O %B';

# RevTeX projects typically benefit from a full clean list.
$clean_ext = 'bbl blg fdb_latexmk fls synctex.gz run.xml bcf';

```

## File: assets/templates/paper_README.md
```markdown
# Paper scaffold (research-writer)

This folder was generated from a `research-team` project.

## Build

```bash
latexmk -pdf -interaction=nonstopmode main.tex
```

## Provenance

- All quoted numbers should have a provenance pointer: `artifact path + key`.
- Any external claim used in core reasoning must be validated or labeled `UNVERIFIED` with a validation plan + kill criterion.

```

## File: assets/templates/references.bib
```text
% references.bib — research-writer scaffold
%
% Policy:
% - Prefer INSPIRE BibTeX when available.
% - RevTeX4-2 (APS) safety: @article entries must include a journal field (use journal = "" if unknown).
%
% Example minimal entry:
% @article{Example:2020abc,
%   author  = {Doe, John},
%   title   = {Example Placeholder},
%   year    = {2020},
%   journal = "",
% }

```

## File: scripts/bin/research_writer_scaffold.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${SCRIPT_DIR}/research_writer_scaffold.py" "$@"

```

## File: scripts/bin/research_writer_scaffold.py
```text
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
import shutil
import sys
from pathlib import Path


def _skill_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


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
    ap.add_argument("--force", action="store_true", help="Overwrite output directory if it exists.")
    args = ap.parse_args()

    project_root = Path(args.project_root).expanduser().resolve()
    if not project_root.is_dir():
        print(f"ERROR: --project-root is not a directory: {project_root}", file=sys.stderr)
        return 2

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

    for p in (main_tpl, bib_tpl, readme_tpl, latexmkrc_tpl):
        if not p.is_file():
            print(f"ERROR: missing template: {p}", file=sys.stderr)
            return 2

    title = args.title.strip() or f"{project_root.name}: draft"
    authors = args.authors.strip() or "AUTHOR(S) (placeholder)"

    main_tex = _render_main_tex(_read_text(main_tpl), title=title, authors=authors, project_root=project_root, tag=args.tag)
    _write_text(out_dir / "main.tex", main_tex)
    _write_text(out_dir / "references.bib", _read_text(bib_tpl))
    _write_text(out_dir / "latexmkrc", _read_text(latexmkrc_tpl))
    _write_text(out_dir / "README.md", _read_text(readme_tpl))
    (out_dir / "figures").mkdir(parents=True, exist_ok=True)

    print("[ok] research-writer scaffold complete")
    print(f"- project root: {project_root}")
    print(f"- tag: {args.tag}")
    print(f"- out: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

## File: scripts/dev/run_all_smoke_tests.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

echo "[smoke] help: scaffold CLI"
bash scripts/bin/research_writer_scaffold.sh --help >/dev/null

echo "[smoke] help: bibtex fixer"
python3 scripts/bin/fix_bibtex_revtex4_2.py --help >/dev/null

echo "[smoke] help: double-backslash fixer"
python3 scripts/bin/fix_md_double_backslash_math.py --help >/dev/null

echo "[smoke] NOTE: end-to-end fixture + latexmk build is implemented in milestone M2"
echo "[smoke] ok"

```

