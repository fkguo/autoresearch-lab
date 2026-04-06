# CP-OBJ-01C — Delegated Runtime Session/Turn Projection

This is the canonical implementation prompt for the next bounded `CP-OBJ-01` code slice after:

- `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01b-typed-execution-identity-seam.md`
- `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`

## Goal

Land the smallest real code slice that gives delegated runtime one stable session/turn projection seam without promoting transcripts into authority.

This slice should:

- derive one shared delegated runtime projection from `AgentEvent[]` plus `RunManifest`
- let delegated runtime and runtime diagnostics consume that same projection seam
- persist only the minimum stable lineage/terminal subset onto `TeamAssignmentSession`

It should not widen into transcript-as-SSOT, unified operator read-model redesign, or public host-surface expansion.

## Why This Slice

`CP-OBJ-01B` closed the low-level identity seam, but the next drift seam is still visible in current code:

- `TeamAssignmentSession` is real delegated-execution authority, yet it currently stores only coarse lifecycle/checkpoint fields
- `runtime-diagnostics-bridge.ts` re-derives terminal and runtime-marker meaning directly from `AgentEvent[]`
- `normalizeTeamScopingState()` still contains `syntheticSession(...)` fallback repair, which is acceptable as bounded legacy fallback but should not be the conceptual center of the common path

Today the runtime already has useful turn/session evidence:

- `AgentEvent` terminal events carry `turnCount`
- runtime markers carry `turnCount`
- `RunManifest` already records step/checkpoint lineage

What is missing is not “more evidence”; it is a shared projection seam that later `CP-OBJ-01D` can reuse without inventing another read model.

## Bounded Design Judgment

Absorb only the source-grounded patterns that help this slice:

- from `../codex/sdk/typescript/src/thread.ts`, `../codex/sdk/typescript/src/events.ts`, and `../codex/sdk/typescript/src/items.ts`
  - keep durable container identity separate from per-turn execution projection
  - normalize event/item/turn boundaries explicitly instead of hiding them in one status blob
- from `../claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`, `../claude-code-sourcemap/restored-src/src/remote/remotePermissionBridge.ts`, and `../claude-code-sourcemap/restored-src/src/entrypoints/agentSdkTypes.ts`
  - keep control sideband typed and separate from the message stream
  - keep session lineage explicit without making transcript history the project-state SSOT

Do **not** copy:

- conversation/thread as the root control-plane object
- remote/UI-first session baggage
- a giant omnibus message schema

## Required Reads

1. `AGENTS.md`
2. `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
3. `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`
4. `packages/orchestrator/src/execution-identity.ts`
5. `packages/orchestrator/src/agent-runner-ops.ts`
6. `packages/orchestrator/src/agent-runner-runtime-state.ts`
7. `packages/orchestrator/src/agent-runner.ts`
8. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
9. `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
10. `packages/orchestrator/src/team-execution-types.ts`
11. `packages/orchestrator/src/team-execution-scoping.ts`
12. `packages/orchestrator/src/team-unified-runtime-support.ts`
13. `packages/orchestrator/src/team-execution-view.ts`
14. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
15. `packages/orchestrator/tests/team-unified-runtime.test.ts`
16. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
17. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
18. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-sequential.test.ts`
19. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
20. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`

## Bounded Implementation

- add one internal helper module for delegated runtime session/turn projection over:
  - `AgentEvent[]`
  - persisted `RunManifest`
  - existing delegated runtime identity
- make `executeDelegatedAgentRuntime(...)` produce that projection once, then reuse it instead of letting downstream consumers recompute terminal/turn meaning independently
- make `writeRuntimeDiagnosticsBridgeArtifact(...)` consume the shared projection seam rather than rediscovering runtime-marker/terminal lineage from raw events on its own
- extend `TeamAssignmentSession` only with the minimum stable execution-attempt subset needed for later convergence, for example:
  - observed turn count
  - terminal kind / stop reason / error code
  - keep these as session-local projection fields, not a new global authority family
- write the session subset during the real common runtime path so live sessions no longer depend on `syntheticSession(...)` for normal successful/approval/recovery flows
- keep `syntheticSession(...)` only as bounded legacy fallback for incomplete older state, not as a new design center
- keep current top-level host surfaces bounded:
  - do not add new public `runtime_diagnostics_*` fields to team-view payloads
  - do not widen `orch_run_execute_agent` team outputs into transcript or turn dumps

## Explicit No-Go

- no transcript/message history promotion into project-state SSOT
- no new generic `job` authority
- no remote/fleet/session-server widening
- no `CP-OBJ-01D` read-model unification in this slice
- no public CLI / MCP contract redesign
- no HEP/domain-pack-specific taxonomy in generic control-plane objects

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-delegated-agent-runtime.test.ts tests/team-unified-runtime.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`

## Review Focus

- confirm delegated runtime now has one shared session/turn projection seam rather than parallel event/bridge/session recomputation
- confirm `TeamAssignmentSession` gains only bounded projection fields instead of becoming a second transcript/read-model authority
- confirm runtime diagnostics bridge now consumes the shared projection seam
- confirm normal runtime/approval/resume flows persist real session lineage without relying on `syntheticSession(...)` on the happy path
- confirm host-path contracts remain bounded and do not silently widen public payloads
