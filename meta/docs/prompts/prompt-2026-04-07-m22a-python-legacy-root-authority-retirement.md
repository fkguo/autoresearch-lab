# M-22A — Python Legacy Root Approval/Run Authority Retirement

This is the canonical implementation prompt for the next truthful `M-22` slice after `CP-OBJ-01E` and the checked-in remainder split:

- `meta/docs/plans/2026-04-07-m22-remainder-split-plan.md`
- `meta/docs/prompts/prompt-2026-03-29-m22-gatespec-ts-approval-consumers-first.md`
- `meta/docs/prompts/prompt-2026-03-31-m22-gatespec-research-team-convergence-first.md`

## Goal

Remove the remaining executable Python ownership of root run / approval lifecycle mutations, while keeping any still-useful `hep-autoresearch` / `hepar` surfaces explicitly provider-local or maintainer-local.

Truthful success for this slice means:

- canonical root lifecycle authority stays on `packages/orchestrator`
- retained Python surfaces stop acting like a second root orchestrator
- `hepar` / `hep-autoresearch` do not regain generic front-door authority
- `doctor` / `bridge` / other retained provider-local tools do not require restoring Python root lifecycle ownership

## Why This Slice Exists

Current source-grounded truth is already split:

- the generic canonical front door is `autoresearch`
- the TS orchestrator already owns root lifecycle semantics for `init/status/pause/resume/approve/export` and the bounded computation entrypoint `autoresearch run --workflow-id computation`
- the installable `hepar` public shell has already been narrowed away from public lifecycle/computation/`doctor`/`bridge`

But executable Python duplicate authority still survives on the internal/full entry chain:

- `packages/hep-autoresearch/bin/hep-autoresearch.js`
- `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
- `packages/hep-autoresearch/scripts/orchestrator.py`
- `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
- `packages/hep-autoresearch/src/hep_autoresearch/web/app.py`

That residue is higher-risk than `M-22B`, because it is still executable and still mutates root approval/run state directly.

## Required Reads

Read in this order before implementation:

1. `AGENTS.md`
2. `packages/hep-autoresearch/AGENTS.md`
3. `meta/remediation_tracker_v1.json`
4. the full `M-22` section in `meta/REDESIGN_PLAN.md`
5. `meta/docs/plans/2026-04-07-m22-remainder-split-plan.md`
6. generic canonical lifecycle authority:
   - `packages/orchestrator/src/cli.ts`
   - `packages/orchestrator/src/cli-help.ts`
   - `packages/orchestrator/src/cli-run.ts`
   - `packages/orchestrator/src/cli-lifecycle.ts`
   - `packages/orchestrator/src/orch-tools/approval.ts`
   - `packages/orchestrator/src/orch-tools/control.ts`
   - `packages/orchestrator/src/orch-tools/create-status-list.ts`
   - `packages/orchestrator/src/orch-tools/run-read-model.ts`
   - `packages/orchestrator/tests/autoresearch-cli.test.ts`
   - `packages/orchestrator/tests/orchestrator.test.ts`
7. Python legacy executable entry chain:
   - `packages/hep-autoresearch/bin/hep-autoresearch.js`
   - `packages/hep-autoresearch/src/hep_autoresearch/cli.py`
   - `packages/hep-autoresearch/scripts/orchestrator.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/web/app.py`
8. affected Python tests / regressions:
   - `packages/hep-autoresearch/tests/test_public_cli_surface.py`
   - `packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py`
   - `packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py`
   - `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py`
   - `packages/hep-autoresearch/tests/test_method_design_cli.py`
   - `packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py`
   - `packages/hep-autoresearch/tests/test_paper_reviser_workflow.py`
   - `packages/hep-autoresearch/tests/test_evolution_trigger.py`
9. current front-door / lifecycle docs that may need truth rebaseline:
   - `packages/hep-autoresearch/README.md`
   - `packages/hep-autoresearch/README.zh.md`
   - `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
   - `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md`
   - `packages/hep-autoresearch/docs/COMPUTATION.md`
   - `packages/hep-autoresearch/docs/COMPUTATION.zh.md`
   - `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
   - `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed entry chains or caller blast radius are not obvious from direct source inspection.

## Exact Scope

### In scope

- Cut or repoint Python surfaces that still own root approval/run lifecycle mutations:
  - `init`
  - `status`
  - `pause`
  - `resume`
  - `approve`
  - `request-approval`
  - `reject`
  - computation-root run-state mutation
  - direct web/UI mutation of `pending_approval`, `gate_satisfied`, `approval_history`, or root `run_status`
- Collapse executable entry chains so retained Python/provider-local surfaces no longer behave like a second root orchestrator.
- Repoint any still-needed provider-local commands so they run against TS-owned root state rather than re-implementing it in Python.
- Rebaseline tests/docs so canonical generic lifecycle truth and retained provider-local maintainer truth are explicit and non-contradictory.

### Explicitly in scope if required to remove duplicate authority

- narrowing or deleting Python computation execution paths that still write root lifecycle state directly
- removing or hard-failing the Python web approval surface if it cannot be converted into a thin adapter over canonical TS authority
- changing maintainer regression bootstrap from Python `init` / `approve` / computation-run authority to `autoresearch` where that is the real canonical root path

### Out of scope

- `M-22B` (`research_workflow_v1` / workflow-template residue cleanup)
- redesigning workflow recipes / workflow-plan
- inventing a new generic web UI
- widening `hepar` / `hep-autoresearch` back into generic authority
- broad provider-local feature deletion purely for aesthetics
- claiming all residual non-computation `run` workflows are retired unless the current code/tests truly justify that broader closeout

## Required Design Constraints

1. `packages/orchestrator` remains the only canonical root lifecycle authority.
2. Do not keep Python root state logic alive behind a wrapper or dual-write fallback.
3. Any retained Python surface must be either:
   - a thin adapter onto canonical TS authority, or
   - an explicitly provider-local / maintainer-local tool that does not mutate root lifecycle state directly.
4. `doctor` / `bridge` may stay provider-local, but they must not depend on restoring Python `init/status/pause/resume/approve/request-approval` as root truth.
5. Do not let the installable public shell re-expose retired lifecycle/computation authority.
6. Do not widen this slice into `M-22B`, `CP-OBJ-01`, `NEW-RT-09/10`, or a broader Python-package purge.

## Packet Assumptions To Re-Check

Reviewers and self-review must explicitly verify these are still true on the implementation worktree:

1. `autoresearch` is already the canonical generic lifecycle/computation front door.
2. The installable `hepar` public shell is already narrowed away from public lifecycle/computation/`doctor`/`bridge`.
3. The remaining problem is executable duplicate authority on the Python internal/provider-local path, not missing generic lifecycle functionality.
4. Provider-local `doctor` / `bridge` can remain valuable without owning root lifecycle state.

If current code/tests falsify any assumption, treat that as a packet assumption breach and update scope truth before claiming closeout.

## Front-door Surface Audit

Because this slice touches package/CLI/lifecycle truth, the review packet must include an explicit front-door audit covering at least:

- `README.md`
- `docs/README_zh.md`
- `docs/PROJECT_STATUS.md`
- `docs/QUICKSTART.md`
- `packages/hep-autoresearch/README.md`
- `packages/hep-autoresearch/README.zh.md`
- `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md`
- `packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md`
- `packages/hep-autoresearch/docs/COMPUTATION.md`
- `packages/hep-autoresearch/docs/COMPUTATION.zh.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md`
- `packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`
- `packages/orchestrator/src/cli-help.ts`
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`

If some live front-door surface remains unchanged, the packet must still say it was checked and why it is not affected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts tests/orchestrator.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py -q`
- `python3 -m pytest packages/hep-autoresearch/tests/test_method_design_cli.py packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py packages/hep-autoresearch/tests/test_paper_reviser_workflow.py packages/hep-autoresearch/tests/test_evolution_trigger.py -q`
- `rg -n "autoresearch init|autoresearch run --workflow-id computation|legacy Pipeline A|provider-local|doctor|bridge|hepar run" packages/hep-autoresearch/README.md packages/hep-autoresearch/README.zh.md packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.md packages/hep-autoresearch/docs/BEGINNER_TUTORIAL.zh.md packages/hep-autoresearch/docs/COMPUTATION.md packages/hep-autoresearch/docs/COMPUTATION.zh.md packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.md packages/hep-autoresearch/docs/ORCHESTRATOR_INTERACTION.zh.md`

Implementation note:

- If the lane touches additional `packages/hep-autoresearch/tests/*.py` callsites that still bootstrap through Python root lifecycle authority, widen the pytest set accordingly instead of claiming “lane-external” by default.

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Reviewers must explicitly answer:

1. Is there any checked-in executable caller that still uses Python as root lifecycle authority?
2. Are retained Python surfaces truly adapter/provider-local, or do they still mutate canonical root state?
3. Did any docs/tests keep implying that `hepar` or `hep-autoresearch` is the current lifecycle/computation front door?
4. Did the batch accidentally re-open broader workflow/template or CP-OBJ/runtime work?

Additional review handling:

- Prefer one `OpenCode workspace` discovery pass first, because hidden callsites/docs drift are plausible here.
- If `Gemini(auto)` or `OpenCode` fail to produce a usable source-grounded verdict, prefer same-model embedded-source reruns rather than shrinking to diff-only review.
- Self-review is mandatory after trio convergence.

## Expected Truthful Closeout Claim

If the batch succeeds, the narrow truthful claim is:

- Python legacy surfaces no longer own root approval/run lifecycle mutations.
- Canonical root lifecycle/computation authority stays on `autoresearch` / `packages/orchestrator`.
- Any retained `hep-autoresearch` / `hepar` commands are explicitly provider-local or maintainer-local adapters, not a second root orchestrator.
- `M-22B` remains the next cleanup slice after this one.

Anything broader than that requires fresh source evidence and should not be claimed by default.
