# M-22 GateSpec Research-Team Convergence First

> **Status (2026-04-02)**: Landed on `main` as the bounded `research-team` convergence gate consumer adoption (`d7daa1e`). This prompt is retained as the slice audit trail; for post-landing SSOT truth sync, see `meta/docs/prompts/prompt-2026-04-05-m22-gatespec-closeout-sync-after-research-team-convergence.md`.

## Intent

This is the canonical implementation prompt for the next truthful `M-22` rollout slice after:

- the 2026-03-29 governance rebaseline; and
- the already-landed TS approval consumer-first slice.

The goal is **not** to finish every remaining `M-22` consumer. The goal is to land the smallest real runtime consumer adoption on the Python/skill side:

- shared `GateSpec` remains the single generic authority source;
- the bounded consumer is the `research-team` convergence gate path;
- local convergence gate metadata should stop hand-owning the authoritative gate ids / `schema_id` / `schema_version`;
- Python legacy approval mappings and `research_workflow_v1` cleanup remain deferred.

## Read First

Implementation lane must read, in order:

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `M-22` section in `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. prior bounded rollout prompt for context only:
   - `meta/docs/prompts/prompt-2026-03-29-m22-gatespec-ts-approval-consumers-first.md`
6. live shared authority (SSOT + shared substrate):
   - `meta/schemas/gate_spec_v1.schema.json`
   - `meta/schemas/convergence_gate_result_v1.schema.json`  *(SSOT for `schema_id`/`schema_version` + allowed `gate_id` values)*
   - `packages/shared/src/gate-registry.ts`
   - `packages/shared/src/__tests__/gate-registry.test.ts`
7. generated contract artifacts (informational-only; do **not** introduce a runtime dependency on them for this slice):
   - `meta/generated/python/gate_spec_v1.py`
   - `meta/generated/python/convergence_gate_result_v1.py`
8. current local duplicate-authority path:
   - `skills/research-team/scripts/gates/convergence_schema.py`
   - `skills/research-team/scripts/gates/check_team_convergence.py`
   - `skills/research-team/scripts/gates/check_draft_convergence.py`
9. adjacent validation / front-door surfaces:
   - `skills/research-team/SKILL.md`
   - `skills/research-team/README.md`
   - `skills/research-team/tests/test_convergence_gate.py`
   - `skills/research-team/tests/test_convergence_gate_json.py`
   - `skills/research-team/FULL_VALIDATION_CONTRACT.md`
   - `skills/research-team/RUNBOOK.md`
   - `skills/research-team/P1_GATE_DOC_ALIGNMENT.md`
   - `skills/research-team/scripts/validation/run_full_contract_validation.sh`
10. deferred-but-inspected adjacent authorities, so the batch does not overreach:
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py`
   - `packages/hep-autoresearch/src/hep_autoresearch/toolkit/computation.py`
   - `meta/schemas/research_workflow_v1.schema.json`

## GitNexus And Serena

- Activate Serena on the current implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is dirty or contains new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed callers or authority map are not obvious from direct source inspection.

## Exact Scope

### In scope

- Make the `research-team` convergence gate path visibly derive its authoritative gate ids and `schema_id`/`schema_version` from existing shared `M-22` authority (SSOT: `meta/schemas/convergence_gate_result_v1.schema.json`) rather than hand-maintained local constants.
- Narrow or remove duplicated local authority in:
  - `skills/research-team/scripts/gates/convergence_schema.py`
- Update only the directly affected runtime callers:
  - `skills/research-team/scripts/gates/check_team_convergence.py`
  - `skills/research-team/scripts/gates/check_draft_convergence.py`
- Update only the directly affected tests/docs/validation locks when they still reflect the old local-authority story:
  - `skills/research-team/tests/test_convergence_gate.py`
  - `skills/research-team/tests/test_convergence_gate_json.py`
  - front-door docs that explicitly describe the convergence gate contract
- If the closeout truth changes, sync:
  - `meta/REDESIGN_PLAN.md`
  - `meta/remediation_tracker_v1.json`

### Out of scope

- Do not reopen the TS orchestrator approval rollout that already landed.
- Do not touch Python legacy approval mappings in `packages/hep-autoresearch/**`.
- Do not touch `meta/schemas/research_workflow_v1.schema.json` or workflow templates.
- Do not change the shared schema or registry semantics (`meta/schemas/convergence_gate_result_v1.schema.json`, `packages/shared/src/gate-registry.ts`) unless a source-grounded bug requires it; this slice is consumer adoption only.
- Do not redesign convergence semantics, parsing heuristics, workflow modes, or the broader `research-team` runtime.
- Do not broaden into repo-wide skill cleanup or `NEW-R08`.
- Do not claim `M-22` is done after this slice unless the real runtime authority evidence justifies it.

## Required Design Constraints

1. Shared/generated authority stays primary; this lane must remove duplicate local gate metadata rather than create a third authority helper that re-hardcodes the same values elsewhere.
2. This is a consumer-adoption lane, not a schema-creation lane.
3. Prefer the smallest robust Python-side adapter over broad import churn.
4. Do not change pass/fail convergence behavior unless the change is strictly required to align authority.
5. Prefer reading the SSOT JSON Schema (`meta/schemas/convergence_gate_result_v1.schema.json`) via stdlib `json` for authority derivation; do not introduce a new runtime dependency on `meta/generated/python/**` (e.g. via `pydantic`) just to fetch constants.
6. Keep the implementation bounded to convergence-gate validation and its directly affected tests/docs.
7. If the shared schema cannot be located (install/mount mismatch), fail **closed** with an explicit, actionable error message; do not silently fall back to re-hardcoded local gate ids or schema id/version.
8. If a compatibility path is proposed anyway, it must be justified in the prompt/update packet under the fallback-discipline questions from `IMPLEMENTATION_PROMPT_CHECKLIST.md` (failure mode, why not fix main path, authority impact, and acceptance coverage).

## Packet Assumptions (must be re-verified)

- This slice assumes the `research-team` skill is executed from a worktree where `meta/schemas/` is present (e.g. skill installed via symlink into this repo). Copying only `skills/research-team/**` without `meta/**` is treated as an invalid install for this rollout slice and must fail-closed.
- `convergence_gate_result_v1` identifiers remain stable in the shared schema; the lane is changing consumer derivation, not renaming schema ids or gate ids.

## Front-door Surface Audit

Because this slice touches a public skill validation/gate surface, the review packet must include a front-door audit covering at least:

- `meta/REDESIGN_PLAN.md` (`M-22` section)
- `meta/remediation_tracker_v1.json` (`M-22` note)
- `skills/research-team/SKILL.md`
- `skills/research-team/README.md`
- `skills/research-team/FULL_VALIDATION_CONTRACT.md`
- `skills/research-team/RUNBOOK.md`
- `skills/research-team/P1_GATE_DOC_ALIGNMENT.md`
- `skills/research-team/scripts/validation/run_full_contract_validation.sh`
- `skills/research-team/tests/test_convergence_gate.py`
- `skills/research-team/tests/test_convergence_gate_json.py`

If live docs or locks still describe the old local authority after implementation, either update them in-batch or explicitly justify why they are not part of the changed truth.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `python3 -m pytest skills/research-team/tests/test_convergence_gate.py`
- `python3 -m pytest skills/research-team/tests/test_convergence_gate_json.py`
- `bash skills/research-team/scripts/validation/run_full_contract_validation.sh`
- `rg -n "GATE_ID_VALUES|SCHEMA_ID|SCHEMA_VERSION|team_convergence|draft_convergence|convergence_gate_result_v1" skills/research-team/scripts/gates skills/research-team/tests skills/research-team/SKILL.md skills/research-team/README.md meta/schemas/convergence_gate_result_v1.schema.json meta/generated/python packages/shared/src/gate-registry.ts meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json`

If the full contract validation is blocked by lane-local environment issues, the lane must still:

- record the exact blocker;
- prove the two targeted convergence test files pass; and
- provide source proof that local hardcoded gate/schema authority was actually removed or reduced in favor of shared-derived truth.

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Seat note:
- `Gemini(auto)` is a reviewer seat name; when invoked via CLI runners it maps to the Gemini model selector `auto` (older artifacts may still record `Gemini-3.1-Pro-Preview` as the historical alias).

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether the `research-team` convergence path truly derives from shared authority now (and does not reintroduce a third local constant map or a hidden runtime dependency on `meta/generated/python/**`).
- Reviewers must explicitly check that the lane stayed bounded and did not silently reopen workflow-gate or legacy-approval cleanup.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- `research-team` convergence gate validation no longer hand-owns the authoritative gate ids / `schema_id` / `schema_version` in local constants.
- The live convergence gate path visibly derives from shared/generated `M-22` authority.
- TS approval rollout remains landed, while Python legacy approval mappings and `research_workflow_v1` cleanup remain pending follow-up slices.

Anything broader than that needs fresh source evidence and should not be claimed by default.
