# research-writer — M9D-r1 Review Packet (`draft_sections` writer→auditor, human-friendly)

## Milestone goal
Add an **opt-in** `draft_sections` command that helps draft paper sections with a **single human-readable final output** (writer→auditor), while enforcing the anti-hallucination **evidence gate** and preserving auditable logs.

## Acceptance criteria
- New CLI exists and `--help` works:
  - `bash scripts/bin/research_writer_draft_sections.sh --help`
- Safe default: does **not** call external models unless `--run-models` (or `--stub-models` for offline).
- Human-friendly outputs (per section) under `paper/drafts/<run-id>/`:
  - `draft_<section>_writer.tex`
  - `draft_<section>_final.tex`
  - `draft_<section>.diff`
  - `trace.jsonl` + `run.json`
- Evidence gate is enforced on `*_final.tex`:
  - default: scan all text blocks (for new drafts)
  - on failure: rename to `*_unsafe.tex` and write `evidence_gate_report_<section>.md`
- Smoke harness covers:
  - safe stub run produces drafts and passes evidence gate
  - unsafe stub run fails evidence gate (expected fail) and writes a report

## Summary of changes
- Added `scripts/bin/research_writer_draft_sections.py` (+ `.sh` wrapper) implementing writer→auditor pipeline:
  - preserves raw outputs (`*.raw.txt`), writes `*_writer.tex`, `*_final.tex`, `*.diff`, `trace.jsonl`, `run.json`, and a run README.
  - does not touch `paper/main.tex`.
- Extended evidence gate linter to support new-draft linting:
  - `scripts/bin/check_latex_evidence_gate.py --scan-all` scans all paragraphs (not only `\\revadd{...}`).
- Extended smoke tests to cover:
  - `draft_sections` in stub safe/unsafe modes
  - `--scan-all` evidence gate behavior
- Updated docs to describe `draft_sections` and `--scan-all`.

## Evidence

### Changed files (summary)
```text
Added:   scripts/bin/research_writer_draft_sections.py
Added:   scripts/bin/research_writer_draft_sections.sh
Updated: scripts/bin/check_latex_evidence_gate.py
Updated: scripts/dev/run_all_smoke_tests.sh
Updated: SKILL.md, README.md, RUNBOOK.md, ROADMAP.md, PLAN.md
```

### `draft_sections` help (excerpt)
```text
--run-models          Call local Claude+Gemini CLIs via runner scripts.
--stub-models         Use deterministic stub model outputs (for tests).
--stub-variant {safe,unsafe}
                      Stub behavior: safe passes evidence gate; unsafe should fail it.
--evidence-scan {all,macros}
                      Evidence-gate scan mode: all text blocks (default) or only macros (revadd).
```

### Evidence gate help (excerpt: new mode)
```text
--scan-all            Scan all text blocks (paragraphs) instead of only
                      \macro{...} additions (useful for new drafts).
```

### Smoke test output (relevant excerpt)
```text
[smoke] help: draft_sections CLI
[smoke] LaTeX evidence-gate checker: scan-all flags risky plain text
[smoke] draft_sections: stub safe -> drafts/
[smoke] draft_sections: stub unsafe -> evidence gate fails and renames output
[smoke] ok
```

### Example output bundle (stub safe)
From an offline fixture run (`--stub-models --stub-variant safe`, section: Introduction), the output dir contains:
```text
README.md
draft_introduction.diff
draft_introduction_auditor.raw.txt
draft_introduction_final.tex
draft_introduction_writer.raw.txt
draft_introduction_writer.tex
run.json
trace.jsonl
```

### Example failure bundle (stub unsafe, expected-fail)
From an offline fixture run (`--stub-models --stub-variant unsafe`), evidence gate fails and the final is renamed:
```text
README.md
draft_introduction.diff
draft_introduction_auditor.raw.txt
draft_introduction_unsafe.tex
draft_introduction_writer.raw.txt
draft_introduction_writer.tex
evidence_gate_report_introduction.md
run.json
trace.jsonl
exit_code=2
```

