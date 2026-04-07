# Prompt: Seam C / Slice A1 - Remove persisted pending approvals

## 0. Context & Objective
- This lane comes directly from `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md`: the next Batch Queue must deliver one concrete projection-only fix under Seam C before moving to other authority work, and `Slice A1` is chosen to take `TeamExecutionState.pending_approvals` out of the persisted authority model.
- Right now the pending-approval list is stored inside `TeamExecutionState` (and cloned, normalized, and replayed), meditated via `syncPendingApprovals`, and used both to gate `approve` interventions and to populate `live_status.pending_approvals`. The goal is to keep `approve` grounded in the canonical per-assignment approval metadata (`approval_id`, `approval_packet_path`, `approval_requested_at`) and render `live_status.pending_approvals` as a derived view over assignments rather than an authority-level projection.
- Deliver a checked-in prompt that specifies what files to touch, the intended boundary, a safe edit sequence, the acceptance commands, and how reviewers/self-reviewers should validate the change.

## 1. Authority Boundary

### 1.1 Canonical approval authority
1. The single source of approval truth is the metadata carried by each `TeamDelegateAssignment`: `approval_id`, `approval_packet_path`, `approval_requested_at`, `delegate_id`, and the assignment status transitions managed in `team-execution-interventions.ts`.
2. Approval ownership must continue to be derived from `assignment.delegate_id` + the per-assignment approval metadata; no new persisted projection list, queue, or summary should own that lifecycle.
3. `TeamExecutionState.pending_approvals` and every call that mutates or reads it must be removed so nothing outside the delegate assignment can claim write-access to delegated approval ownership.

### 1.2 Projection-only surfaces
1. `TeamExecutionView.buildTeamLiveStatusView` (and any caller) is allowed to map assignments that are `awaiting_approval` into a `TeamPendingApprovalView`, but only as a derived projection—the view should never be considered the mutating authority.
2. `team-unified-runtime.ts` should continue to expose `live_status.pending_approvals` (and related tests) but they must be built from a helper that scans assignments or sessions rather than from persisted state.
3. Any persisted projection or clone path (e.g., `team-execution-clone.ts`, `team-execution-state.ts` tests, `hep-mcp` contracts) must no longer carry `pending_approvals` in its payload.

## 2. Implementation Scope
1. Remove `pending_approvals` from `TeamExecutionState` and avoid serializing it anywhere (`team-execution-types.ts`, `team-execution-clone.ts`, `team-execution-state.ts` tests, other clones/seeders).
2. Keep `TeamPendingApproval` / `TeamPendingApprovalView` types if they are needed for the view but build them on-the-fly by reusing `pendingApprovalFromAssignment` (or a new helper that mirrors its logic without mutating state).
3. Replace the `syncPendingApprovals` calls inside `team-execution-interventions.ts` / `team-execution-scoping.ts` with the new derived helper so no mutation persists the list.
4. Update `approve` intervention validation to rely solely on assignment metadata; the previous lookup via `state.pending_approvals` should be replaced with a check that the metadata matches the targeted assignment/delegate and that the assignment is still `awaiting_approval`.
5. Adjust `team-execution-view.ts` so `live_status.pending_approvals` is computed from assignments and sessions, and any `TeamPendingApprovalView` w/ `runtime_run_id` or `packet_path` is filled by reading assignment fields (maybe using `pendingApprovalFromAssignment`).
6. Align runtime tests (`team-unified-runtime.*`, `team-execution-state.*`) with the derived view so they stop expecting `state.pending_approvals` to exist; add new expectations that `live_status.pending_approvals` still reflects assignments in `awaiting_approval` status.
7. Update host/cli contracts (`hep-mcp/tests/contracts/orchRunExecuteAgent.team*.test.ts`) to align with the new boundary: requests that once inspected `team_state.pending_approvals` now need to compute the derived list from assignments, and responses should match the canonical assignment metadata.

## 3. Non-goals
- Do not repoint `approve` intervention to a new authority family (e.g., a separate approval backlog or queue); it should remain assignment-centric.
- Do not reintroduce `TeamExecutionState.pending_approvals` under a different name or persist any projection of approvals anywhere other than the derived live view.
- Do not expand the `TeamPendingApprovalView` payload beyond what `pendingApprovalFromAssignment` already exposes in order to prevent creeping authority expansion.
- Do not change any public signature that is unrelated to the projection boundary (e.g., no new runtime API fields beyond the derived `live_status.pending_approvals`).

## 4. Required Source Surfaces
- `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md` (Seam C / Slice A1 context and acceptance targets).
- `meta/REDESIGN_PLAN.md` (cross-check the Seam C narrative and ensure tracker alignment).
- `packages/orchestrator/src/team-execution-types.ts` (remove the persisted field declaration).
- `packages/orchestrator/src/team-execution-clone.ts` (stop copying `pending_approvals`).
- `packages/orchestrator/src/team-execution-state.ts` (any normalization helpers/key assertions referencing `pending_approvals`).
- `packages/orchestrator/src/team-execution-scoping.ts` (the original `syncPendingApprovals` + `pendingApprovalFromAssignment`).
- `packages/orchestrator/src/team-execution-interventions.ts` (approve intervention validation and `sync` calls).
- `packages/orchestrator/src/team-execution-view.ts` (view builder for `live_status.pending_approvals`).
- `packages/orchestrator/src/team-unified-runtime.ts` (entrypoints that expose the live status + tests calling them).
- `packages/orchestrator/tests/team-unified-runtime.test.ts`, `team-unified-runtime-sequential.*`, `team-unified-runtime-parallel-recovery.test.ts`, `team-execution-state.test.ts` (verify the view and state behavior).
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts` and `team-view.test.ts` (host contract surfaces that observe `pending_approvals`).

## 5. Suggested Edit Sequence
1. Delete the persisted `pending_approvals` property from `TeamExecutionState`, remove it from clone/state helpers, and update any fixtures/tests that seed it (e.g., `team-execution-bootstrap.ts`, `team-execution-state.test.ts`).
2. Refactor `syncPendingApprovals` / `pendingApprovalFromAssignment` so they live in the view layer (or become a helper that takes assignments + runId and returns the derived list) and ensure no caller writes into `state.pending_approvals`.
3. Harden `team-execution-interventions.ts`: validate `approve` interventions against assignment metadata, drop the lookup against `state.pending_approvals`, and remove the final `syncPendingApprovals` call once the view helper exists elsewhere.
4. Update `team-execution-view.ts` to compute `live_status.pending_approvals` via the new helper, making sure it still covers assignments whose `delegate_id` and `approval` fields match the derived view contract.
5. Adjust `team-unified-runtime.ts` and the related tests so they assert the derived view; add new cases if needed to prove `live_status.pending_approvals` is computed, not persisted.
6. Refresh `hep-mcp` contract tests (team + team-view) so they no longer expect the `pending_approvals` array as part of persisted state but instead observe the derived view.

## 6. Acceptance
1. `git diff --check`.
2. `pnpm --filter @autoresearch/orchestrator test -- tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-execution-state.test.ts`.
3. `pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-runtime.test.ts tests/orchestrator.test.ts` (orchestrator smoke to catch regressions within runtime entrypoints).
4. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts`.
5. Any new helper/tests you add to prove the projection guard must be part of the above orchestrator/hep-mcp command suites.

## 7. Formal Review Packet
1. `team-execution-types.ts` + `team-execution-clone.ts` + `team-execution-state.ts` (no persisted `pending_approvals`).
2. `team-execution-scoping.ts` + the new helper that replaces `syncPendingApprovals`.
3. `team-execution-interventions.ts` (especially the `approve` validation path).
4. `team-execution-view.ts` + `team-unified-runtime.ts` (rise-level view construction).
5. All touched orchestrator tests that reference `pending_approvals`.
6. `hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts` and `...team-view.test.ts`.
7. `meta/REDESIGN_PLAN.md` / `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md` snippets relevant to Seam C / Slice A1.

Formal review must answer:
1. Where does approval ownership live now? Confirm `TeamDelegateAssignment` metadata alone carries it.
2. Is there any persisted state or clone path still exposing `pending_approvals` as a mutable list?
3. Does `live_status.pending_approvals` continue to present the derived context expected by clients (without persisting it)?
4. Have the orchestrator/hep-mcp tests been updated to reflect the new projection-only guard?

## 8. Self-review Checklist
1. No compile-time type still references `TeamExecutionState.pending_approvals`.
2. `pendingApprovalFromAssignment` (or equivalent helper) has clear boundaries: takes assignments + runId and returns derived entries without mutating state.
3. `approve` intervention now checks `assignment.approval_*` + `delegate_id` and does not rely on any persisted `pending_approvals` collection.
4. `live_status.pending_approvals` is recomputed on each view build and matches assignments in `awaiting_approval`.
5. Tests/invariants cover both runtime exposures and host contract surfaces so the projection guard is regression-covered.

## 9. Completion Definition
1. All acceptance commands green.
2. Formal trio review package (Opus / Gemini(auto) / OpenCode) reports `blocking_issues = []` with no semantic drift.
3. Self-review sign-off with no blocking observations.
4. `meta/REDESIGN_PLAN.md` + `meta/remediation_tracker_v1.json` + `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md` updated if needed to note the completion of `Seam C / Slice A1`.
