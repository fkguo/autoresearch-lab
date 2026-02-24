# research-writer — M5-r2 Review Packet (apply N=50 discussion-logic patterns + batching/resume)

## Milestone goal
Scale the discussion-logic learning pipeline to an N=50 exemplar set (dual-model maps for every paper, in 10-paper batches) and distill additional *journal-agnostic* discussion patterns into the playbook, while keeping the workflow auditable and avoiding any automatic LLM-driven mutation of the playbook.

## Acceptance criteria
- `assets/style/physics_discussion_logic_playbook.md` includes additional cross-subfield patterns observed in an N=50 exemplar set (e.g., error-budget narration, sensitivity-driven prioritization, triangulation).
- `assets/style/style_sources_used.md` records the N=50 arXiv IDs used (audit trail; no corpus dump committed).
- The corpus/packs pipeline supports batching/resume and optional model subset reruns (repair workflow).
- Gemini CLI preamble noise is handled so the reviewer output contract remains enforceable.
- Smoke tests pass locally (offline fixtures).

## Evidence

### File tree (relevant subset)
```text
ROADMAP.md
RUNBOOK.md
SKILL.md
assets/style/physics_discussion_logic_playbook.md
assets/style/style_sources_used.md
scripts/bin/fetch_prl_style_corpus.py
scripts/bin/research_writer_learn_discussion_logic.py
scripts/dev/run_all_smoke_tests.sh
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
- project root: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.QBqqC709MT/project
- tag: M2-smoke
- out: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.QBqqC709MT/paper
[smoke] markdown double-backslash check: generated paper + skill assets
[smoke] latexmk: compile paper
[smoke] bibtex fixer: adds journal field
[smoke] double-backslash checker+fixer: markdown math only
[smoke] ok
```

### External run evidence (not committed)
Generated into `/Users/fkg/Nutstore Files/Coding/research_writer_discussion_logic`:
```text
packs 50 claude 50 gemini 50 both 50
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

## M4: Apply N=10 patterns to the playbook

Acceptance criteria:
- `assets/style/physics_discussion_logic_playbook.md` includes additional high-yield, journal-agnostic discussion patterns observed in an N=10 exemplar set.
- `assets/style/style_sources_used.md` records the N=10 arXiv IDs used (audit trail; no corpus dump committed).
- No automatic mutation of playbook based on model outputs; merging remains an agent/human step for stability and anti-plagiarism hygiene.

## M5: Apply N=50 patterns to the playbook

Acceptance criteria:
- `assets/style/physics_discussion_logic_playbook.md` includes additional cross-subfield patterns observed in an N=50 exemplar set (e.g., error-budget narration, sensitivity-driven prioritization, triangulation).
- `assets/style/style_sources_used.md` records the N=50 arXiv IDs used (audit trail; no corpus dump committed).
- The corpus/packs pipeline supports batching/resume and optional model subset reruns (repair workflow).
````

---

## File: assets/style/style_sources_used.md
````markdown
# M0 — Style sources (representative files opened)

This is a minimal “audit trail” of representative `.tex` sources (sampled from the corpus listed in `assets/style/style_profile.md`) that were manually inspected to extract writing/voice conventions. It is not an exhaustive corpus dump.

- `/Users/fkg/Dropbox/Apps/Overleaf/Jpsipi_JpsiK/Jpsipi_v1.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/ZREFT-Letter/ZREFT.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD Letter: piK_RoySteinerEq/main.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature Commun.: GFFs of nucleon/main_arxiv.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/Disc-Calculus/main-JHEP.tex`

## Exemplar PRL-style papers (arXiv sources opened)

Representative arXiv LaTeX sources downloaded via INSPIRE and manually inspected for discussion-logic patterns (paths not stored in this repo):

- `arXiv:2412.00190` (dispersive HLbL / muon $g-2$; intro + diagnostics/uncertainty narration)
- `arXiv:2503.04883` (EW contribution to muon $g-2$; “bottom line” framing + uncertainty hierarchy)
- `arXiv:2506.02597` (ab initio radii; problem framing + discrepancy diagnosis)

## N=10 exemplar set (auto packs + dual-model maps)

Downloaded via the INSPIRE query in `assets/style/prl_style_corpus.md` and processed with:
- `scripts/bin/research_writer_learn_discussion_logic.py` (N=10; masking on; optional Claude+Gemini clean-room extraction)

Papers (arXiv sources; titles sanitized):
- `arXiv:2506.02597` (2025) — Ab Initio Study of the Radii of Oxygen Isotopes
- `arXiv:2503.04883` (2025) — Improved Evaluation of the Electroweak Contribution to Muon g-2
- `arXiv:2502.12074` (2025) — Lattice QCD Study of Pion Electroproduction and Weak Production from a Nucleon
- `arXiv:2412.00190` (2024) — Complete Dispersive Evaluation of the Hadronic Light-by-Light Contribution to Muon g-2
- `arXiv:2411.14935` (2024) — Ab Initio Study of the Beryllium Isotopes Be7 to Be12
- `arXiv:2411.08098` (2024) — Precision Evaluation of the η- and η′-Pole Contributions to Hadronic Light-by-Light Scattering in the Anomalous Magnetic Moment of the Muon
- `arXiv:2409.18577` (2024) — Light Λ Hypernuclei Studied with Chiral Hyperon-Nucleon and Hyperon-Nucleon-Nucleon Forces
- `arXiv:2408.09375` (2024) — Effective-Range Expansion with a Long-Range Force
- `arXiv:2407.16659` (2024) — ω Meson from Lattice QCD
- `arXiv:2405.20210` (2024) — Anisotropic Flow in Fixed-Target Pb208+Ne20 Collisions as a Probe of Quark-Gluon Plasma

## N=50 exemplar set (auto packs + dual-model maps)

Downloaded via the INSPIRE query in `assets/style/prl_style_corpus.md` and processed with dual-model extraction into:
- `/Users/fkg/Nutstore Files/Coding/research_writer_discussion_logic` (not stored in this repo)

Papers (arXiv sources; IDs sorted by recency):
- `arXiv:2506.02597`
- `arXiv:2503.04883`
- `arXiv:2502.12074`
- `arXiv:2412.00190`
- `arXiv:2411.14935`
- `arXiv:2411.08098`
- `arXiv:2409.18577`
- `arXiv:2408.09375`
- `arXiv:2407.16659`
- `arXiv:2405.20210`
- `arXiv:2405.18469`
- `arXiv:2404.17444`
- `arXiv:2402.05995`
- `arXiv:2309.02037`
- `arXiv:2309.01558`
- `arXiv:2307.02532`
- `arXiv:2306.11439`
- `arXiv:2306.04500`
- `arXiv:2303.09441`
- `arXiv:2205.10994`
- `arXiv:2204.06005`
- `arXiv:2201.02565`
- `arXiv:2112.06929`
- `arXiv:2111.14191`
- `arXiv:2109.12961`
- `arXiv:2105.12095`
- `arXiv:2105.04563`
- `arXiv:2102.02825`
- `arXiv:2012.11602`
- `arXiv:2012.08281`
- `arXiv:2012.04599`
- `arXiv:2011.14517`
- `arXiv:2010.09420`
- `arXiv:2009.07795`
- `arXiv:2009.06248`
- `arXiv:2009.04479`
- `arXiv:2003.04886`
- `arXiv:2002.07184`
- `arXiv:1912.05105`
- `arXiv:1910.11846`
- `arXiv:1903.07969`
- `arXiv:1903.03625`
- `arXiv:1902.11221`
- `arXiv:1811.12482`
- `arXiv:1811.11181`
- `arXiv:1805.01471`
- `arXiv:1712.06595`
- `arXiv:1711.09342`
- `arXiv:1708.02245`
- `arXiv:1702.05177`
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

## G. High-yield patterns observed in exemplar papers (N≈10)

These are general “moves” that repeatedly appear in strong papers across subfields.

### G1) Precision-target hook (“why now?”)

- Start with the **precision target** (experimental or phenomenological) and state the **gap**: what is currently limiting and why it matters.
- Immediately name the **dominant obstacle** (a correlator, a systematic, an analytic structure, a model dependence) rather than “we compute X”.

### G2) Method transfer with validation

- If you import a technique/constraint from an adjacent problem, explicitly **validate transfer**: reproduce a known benchmark/limit first, then extend.
- When adapting a method to a less-controlled sector, label what becomes **newly model-dependent** and how you bound it.

### G3) Decompose by regimes; use matching as a diagnostic

- Break the problem into **natural regimes/components** (low/high energy, heavy/light degrees of freedom, tensor structures).
- Make the **matching prescription** explicit (scales/overlaps) and use the matching region as a **self-consistency check** for missing contributions.

### G4) Robustness via “variation + control/baseline”

- Prefer a small set of **targeted variations** that diagnose distinct systematics (matching scale, input model family, fit window, kinematics).
- When possible, add a **baseline/control** that “turns off” the key mechanism, or a **counterfactual** run that isolates which variable drives the trend.

### G5) Shift attribution + uncertainty hierarchy

- If your headline number shifts relative to prior work, **attribute the shift** to a short list of identifiable improvements (what changed and why).
- State the **dominant uncertainty now** (after improvements) and what would reduce it most efficiently.

### G6) Separate “data” from “extraction”

- When results disagree across determinations, distinguish **raw measurements** from **model-dependent extractions** and target the critique at the extraction assumptions.

### G7) Intuition-first mechanism paragraph

- Before showing the key plot/table, give a short **mechanism paragraph**: a physical picture (geometry/threshold/singularity) that predicts the sign/trend the figure will show.

### G8) Future-proofing (honest limitations)

- Name missing effects that are known to exist; explain why they are **subleading for the present claim**, and specify the **next validation step**.
- If anything is not independently validated, use the `UNVERIFIED` protocol (plan + kill criterion).

### G9) Error budget as narrative backbone (not a footnote)

- Present (or at least describe) a **structured error budget**: list sources, relative sizes, and how each is estimated.
- Turn the error budget into **prioritization**: “the dominant uncertainty is X because Y; the next most efficient improvement is Z.”

### G10) Sensitivity-driven “what matters” discussion

- Explicitly connect the headline result to its **most sensitive inputs/assumptions** (fit window, priors, cutoffs, kinematic region, model family).
- Use that sensitivity to justify which new datum/computation would be **highest leverage** (not just “more work is needed”).

### G11) Triangulation: independent routes to the same quantity

- Where possible, compute/estimate the same target via **two conceptually different routes** (representations, parametrizations, datasets, matching schemes).
- Treat the spread as an **honest systematic** (and explain which ingredient causes it), rather than hiding it in a single “preferred” setup.

### G12) Global consistency as a check (multi-observable logic)

- When multiple observables/constraints enter, show that the preferred solution is **globally consistent** (not tuned to one channel).
- If tensions remain, localize them: identify which subset drives the mismatch and what missing ingredient could reconcile it.

### G13) Inference hygiene: stability under fit/prior/cut choices

- Report stability under **fit range/window variations**, alternative priors/regularizations, and cutoffs/matching choices.
- Convert “reasonable variation” into a quantified systematic, and explain why the variation set is **diagnostic** (not arbitrary).

## H. Reusable templates (drafting aids)

### H1) “Bottom line” paragraph (results + attribution + uncertainty)

Use this structure (fill placeholders; do not copy any source phrasing):

- **Bottom line**: “We obtain `<headline observable>` = `<number>` (…); this is `<direction>` relative to `<baseline/prior>`.”
- **Attribution**: “The change is driven by (i) `<ingredient A>`, (ii) `<ingredient B>`, … (sign/direction, not a literature debate).”
- **Dominant uncertainty**: “At this point, the dominant uncertainty arises from `<source>`, because `<reason>`; reducing it requires `<next computation/measurement>`.”

### H2) Robustness paragraph (diagnostics)

- “We test robustness by varying `<knob>` within `<range>`; the result changes by `<Δ>` and we assign `<systematic>` accordingly.”
- “A control/baseline setup `<baseline>` isolates `<mechanism>` by holding `<confounder>` fixed.”

### H3) Error budget paragraph (hierarchy + actionability)

- “Our uncertainty budget is dominated by `<source 1>` (estimated via `<procedure>`), followed by `<source 2>` (estimated via `<procedure>`); other effects are subleading at the present precision.”
- “Reducing `<source 1>` requires `<specific measurement/computation>`; improvements to `<source 2>` would have limited impact until `<source 1>` is addressed.”
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
  --max-records 50 \
  --resume \
  --out-dir /tmp/prl_style_corpus
```

### 6) Generate N=10 reading packs (corpus → excerpts)

This produces per-paper packs (Abstract/Intro/Conclusions + auto-selected diagnostics paragraphs) to enable clean-room, auditable extraction of discussion logic.

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --corpus-dir /tmp/prl_style_corpus \
  --n 10 \
  --resume \
  --out-dir /tmp/research_writer_discussion_logic \
  --mask-math \
  --mask-cites
```

### 7) Optional: run a dual-model pass (Claude + Gemini)

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
  --fetch \
  --fetch-n 50 \
  --n 10 \
  --resume \
  --out-dir "/Users/fkg/Nutstore Files/Coding/research_writer_discussion_logic" \
  --mask-math \
  --mask-cites \
  --run-models
```

Repeat the same command 4 more times to fill out 50 packs (in `--resume` mode the script skips existing packs/outputs and processes the next N papers).

### 7b) Repair missing model outputs (recommended for flaky networks)

If some packs exist but one model output is missing, rerun in repair mode:

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py \
  --corpus-dir "/Users/fkg/Nutstore Files/Coding/research_writer_discussion_logic/corpus" \
  --out-dir "/Users/fkg/Nutstore Files/Coding/research_writer_discussion_logic" \
  --mode repair \
  --n 10 \
  --resume \
  --models gemini \
  --mask-math \
  --mask-cites
```

Prereqs for `--run-models`:
- `claude` and `gemini` CLIs available in `PATH`
- Runner skills installed under `$CODEX_HOME/skills/`:
  - `claude-cli-runner`
  - `gemini-cli-runner`

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

## File: scripts/bin/fetch_prl_style_corpus.py
````python
#!/usr/bin/env python3
"""
fetch_prl_style_corpus.py

Fetch an exemplar paper corpus via INSPIRE → arXiv LaTeX sources.

Intended use in `research-writer`: build a local set of primary-source LaTeX
files that you can *read* to learn **general physics discussion logic**
(argument flow, diagnostics, uncertainty narration). This is not about
superficial PRL formatting.

Primary use (FK/Meissner/Hoferichter PRL query):
  python3 fetch_prl_style_corpus.py \
    --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
    --max-records 10 \
    --out-dir /tmp/prl_style_corpus

Notes:
- Best-effort and network-robust: failures are logged to JSONL and the script continues.
- INSPIRE may rate-limit (HTTP 429). If you see that in the trace, reduce `--max-records` and retry later.
- Output is a *local* corpus for discussion-logic learning; do NOT copy text verbatim into new manuscripts.
- Extraction is filtered to TeX/Bib/Sty-style files by default to keep the corpus small.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tarfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlsplit
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ALLOWED_HOSTS = {"inspirehep.net", "arxiv.org", "export.arxiv.org"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _host_ok(url: str) -> bool:
    try:
        host = urlsplit(url).netloc.split(":", 1)[0].lower()
    except Exception:
        return False
    return host in ALLOWED_HOSTS


def _http_get(url: str, *, accept: str, timeout_s: int = 30) -> bytes:
    if not _host_ok(url):
        raise ValueError(f"refusing host not in allowlist: {url}")
    req = Request(url, headers={"Accept": accept})
    with urlopen(req, timeout=timeout_s) as r:  # nosec - intended for controlled metadata fetch
        return r.read()


def _safe_id(s: str) -> str:
    s = (s or "").strip()
    s = s.replace("/", "_")
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s)
    return s.strip("_") or "unknown"


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_jsonl(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, sort_keys=True) + "\n")


def _parse_inspire_query(query_url: str | None, query: str | None) -> str:
    if query and query.strip():
        return query.strip()
    if not query_url:
        raise ValueError("either --query or --query-url must be provided")

    u = urlsplit(query_url)
    if not u.netloc:
        raise ValueError(f"invalid query url: {query_url!r}")
    host = u.netloc.split(":", 1)[0].lower()
    if host != "inspirehep.net":
        raise ValueError(f"refusing --query-url host != inspirehep.net: {host!r}")
    qs = parse_qs(u.query)
    q_vals = qs.get("q") or []
    if not q_vals or not q_vals[0].strip():
        raise ValueError("failed to extract q=... from --query-url")
    return q_vals[0].strip()


def _inspire_api_url(query: str, *, size: int, page: int, sort: str) -> str:
    q_enc = quote(query)
    return f"https://inspirehep.net/api/literature?sort={quote(sort)}&size={int(size)}&page={int(page)}&q={q_enc}"


def _extract_arxiv_id(md: dict[str, Any]) -> str:
    eprints = md.get("arxiv_eprints")
    if isinstance(eprints, list):
        for e in eprints:
            if isinstance(e, dict) and isinstance(e.get("value"), str) and e["value"].strip():
                return e["value"].strip()
    return ""


def _extract_title(md: dict[str, Any]) -> str:
    titles = md.get("titles")
    if isinstance(titles, list) and titles:
        t0 = titles[0] if isinstance(titles[0], dict) else {}
        v = t0.get("title")
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_year(md: dict[str, Any]) -> str:
    for key in ("preprint_date", "legacy_creation_date", "created"):
        v = md.get(key)
        if isinstance(v, str) and len(v) >= 4 and v[:4].isdigit():
            return v[:4]
    pub = md.get("publication_info")
    if isinstance(pub, list) and pub:
        p0 = pub[0] if isinstance(pub[0], dict) else {}
        y = p0.get("year")
        if isinstance(y, int):
            return str(y)
        if isinstance(y, str) and y.strip():
            return y.strip()
    return ""


def _extract_doi(md: dict[str, Any]) -> str:
    dois = md.get("dois")
    if isinstance(dois, list):
        for d in dois:
            if isinstance(d, dict) and isinstance(d.get("value"), str) and d["value"].strip():
                return d["value"].strip()
    return ""


def _extract_authors(md: dict[str, Any]) -> list[str]:
    authors = md.get("authors")
    out: list[str] = []
    if isinstance(authors, list):
        for a in authors:
            if not isinstance(a, dict):
                continue
            name = a.get("full_name") or a.get("name") or ""
            if isinstance(name, str) and name.strip():
                out.append(name.strip())
    return out


def _safe_member_path(name: str) -> Path | None:
    """
    Safe relative path (reject absolute and .. traversal).
    """
    try:
        p = Path(name)
    except Exception:
        return None
    if p.is_absolute():
        return None
    if ".." in p.parts:
        return None
    return p


def _download_arxiv_source(arxiv_id: str) -> bytes:
    # arXiv source endpoint returns a tar(.gz) stream.
    url = f"https://arxiv.org/e-print/{quote(arxiv_id)}"
    return _http_get(url, accept="application/x-tar, application/octet-stream")


@dataclass(frozen=True)
class Record:
    recid: str
    title: str
    year: str
    arxiv_id: str
    doi: str
    authors: list[str]


def _iter_inspire_records(query: str, *, size: int, max_records: int, sort: str, trace_path: Path) -> list[Record]:
    out: list[Record] = []
    page = 1
    logged_start = False
    seen_arxiv: set[str] = set()
    while len(out) < max_records:
        url = _inspire_api_url(query, size=size, page=page, sort=sort)
        try:
            raw = _http_get(url, accept="application/json")
            obj = json.loads(raw.decode("utf-8", errors="replace"))
            total_hits = obj.get("hits", {}).get("total", None)
            if not logged_start:
                _append_jsonl(
                    trace_path,
                    {
                        "ts": _utc_now(),
                        "event": "inspire_query_start",
                        "url": url,
                        "total_hits": total_hits,
                        "page_size": size,
                        "sort": sort,
                    },
                )
                logged_start = True
        except Exception as exc:
            _append_jsonl(trace_path, {"ts": _utc_now(), "event": "inspire_query_error", "url": url, "error": str(exc)})
            break

        hits = obj.get("hits", {}).get("hits", [])
        if not isinstance(hits, list) or not hits:
            break
        _append_jsonl(trace_path, {"ts": _utc_now(), "event": "inspire_page_ok", "page": page, "hits_returned": len(hits), "url": url})

        for h in hits:
            if len(out) >= max_records:
                break
            if not isinstance(h, dict):
                continue
            recid = str(h.get("id") or "").strip()
            md = h.get("metadata") if isinstance(h.get("metadata"), dict) else {}
            arxiv_id = _extract_arxiv_id(md)
            if not arxiv_id:
                _append_jsonl(
                    trace_path,
                    {"ts": _utc_now(), "event": "skip_no_arxiv", "recid": recid, "title": _extract_title(md)},
                )
                continue
            if arxiv_id in seen_arxiv:
                _append_jsonl(trace_path, {"ts": _utc_now(), "event": "skip_duplicate_arxiv", "arxiv_id": arxiv_id, "recid": recid})
                continue
            seen_arxiv.add(arxiv_id)
            out.append(
                Record(
                    recid=recid,
                    title=_extract_title(md),
                    year=_extract_year(md),
                    arxiv_id=arxiv_id,
                    doi=_extract_doi(md),
                    authors=_extract_authors(md),
                )
            )

````

---

## File: scripts/bin/research_writer_learn_discussion_logic.py
````python
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
from html import unescape as _html_unescape
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
        for i, ch in enumerate(ln):
            if ch != "%":
                continue
            # In TeX, '%' starts a comment unless escaped as '\%'.
            # If there are N backslashes immediately preceding '%':
            # - N odd  => '%' is escaped (literal percent)
            # - N even => '%' starts a comment (e.g. '\\%': linebreak then comment)
            j = i - 1
            n_bs = 0
            while j >= 0 and ln[j] == "\\":
                n_bs += 1
                j -= 1
            if n_bs % 2 == 0:
                cut = i
                break
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
...
    code = subprocess.run(cmd, check=False).returncode
    _append_jsonl(trace, {"ts": _utc_now(), "event": "fetch_end", "exit_code": code})
    return code


def _write_pack(out_path: Path, *, rec: dict[str, Any], segs: list[Segment]) -> None:
    title = _strip_simple_html(rec.get("title") or "")
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
    run_claude: bool,
    run_gemini: bool,
    claude_model: str,
    gemini_model: str,
    claude_timeout_s: int,
    gemini_timeout_s: int,
    trace: Path,
) -> dict[str, Any]:
    claude_runner = _find_runner("claude")
    gemini_runner = _find_runner("gemini")
    if not claude_runner.is_file():
        raise FileNotFoundError(f"claude runner not found: {claude_runner}")
    if not gemini_runner.is_file():
        raise FileNotFoundError(f"gemini runner not found: {gemini_runner}")

    claude_out = out_dir / "claude.md"
    gemini_out = out_dir / "gemini.md"

    out: dict[str, Any] = {"claude_ok": None, "gemini_ok": None}

    if run_claude:
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
        try:
            code_a = subprocess.run(claude_cmd, check=False, timeout=max(1, int(claude_timeout_s))).returncode
        except subprocess.TimeoutExpired:
            code_a = 124
            _append_jsonl(trace, {"ts": _utc_now(), "event": "claude_timeout", "timeout_s": int(claude_timeout_s)})
        _append_jsonl(trace, {"ts": _utc_now(), "event": "claude_end", "exit_code": code_a})
        out["claude_ok"] = code_a == 0

    if run_gemini:
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
        try:
            code_b = subprocess.run(gemini_cmd, check=False, timeout=max(1, int(gemini_timeout_s))).returncode
        except subprocess.TimeoutExpired:
            code_b = 124
            _append_jsonl(trace, {"ts": _utc_now(), "event": "gemini_timeout", "timeout_s": int(gemini_timeout_s)})
        _append_jsonl(trace, {"ts": _utc_now(), "event": "gemini_end", "exit_code": code_b})
        out["gemini_ok"] = code_b == 0

    return out


_RE_GEMINI_HOOK_PREAMBLE = re.compile(r"^Hook registry initialized with \d+ hook entries\s*$")


def _sanitize_gemini_output(path: Path) -> None:
    """
    Some Gemini CLI builds emit a one-line preamble like:
      "Hook registry initialized with 0 hook entries"
    before the actual model output. Strip that deterministically if present at the top.
    """
    if not path.is_file():
        return
    try:
        raw = _read_text(path)
    except Exception:
        return
    lines = raw.splitlines()
    i = 0
    # Skip leading blanks and a single known preamble line.
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i < len(lines) and _RE_GEMINI_HOOK_PREAMBLE.match(lines[i]):
        i += 1
        while i < len(lines) and not lines[i].strip():
            i += 1
    cleaned = "\n".join(lines[i:]).rstrip() + "\n"
    if cleaned != raw:
        path.write_text(cleaned, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", required=True, type=Path, help="Output directory for packs + logs.")
    ap.add_argument("--n", type=int, default=10, help="Number of papers to process (default: 10).")
    ap.add_argument("--resume", action="store_true", help="Skip papers whose packs (and model outputs, if requested) already exist.")
    ap.add_argument(
        "--mode",
        default="new",
        choices=["new", "repair"],
        help="Selection mode: 'new' = create N new packs; 'repair' = retry missing model outputs for existing packs.",
    )
    ap.add_argument("--query-url", default="", help="INSPIRE UI query URL (used only if fetching).")
    ap.add_argument("--query", default="", help="INSPIRE query string (used only if fetching).")
    ap.add_argument("--corpus-dir", type=Path, default=None, help="Existing corpus dir (output of fetch_prl_style_corpus.py).")
    ap.add_argument("--fetch", action="store_true", help="Fetch the corpus into out-dir/corpus (requires --query-url or --query).")
    ap.add_argument("--fetch-n", type=int, default=None, help="If fetching, number of records to fetch (default: same as --n).")
    ap.add_argument("--mask-math", action="store_true", help="Mask common math blocks in excerpts (recommended).")
    ap.add_argument("--mask-cites", action="store_true", help="Mask \\cite{...} in excerpts (recommended).")
    ap.add_argument("--run-models", action="store_true", help="Run Claude+Gemini on each pack (clean-room, tools disabled).")
    ap.add_argument(
        "--models",
        default="",
        help="Optional comma-separated subset of models to run: claude,gemini. Overrides --run-models default.",
    )
    ap.add_argument("--claude-model", default="opus")
    ap.add_argument("--gemini-model", default="gemini-3-pro-preview")
    ap.add_argument("--claude-timeout-s", type=int, default=1800, help="Timeout per Claude call (seconds).")
    ap.add_argument("--gemini-timeout-s", type=int, default=1800, help="Timeout per Gemini call (seconds).")
    args = ap.parse_args()

    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    trace = out_dir / "trace.jsonl"
    packs_dir = out_dir / "packs"

    _append_jsonl(trace, {"ts": _utc_now(), "event": "start", "argv": sys.argv})
...
    _append_jsonl(trace, {"ts": _utc_now(), "event": "start", "argv": sys.argv})

    corpus_dir = args.corpus_dir.expanduser().resolve() if args.corpus_dir is not None else None
    if args.fetch or corpus_dir is None:
        corpus_dir = out_dir / "corpus"
        fetch_n = int(args.fetch_n) if args.fetch_n is not None else int(args.n)
        code = _run_fetch(
            query_url=args.query_url,
            query=args.query,
            n=max(0, fetch_n),
            out_dir=corpus_dir,
            trace=trace,
            resume=bool(args.resume),
        )
        if code != 0:
            return code

    assert corpus_dir is not None
    papers_dir = corpus_dir / "papers"
    if not papers_dir.is_dir():
        print(f"ERROR: corpus papers dir not found: {papers_dir}", file=sys.stderr)
        return 2

    # Choose papers in descending arXiv id (a reasonable proxy for recency).
    # In --resume mode we select the first N *unprocessed* papers, enabling repeated N=10 batch runs.
    paper_dirs = sorted([p for p in papers_dir.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True)

    system_prompt = _skill_root() / "assets" / "style" / "discussion_logic_extractor_system_prompt.txt"
    if (args.run_models or args.models.strip()) and not system_prompt.is_file():
        print(f"ERROR: system prompt not found: {system_prompt}", file=sys.stderr)
        return 2

    model_set = {m.strip().lower() for m in args.models.split(",") if m.strip()} if args.models.strip() else set()
    run_claude = ("claude" in model_set) if model_set else bool(args.run_models)
    run_gemini = ("gemini" in model_set) if model_set else bool(args.run_models)

    meta = {
        "created_at": _utc_now(),
        "n": int(args.n),
        "corpus_dir": str(corpus_dir),
        "mode": str(args.mode),
        "mask_math": bool(args.mask_math),
        "mask_cites": bool(args.mask_cites),
        "run_models": bool(args.run_models),
        "run_claude": bool(run_claude),
        "run_gemini": bool(run_gemini),
        "models": sorted(model_set) if model_set else [],
        "claude_model": args.claude_model,
        "gemini_model": args.gemini_model,
        "claude_timeout_s": int(args.claude_timeout_s),
        "gemini_timeout_s": int(args.gemini_timeout_s),
    }
    _write_json(out_dir / "meta.json", meta)

    processed = 0
    skipped_existing = 0
    skipped_no_main_tex = 0
    errors = 0
    for pd in paper_dirs:
        if processed >= max(0, int(args.n)):
            break
        arxiv_id = pd.name
        pack_dir = packs_dir / arxiv_id
        pack_path = pack_dir / "pack.md"
        flat_path = pack_dir / "flattened_main.tex"
        evidence_path = pack_dir / "evidence.json"
        claude_out = pack_dir / "claude.md"
        gemini_out = pack_dir / "gemini.md"

        pack_complete = pack_path.is_file() and flat_path.is_file() and evidence_path.is_file()
        models_complete = (not run_claude or claude_out.is_file()) and (not run_gemini or gemini_out.is_file())

        if args.mode == "new" and pack_complete:
            if args.resume:
                skipped_existing += 1
            continue

        if args.mode == "repair" and not pack_complete:
            continue

        if args.resume and args.mode == "repair" and models_complete:
            skipped_existing += 1
            _append_jsonl(
                trace,
                {
                    "ts": _utc_now(),
                    "event": "resume_skip_existing",
                    "arxiv_id": arxiv_id,
                    "pack_complete": True,
                    "models_complete": bool(models_complete),
                },
            )
            continue

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
            if args.mode == "new" and not (args.resume and pack_complete):
                main_tex = _find_main_tex(pd)
                if main_tex is None:
                    skipped_no_main_tex += 1
                    _append_jsonl(trace, {"ts": _utc_now(), "event": "skip_no_main_tex", "arxiv_id": arxiv_id})
                    continue

                flat = _flatten_inputs(_read_text(main_tex), paper_dir=pd)
                pack_dir.mkdir(parents=True, exist_ok=True)
                flat_path.write_text(flat, encoding="utf-8")

                segs, evidence = _extract_segments_text(
                    flat,
                    evidence_name=flat_path.name,
                    mask_math=bool(args.mask_math),
                    mask_cites=bool(args.mask_cites),
                )
                evidence["arxiv_id"] = arxiv_id
                evidence["source_main_tex"] = main_tex.name
                _write_json(evidence_path, evidence)
                if rec:
                    _write_json(pack_dir / "record.json", rec)
                _write_pack(pack_path, rec=rec, segs=segs)

                _append_jsonl(
                    trace,
                    {
                        "ts": _utc_now(),
                        "event": "pack_ok",
                        "arxiv_id": arxiv_id,
                        "main_tex": main_tex.name,
                        "segments": len(segs),
                    },
                )

            run_claude_needed = bool(run_claude) and not claude_out.is_file()
            run_gemini_needed = bool(run_gemini) and not gemini_out.is_file()
            if (run_claude_needed or run_gemini_needed):
                _run_models_for_pack(
                    out_dir=pack_dir,
                    pack_path=pack_path,
                    system_prompt_path=system_prompt,
                    run_claude=bool(run_claude_needed),
                    run_gemini=bool(run_gemini_needed),
                    claude_model=args.claude_model,
                    gemini_model=args.gemini_model,
                    claude_timeout_s=int(args.claude_timeout_s),
                    gemini_timeout_s=int(args.gemini_timeout_s),
                    trace=trace,
                )
                if run_gemini_needed:
                    _sanitize_gemini_output(gemini_out)

            processed += 1
        except Exception as exc:
            errors += 1
            _append_jsonl(trace, {"ts": _utc_now(), "event": "paper_error", "arxiv_id": arxiv_id, "error": str(exc)})
            continue

    _append_jsonl(
        trace,
        {
            "ts": _utc_now(),
            "event": "done",
            "processed": processed,
            "skipped_existing": skipped_existing,
            "skipped_no_main_tex": skipped_no_main_tex,
            "errors": errors,
        },
    )
    print("[ok] discussion-logic packs prepared")
    print(f"- corpus: {corpus_dir}")
    print(f"- out:    {out_dir}")
    print(f"- packs:  {packs_dir}")
    if args.resume:
        print(f"- skipped existing: {skipped_existing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
````
