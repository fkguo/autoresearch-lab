# Adjudication — skilldev-code-cleanup-md-dedup-r1

## Goal

Reduce duplicated Markdown hygiene logic (avoid “spaghetti”), keep behavior stable, and keep deterministic regression green.

## Decision List (with rationale)

1) **Deduplicate Markdown helpers into small shared libs**
- Decision: add `scripts/lib/md_utils.py` and `scripts/lib/md_math_hygiene.py`.
- Rationale: the same file-iteration + inline-code-span parsing + math-hygiene state machine existed in multiple places; centralizing reduces regression risk and maintenance load.

2) **Refactor global hygiene gates to use shared helpers**
- Decision: refactor:
  - `scripts/gates/check_markdown_math_hygiene.py`
  - `scripts/gates/check_markdown_link_hygiene.py`
  - `scripts/gates/check_markdown_latex_macro_hygiene.py`
- Rationale: remove 3-way duplication of target expansion and inline-code parsing.

3) **Refactor KB math-hygiene checks to reuse the shared validator**
- Decision: `scripts/gates/check_knowledge_layers.py` now calls `validate_markdown_math_hygiene(...)` for referenced KB notes.
- Rationale: ensures KB rendering-safety checks stay semantically aligned with the global math hygiene gate.

4) **Refactor deterministic autofix helpers to reuse shared file iteration + inline-code parsing**
- Decision: refactor:
  - `scripts/bin/fix_markdown_math_hygiene.py`
  - `scripts/bin/fix_markdown_link_hygiene.py`
  - `scripts/bin/fix_markdown_latex_macros.py`
- Rationale: remove 3-way duplication in file iteration and (where applicable) inline-code parsing.

5) **Add a minimal md-utils regression smoke test**
- Decision: add `scripts/dev/smoke/smoke_test_md_utils_smoke.sh`.
- Rationale: lock the most likely regression vectors (inline code parsing + target/exclude resolution) deterministically without introducing a new test framework.

## Gate / Regression Results

- `python3 -m compileall -q scripts` ✅
- `bash scripts/dev/run_all_smoke_tests.sh` ✅ (includes `smoke_test_md_utils_smoke.sh`)

## Member Reviews (A/B/C)

- Member A (Opus): `team/skilldev-code-cleanup-md-dedup-r1_member_a_opus.md` → **APPROVE** (minor conditions)
  - Addressed by: adding `smoke_test_md_utils_smoke.sh`; preserving error message prefixes via call-site control; keeping scope limited.
- Member B (Gemini): `team/skilldev-code-cleanup-md-dedup-r1_member_b_gemini.md` → **APPROVE**
  - Addressed by: smoke suite remains green; refactor keeps per-gate semantics.
- Member C (Sonnet): `team/skilldev-code-cleanup-md-dedup-r1_member_c_sonnet.md` → **CONCERNS (non-blocking)**
  - Addressed by: deterministic sorting already preserved; shared validator keeps path context (`path_for_msgs`) and tests cover end-to-end behavior.

## Adjudication

**ACCEPT r1.**

Notes:
- The shared math-hygiene validator now ignores inline code spans via a robust backtick parser, which is consistent with the stated “ignore inline code spans” policy and reduces false positives.

## Next Step

- Optional follow-up (separate round): consider a small snapshot-style regression assertion for gate stdout formatting (only if log diffs become noisy).
