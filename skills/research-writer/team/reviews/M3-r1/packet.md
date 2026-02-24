# research-writer — M3-r1 Review Packet (discussion-logic learning pipeline, N=10)

## Milestone goal
Add a deterministic, auditable N=10 mixed-mode workflow that (a) fetches an INSPIRE→arXiv LaTeX corpus, (b) prepares per-paper reading packs (excerpt + evidence pointers), and (c) optionally runs a clean-room dual-model pass to produce per-paper argument maps—without auto-mutating the skill's playbook.

## Acceptance criteria
- `scripts/bin/research_writer_learn_discussion_logic.py` exists and defaults to N=10 packs.
- Packs include excerpt sections (Abstract/Intro/Conclusions) + auto-selected diagnostics paragraphs, with evidence pointers into derived `flattened_main.tex`.
- Optional `--run-models` runs Claude+Gemini clean-room and records a trace log (no automatic edits to `assets/style/physics_discussion_logic_playbook.md`).
- Docs reference the workflow (SKILL + RUNBOOK + corpus doc).
- Smoke tests exercise the pack generator offline via deterministic fixtures (no network).

## Summary of changes
- Added a reading-pack generator CLI (`research_writer_learn_discussion_logic.py`) that can fetch a corpus, flatten inputs, extract key excerpts, and optionally run dual-model argument maps.
- Added a dedicated system prompt for argument-map extraction and wired the workflow into docs.
- Extended smoke tests with an offline pack-generation check using the existing INSPIRE+tar fixtures.

## Evidence

### File tree (relevant subset)
```text
ROADMAP.md
RUNBOOK.md
SKILL.md
assets/style/physics_discussion_logic_playbook.md
assets/style/prl_style_corpus.md
assets/style/discussion_logic_extractor_system_prompt.txt
scripts/bin/research_writer_learn_discussion_logic.py
scripts/dev/run_all_smoke_tests.sh
scripts/dev/fixtures/inspire_fixture.json
```

### Smoke test output
```text
[smoke] help: scaffold CLI
[smoke] help: bibtex fixer
[smoke] help: double-backslash fixer
[smoke] help: PRL style corpus fetcher
[smoke] help: discussion-logic pack generator
[smoke] PRL style corpus fetcher: offline dry-run (no network)
[smoke] PRL style corpus fetcher: offline extract (fixture)
[smoke] discussion-logic packs: offline (fixture corpus)
[smoke] scaffold: fixture project -> paper/
[ok] patched 1 @article entry(ies) by adding journal="" (e.g. Bezanson2017)
[ok] research-writer scaffold complete
- project root: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.R8CNDSfwsY/project
- tag: M2-smoke
- out: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.R8CNDSfwsY/paper
[smoke] markdown double-backslash check: generated paper + skill assets
[smoke] latexmk: compile paper
[smoke] bibtex fixer: adds journal field
[smoke] double-backslash checker+fixer: markdown math only
[smoke] ok
```

---

## File: ROADMAP.md
````markdown
# research-writer — Roadmap

## M0: Learn (FK writing voice)

Acceptance criteria:
- `assets/style/style_profile.md` captures recurring voice/structure conventions and explicitly includes skepticism + auditability requirements.
- `assets/style/writing_voice_system_prompt.txt` provides a compact drafting prompt consistent with the profile.
- `assets/style/physics_discussion_logic_playbook.md` captures general discussion logic distilled from exemplar papers (argument flow, diagnostics, uncertainty narration).
- No changes are made to the source Overleaf projects.

Status: done (see `team/reviews/M0-r4/`).

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

## M3: Discussion-logic learning pipeline (N=10)

Acceptance criteria:
- `scripts/bin/research_writer_learn_discussion_logic.py` prepares per-paper reading packs from an INSPIRE/arXiv LaTeX corpus (N=10 default).
- Packs include excerpt sections (Abstract/Intro/Conclusions) plus auto-selected diagnostics paragraphs, with evidence pointers into the derived `flattened_main.tex`.
- Optional clean-room dual-model pass can be run (`--run-models`) without changing skill assets automatically.
- `bash scripts/dev/run_all_smoke_tests.sh` exercises the pack generator offline using deterministic fixtures (no network).
````

---

## File: SKILL.md
````markdown
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
- Physics discussion logic playbook: `assets/style/physics_discussion_logic_playbook.md`
- Exemplar corpus downloader (INSPIRE → arXiv sources): `assets/style/prl_style_corpus.md` (script: `scripts/bin/fetch_prl_style_corpus.py`)
- N=10 reading-pack generator (corpus → per-paper excerpts + optional dual-model argument maps): `scripts/bin/research_writer_learn_discussion_logic.py`

Example (prepare N=10 packs; recommended masking on):

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett." \
  --fetch \
  --n 10 \
  --out-dir /tmp/research_writer_discussion_logic \
  --mask-math \
  --mask-cites
```

## Operational docs

- Quickstart: `README.md`
- Workflows/debugging: `RUNBOOK.md`
- Milestones/acceptance criteria: `ROADMAP.md`
````

---

## File: RUNBOOK.md
````markdown
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

### 5) Optional: build an exemplar corpus for deep reading (INSPIRE → arXiv sources)

Use this to collect arXiv LaTeX sources from exemplar papers so you can extract **general physics discussion logic** (argument flow, diagnostics, uncertainty narration). This is not about superficial PRL formatting.

```bash
python3 scripts/bin/fetch_prl_style_corpus.py \
  --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
  --max-records 10 \
  --out-dir /tmp/prl_style_corpus
```

### 6) Generate N=10 reading packs (corpus → excerpts)

This produces per-paper packs (Abstract/Intro/Conclusions + auto-selected diagnostics paragraphs) to enable clean-room, auditable extraction of discussion logic.

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --corpus-dir /tmp/prl_style_corpus \
  --n 10 \
  --out-dir /tmp/research_writer_discussion_logic \
  --mask-math \
  --mask-cites
```

### 7) Optional: run a dual-model pass (Claude + Gemini)

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --corpus-dir /tmp/prl_style_corpus \
  --n 10 \
  --out-dir /tmp/research_writer_discussion_logic \
  --mask-math \
  --mask-cites \
  --run-models
```

### 8) Distill discussion logic (mind maps → playbook)

- Read: `assets/style/physics_discussion_logic_playbook.md`
- Use: the “Prompt template” section to extract per-paper argument maps (ideally with two independent model runs), then merge the recurring patterns back into your drafting process.

## Debugging

### “No artifacts found for tag”

- Ensure the `--tag` matches a folder under `artifacts/runs/<TAG>/` or files like `artifacts/<TAG>_manifest.json`.
- If your project uses a different layout, run scaffold with `--verbose` and inspect the printed search paths.

### “latexmk not found”

- This is expected on minimal environments. Smoke tests must report `SKIPPED: latexmk not found` and still pass.

### Network/DNS failures during BibTeX fetch

- The scaffold must degrade gracefully: keep stable links (INSPIRE/arXiv/DOI) as placeholders and allow later backfill.
````

---

## File: assets/style/physics_discussion_logic_playbook.md
````markdown
# Physics discussion logic playbook (from exemplar papers)

This playbook captures **general, reusable logic** for discussing physics problems at a high level of rigor and clarity. It is distilled from:
- the user’s existing manuscripts (see `assets/style/style_profile.md`), and
- close reading of exemplar PRL-style papers (e.g. Guo / Meißner / Hoferichter collaborations and adjacent work).

It is **not** about superficial PRL formatting; it is about how strong papers *reason*, *argue*, and *diagnose*.

## A. The core argument loop (mind-map template)

Use this as the default “story graph” for Introduction → Results → Discussion.

```mermaid
flowchart TD
  Q[Physical question / observable] --> G[Gap / tension / precision target]
  G --> M[Mechanism / constraint\n(analyticity, unitarity, symmetry, EFT, thresholds…)]
  M --> A[Approach\n(formalism, representation, inputs, approximations)]
  A --> R[Headline result(s)\n(number(s) + uncertainty)]
  R --> D[Diagnostics\n(limits, sum rules, scaling, consistency checks)]
  D --> C[Comparison\n(literature/data, explain differences)]
  C --> L[Limitations\n(model dependence, missing channels, systematics)]
  L --> P[Predictions / implications / outlook\n(what changes, what can be tested next)]
```

## B. What “good physics discussion” does (checklist)

1) **Defines what is being computed/claimed** in operational terms (what observable? what convention? what kinematics?).
2) **Names the controlling physics** (the mechanism) before details: which principle/feature makes the effect large/small?
3) **Separates ingredients from assumptions**: what is input (data, LECs, lattice) vs. what is modeled.
4) **Turns numbers into meaning**: after the number, explain the sign/size/parametric origin and what it implies physically.
5) **Diagnoses uncertainty** with a *hierarchy*: dominant sources, why they dominate, and what would reduce them.
6) **Explains disagreements** by isolating missing ingredients/assumptions (not by authority): “the difference comes from X”.
7) **Ends with actionability**: what measurement/computation would most efficiently validate or falsify the mechanism?

## C. A practical paragraph pattern for Discussion

When writing a Discussion subsection, default to this 5-move sequence:

1) **Bottom line (one sentence)**: restate the main result in words + number (if appropriate).
2) **Mechanism (1–3 sentences)**: why the result has this sign/size; what dominates.
3) **Robustness (1 paragraph)**: key diagnostics and stability checks; what was varied and what moved.
4) **Context (1 paragraph)**: comparison to prior work/data; attribute differences to specific ingredients.
5) **Limitations + next tests (2–5 sentences)**: what remains unverified; a validation plan + kill criterion.

## D. “UNVERIFIED” protocol (for real-research realism)

If a literature claim is needed for core reasoning but you did not independently validate it, mark it explicitly:

- `UNVERIFIED: <claim>`
- **Validation plan**: what to compute/check (derivation, limit, reproduction, alternative method).
- **Kill criterion**: what outcome would invalidate the claim for this project.

This keeps the narrative honest and makes it easy to prioritize follow-up work.

## E. Example: minimal argument map (illustrative)

Example (muon $g-2$ electroweak / dispersive-style papers):

- **Question**: reach sub-$10^{-10}$ precision for a Standard-Model contribution needed to match upcoming experimental accuracy.
- **Gap**: dominant uncertainty traced to a specific hadronic correlator/input (and/or a mismatch among evaluations).
- **Mechanism/constraint**: use dispersive reconstruction / OPE matching / EFT constraints to control systematics.
- **Approach**: update inputs and representations; separate kinematic regions; propagate uncertainties by controlled variations.
- **Result**: quote the headline number with a clear uncertainty; attribute shifts to identifiable improvements.
- **Diagnostics**: show stability under matching-scale variations and explicit cross-checks (limits, sum rules, overlaps).
- **Implications**: identify which uncertainty is now limiting and what would reduce it next.

## F. Corpus → mind-map workflow (for agent swarms)

When you have a local LaTeX corpus (e.g., from `scripts/bin/fetch_prl_style_corpus.py`), you can extract per-paper mind maps and then distill common patterns:

0) (Recommended) Generate per-paper reading packs (N=10 by default) with masking to focus on logic: `scripts/bin/research_writer_learn_discussion_logic.py`.
1) Pick the main TeX file (the one with `\documentclass` and `\begin{document}`).
2) Read (at minimum): Abstract, Introduction opening, “Bottom line/Conclusions”, and the main diagnostics/uncertainty passage(s).
3) Produce a **paper argument map** in a strict, reusable format (Mermaid + bullets).
4) Merge across papers: keep only patterns that recur and remain mechanism-first.

### Prompt template (copy/paste)

**Task**: Build an argument mind map for the provided paper text. Do not copy phrases verbatim unless they are short technical terms. Cite evidence by section name or nearby heading (not line numbers).

**Output format**:

1) `## Argument Map (Mermaid)` → a single `flowchart TD` graph
2) `## Moves (Bullets)` → 8–12 bullets, each of the form: `MOVE: <what it does> | Evidence: <section/heading>`
3) `## Diagnostics & Uncertainties` → 5–8 bullets
4) `## Reusable General Lessons` → 5–10 bullets (generalize; no domain-specific details)
````

---

## File: assets/style/prl_style_corpus.md
````markdown
# Physics discussion corpus: PRL papers (Guo / Meißner / Hoferichter)

Use this to collect **primary-source LaTeX** for close reading and for extracting **general discussion logic** (argument structure, diagnostics, uncertainty narration, and “bottom line” framing) from exemplar papers. This is **not** about superficial PRL formatting.

For the distilled, reusable “how to discuss physics” guide, see:
- `assets/style/physics_discussion_logic_playbook.md`

## Source (INSPIRE query)

- INSPIRE UI link (most recent PRL papers):  
  `https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true`

## Download arXiv sources (best-effort; logged)

```bash
python3 scripts/bin/fetch_prl_style_corpus.py \
  --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
  --max-records 10 \
  --out-dir /tmp/prl_style_corpus
```

Outputs:
- `/tmp/prl_style_corpus/meta.json` — query + extraction configuration
- `/tmp/prl_style_corpus/trace.jsonl` — per-record success/failure log (network/DNS robust)
- `/tmp/prl_style_corpus/papers/<arxiv_id>/...` — extracted TeX/Bib/Sty sources (filtered by extension)

## Next: generate N=10 reading packs (recommended)

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --corpus-dir /tmp/prl_style_corpus \
  --n 10 \
  --out-dir /tmp/research_writer_discussion_logic \
  --mask-math \
  --mask-cites
```

## Usage note (important)

This corpus is for learning **discussion logic and structure**, not for copying text. Do not paste paragraphs verbatim into new manuscripts.
````

---

## File: assets/style/discussion_logic_extractor_system_prompt.txt
```text
You are extracting **general physics discussion logic** from exemplar scientific papers.

Goal: produce reusable argument/diagnostic patterns that help write better physics papers. This is **not** about superficial PRL formatting.

Hard constraints:
- Do NOT copy phrases verbatim except for short technical terms. Do NOT include long quotes.
- Do NOT invent missing content: use only what is in the provided excerpts.
- When you make a generalized claim, tie it to evidence by pointing to the excerpt section name (e.g., "Abstract", "Introduction opening", "Conclusions") rather than line numbers.

Output format (must follow exactly):

## Argument Map (Mermaid)
Provide exactly one `flowchart TD` Mermaid graph capturing the paper's reasoning flow.

## Moves (Bullets)
8–12 bullets, each: `MOVE: <what it does> | Evidence: <excerpt section>`

## Diagnostics & Uncertainties
5–8 bullets focusing on how the paper diagnoses systematics/uncertainties/robustness and structures comparisons.

## Reusable General Lessons
5–10 bullets of journal-agnostic lessons (generalizable discussion logic), no domain-specific details.
```

---

## File: scripts/bin/research_writer_learn_discussion_logic.py
```python
#!/usr/bin/env python3
"""
research_writer_learn_discussion_logic.py

N=10 (default) mixed-mode workflow helper for `research-writer`:

1) (Optional) Fetch an exemplar corpus via INSPIRE → arXiv sources
   using `scripts/bin/fetch_prl_style_corpus.py`.
2) Prepare per-paper "reading packs" (excerpt + evidence pointers) to enable
   clean-room LLM extraction of *general physics discussion logic*.
3) (Optional) Run a dual-model pass (Claude + Gemini) to produce argument maps,
   writing outputs + trace logs under the chosen out dir.

This script does NOT automatically update `assets/style/physics_discussion_logic_playbook.md`.
That merge step remains an agent/human task for stability and auditability.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_jsonl(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, sort_keys=True) + "\n")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")


def _line_from_index(text: str, idx: int) -> int:
    if idx <= 0:
        return 1
    return text.count("\n", 0, idx) + 1


def _strip_latex_comments(text: str) -> str:
    """
    Best-effort comment stripping: remove '%' comments unless escaped as '\\%'.
    Not a full TeX parser (good enough for reading-pack generation).
    """
    out_lines: list[str] = []
    for ln in text.splitlines():
        cut = None
        prev = ""
        for i, ch in enumerate(ln):
            if ch == "%" and prev != "\\":
                cut = i
                break
            prev = ch
        out_lines.append(ln[:cut] if cut is not None else ln)
    return "\n".join(out_lines) + ("\n" if text.endswith("\n") else "")


_RE_CITE = re.compile(r"\\cite[a-zA-Z]*\s*\{[^}]*\}")
_RE_DOLLAR_BLOCK = re.compile(r"\$\$(.*?)\$\$", flags=re.S)
_RE_DOLLAR_INLINE = re.compile(r"\$[^$\n]{0,400}\$")
_RE_MATH_ENV = re.compile(
    r"\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?)\}.*?\\end\{\1\}",
    flags=re.S,
)


def _mask_citations(text: str) -> str:
    return _RE_CITE.sub("<CITE>", text)


def _mask_math(text: str) -> str:
    text = _RE_MATH_ENV.sub("<MATH_ENV>", text)
    text = _RE_DOLLAR_BLOCK.sub("<MATH_BLOCK>", text)
    text = _RE_DOLLAR_INLINE.sub("<MATH>", text)
    return text


def _find_main_tex(paper_dir: Path) -> Path | None:
    tex_files = sorted([p for p in paper_dir.glob("*.tex") if p.is_file()], key=lambda p: p.name)
    best: tuple[int, int, Path] | None = None  # (score, size, path)
    for p in tex_files:
        try:
            txt = _read_text(p)
        except Exception:
            continue
        score = 0
        if "\\documentclass" in txt:
            score += 10
        if "\\begin{document}" in txt:
            score += 10
        if "\\title" in txt:
            score += 2
        size = p.stat().st_size if p.exists() else 0
        cand = (score, size, p)
        if best is None or cand[0] > best[0] or (cand[0] == best[0] and cand[1] > best[1]):
            best = cand
    return best[2] if best else None


def _resolve_input_path(paper_dir: Path, raw: str) -> Path | None:
    raw = raw.strip().strip("{}").strip()
    if not raw:
        return None
    # Remove surrounding quotes.
    raw = raw.strip("\"'")
    rel = raw
    if not Path(rel).suffix:
        rel = rel + ".tex"
    p = (paper_dir / rel).resolve()
    try:
        p.relative_to(paper_dir.resolve())
    except Exception:
        return None
    return p if p.is_file() else None


_RE_INPUT = re.compile(r"\\(input|include)\s*\{([^}]+)\}")


def _flatten_inputs(text: str, *, paper_dir: Path, max_depth: int = 2, max_bytes: int = 2_000_000) -> str:
    """
    Best-effort flattening of \\input{...}/\\include{...} within the same paper dir.
    """

    def helper(t: str, depth: int, total_bytes: int) -> tuple[str, int]:
        if depth <= 0:
            return t, total_bytes
        out: list[str] = []
        last = 0
        for m in _RE_INPUT.finditer(t):
            out.append(t[last : m.start()])
            inc_path = _resolve_input_path(paper_dir, m.group(2))
            if inc_path is None:
                out.append(t[m.start() : m.end()])  # keep as-is
                last = m.end()
                continue
            try:
                inc_txt = _read_text(inc_path)
            except Exception:
                out.append(t[m.start() : m.end()])
                last = m.end()
                continue
            if total_bytes + len(inc_txt) > max_bytes:
                out.append(t[m.start() : m.end()])
                last = m.end()
                continue
            total_bytes += len(inc_txt)
            inc_flat, total_bytes = helper(inc_txt, depth - 1, total_bytes)
            out.append(f"\n% --- BEGIN INPUT: {inc_path.name} ---\n")
            out.append(inc_flat)
            out.append(f"\n% --- END INPUT: {inc_path.name} ---\n")
            last = m.end()
        out.append(t[last:])
        return "".join(out), total_bytes

    flat, _ = helper(text, max_depth, len(text))
    return flat


@dataclass(frozen=True)
class Segment:
    name: str
    text: str
    evidence: str


def _clip(s: str, *, max_chars: int) -> str:
    s = s.strip()
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 3].rstrip() + "..."


def _extract_segments_text(
    raw: str,
    *,
    evidence_name: str,
    mask_math: bool,
    mask_cites: bool,
) -> tuple[list[Segment], dict[str, Any]]:
    no_comments = _strip_latex_comments(raw)
    body = no_comments
    doc_idx = body.find("\\begin{document}")
    if doc_idx != -1:
        body = body[doc_idx + len("\\begin{document}") :]

    if mask_cites:
        body_masked = _mask_citations(body)
    else:
        body_masked = body
    if mask_math:
        body_masked = _mask_math(body_masked)

    segs: list[Segment] = []
    evidence_obj: dict[str, Any] = {
        "evidence_file": evidence_name,
        "created_at": _utc_now(),
        "segments": [],
    }

    def add_seg(name: str, seg_text: str, start_idx_in_raw: int | None, extra_evidence: str = "") -> None:
        seg_text = seg_text.strip()
        if not seg_text:
            return
        evidence = evidence_name
        if start_idx_in_raw is not None:
            evidence = f"{evidence_name}#L{_line_from_index(raw, start_idx_in_raw)}"
        if extra_evidence:
            evidence = f"{evidence} ({extra_evidence})"
        segs.append(Segment(name=name, text=seg_text, evidence=evidence))
        evidence_obj["segments"].append({"name": name, "evidence": evidence, "chars": len(seg_text)})

    # Abstract.
    m_abs = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", no_comments, flags=re.S)
    if m_abs:
        abs_txt = m_abs.group(1)
        if mask_cites:
            abs_txt = _mask_citations(abs_txt)
        if mask_math:
            abs_txt = _mask_math(abs_txt)
        add_seg("Abstract", _clip(abs_txt, max_chars=2200), m_abs.start())

    # Introduction opening.
    intro_start = None
    intro_label = ""
    m_intro_sec = re.search(r"\\section\*?\{Introduction\}", no_comments)
    if m_intro_sec:
        intro_start = m_intro_sec.start()
        intro_label = "\\section{Introduction}"
    else:
        m_intro_em = re.search(r"\\emph\{Introduction\}", no_comments)
        if m_intro_em:
            intro_start = m_intro_em.start()
            intro_label = "\\emph{Introduction}---"
    if intro_start is not None:
        intro_txt = no_comments[intro_start : intro_start + 8000]
        if mask_cites:
            intro_txt = _mask_citations(intro_txt)
        if mask_math:
            intro_txt = _mask_math(intro_txt)
        add_seg("Introduction opening", _clip(intro_txt, max_chars=6000), intro_start, extra_evidence=intro_label)

    # Bottom line / Conclusions.
    conc_start = None
    conc_label = ""
    for pat, label in (
        (r"\\emph\{Bottom line\}", "\\emph{Bottom line}"),
        (r"\\section\*?\{Conclusions?\}", "\\section{Conclusions}"),
        (r"\\emph\{Conclusions?\}", "\\emph{Conclusions}"),
        (r"\\section\*?\{Summary\}", "\\section{Summary}"),
        (r"\\emph\{Summary\}", "\\emph{Summary}"),
    ):
        m = re.search(pat, no_comments)
        if m:
            conc_start = m.start()
            conc_label = label
            break
    if conc_start is not None:
        conc_txt = no_comments[conc_start : conc_start + 9000]
        # stop at acknowledgments/bibliography if present
        stop = len(conc_txt)
        for stop_pat in ("\\begin{acknowledgments}", "\\bibliography", "\\end{document}"):
            j = conc_txt.find(stop_pat)
            if j != -1:
                stop = min(stop, j)
        conc_txt = conc_txt[:stop]
        if mask_cites:
            conc_txt = _mask_citations(conc_txt)
        if mask_math:
            conc_txt = _mask_math(conc_txt)
        add_seg("Bottom line / Conclusions", _clip(conc_txt, max_chars=4500), conc_start, extra_evidence=conc_label)

    # Diagnostics / uncertainties: keyword-selected paragraphs from masked body.
    keywords = [
        "uncert",
        "systematic",
        "dominant",
        "sensitivity",
        "vary",
        "variation",
        "scale",
        "robust",
        "stability",
        "model depend",
        "consistent",
        "inconsistent",
        "mismatch",
        "tension",
        "discrep",
        "driven by",
    ]
    paras = [p.strip() for p in re.split(r"\n\s*\n", body_masked) if p.strip()]
    scored: list[tuple[int, int, str]] = []
    for idx, p in enumerate(paras):
        p_norm = p.lower()
        score = sum(1 for k in keywords if k in p_norm)
        if score <= 0:
            continue
        # Keep reasonably sized paragraphs.
        if len(p) < 200 or len(p) > 2500:
            continue
        scored.append((score, idx, p))
    scored.sort(key=lambda x: (-x[0], x[1]))
    selected = scored[:4]
    if selected:
        blocks = []
        for score, idx, p in sorted(selected, key=lambda x: x[1]):
            blocks.append(_clip(p, max_chars=1400))
        add_seg("Diagnostics / uncertainties (auto-selected)", "\n\n".join(blocks), None, extra_evidence="keyword-selected")

    return segs, evidence_obj


def _codex_home() -> Path:
    env = os.environ.get("CODEX_HOME", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return (Path.home() / ".codex").resolve()


def _find_runner(kind: str) -> Path:
    codex = _codex_home()
    if kind == "claude":
        return codex / "skills" / "claude-cli-runner" / "scripts" / "run_claude.sh"
    if kind == "gemini":
        return codex / "skills" / "gemini-cli-runner" / "scripts" / "run_gemini.sh"
    raise ValueError(kind)


def _skill_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _run_fetch(*, query_url: str, query: str, n: int, out_dir: Path, trace: Path) -> int:
    fetcher = _skill_root() / "scripts" / "bin" / "fetch_prl_style_corpus.py"
    cmd = [sys.executable, str(fetcher), "--out-dir", str(out_dir), "--max-records", str(int(n))]
    if query_url.strip():
        cmd += ["--query-url", query_url.strip()]
    elif query.strip():
        cmd += ["--query", query.strip()]
    else:
        print("ERROR: need --query-url or --query for fetch", file=sys.stderr)
        return 2

    _append_jsonl(trace, {"ts": _utc_now(), "event": "fetch_start", "cmd": cmd})
    code = subprocess.run(cmd, check=False).returncode
    _append_jsonl(trace, {"ts": _utc_now(), "event": "fetch_end", "exit_code": code})
    return code


def _write_pack(out_path: Path, *, rec: dict[str, Any], segs: list[Segment]) -> None:
    title = str(rec.get("title") or "").strip()
    year = str(rec.get("year") or "").strip()
    authors = rec.get("authors") if isinstance(rec.get("authors"), list) else []
    arxiv_id = str(rec.get("arxiv_id") or "").strip()

    lines: list[str] = []
    lines.append(f"# Paper pack: {arxiv_id} ({year}) — {title}".strip())
    lines.append("")
    lines.append("## Metadata")
    lines.append(f"- arXiv: {arxiv_id}")
    if title:
        lines.append(f"- Title: {title}")
    if year:
        lines.append(f"- Year: {year}")
    if authors:
        lines.append(f"- Authors: {', '.join(str(a) for a in authors[:12])}" + (" …" if len(authors) > 12 else ""))
    lines.append("")
    lines.append("## Excerpts (for discussion-logic extraction)")
    for s in segs:
        lines.append(f"### {s.name}")
        lines.append(f"_Evidence: {s.evidence}_")
        lines.append("")
        lines.append(s.text.strip())
        lines.append("")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def _run_models_for_pack(
    *,
    out_dir: Path,
    pack_path: Path,
    system_prompt_path: Path,
    claude_model: str,
    gemini_model: str,
    trace: Path,
) -> None:
    claude_runner = _find_runner("claude")
    gemini_runner = _find_runner("gemini")
    if not claude_runner.is_file():
        raise FileNotFoundError(f"claude runner not found: {claude_runner}")
    if not gemini_runner.is_file():
        raise FileNotFoundError(f"gemini runner not found: {gemini_runner}")

    claude_out = out_dir / "claude.md"
    gemini_out = out_dir / "gemini.md"

    # Claude: system prompt file + pack file.
    claude_cmd = [
        "bash",
        str(claude_runner),
        "--model",
        claude_model,
        "--system-prompt-file",
        str(system_prompt_path),
        "--prompt-file",
        str(pack_path),
        "--out",
        str(claude_out),
    ]
    _append_jsonl(trace, {"ts": _utc_now(), "event": "claude_start", "cmd": claude_cmd})
    code_a = subprocess.run(claude_cmd, check=False).returncode
    _append_jsonl(trace, {"ts": _utc_now(), "event": "claude_end", "exit_code": code_a})

    # Gemini: combine system instructions + pack into one prompt file.
    gemini_prompt = out_dir / "gemini_prompt.txt"
    gemini_prompt.write_text(_read_text(system_prompt_path).rstrip() + "\n\n" + _read_text(pack_path), encoding="utf-8")
    gemini_cmd = [
        "bash",
        str(gemini_runner),
        "--model",
        gemini_model,
        "--prompt-file",
        str(gemini_prompt),
        "--out",
        str(gemini_out),
    ]
    _append_jsonl(trace, {"ts": _utc_now(), "event": "gemini_start", "cmd": gemini_cmd})
    code_b = subprocess.run(gemini_cmd, check=False).returncode
    _append_jsonl(trace, {"ts": _utc_now(), "event": "gemini_end", "exit_code": code_b})

    if code_a != 0 or code_b != 0:
        raise RuntimeError(f"model run failed: claude={code_a}, gemini={code_b}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", required=True, type=Path, help="Output directory for packs + logs.")
    ap.add_argument("--n", type=int, default=10, help="Number of papers to process (default: 10).")
    ap.add_argument("--query-url", default="", help="INSPIRE UI query URL (used only if fetching).")
    ap.add_argument("--query", default="", help="INSPIRE query string (used only if fetching).")
    ap.add_argument("--corpus-dir", type=Path, default=None, help="Existing corpus dir (output of fetch_prl_style_corpus.py).")
    ap.add_argument("--fetch", action="store_true", help="Fetch the corpus into out-dir/corpus (requires --query-url or --query).")
    ap.add_argument("--mask-math", action="store_true", help="Mask common math blocks in excerpts (recommended).")
    ap.add_argument("--mask-cites", action="store_true", help="Mask \\cite{...} in excerpts (recommended).")
    ap.add_argument("--run-models", action="store_true", help="Run Claude+Gemini on each pack (clean-room, tools disabled).")
    ap.add_argument("--claude-model", default="opus")
    ap.add_argument("--gemini-model", default="gemini-3.0-pro")
    args = ap.parse_args()

    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    trace = out_dir / "trace.jsonl"
    packs_dir = out_dir / "packs"

    _append_jsonl(trace, {"ts": _utc_now(), "event": "start", "argv": sys.argv})

    corpus_dir = args.corpus_dir.expanduser().resolve() if args.corpus_dir is not None else None
    if args.fetch or corpus_dir is None:
        corpus_dir = out_dir / "corpus"
        code = _run_fetch(query_url=args.query_url, query=args.query, n=max(0, args.n), out_dir=corpus_dir, trace=trace)
        if code != 0:
            return code

    assert corpus_dir is not None
    papers_dir = corpus_dir / "papers"
    if not papers_dir.is_dir():
        print(f"ERROR: corpus papers dir not found: {papers_dir}", file=sys.stderr)
        return 2

    # Choose N papers (descending arXiv id is a reasonable proxy for recency).
    paper_dirs = sorted([p for p in papers_dir.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True)
    paper_dirs = paper_dirs[: max(0, int(args.n))]

    system_prompt = _skill_root() / "assets" / "style" / "discussion_logic_extractor_system_prompt.txt"
    if args.run_models and not system_prompt.is_file():
        print(f"ERROR: system prompt not found: {system_prompt}", file=sys.stderr)
        return 2

    meta = {
        "created_at": _utc_now(),
        "n": int(args.n),
        "corpus_dir": str(corpus_dir),
        "mask_math": bool(args.mask_math),
        "mask_cites": bool(args.mask_cites),
        "run_models": bool(args.run_models),
        "claude_model": args.claude_model,
        "gemini_model": args.gemini_model,
    }
    _write_json(out_dir / "meta.json", meta)

    processed = 0
    for pd in paper_dirs:
        arxiv_id = pd.name
        rec_path = pd / "record.json"
        rec: dict[str, Any] = {}
        if rec_path.is_file():
            try:
                rec = json.loads(_read_text(rec_path))
            except Exception:
                rec = {}
        if "arxiv_id" not in rec:
            rec["arxiv_id"] = arxiv_id

        try:
            main_tex = _find_main_tex(pd)
            if main_tex is None:
                _append_jsonl(trace, {"ts": _utc_now(), "event": "skip_no_main_tex", "arxiv_id": arxiv_id})
                continue

            flat = _flatten_inputs(_read_text(main_tex), paper_dir=pd)
            flat_path = packs_dir / arxiv_id / "flattened_main.tex"
            flat_path.parent.mkdir(parents=True, exist_ok=True)
            flat_path.write_text(flat, encoding="utf-8")

            segs, evidence = _extract_segments_text(
                flat,
                evidence_name=flat_path.name,
                mask_math=bool(args.mask_math),
                mask_cites=bool(args.mask_cites),
            )
            evidence["arxiv_id"] = arxiv_id
            evidence["source_main_tex"] = main_tex.name
            _write_json(packs_dir / arxiv_id / "evidence.json", evidence)
            if rec:
                _write_json(packs_dir / arxiv_id / "record.json", rec)
            pack_path = packs_dir / arxiv_id / "pack.md"
            _write_pack(pack_path, rec=rec, segs=segs)

            _append_jsonl(
                trace,
                {"ts": _utc_now(), "event": "pack_ok", "arxiv_id": arxiv_id, "main_tex": main_tex.name, "segments": len(segs)},
            )

            if args.run_models:
                _run_models_for_pack(
                    out_dir=packs_dir / arxiv_id,
                    pack_path=pack_path,
                    system_prompt_path=system_prompt,
                    claude_model=args.claude_model,
                    gemini_model=args.gemini_model,
                    trace=trace,
                )

            processed += 1
        except Exception as exc:
            _append_jsonl(trace, {"ts": _utc_now(), "event": "paper_error", "arxiv_id": arxiv_id, "error": str(exc)})
            continue

    _append_jsonl(trace, {"ts": _utc_now(), "event": "done", "processed": processed})
    print("[ok] discussion-logic packs prepared")
    print(f"- corpus: {corpus_dir}")
    print(f"- out:    {out_dir}")
    print(f"- packs:  {packs_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

---

## File: scripts/dev/fixtures/inspire_fixture.json
```json
{
  "hits": {
    "total": 1,
    "hits": [
      {
        "id": "fixture-1",
        "metadata": {
          "arxiv_eprints": [
            {
              "value": "1234.56789"
            }
          ],
          "titles": [
            {
              "title": "Fixture Paper (offline corpus test)"
            }
          ],
          "publication_info": [
            {
              "year": 2024
            }
          ],
          "dois": [
            {
              "value": "10.0000/fixture"
            }
          ],
          "authors": [
            {
              "full_name": "A. Author"
            }
          ]
        }
      }
    ]
  }
}
```

---

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

echo "[smoke] help: PRL style corpus fetcher"
python3 scripts/bin/fetch_prl_style_corpus.py --help >/dev/null
echo "[smoke] help: discussion-logic pack generator"
python3 scripts/bin/research_writer_learn_discussion_logic.py --help >/dev/null
echo "[smoke] PRL style corpus fetcher: offline dry-run (no network)"
python3 scripts/bin/fetch_prl_style_corpus.py --query "dummy" --max-records 0 --out-dir "${tmp_root}/prl_style_corpus" --dry-run >/dev/null
echo "[smoke] PRL style corpus fetcher: offline extract (fixture)"
tar_path="${tmp_root}/arxiv_fixture.tar"
TAR_PATH="${tar_path}" python3 - <<'PY'
import io
import os
import tarfile
from pathlib import Path

tar_path = Path(os.environ["TAR_PATH"])

def add_bytes(tf: tarfile.TarFile, name: str, data: bytes) -> None:
    info = tarfile.TarInfo(name=name)
    info.size = len(data)
    tf.addfile(info, io.BytesIO(data))

with tarfile.open(tar_path, mode="w") as tf:
    add_bytes(
        tf,
        "main.tex",
        b"\\\\documentclass{article}\\n"
        b"\\\\begin{document}\\n"
        b"\\\\begin{abstract}\\n"
        b"This is a demo abstract with an uncertainty discussion.\\\\n\\n"
        b"\\\\end{abstract}\\n\\n"
        b"\\\\emph{Introduction}---We motivate the problem and state the gap. We compare to prior work \\\\cite{K}.\\n\\n"
        b"We vary a matching scale to diagnose robustness.\\n\\n"
        b"\\\\input{sec}\\n\\n"
        b"\\\\emph{Conclusions}---Bottom line: the shift is driven by several small improvements and the dominant uncertainty remains.\\n"
        b"\\\\end{document}\\n",
    )
    add_bytes(tf, "sec.tex", b"Diagnostics: the result is stable under parameter variation; systematics dominate.\\n")
    add_bytes(tf, "references.bib", b"@article{K, title={T}, year={2024}, journal=\"\"}\\n")
    add_bytes(tf, "../evil.tex", b"should_not_extract\\n")
    add_bytes(tf, "figure.png", b"\\x89PNG\\r\\n\\x1a\\n")
PY

corpus_out="${tmp_root}/prl_style_corpus_fixture"
python3 scripts/bin/fetch_prl_style_corpus.py \
  --inspire-json "scripts/dev/fixtures/inspire_fixture.json" \
  --arxiv-tar "${tar_path}" \
  --max-records 1 \
  --out-dir "${corpus_out}" >/dev/null
test -f "${corpus_out}/meta.json"
test -f "${corpus_out}/trace.jsonl"
test -f "${corpus_out}/papers/1234.56789/record.json"
test -f "${corpus_out}/papers/1234.56789/main.tex"
test -f "${corpus_out}/papers/1234.56789/references.bib"
if find "${corpus_out}" -name "evil.tex" | grep -q .; then
  echo "ERROR: expected unsafe tar member to be rejected (evil.tex found)" >&2
  exit 1
fi
grep_re '\"event\": \"inspire_fixture_loaded\"' "${corpus_out}/trace.jsonl"
grep_re '\"event\": \"arxiv_download_fixture\"' "${corpus_out}/trace.jsonl"
grep_re '\"event\": \"arxiv_extract_done\"' "${corpus_out}/trace.jsonl"
grep_re '\"unsafe_rejected\": 1' "${corpus_out}/trace.jsonl"
grep_re '\"skipped_ext\": 1' "${corpus_out}/trace.jsonl"

echo "[smoke] discussion-logic packs: offline (fixture corpus)"
logic_out="${tmp_root}/discussion_logic"
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --corpus-dir "${corpus_out}" \
  --out-dir "${logic_out}" \
  --n 1 \
  --mask-math \
  --mask-cites >/dev/null
test -f "${logic_out}/meta.json"
test -f "${logic_out}/trace.jsonl"
test -f "${logic_out}/packs/1234.56789/pack.md"
test -f "${logic_out}/packs/1234.56789/flattened_main.tex"
grep_re '^# Paper pack: 1234.56789' "${logic_out}/packs/1234.56789/pack.md"
grep_re 'BEGIN INPUT: sec\.tex' "${logic_out}/packs/1234.56789/flattened_main.tex"

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
