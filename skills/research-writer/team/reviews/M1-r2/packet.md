# research-writer — M1 Review Packet (design + scaffold, r2)

Milestone goal: create the skill skeleton (docs, templates, scripts layout, smoke harness) and reviewer prompt infrastructure.

## Acceptance criteria
- Required docs exist: SKILL.md, README.md, RUNBOOK.md, ROADMAP.md
- Templates exist under assets/templates (RevTeX4-2 12pt onecolumn, bib template, latexmkrc, paper README)
- Smoke harness exists and runs: scripts/dev/run_all_smoke_tests.sh
- Reviewer system prompts exist and enforce strict output contract

## Notes on scope
- M1 provides a minimal compilable paper skeleton (template-first).
- M2 adds full ingestion of Draft_Derivation.md + artifacts/ and populates TODOs + provenance tables.

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
[smoke] scaffold: minimal project -> paper/
[ok] research-writer scaffold complete
- project root: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.jTyceQsLBF/project
- tag: M1-r1
- out: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.jTyceQsLBF/paper
[smoke] bibtex fixer: adds journal field
[smoke] double-backslash checker+fixer: markdown math only
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

## File: assets/review/review_packet_template.md
```markdown
# <skill> — <milestone> Review Packet

## Milestone goal
<1–3 sentences>

## Acceptance criteria
- <bullet list>

## Summary of changes
- <what changed>

## Evidence
- File tree (relevant subset)
- Key file contents (paste, do not reference paths the reviewer cannot open)
- Local smoke/test output (paste)

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

## Scaffold level

- M1: minimal compilable skeleton (section TODOs remain).
- M2: populate TODOs from `Draft_Derivation.md` and `artifacts/` manifests/summaries.
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

## File: assets/style/style_profile.md
```markdown
# research-writer — FK LaTeX Writing Style Profile (M0)

This file summarizes recurring writing/style patterns inferred from a scan of the user’s existing LaTeX manuscripts (Overleaf projects listed in the M0 corpus below). It is intended as **guidance** for drafting new text in a similar technical voice, not as a phrase bank to copy verbatim.

## 1) High-level voice

- **Physics-first, mechanism-first**: lead with the physical question, then the mechanism/constraint (unitarity/analyticity/symmetry/power counting), then the quantitative consequence.
- **Active but restrained**: frequent “We …” for actions/results (“We show/derive/find”), but avoid hype. Prefer concrete verbs.
- **Skeptical by default**: treat literature claims as inputs that can fail; when leaning on them, either validate (derivation/check/limit) or label as *unverified* with a plan + kill criterion.
- **Definition-hardened**: quantities are defined operationally; if a number is quoted, the definition and extraction procedure are explicit (and uncertainties are discussed).
- **Comparative and diagnostic**: comparisons to prior methods/results are used to isolate *why* things differ (e.g., left-hand cuts, crossing, coupled channels, thresholds).

## 2) Paragraph mechanics (typical “moves”)

- **Context → gap → contribution** in the first 1–3 paragraphs of the Introduction.
- **Concrete signposting**:
  - “In this work, we …”
  - “This paper is organized as follows …”
  - “For simplicity, we …” / “Without loss of generality, …”
  - “As is well-known (see, e.g., …), …” when using standard facts.
- **Bridge equations to meaning**: after key equations, add a sentence explaining what controls the size/sign/limit; avoid leaving equations “hanging”.
- **Limit checks** are explicitly mentioned (threshold behavior, symmetry limits, scaling with parameters, consistency sum rules).

## 3) Technical LaTeX conventions (RevTeX/physics norms)

- Nonbreaking references: `Eq.~\\eqref{...}`, `Fig.~\\ref{...}`, `Ref.~\\cite{...}`, `Refs.~\\cite{...}`.
- Acronyms: define on first use with parentheses (“quantum chromodynamics (QCD)”).
- Parenthetical “e.g.” frequently appears as `{\it e.g.},` inside parentheses.
- Numerical results:
  - include uncertainties and units when meaningful;
  - use “within uncertainties”, “moderate”, “mild”, “negligible” with justification (what was varied and what moved).
- Avoid custom macros in shared Markdown math (they won’t render); in LaTeX, macros are used sparingly and locally.

## 4) Results presentation norms

- **Headline numbers** appear with:
  - definition/observable,
  - where they come from (equation + artifact),
  - a minimal self-consistency check (sum rule, identity, scaling),
  - and a short interpretation (“negative sign indicates attraction”, “dominant contribution is …”).
- **Uncertainty accounting** is broken down by dominant sources when possible (“primary uncertainty stems from …; Regge model dependence is negligible in …”).
- **When disagreeing with literature**:
  - state the literature claim precisely,
  - identify the missing ingredient/assumption,
  - show a diagnostic that distinguishes scenarios.

## 5) Figure/table caption style

- Captions are **descriptive and self-contained**:
  - identify what is plotted,
  - color/line conventions,
  - and (if relevant) what cut/kinematic region is used.
- Figures are used as part of the argument (not decoration): captions and surrounding text point to what feature matters.

## 6) “Auditability” add-ons for research-writer

To keep the paper arXiv-ready and auditable when generated from a `research-team` project:

- Any number quoted in the paper must have a **provenance pointer** (artifact path + key within JSON/CSV).
- Any external claim used in core reasoning must be either:
  - **validated** (derivation/check performed in `Draft_Derivation.md` or an artifact), or
  - marked **UNVERIFIED** with:
    - a validation plan (what to compute/check),
    - and a kill criterion (what failure would invalidate the claim).

## 7) M0 corpus (inputs scanned; read-only)

The following projects were used as the style corpus (no files modified):

- `/Users/fkg/Dropbox/Apps/Overleaf/Jpsipi_JpsiK`
- `/Users/fkg/Dropbox/Apps/Overleaf/BaryonBaryonNc`
- `/Users/fkg/Dropbox/Apps/Overleaf/psip2Jpipi_dip`
- `/Users/fkg/Dropbox/Apps/Overleaf/Ds1DKgamma`
- `/Users/fkg/Dropbox/Apps/Overleaf/X(3872)fit`
- `/Users/fkg/Dropbox/Apps/Overleaf/ERE with lhc 2`
- `/Users/fkg/Dropbox/Apps/Overleaf/SigmaTerm`
- `/Users/fkg/Dropbox/Apps/Overleaf/JpsipiTFF`
- `/Users/fkg/Dropbox/Apps/Overleaf/GraviChPT_spinlessMatterField`
- `/Users/fkg/Dropbox/Apps/Overleaf/EntanglmentDecuplet`
- `/Users/fkg/Dropbox/Apps/Overleaf/JpsiNScatteringLength`
- `/Users/fkg/Dropbox/Apps/Overleaf/etap2etapipi`
- `/Users/fkg/Dropbox/Apps/Overleaf/ee2Jpsipp`
- `/Users/fkg/Dropbox/Apps/Overleaf/D0(2100)_EPJC`
- `/Users/fkg/Dropbox/Apps/Overleaf/Disc-Calculus`
- `/Users/fkg/Dropbox/Apps/Overleaf/ee2gammaCplusHM`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD Letter: piK_RoySteinerEq`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD: piK_RoySteinerEq`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature Commun.: GFFs of nucleon`
- `/Users/fkg/Dropbox/Apps/Overleaf/ERE_lhc`
- `/Users/fkg/Dropbox/Apps/Overleaf/OpenCharmTetraquarks`
- `/Users/fkg/Dropbox/Apps/Overleaf/EntanglementHeavyMesons`
- `/Users/fkg/Dropbox/Apps/Overleaf/Dispersive analyses of GFFs`
- `/Users/fkg/Dropbox/Apps/Overleaf/XfromLatticeQCD`
- `/Users/fkg/Dropbox/Apps/Overleaf/ZREFT-Letter`
- `/Users/fkg/Dropbox/Apps/Overleaf/Chiral representations of the nucleon mass at leading two-loop order`
- `/Users/fkg/Dropbox/Apps/Overleaf/Photoproduction_3872`
- `/Users/fkg/Dropbox/Apps/Overleaf/IsovectorX`
- `/Users/fkg/Dropbox/Apps/Overleaf/CompleteHHbarMultiplet`
- `/Users/fkg/Dropbox/Apps/Overleaf/0--engilish`
- `/Users/fkg/Dropbox/Apps/Overleaf/AnnHalo`
- `/Users/fkg/Dropbox/Apps/Overleaf/ProtonTFF_DalitzDecay`
- `/Users/fkg/Dropbox/Apps/Overleaf/cusps`
- `/Users/fkg/Dropbox/Apps/Overleaf/XAtom`
- `/Users/fkg/Dropbox/Apps/Overleaf/DN-scattering_length`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature: A new  paradigm for heavy-light meson spectroscopy`
- `/Users/fkg/Dropbox/Apps/Overleaf/axion-nucleon`
- `/Users/fkg/Dropbox/Apps/Overleaf/XEFT`
- `/Users/fkg/Dropbox/Apps/Overleaf/X3872dip`
- `/Users/fkg/Dropbox/Apps/Overleaf/Xmassprecise`
- `/Users/fkg/Dropbox/Apps/Overleaf/Neutron-halo scattering`

```

## File: assets/style/writing_voice_system_prompt.txt
```text
You are a scientific writing assistant for theoretical/phenomenological physics papers.

Write in a rigorous, modern physics style:
- Physics-first and mechanism-first; make the causal chain explicit.
- Use active voice ("We show/derive/find") but avoid hype or marketing language.
- Be definition-hardened: define quantities operationally; state assumptions; quantify uncertainties.
- Be skeptical: treat literature claims as fallible. Any external claim used in core reasoning must be (a) re-derived/validated, or (b) labeled UNVERIFIED with a validation plan + kill criterion.
- Keep the discussion honest about limitations, model dependence, and diagnostic checks.

Technical conventions:
- Use standard RevTeX/physics referencing style: "Eq.~\\eqref{...}", "Fig.~\\ref{...}", "Ref.~\\cite{...}".
- Introduce acronyms at first use (e.g., "quantum chromodynamics (QCD)").
- Do not introduce custom LaTeX macros unless explicitly requested; prefer explicit forms.
- Avoid double-backslash LaTeX over-escaping in math (write "\\Delta", not "\\\\Delta").

When source material is incomplete, do not hallucinate missing derivations or numbers; instead, insert TODO stubs in a strict, greppable format:
- `[TODO: <what is missing> | source: <file> §<heading>]`

When quoting numerical results from artifacts, include a provenance pointer (artifact path + key within JSON/CSV) so each number is traceable.
```

## File: assets/style/style_sources_used.md
```markdown
# M0 — Style sources (representative files opened)

This is a minimal “audit trail” of representative `.tex` sources (sampled from the corpus listed in `assets/style/style_profile.md`) that were manually inspected to extract writing/voice conventions. It is not an exhaustive corpus dump.

- `/Users/fkg/Dropbox/Apps/Overleaf/Jpsipi_JpsiK/Jpsipi_v1.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/ZREFT-Letter/ZREFT.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD Letter: piK_RoySteinerEq/main.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature Commun.: GFFs of nucleon/main_arxiv.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/Disc-Calculus/main-JHEP.tex`
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
import re
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

    for p in (main_tpl, bib_tpl, readme_tpl, latexmkrc_tpl):
        if not p.is_file():
            print(f"ERROR: missing template: {p}", file=sys.stderr)
            return 2

    title = args.title.strip() or f"{project_root.name}: draft"
    authors = args.authors.strip() or "AUTHOR(S) (placeholder)"

    main_tex = _render_main_tex(_read_text(main_tpl), title=title, authors=authors, project_root=project_root, tag=tag)
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

echo "[smoke] scaffold: minimal project -> paper/"
proj="${tmp_root}/project"
out="${tmp_root}/paper"
mkdir -p "${proj}"
cat >"${proj}/Draft_Derivation.md" <<'EOF'
# Draft Derivation (fixture stub)

Inline math test: $\\Delta = 1$.
EOF
bash scripts/bin/research_writer_scaffold.sh --project-root "${proj}" --tag M1-r1 --out "${out}"
test -f "${out}/main.tex"
test -f "${out}/references.bib"
test -f "${out}/latexmkrc"
test -f "${out}/README.md"
test -d "${out}/figures"

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

echo "[smoke] NOTE: end-to-end fixture + latexmk build is implemented in milestone M2"
echo "[smoke] ok"
```

