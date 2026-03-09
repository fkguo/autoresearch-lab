# Workflow Gap Analysis — 2026-02-16

Purpose: distill reusable workflow defects that must remain visible at the package level.  
Scope: generic workflow / boundary / audit lessons only.  
SSOT tracker: `docs/plans/2026-02-12-implementation-plan-tracker.md`.

NOT_FOR_CITATION.

## Gap 1 — Literature expansion must be gate-enforced

Observed:

- Seed materials were too easy to treat as “good enough”.
- Expansion beyond the first bibliography was not represented as a required, machine-checkable step.

Why it matters:

- A generic autoresearch system must distinguish seed intake from auditable coverage.
- Without a structured scout step, novelty and feasibility judgments drift toward whichever papers happened to be available first.

Remediation:

- Add a deterministic literature-scout step with query-plan, inclusion/exclusion rationale, and coverage report.
- Feed that output into milestone gates instead of treating it as an optional side artifact.

## Gap 2 — Repo role and write root must be explicit

Observed:

- Instance-style material could leak into the design repo when target paths and repo roles were implicit.
- Relative-path edits plus ambiguous working directories made this easy to miss.

Why it matters:

- The design repo and the run repo solve different problems.
- Once the boundary is fuzzy, run diaries and local workflow residue start polluting checked-in SSOT.

Remediation:

- Require every file-writing stage to declare repo role and write root up front.
- Fail closed before execution if a write escapes the declared root or targets the wrong repo role.

## Gap 3 — External reviewer wrappers need capability probing

Observed:

- Review tooling could assume advertised CLI features were actually usable.
- Runtime mismatches then created brittle review loops and poorly auditable failures.

Why it matters:

- Reviewer infrastructure must fail deterministically.
- Capability uncertainty belongs in wrapper logic, not in checked-in design docs or manual workaround notes.

Remediation:

- Add capability probe + resolved-backend recording for every external reviewer wrapper.
- Enforce a verdict-first output contract so malformed reviewer output fails fast.

## Gap 4 — Mutation helpers need their own audit boundary

Observed:

- State mutations and evidence generation were too easy to couple.
- When mutation wrappers are implicit, receipts and summaries tend to leak into SSOT docs.

Why it matters:

- Mutation tooling should produce concise auditable artifacts, not expand the design repo into an operations diary.

Remediation:

- Use dedicated wrappers that snapshot pre-state, apply mutation, snapshot post-state, and emit a compact summary artifact.
- Keep those receipts in local or run-specific audit surfaces, not in package-level design notes.

## Gap 5 — Durable lessons and execution residue must be separated

Observed:

- Reusable workflow lessons and narrow execution residue tended to accumulate in the same checked-in files.

Why it matters:

- Once those categories mix, future planning starts overfitting to one recent campaign instead of the generic substrate.

Remediation:

- Keep only durable workflow, gate, and boundary lessons in checked-in docs.
- Move run-level progress, local review receipts, and instance evidence pointers out of the package repo.
