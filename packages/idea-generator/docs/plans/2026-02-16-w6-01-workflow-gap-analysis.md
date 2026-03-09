# Execution Workflow Gap Analysis（历史文件名保留） — 2026-02-16

Purpose: distill **reusable workflow defects** that surfaced during early package bring-up.  
Scope here is intentionally generic: package boundary, literature scout discipline, and review / board-sync tooling reliability.  
SSOT tracker remains `docs/plans/2026-02-12-implementation-plan-tracker.md`.

NOT_FOR_CITATION (internal process notes).

## Gap 1 — Literature expansion was optional instead of gate-enforced

Observed:
- Seed papers were treated as sufficient input too often.
- There was no deterministic requirement to expand beyond the initial bibliography and record why additional sources were included or excluded.

Why this matters:
- A generic autoresearch tool must distinguish “seed intake completed” from “coverage is plausibly sufficient”.
- Without a structured scout step, novelty and feasibility judgments drift toward whatever the first seed set happened to mention.

Remediation:
- Add a deterministic literature-scout step that:
  - runs a fixed query plan,
  - records inclusion / exclusion reasons,
  - emits machine-checkable reference cards or opportunity cards, and
  - feeds a coverage report into gates instead of being an optional side artifact.

## Gap 2 — Repo-boundary violations were too easy

Observed:
- Instance-style files were accidentally written into the design repo because target paths and repo roles were implicit.
- Relative-path editing plus ambiguous working directories made this class of mistake easy to miss.

What was hardened:
- Pollution checks now fail closed on instance roots and local review workflow surfaces.

Remaining remediation:
- Require every file-writing stage to declare target repo role and write root up front.
- Add a preflight helper that rejects writes outside the declared repo boundary before execution starts.

## Gap 3 — Review runner capability probing was missing

Observed:
- Review tooling assumed CLI features were available because help text advertised them.
- In practice, capability flags could still fail at runtime, producing false negatives or brittle review loops.

Remediation:
- Wrap external reviewer CLIs with a deterministic capability probe.
- Record the resolved backend, exact command line, and stderr in the local review archive.
- Enforce a verdict-first output contract so malformed reviewer output fails fast.

## Gap 4 — Board-sync mutations needed their own hardened wrapper

Observed:
- Direct CLI calls for board / issue mutation were brittle and required undocumented workarounds.
- The mutation layer was not isolated enough from the evidence layer.

Remediation:
- Use a single board-sync helper that:
  - snapshots pre-state,
  - applies the mutation with all known required flags,
  - snapshots post-state,
  - writes a concise summary artifact,
  - and fails closed if any step cannot be audited.

## Gap 5 — Durable lessons were mixed with run diaries

Observed:
- Package docs accumulated both reusable process lessons and narrow scientific execution notes.
- This made it hard to tell what belonged in a generic checked-in design repo versus an external run archive.

Remediation:
- Keep only durable workflow / gate / boundary lessons in checked-in docs.
- Move run-level scientific progress, board-sync receipts, and instance evidence pointers to external archives.
