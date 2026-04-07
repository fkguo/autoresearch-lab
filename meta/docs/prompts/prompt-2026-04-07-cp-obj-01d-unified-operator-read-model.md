# CP-OBJ-01D — Unified Operator Read Model

This is the canonical implementation prompt for the next bounded `CP-OBJ-01` slice after:

- `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01b-typed-execution-identity-seam.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01c-delegated-runtime-session-turn-projection.md`
- `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`

## Goal

Land the smallest real code slice that makes operator-facing run/team/runtime projections consume one shared control-plane vocabulary without promoting transcript history or `runtime_projection` into new authority.

This slice should:

- unify the interpretation layer across root run read model, team live status, and runtime diagnostics
- reuse the landed delegated execution identity seam and `runtime_projection` seam
- keep existing public payload shapes bounded while removing duplicate status/cause/action interpreters
- leave `CP-OBJ-01E` research-task bridge and `M-22` authority residue out of scope

It should not widen into payload redesign, task-authority migration, or remote/fleet/server work.

## Why This Slice

`CP-OBJ-01C` solved the missing projection seam. The next structural drift is interpretation drift:

- `packages/orchestrator/src/orch-tools/run-read-model.ts` expresses root run status and approval state with one vocabulary
- `packages/orchestrator/src/team-execution-view.ts` expresses assignment/live-status/background-task state with another
- `packages/orchestrator/src/runtime-diagnostics-bridge.ts` now consumes `runtime_projection`, but still maintains a third status/cause/action language
- `assignment_results`, `live_status`, and diagnostics are therefore parallel operator interpreters over related evidence instead of one projection family

This slice is about converging those operator read models, not inventing a new view object and not widening current host payloads.

## Source-grounded External Patterns

Use these as design patterns only; do not import their worldview wholesale.

- `../codex/codex-rs/app-server-protocol/schema/typescript/v2/Thread.ts`
- `../codex/codex-rs/app-server-protocol/schema/typescript/v2/Turn.ts`
- `../codex/codex-rs/app-server/src/thread_state.rs`
- `../claude-code-sourcemap/restored-src/src/utils/sessionState.ts`
- `../claude-code-sourcemap/restored-src/src/utils/conversationRecovery.ts`
- `../claude-code-sourcemap/restored-src/src/utils/sessionRestore.ts`

Absorb only the bounded lessons that fit `autoresearch`:

- operator projection must stay distinct from canonical transcript/history authority
- projection should carry explicit provenance/fidelity semantics when recovery/synthetic repair is involved
- approval / requires-action state should be typed operator metadata, not inferred from raw message flow alone
- recovery overlays may exist, but they must stay overlays rather than rewriting canonical history
- diagnostics/tracing are their own signal family, not transcript facts

Do not import:

- `thread` / `fork` / `rollback` / UI-first transport baggage as root control-plane semantics
- standalone notification-only approval authority
- a giant omnibus session schema that mixes transcript, diagnostics, transport, and cache concerns

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
5. `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`
6. `packages/orchestrator/src/orch-tools/run-read-model.ts`
7. `packages/orchestrator/src/team-execution-view.ts`
8. `packages/orchestrator/src/team-unified-runtime.ts`
9. `packages/orchestrator/src/team-unified-runtime-types.ts`
10. `packages/orchestrator/src/team-execution-runtime-types.ts`
11. `packages/orchestrator/src/team-unified-runtime-support.ts`
12. `packages/orchestrator/src/team-execution-scoping.ts`
13. `packages/orchestrator/src/team-execution-types.ts`
14. `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
15. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
16. `packages/orchestrator/tests/orchestrator.test.ts`
17. `packages/orchestrator/tests/team-unified-runtime.test.ts`
18. `packages/hep-mcp/tests/contracts/orchRunApprove.test.ts`
19. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
20. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
21. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
22. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-sequential.test.ts`
23. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
24. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`

## Bounded Implementation

- add one internal-only operator read-model helper module under `packages/orchestrator/src/`
  - it should define the shared operator summary vocabulary for status / cause / recommended action / approval attention over existing runtime evidence
  - it should consume bounded inputs such as assignment status, nullable `session.runtime_projection`, approval metadata, and existing root run status
- update `runtime-diagnostics-bridge.ts` so `summary` is derived through the shared helper rather than a private standalone interpreter
- update team operator surfaces so the existing public fields (`status`, `runtime_status`, `task_lifecycle_status`, `task_status`, approval metadata, and related result status) are produced from the same shared mapping logic instead of per-surface duplicate rules
- let root run read model (`buildRunStatusView(...)` and any direct consumers such as fleet/status list views) reuse the same vocabulary family only where semantically applicable
  - root run must remain rooted in root authority (`RunState`, ledger, pending approval)
  - do not pull team-local state back into `orch_run_status` as a new authority
- if explicit provenance/materialization flags are needed for recovery or synthetic overlay semantics, keep them internal-only or scoped to existing internal results; do not widen public host payloads

## Explicit No-Go

- no new public `live_status`, `assignment_results`, `orch_run_status`, or replay fields
- no promotion of `runtime_projection` into a persisted SSOT or transcript replacement
- no `job` / `thread` / transcript authority introduction
- no `CP-OBJ-01E` task bridge work in this slice
- no `M-22` legacy approval/workflow cleanup mixed into this slice
- no fleet/EVO-14/server/remote widening
- no dashboard/UI contract work

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/orchestrator.test.ts tests/team-unified-runtime.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`

## Review Focus

- confirm there is one shared operator interpretation layer instead of three parallel interpreters
- confirm root run status remains rooted in root authority and is not widened into team-local authority
- confirm team views and diagnostics reuse the same vocabulary family without exposing `runtime_projection`
- confirm recovery/approval semantics remain explicit and auditable
- confirm no public payload widening or transcript/job authority drift was introduced

