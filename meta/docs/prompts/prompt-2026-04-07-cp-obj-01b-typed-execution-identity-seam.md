# CP-OBJ-01B — Typed Execution Identity Seam First

This is the canonical implementation prompt for the next bounded `CP-OBJ-01` slice after:

- `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md`
- `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`

## Goal

Land the smallest real code slice that stops delegated runtime identity from being reconstructed independently in multiple places.

This slice should:

- introduce one shared delegated-execution identity seam
- make team runtime / scoping / view code consume that seam
- keep behavior and wire format stable

It should not widen into session/turn redesign, task-graph redesign, or remote/fleet/runtime API changes.

## Why This Slice

`CP-OBJ-01A` already locked the current object map and named the biggest low-level duplication seam:

- root run id vs delegated synthetic runtime id
- repeated string recomposition of `runtime_run_id`
- repeated string recomposition of delegated manifest path

Today these relations are hand-reconstructed in multiple places:

- `packages/orchestrator/src/team-execution-scoping.ts`
- `packages/orchestrator/src/team-execution-view.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`

That duplication is small enough to fix now, but central enough that later `CP-OBJ-01C/01D` work will keep drifting if this seam stays implicit.

## Required Reads

1. `AGENTS.md`
2. `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
3. `meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md`
4. `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`
5. `packages/orchestrator/src/team-execution-scoping.ts`
6. `packages/orchestrator/src/team-execution-view.ts`
7. `packages/orchestrator/src/team-unified-runtime-support.ts`
8. `packages/orchestrator/src/team-execution-types.ts`
9. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
10. `packages/orchestrator/src/run-manifest.ts`
11. `packages/orchestrator/src/index.ts`
12. `packages/orchestrator/tests/team-execution-state.test.ts`
13. `packages/orchestrator/tests/team-unified-runtime.test.ts`
14. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
15. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
16. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`

## Bounded Implementation

- add one internal helper module for delegated execution identity, with explicit relation between:
  - root project run id
  - assignment id
  - delegated runtime run id
  - delegated manifest path
- convert existing team-runtime/scoping/view code to consume that helper instead of reconstructing the strings independently
- where current function names are already used broadly, compatibility wrappers are allowed, but the wrapper must delegate to the shared identity helper rather than remain a second implementation
- add or update focused regression coverage so the identity seam is locked in one place

## Explicit No-Go

- no behavior change to runtime status/approval/session semantics
- no public CLI / MCP payload redesign
- no renaming of persisted fields such as `runtime_run_id` or `manifest_path`
- no transcript/turn substrate rollout
- no generic `job` object introduction
- no widening into docs ordering cleanup; that remains a separate lane

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-state.test.ts tests/team-unified-runtime.test.ts tests/research-loop-delegated-agent-runtime.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`

## Review Focus

- confirm delegated runtime identity now comes from one shared seam rather than repeated ad hoc string reconstruction
- confirm the slice keeps wire format and persisted artifact paths stable
- confirm no new public authority or second read-model layer is introduced
- confirm tracker / redesign / memory sync records a bounded `CP-OBJ-01B` closeout rather than over-claiming broader convergence
