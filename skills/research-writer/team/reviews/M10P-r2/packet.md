# research-writer — M10P-r2 Review Packet (consume MCP-exported `paper/` via `paper_manifest.json`, deterministic)

## What changed since r1 (addressing blockers)
- Added `--dry-run` to make the tool non-destructive when desired (validate + planned actions only; no writes, no compile).
- Made `main.tex` mutation safer:
  - When a bibliography-layering patch is needed, the tool writes a deterministic backup `main.tex.bak` **once** (does not overwrite if already present).
  - The audit log records `before_sha256`, `after_sha256`, and backup metadata.
- Made `latexmk` compile more deterministic/non-interactive:
  - uses `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex`.
- Review packet now includes concrete fixture evidence (the exact `hep://` line and the exact conflicting citekey entries).

## Milestone goal
Add **deterministic v1** support for consuming an MCP-exported `paper/` scaffold using `paper/paper_manifest.json` as the **only entrypoint**, providing:
- validate (fail-fast),
- bib layering hygiene (generated + manual bib),
- optional compile (latexmk if present, else deterministic SKIPPED),
- and an audit trail (`paper/build_trace.jsonl`).

This is publisher/compile/hygiene only: **no network, no LLM, no new physics content**.

## Acceptance criteria
- Single entrypoint:
  - New CLI supports `--paper-manifest <path>` and defaults to `paper/paper_manifest.json` if present.
- Deterministic validate (fail-fast):
  - checks `schemaVersion`
  - checks `main.tex` / sections / bib / figures paths exist
  - checks no `.tex` contains `hep://`
  - checks citekey conflicts between `references_generated.bib` and `references_manual.bib` (conflict => fail-fast with guidance)
- Bib layering:
  - if `references_manual.bib` missing, auto-create an empty file (unless `--dry-run`)
  - `main.tex` must reference both generated and manual bib databases
- Optional compile:
  - if `latexmk` exists and `--compile` is passed: run `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex`
  - if `latexmk` missing: emit deterministic `SKIPPED` (not failure) and log it
- Audit:
  - write/append `paper/build_trace.jsonl` with input checksums + validate/hygiene/compile results
  - when `main.tex` is changed, write `main.tex.bak` (if missing) and log backup metadata
- Offline smoke coverage:
  - includes a minimal `paper/ + paper_manifest.json` fixture
  - validate catches:
    - (a) `hep://` in `.tex`
    - (b) citekey conflicts across bib layers

## Summary of changes
- New deterministic publisher CLI:
  - `scripts/bin/research_writer_consume_paper_manifest.py`
  - wrapper: `scripts/bin/research_writer_consume_paper_manifest.sh`
- New offline fixtures:
  - `scripts/dev/fixtures/paper_manifest/ok_root/...`
  - `scripts/dev/fixtures/paper_manifest/bad_hep_uri_root/...`
  - `scripts/dev/fixtures/paper_manifest/bad_citekey_conflict_root/...`
- Smoke tests updated:
  - `scripts/dev/run_all_smoke_tests.sh`
- Docs updated: `SKILL.md`, `README.md`, `RUNBOOK.md`.

## Evidence

### CLI help (excerpt; new `--dry-run`)
```text
--paper-manifest PAPER_MANIFEST
  Path to paper_manifest.json (default: ./paper/paper_manifest.json, then ./paper_manifest.json).
--dry-run
  Validate and report what would change, but do not write any files and do not compile.
--compile
  If latexmk exists, compile via `latexmk -pdf main.tex`.
```

### Fixture evidence: `hep://` is present and must be caught
From `scripts/dev/fixtures/paper_manifest/bad_hep_uri_root/paper/sections/introduction.tex`:
```tex
This fixture intentionally contains a forbidden internal URI:
hep://runs/1234567890abcdef
```

### Fixture evidence: citekey conflict is present and must be caught
From `scripts/dev/fixtures/paper_manifest/bad_citekey_conflict_root/paper/references_generated.bib`:
```bibtex
@article{K,
  title = {Fixture reference (generated)},
  author = {Doe, John},
  year = {2024},
  journal = ""
}
```

From `scripts/dev/fixtures/paper_manifest/bad_citekey_conflict_root/paper/references_manual.bib`:
```bibtex
@article{K,
  title = {Fixture reference (manual conflicting key)},
  author = {Doe, Jane},
  year = {2024},
  journal = ""
}
```

### Bib layering behavior (ok fixture)
Ok fixture main.tex intentionally starts with only generated bib:
```tex
\bibliography{references_generated}
```

After running the CLI, `main.tex` must contain:
```tex
\bibliography{references_generated,references_manual}
```
and a deterministic backup `main.tex.bak` must exist (only created if a change was needed).

### Smoke test output (relevant excerpt)
```text
[smoke] consume paper manifest: ok fixture (default manifest path)
[smoke] consume paper manifest: FAIL on hep:// in .tex
[smoke] consume paper manifest: FAIL on citekey conflicts
[smoke] ok
```

