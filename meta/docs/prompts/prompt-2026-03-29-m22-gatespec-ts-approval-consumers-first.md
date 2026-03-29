# M-22 GateSpec TS Approval Consumers First

## Intent

This is the canonical implementation prompt for the next truthful `M-22` slice after the 2026-03-29 governance rebaseline.

The goal is **not** to “finish GateSpec rollout everywhere.” The goal is to land the smallest real non-test consumer adoption:

- shared `GateSpec` substrate remains the single generic authority source;
- first rollout slice is **TS approvals first**;
- only the `packages/shared` + `packages/orchestrator` approval/query/state-validation/read-model path is in scope;
- Python legacy approval mappings, research-team convergence adoption, and `research_workflow_v1` / workflow-template cleanup stay deferred.

## Read First

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `M-22` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/2026-03-29-approval-cluster-rebaseline.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. live substrate:
   - `meta/schemas/gate_spec_v1.schema.json`
   - `packages/shared/src/gate-registry.ts`
   - `packages/shared/src/__tests__/gate-registry.test.ts`
7. current TS approval duplicate-authority files:
   - `packages/orchestrator/src/state-manager.ts`
   - `packages/orchestrator/src/orch-tools/common.ts`
   - `packages/orchestrator/src/orch-tools/control.ts`
   - `packages/orchestrator/src/orch-tools/schemas.ts`
   - `packages/orchestrator/src/orch-tools/run-read-model.ts`
   - `packages/orchestrator/src/orch-tools/approval.ts`
   - adjacent approval tests in `packages/orchestrator/tests/**`
8. deferred-but-inspected adjacent authorities, so the batch does not overreach:
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
   - `skills/research-team/scripts/gates/convergence_schema.py`
   - `meta/schemas/research_workflow_v1.schema.json`

## GitNexus And Serena

- Activate Serena on the current implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed callers or authority map are not obvious from direct source inspection.

## Exact Scope

### In scope

- Make the TS orchestrator approval path live-read shared GateSpec authority for A1–A5.
- Centralize the A1–A5 gate-to-policy-key relationship so `packages/orchestrator` no longer carries hand-maintained duplicate approval authority across:
  - `state-manager.ts`
  - `orch-tools/common.ts`
  - `orch-tools/control.ts`
  - `orch-tools/schemas.ts`
  - `orch-tools/run-read-model.ts`
  - `orch-tools/approval.ts`
  - any adjacent approval/query/read-model helper that must consume the same truth
- Preserve all current public ids and wire shapes:
  - approval categories remain `A1`–`A5`
  - `approval_packet_v1` stays unchanged
  - `expected_approvals` stays unchanged
  - approval policy operation keys remain `mass_search`, `code_changes`, `compute_runs`, `paper_edits`, `final_conclusions`
  - approvals-list filtering behavior stays unchanged, including `A0`

### Out of scope

- Do not touch `packages/hep-autoresearch/**`
- Do not touch `skills/research-team/**`
- Do not touch `meta/schemas/research_workflow_v1.schema.json` or workflow templates
- Do not add `A0` to `GateSpec v1`
- Do not broaden this slice into generic approval/report CLI repointing
- Do not mark `M-22` done after this slice unless the real runtime authority evidence justifies it

## Required Design Constraints

1. Shared GateSpec stays the only new canonical source for A1–A5 approval ids and their approval-category semantics inside the TS orchestrator path.
2. `A0` remains compatibility-only for query/filter surfaces and must not appear as a registered GateSpec entry.
3. If GateSpec-derived helpers are added in `packages/shared`, they must remain provider-neutral and approval-first rather than reopening convergence/workflow abstractions in the same batch.
4. Do not silently invent new public enums, new approval ids, new policy keys, or a second fallback authority map.
5. If some TS surface still needs a compatibility adapter, it must be visibly derived from shared GateSpec truth rather than hand-maintained duplicate constants.

## Front-door Surface Audit

Because this slice touches public orchestrator approval surfaces, the review packet must include a front-door audit covering at least:

- `meta/REDESIGN_PLAN.md` (`M-22` section)
- `meta/remediation_tracker_v1.json` (`M-22` note)
- `packages/orchestrator/src/orch-tools/index.ts`
- `packages/orchestrator/src/orch-tools/schemas.ts`
- `packages/orchestrator/src/orch-tools/run-read-model.ts`
- `packages/orchestrator/src/orch-tools/approval.ts`
- relevant public orchestrator tests that lock approval tool/filter behavior

If live docs or locks still describe the old duplicate authority after implementation, either update them in-batch or explicitly justify why they are not part of the changed truth.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/shared test -- src/__tests__/gate-registry.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/orchestrator.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/compute-bridge.test.ts tests/compute-loop-execution.test.ts tests/execute-manifest-core.test.ts`
- `rg -n "A0|A1|A2|A3|A4|A5|mass_search|code_changes|compute_runs|paper_edits|final_conclusions|GateSpec|gate-registry" packages/orchestrator packages/shared/src meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json`

Implementation note from the governance lane:

- On the current governance worktree, `pnpm --filter @autoresearch/shared test -- src/__tests__/gate-registry.test.ts` was blocked because `node_modules` / `vitest` were missing.
- The implementation lane must rerun the shared test from a hydrated workspace and treat missing dependencies as an environment prerequisite, not as permission to skip the test.

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether the shared GateSpec authority actually replaced duplicated TS approval mappings.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- `packages/orchestrator` approval/query/state-validation/read-model surfaces now derive A1–A5 approval authority from shared GateSpec truth.
- `A0` remains compatibility-only outside `GateSpec v1`.
- Python legacy approval authority, convergence-gate adoption, and workflow-gate cleanup remain pending follow-up slices.

Anything broader than that needs fresh source evidence and should not be claimed by default.
