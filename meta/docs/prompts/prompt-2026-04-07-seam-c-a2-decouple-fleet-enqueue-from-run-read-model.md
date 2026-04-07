# Prompt: 2026-04-07 Seam C / Slice A2 — Decouple Fleet Enqueue From Run Read-Model

## 1. Background & Target

Seam C’s Slice A2 is the execution-safe lane that removes projection authority from the fleet enqueue mutation path. Today `orch_fleet_enqueue` gates `run_id` mutations via `assertKnownRun`, which pulls the `run-read-model` projection (`readRunListView`) before any mutation. That projection is derived, stale by design, and already intended to be read-only; yet it is currently being treated as canonical authority whenever the fleet queue decides whether a run exists. We must flip that: the canonical gatekeeper for enqueue mutations is the live state + the ledger/artifact evidence, not a cached projection.

The deliverable is a checked-in implementation prompt for Seam C / Slice A2 that explains why `assertKnownRun` must stop using `readRunListView`, what sources it should trust instead, and how the adjacent tests and diagnostics must prove the new boundary.

## 2. Specific Authority Baseline (read before editing)

Read these files before making changes so the new lane stays grounded in the current truth:

- `packages/orchestrator/src/orch-tools/fleet-queue-tools.ts` (where `assertKnownRun` lives and currently calls `readRunListView`).
- `packages/orchestrator/src/orch-tools/run-read-model.ts` (the projection whose list view we are escaping). Understand `readRunListView` and why it is a derived surface.
- `packages/orchestrator/tests/orch-fleet-queue.test.ts` + `packages/orchestrator/tests/orchFleetTestSupport.ts` (to see how run existence is asserted today and how ledger/state fixtures are written).
- `packages/orchestrator/src/orch-tools/common.ts` / `packages/orchestrator/src/index.ts` (for `StateManager`/ledger paths, to know how to check raw ledger/artifact presence).
- `meta/REDESIGN_PLAN.md` and `meta/docs/plans/2026-04-07-next-batch-front-door-command-inventory-anti-drift.md` (for the current Seam C/next-batch narrative that distinguishes canonical state from projections).

Current truths you must preserve:

- The fleet queue is a mutation surface; enqueue must fail closed when run provenance cannot be confirmed.
- `StateManager.readState()` is the canonical runtime run snapshot for the current project root; it already knows the live `run_id` in state.json.
- The ledger and the artifacts directory under `artifacts/runs/<runId>` are the durable evidence that a run ever existed (even if it is completed/paused).
- `readRunListView` is a projection derived from those facts and must remain projection-only (per Seam boundary guard); it can still be used for read-only lists elsewhere (e.g., fleet-status) but not for gating mutations.

## 3. Scope, Goals, and Non-Goals

### Primary tasks

1. Redefine `assertKnownRun` so it no longer relies on `readRunListView`. Instead, gate on:
   - the current live state for the project root (`state.json`) when the desired `run_id` matches the current state.
   - the raw ledger ledger lines (presence of entries with the requested `run_id`).
   - optional artifact evidence such as `artifacts/runs/<runId>` (to cover runs that finished and no longer occupy `state.json`).
   - propagate existing projection read-model errors only for observability, not for mutation gating.
2. Update/enlarge fleet enqueue tests to cover the new gate: both when the ledger/artifacts do show the run and when they do not, ensuring the error contains ledger/artifact diagnostics but does not flip to projection-derived `last_status` checks.
3. Ensure any helper run-detection code reused inside `fleet-queue-tools.ts` is aware of the seam: no other fleet enqueue code should silently fall back to `readRunListView`.

### Must not do

- Do not refactor `readRunListView` into some new canonical surface—keep it clearly projection-only.
- Do not reroute `fleet-status`/`run-status` or other read-only endpoints through the new gating logic; they are allowed to keep using the projection.
- Do not drop the ledger/artifact evidence requirements in favor of heuristics (e.g., “if the run_id looks familiar, proceed”).

## 4. Suggested Implementation Sequence

1. Document the new boundary at the top of `assertKnownRun` and the relevant seam narrative (e.g., update comments or local helper functions to state the new canonical authority: live state + ledger/artifacts, not `readRunListView`).
2. Rewrite `assertKnownRun` so it:
   - uses `manager.readState()` to accept the current state run immediately;
   - falls back to scanning the ledger file for the requested `run_id`; when scanning, collect `ReadModelError`-like diagnostics (missing ledger, unreadable lines) for observability but do not rely on projection status fields;
   - optionally checks for directory existence under `artifacts/runs/<runId>` to catch removed but recorded runs;
   - only rejects when every canonical artifact (state, ledger, artifacts dir) reports “not found” in combination with a clean ledger read.
3. Update tests in `orch-fleet-queue.test.ts` (and helper fixtures) to reflect the new error path. Add cases that:
   - succeed when the run exists only in state or ledger/artifacts but not both;
   - fail when the run is absent from all canonical artifacts; ensure the thrown error includes ledger/artifact diagnostics (e.g., missing ledger or missing run_id entries). 
4. If you introduce new helper utilities (e.g., ledger-scanning helpers), keep them local to `fleet-queue-tools.ts` or shared `orch-tools/common.ts` so the seam remains tightly scoped.

## 5. Suggested File Touch Set

- `packages/orchestrator/src/orch-tools/fleet-queue-tools.ts`
- `packages/orchestrator/src/orch-tools/run-read-model.ts` (only if you need to clarify projection-only documentation; do not change list-view logic unless you are explicitly reprojectioning for diagnostics)
- `packages/orchestrator/tests/orch-fleet-queue.test.ts`
- `packages/orchestrator/tests/orchFleetTestSupport.ts`
- `packages/orchestrator/src/orch-tools/common.ts` (if you need to expose helpers around ledger/artifact path checks)
- Any new test helpers supporting ledger or artifact lookups (keep them under `tests/` or `orch-tools/` to maintain seam boundaries)

## 6. Acceptance (must pass)

1. `git diff --check`
2. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-queue.test.ts`
3. If you add helpers in `common.ts`, rerun `pnpm --filter @autoresearch/orchestrator test -- tests/orch-tools.common.test.ts` (or analogous file) even if it currently has no tests.

Add commands for any new tests introduced specifically for the lane.

## 7. Formal Review Focus

Reviewers should be able to answer:

1. Does `assertKnownRun` now gate mutations using only canonical state artifacts (state.json, ledger, artifacts directories) and not `readRunListView`?
2. Are the new tests covering both success and failure surfaces tied to ledger/artifact evidence without touching the projection’s `last_status`? 
3. Does the error payload include the ledger/artifact diagnostics while explicitly stating the projection view is not authoritative?
4. Do the new helpers (if any) keep the boundary sealed and avoid generalizing to other `orch-tools` surfaces?

Plot the review packet to include both the updated `fleet-queue-tools.ts` and the failing/success scenarios in `orch-fleet-queue.test.ts`, plus any new helper files you touch.

## 8. Self-Review Checklist

Before calling this lane done, ensure:

1. `assertKnownRun` now short-circuits on the live `state.json` run and does not read `readRunListView` for gating.
2. For runs that no longer occupy `state.json`, the ledger (and optionally `artifacts/runs/<runId>`) is scanned and, when the run exists, the enqueue still succeeds.
3. When the run is absent from every canonical artifact, the enqueue rejects with diagnostics about the ledger/artifacts, not with derived `last_status` information from a projection.
4. Tests explicitly document which canonical artifact provided the authoritative signal; no test relies on `readRunListView` to assert run existence.
5. Review notes/stateful documentation record that this seam is part of Seam C / Slice A2 and that projection surfaces remain read-only.

## 9. Completion Criteria

This lane can close only after:

1. Acceptance commands pass.
2. Formal review yields `blocking_issues = []` and confirms the new authority seam.
3. Self-review checklist is satisfied.
4. Tracker + prompt doc (this file) remain the single source of truth for this lane.
