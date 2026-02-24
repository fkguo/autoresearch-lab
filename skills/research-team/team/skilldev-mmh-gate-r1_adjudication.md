# Adjudication — skilldev-mmh-gate-r1

Date: 2026-01-21
Scope: research-team skill (global Markdown math hygiene gate + integration into run_team_cycle preflight)

## Decision list

1) Add a **global Markdown math hygiene gate** (domain-neutral)
- Decision: Introduce `scripts/gates/check_markdown_math_hygiene.py`.
- Rationale: Prevent common Markdown rendering breakage in math-heavy docs across the project (not only KB notes).

2) Add a **deterministic autofix helper**
- Decision: Introduce `scripts/bin/fix_markdown_math_hygiene.py`.
- Rationale: Provide a safe, local, deterministic way to repair typical LLM formatting hazards without manual editing.

3) Integrate the gate into the **team cycle preflight**
- Decision: `scripts/bin/run_team_cycle.sh` runs the global math hygiene gate after deterministic auto-fills and before any LLM calls.
- Rationale: Fail-fast on rendering hazards before generating member reports; keep the “mandatory convergence gate” semantics unchanged.

4) Keep KB-specific rendering checks in the **knowledge layers gate**
- Decision: `scripts/gates/check_knowledge_layers.py` continues to validate referenced KB notes for math rendering hazards.
- Rationale: KB notes are frequently linked from capsule I / References; a single bad KB note can break evidence readability.

5) Add deterministic regression coverage
- Decision: Add a smoke test `scripts/dev/smoke/smoke_test_markdown_math_hygiene_gate.sh` and rely on existing convergence smoke tests.
- Rationale: Prevent silent regressions; verify gate+autofix behavior end-to-end.

## Gate / regression results (deterministic)

- `bash -n scripts/bin/run_team_cycle.sh` ✅
- `bash scripts/dev/smoke/smoke_test_markdown_math_hygiene_gate.sh` ✅
- `bash scripts/dev/smoke/smoke_test_run_team_cycle_convergence_gate.sh` ✅
- Full smoke suite (`scripts/dev/smoke/smoke_test_*.sh`) ✅

## Member reviews

### Member A — Claude Opus
- Decision: **APPROVE**
- Notes: Confirms policy alignment (no `\(\)`/`\[\]`, fenced `$$`, no line-start `+/-/=`, split-`$$` heuristic) and bash safety under `set -euo pipefail`.

### Member B — Gemini 3 Pro
- Decision: **APPROVE**
- Notes:
  - Flags minor maintainability concerns (validation logic duplicated between KB gate and global gate).
  - Notes the fixer is intentionally conservative around backticks (some mixed code+math lines may need manual edits).

### Member C — Claude Sonnet (non-blocking)
- Verdict: **CONCERNS**
- Main points:
  - Wants explicit evidence of convergence-gate ordering (diff-only view limited).
  - Flags autofix merge heuristic edge cases (back-to-back `$$` blocks starting with `\qquad`).
- Adjudication: Convergence ordering is covered by deterministic smoke tests and full-script inspection; autofix risk is acceptable as an opt-in helper under the stated policy, but worth adding extra smoke cases later.

## Adjudication

- Accept the code changes as technically correct and gate-safe (A+B approve; C concerns noted).
- Do not expand sidecar scope beyond non-blocking guarantees.

## Next step

- Optional follow-ups:
  - Add smoke case: adjacent-but-intentional `$$` blocks starting with `\qquad` should not be auto-merged (or document that it will).
  - Add smoke case: config fallback when `markdown_math_hygiene` key missing.
