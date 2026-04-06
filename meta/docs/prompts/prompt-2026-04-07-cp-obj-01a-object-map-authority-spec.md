# CP-OBJ-01A — Object Map / Authority Spec First

This is the canonical implementation prompt for the first bounded `CP-OBJ-01` slice after `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`.

## Goal

Author a checked-in, source-grounded control-plane object map for `packages/orchestrator/` so later runtime slices stop editing against half-implicit object boundaries.

This slice is intentionally documentation/governance-first. It must:

- write the current canonical object families down explicitly
- distinguish authority objects from derived projections
- name the real parallel-authority seams that later slices must converge
- sync tracker / redesign / architecture memory so the next batches can execute against the same object language

It must not rewrite runtime behavior, add new public APIs, or reopen already-landed runtime hardening slices.

## Why This Slice

Mainline now has a coherent generic-first front door, current CI is green, and recent bounded runtime / post-runtime / legacy-doc follow-ups are landed. The next structural risk is no longer "missing one more guard" but the fact that orchestrator runtime code still spans multiple overlapping object families:

- `RunState` / `LedgerEvent`
- `RunManifest`
- `TeamExecutionState` / `TeamDelegateAssignment` / `TeamAssignmentSession`
- `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint`
- `AgentEvent`
- multiple operator read-model / diagnostics projections layered on top

Without an explicit authority map, future runtime improvements will keep reinforcing string-level identity conventions and parallel read models.

## Required Reads

1. `AGENTS.md`
2. `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
3. `packages/orchestrator/src/types.ts`
4. `packages/orchestrator/src/state-manager.ts`
5. `packages/orchestrator/src/run-manifest.ts`
6. `packages/orchestrator/src/agent-runner-ops.ts`
7. `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
8. `packages/orchestrator/src/team-execution-types.ts`
9. `packages/orchestrator/src/team-execution-scoping.ts`
10. `packages/orchestrator/src/team-execution-view.ts`
11. `packages/orchestrator/src/team-unified-runtime-support.ts`
12. `packages/orchestrator/src/research-loop/task-types.ts`
13. `packages/orchestrator/src/research-loop/event-types.ts`
14. `packages/orchestrator/src/research-loop/runtime.ts`
15. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
16. `/Users/fkg/Coding/Agents/codex/sdk/typescript/src/thread.ts`
17. `/Users/fkg/Coding/Agents/codex/sdk/typescript/src/events.ts`
18. `/Users/fkg/Coding/Agents/codex/codex-rs/exec/src/event_processor_with_jsonl_output.rs`
19. `/Users/fkg/Coding/Agents/codex/codex-rs/analytics/src/events.rs`
20. `/Users/fkg/Coding/Agents/codex/codex-rs/state/src/runtime/agent_jobs.rs`
21. `/Users/fkg/Coding/Agents/claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`
22. `/Users/fkg/Coding/Agents/claude-code-sourcemap/restored-src/src/entrypoints/sdk/coreSchemas.ts`
23. `/Users/fkg/Coding/Agents/claude-code-sourcemap/restored-src/src/entrypoints/agentSdkTypes.ts`

## Required Deliverables

1. `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`
2. `meta/REDESIGN_PLAN.md` sync for the new planning truth
3. `meta/remediation_tracker_v1.json` sync for the machine-readable umbrella / next-batch truth
4. `.serena/memories/architecture-decisions.md` update if the slice surfaces a stable invariant

## Bounded Implementation

- write one source-grounded object-map / authority-spec doc under `meta/docs/` that covers at least:
  - root project-run authority
  - delegated execution authority
  - runtime step-checkpoint authority
  - research-task / follow-up authority
  - execution evidence stream
  - derived operator projections
- explicitly classify which objects are:
  - canonical authority
  - derived projection
  - current string-convention seam / technical debt
  - not yet first-class object (`job`, `turn`) and therefore not safe to widen casually
- spell out the concrete duplication seams:
  - `run_id` vs synthetic delegated runtime ids
  - `task_id` as task-graph id vs assignment-carried execution id
  - step checkpoint vs assignment checkpoint vs research-loop checkpoint
  - raw execution events vs operator replay / status views
- sync redesign/tracker wording so `CP-OBJ-01` is visible as the next generic-first main axis without inventing a new phase-counted remediation id
- keep the first-touch docs follow-up as a separate bounded lane; do not mix it into the object-model lane

## Explicit No-Go

- no runtime behavior rewrites
- no new CLI / MCP / package public surface
- no schema/codegen rollout
- no `thread`/transcript-as-SSOT pivot
- no remote/server/fleet widening
- no HEP-specific taxonomy or pack-local assumptions in the generic object language
- no reopening `NEW-RT-08`, `NEW-RT-09`, `NEW-RT-10`, or post-runtime eval slices beyond documenting how they fit the object map

## Acceptance

- `git diff --check`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`
- `rg -n "CP-OBJ-01|control-plane object convergence|object map" meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md meta/docs/2026-04-07-orchestrator-control-plane-object-map.md meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md .serena/memories/architecture-decisions.md`

## Review Focus

- confirm the new object map is source-grounded against the live orchestrator code rather than aspirational architecture prose
- confirm authority vs projection boundaries are explicit and not just renamed duplicates
- confirm the doc does not accidentally promote transcript/session evidence into project-state SSOT
- confirm redesign/tracker sync keeps counts stable and records `CP-OBJ-01` as planning truth rather than false implementation closeout
