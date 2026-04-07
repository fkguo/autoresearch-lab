# CP-OBJ-01E — Research-Task Bridge Into Live Execution

This is the canonical implementation prompt for the bounded `CP-OBJ-01` slice that should follow `CP-OBJ-01D`:

- `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01a-object-map-authority-spec.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01b-typed-execution-identity-seam.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01c-delegated-runtime-session-turn-projection.md`
- `meta/docs/prompts/prompt-2026-04-07-cp-obj-01d-unified-operator-read-model.md`
- `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`

## Goal

Land the smallest real code slice that keeps canonical `ResearchTask` identity alive through the live delegated execution path, so task is no longer just decorative metadata once it enters team runtime.

This slice should:

- preserve canonical task reference from follow-up seed creation into assignment registration, delegated runtime execution, checkpoint binding, replay, and result surfaces
- keep `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint` as the task authority family
- add only the bridge seam needed for live execution, not a full migration into `ResearchLoopRuntime`

It should not rewrite team runtime into research-loop, merge checkpoint authorities, or widen public payloads.

## Why This Slice

The canonical task substrate already exists, but the live execution path still degrades it:

- `packages/orchestrator/src/research-loop/runtime.ts`, `task-types.ts`, `event-types.ts`, and `checkpoint-types.ts` already own task/event/checkpoint authority
- `packages/orchestrator/src/computation/feedback-state.ts`, `followup-bridges.ts`, and `feedback-followups.ts` already create follow-up tasks, handoffs, and team-execution metadata
- once execution enters team runtime, most downstream logic carries only `task_id` / `task_kind` strings plus assignment/session metadata
- team view `task_status` / `task_lifecycle_status` are currently assignment projections, not canonical `ResearchTask.status`

This slice is therefore about adding a typed bridge seam, not about inventing a second task substrate.

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/plans/2026-04-07-control-plane-object-convergence-plan.md`
5. `meta/docs/2026-04-07-orchestrator-control-plane-object-map.md`
6. `packages/orchestrator/src/research-loop/runtime.ts`
7. `packages/orchestrator/src/research-loop/task-types.ts`
8. `packages/orchestrator/src/research-loop/event-types.ts`
9. `packages/orchestrator/src/research-loop/checkpoint-types.ts`
10. `packages/orchestrator/src/computation/feedback-state.ts`
11. `packages/orchestrator/src/computation/followup-bridges.ts`
12. `packages/orchestrator/src/computation/feedback-followups.ts`
13. `packages/orchestrator/src/team-execution-types.ts`
14. `packages/orchestrator/src/team-execution-scoping.ts`
15. `packages/orchestrator/src/team-execution-view.ts`
16. `packages/orchestrator/src/team-unified-runtime-support.ts`
17. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
18. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
19. `packages/orchestrator/tests/team-unified-runtime.test.ts`
20. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`

## Bounded Implementation

- add one typed internal bridge seam that carries canonical research-task reference through the live team/delegated execution path
  - it should be derived from the existing `ResearchTask` authority family rather than inventing a second task object
  - it should preserve the relation between task, handoff, target node, assignment, and delegated runtime identity
- update follow-up/task-to-team bridge code so delegated follow-up configuration carries that canonical task reference explicitly, not only `task_id` / `task_kind` strings
- update team execution state / result / replay/checkpoint binding surfaces so the same canonical task ref survives pause/resume/recovery
- keep team-local `task_status` / `task_lifecycle_status` as projections; do not silently upgrade them into canonical task authority
- if research-loop checkpoint and team checkpoint need to cross-reference, add explicit relation only
  - do not merge the two checkpoint families into one object

## Explicit No-Go

- no full migration of live execution onto `ResearchLoopRuntime`
- no workflow-level redesign
- no `EVO-13` / `EVO-14` reopen
- no transcript/session/assignment metadata promotion into new task authority
- no public payload widening
- no checkpoint-authority merge

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/compute-loop-writing-review-bridge.test.ts tests/team-unified-runtime.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `python3 - <<'PY'\nimport json\njson.load(open('meta/remediation_tracker_v1.json'))\nprint('tracker-json-ok')\nPY`

## Review Focus

- confirm canonical `ResearchTask` authority remains in research-loop, not team runtime
- confirm the bridge seam preserves task identity end-to-end across follow-up seed, assignment, runtime result, and recovery
- confirm team-local task projection fields remain projections, not second task authority
- confirm checkpoint families remain distinct while cross-references stay explicit
- confirm no public payload widening or workflow redesign was introduced

