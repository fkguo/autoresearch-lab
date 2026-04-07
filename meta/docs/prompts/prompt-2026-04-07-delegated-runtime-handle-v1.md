# Prompt: 2026-04-07 DelegatedRuntimeHandleV1 First Slice

## Why this lane exists now

Current runtime structural truth has already been narrowed by the checked-in deep dive in `meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md`:

`DelegatedRuntimeHandleV1 -> RuntimePermissionProfileV1 -> DelegatedRuntimeTransport`

The first slice must be `DelegatedRuntimeHandleV1`, not transport, because delegated runtime identity / lineage / artifact refs are still reconstructed in multiple places:

- `packages/orchestrator/src/execution-identity.ts`
- `packages/orchestrator/src/team-execution-scoping.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`

Without a canonical handle, transport would only wrap the current string/path glue, and permission profile would still lack a stable runtime carrier.

## Primary objective

Land a bounded first cut where:

1. delegated runtime identity, lineage, and artifact refs are carried through a single internal typed handle;
2. call sites stop re-deriving `runtime_run_id`, `manifest_path`, `spans_path`, and session lineage ad hoc;
3. the change stays entirely internal to orchestrator runtime/control-plane code;
4. no transcript/history/fleet/remote-session authority is promoted as part of this slice.

## Hard boundaries

1. Do not implement transport in this lane.
2. Do not widen into full permission-profile redesign; permission may only consume handle fields already needed by current code.
3. Do not introduce durable `job` / `turn` families or transcript-as-SSOT.
4. Do not widen into websocket / SSE / remote-session / fleet lease / scheduler semantics.
5. No backward-compat shims are required.

## Expected contract shape

The first cut should be close to:

```ts
interface DelegatedRuntimeHandleV1 {
  version: 1;
  identity: {
    project_run_id: string;
    assignment_id: string;
    session_id: string;
    runtime_run_id: string;
  };
  lineage: {
    task_id: string;
    checkpoint_id: string | null;
    parent_session_id: string | null;
    forked_from_assignment_id: string | null;
    forked_from_session_id: string | null;
  };
  artifacts: {
    manifest_path: string;
    spans_path: string;
    runtime_diagnostics_bridge_path: string;
  };
}
```

Field names may adapt to existing repo types, but the semantic content above must not be lost.

## Source-grounded touch surface

Implementation:

- `packages/orchestrator/src/execution-identity.ts`
- `packages/orchestrator/src/team-execution-scoping.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
- `packages/orchestrator/src/team-execution-runtime.ts`
- `packages/orchestrator/src/team-execution-runtime-types.ts`
- `packages/orchestrator/src/team-unified-runtime-types.ts`

Tests / supporting evidence:

- `packages/orchestrator/tests/team-unified-runtime.test.ts`
- `packages/orchestrator/tests/team-unified-runtime-sequential.test.ts`
- `packages/orchestrator/tests/team-unified-runtime-parallel-recovery.test.ts`
- `packages/orchestrator/tests/team-execution-runtime.test.ts`
- `packages/orchestrator/tests/team-execution-state.test.ts`
- `packages/orchestrator/tests/orchestrator.test.ts`
- `meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

## Recommended implementation sequence

1. Introduce `DelegatedRuntimeHandleV1` in the identity/runtime seam layer.
2. Make `openAssignmentSession(...)` or its nearest canonical producer construct the handle once.
3. Thread the handle through launch preparation / runtime execution / outcome merge code paths.
4. Replace duplicated path/id reconstruction with handle reads.
5. Add focused tests proving canonical runtime ids and artifact refs stay stable across sequential / recovery paths.
6. Update plan/tracker truth to mark handle as the next concrete structural implementation slice.

## Non-goals

- no public API / CLI / package front-door changes
- no remote transport abstraction yet
- no permission lattice redesign yet
- no new read-model or replay authority object

## Acceptance

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-parallel-recovery.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-runtime.test.ts tests/team-execution-state.test.ts tests/orchestrator.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`

If new targeted tests are added for the handle seam, include them explicitly in the acceptance record.

## Formal review packet requirements

Review packet must include at minimum:

- the new handle type definition
- canonical producer site
- all call-site wiring where path/id reconstruction was removed
- sequential + recovery tests
- `meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

1. whether the handle is truly canonical rather than another projection wrapper;
2. whether transport/session/fleet semantics leaked into the handle;
3. whether any path/id still gets silently recomputed outside the handle after the refactor.

## Self-review focus

Before closeout, self-review must confirm:

1. delegated runtime lineage is now sourced from one typed seam rather than reconstructed ad hoc;
2. runtime artifact refs come from the handle rather than scattered helpers;
3. the slice did not accidentally widen into permission-profile or transport work;
4. plan/tracker wording still preserves the structural order `Handle -> PermissionProfile -> Transport`.
