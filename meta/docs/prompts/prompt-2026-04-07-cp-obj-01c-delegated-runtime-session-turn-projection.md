# CP-OBJ-01C — Delegated Runtime Session/Turn Projection

This is the canonical implementation prompt for the next bounded `CP-OBJ-01` slice after:

- `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01b-typed-execution-identity-seam.md`
- `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`

## Goal

Land the smallest real code slice that gives delegated runtime a stable session/turn projection seam without promoting transcript history into control-plane authority.

This slice should:

- record a compact runtime projection while `AgentRunner` still owns real turn boundaries
- return that projection from `executeDelegatedAgentRuntime(...)`
- let runtime diagnostics consume that projection instead of re-deriving everything from scattered raw markers
- persist the projection on the real `TeamAssignmentSession` when a delegated run actually executes

It should not widen into operator read-model redesign, public payload expansion, or transcript-as-SSOT migration.

## Why This Slice

The current gap is no longer delegated runtime identity; `CP-OBJ-01B` already fixed that seam.

The remaining structural problem is projection loss:

- `executeDelegatedAgentRuntime(...)` returns raw `events + manifest + diagnostics summary`, but no stable session/turn projection object
- `AgentEvent[]` is not sufficient to reconstruct turns later with confidence, especially for tool-use turns that continue without an end-of-turn event
- `runtime-diagnostics-bridge.ts` currently rescans raw events to infer status/cause/action instead of consuming one canonical runtime projection
- `TeamAssignmentSession` currently stores lineage/lifecycle/checkpoint state only, so common-path runtime projection disappears and later code falls back to synthetic session repair

This slice is therefore about source-recorded projection, not about inventing another durable authority family.

## Source-grounded External Patterns

Use these as design patterns only; do not copy their worldview wholesale.

- `../codex/sdk/typescript/src/thread.ts`
- `../codex/sdk/typescript/src/events.ts`
- `../codex/sdk/typescript/src/items.ts`
- `../claude-code-sourcemap/restored-src/src/remote/sdkMessageAdapter.ts`
- `../claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`

Absorb only the bounded lessons that fit `autoresearch`:

- Codex separates thread container identity from turn execution and returns typed `items[]` for a completed turn rather than treating transcript text as the only durable summary.
- Claude Code keeps control-sideband signals typed beside message flow rather than forcing permission/progress/session state back into raw message content.

Do not import:

- transcript/thread as root project-state authority
- remote/UI-first runtime baggage
- giant omnibus message schemas

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
5. `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`
6. `packages/orchestrator/src/agent-runner.ts`
7. `packages/orchestrator/src/agent-runner-ops.ts`
8. `packages/orchestrator/src/agent-runner-runtime-state.ts`
9. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
10. `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
11. `packages/orchestrator/src/team-execution-types.ts`
12. `packages/orchestrator/src/team-execution-scoping.ts`
13. `packages/orchestrator/src/team-unified-runtime-support.ts`
14. `packages/orchestrator/src/team-unified-runtime-types.ts`
15. `packages/orchestrator/tests/agent-runner.test.ts`
16. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
17. `packages/orchestrator/tests/team-unified-runtime.test.ts`
18. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
19. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`

## Bounded Implementation

- add one internal-only projection helper module under `packages/orchestrator/src/research-loop/` for compact delegated runtime projection types plus builder logic
- record projection data at source while `AgentRunner` still has real turn context
  - include recovery vs normal dialogue phase
  - include turn count
  - include compact counts/signals such as text count, tool call count, marker kinds, approval requested, and terminal outcome
  - do not inline raw transcript text or full tool results into the projection
- extend `ExecuteDelegatedAgentRuntimeResult` so delegated runtime returns that projection together with existing raw evidence
- update `runtime-diagnostics-bridge.ts` to consume the projection for session summary / terminal evidence instead of re-inventing summary from ad hoc scans over raw events alone
- extend `TeamAssignmentSession` with a nullable runtime-projection field
  - real launched sessions may receive the projection on merge
  - freshly opened sessions initialize it to `null`
  - synthetic/repaired sessions must stay `null` rather than fabricating turn history
- keep `AgentEvent[]` as low-level evidence; the projection is a compact derived seam, not a replacement authority

## Explicit No-Go

- no public CLI / MCP payload widening
- no new `job` object
- no transcript/thread promotion into control-plane SSOT
- no live-status / replay / team-view vocabulary unification; that belongs to `CP-OBJ-01D`
- no backfill that makes synthetic sessions look like they have authentic turn history
- no behavior rewrite for existing team status semantics such as `max_turns` or `diminishing_returns`
- no remote/server/fleet widening

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/team-unified-runtime.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`

## Review Focus

- confirm turn boundaries are recorded at source instead of being guessed later from raw `AgentEvent[]`
- confirm recovery paths, truncation/overflow markers, and diminishing-returns markers remain auditable through the projection
- confirm `runtime-diagnostics-bridge.ts` now consumes the projection seam rather than acting as a second ad hoc projector over raw events
- confirm synthetic sessions never fabricate runtime projection history
- confirm public host/team-view payloads do not widen in this slice
- confirm existing team status semantics stay unchanged; the new seam is projection-only
