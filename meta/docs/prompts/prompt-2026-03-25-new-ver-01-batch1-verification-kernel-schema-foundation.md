# NEW-VER-01 Batch 1 — Verification Kernel Schema Foundation

## Goal

Create the checked-in provider-neutral, typed, artifact-backed verification contract foundation for `NEW-VER-01`. This batch defines schema authority for verification across compute -> writing -> review -> revision and locks the future lane boundary without starting producer wiring or heuristic deletion.

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `.serena/memories/architecture-decisions.md`
5. `/Users/fkg/.autoresearch-lab-dev/SOTA-preflight/2026-03-25/gpd-get-physics-done/verification-kernel-design.md`
6. `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-25/gpd-get-physics-done/deep-source-analysis.md`
7. `packages/orchestrator/src/computation/result.ts`
8. `packages/orchestrator/src/computation/followup-bridges.ts`
9. `packages/hep-mcp/src/core/writing/evidence.ts`
10. `packages/hep-mcp/src/tools/research/physicsValidator.ts`
11. `packages/hep-mcp/src/tools/research/index.ts`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. If the worktree is dirty, run `npx gitnexus analyze --force`; otherwise run at least `npx gitnexus analyze`.
3. Before formal review, rerun `npx gitnexus analyze --force` if schema exports, generated bindings, or adjacent shared call paths changed, then collect `detect_changes` evidence for the touched authority surfaces.

## Source-Grounded Context

- `packages/orchestrator/src/computation/result.ts` already persists canonical `computation_result_v1`.
- `packages/orchestrator/src/computation/followup-bridges.ts` already emits deterministic writing/review bridge artifacts.
- `packages/hep-mcp/src/core/writing/evidence.ts` currently treats bridge artifacts only as metadata/status inputs.
- `packages/hep-mcp/src/tools/research/physicsValidator.ts` is still a heuristic text-pattern validator and remains re-exported from `packages/hep-mcp/src/tools/research/index.ts`.

Batch 1 exists because the repo has compute -> writing/review substrate but still lacks a first-class provider-neutral verification artifact family.

## Fixed Batch Order

1. Batch 1: schema foundation
2. Batch 2: minimal producer + pass-through wiring
3. Batch 3: heuristic deletion

Do not merge or reorder these batches without a checked-in governance update.

## Batch 1 Owned Files / Surfaces

- `meta/schemas/verification_subject_v1.schema.json`
- `meta/schemas/verification_check_run_v1.schema.json`
- `meta/schemas/verification_subject_verdict_v1.schema.json`
- `meta/schemas/verification_coverage_v1.schema.json`
- Generated TS/Python bindings produced from those schemas
- The narrow shared export/codegen surface required to expose those bindings cleanly
- `meta/remediation_tracker_v1.json` / `meta/REDESIGN_PLAN.md` only if schema names, scope, or batch boundaries change during implementation

## Contract Targets

Batch 1 should define a provider-neutral verification artifact family with explicit typed contracts for:

- `verification_subject_v1`
  - stable verification target identity
  - subject kinds such as `claim`, `result`, `deliverable`, `acceptance_test`, `reference_action`, `forbidden_proxy`, `comparison_target`
  - source refs back to existing artifacts and linked domain IDs
- `verification_check_run_v1`
  - one executed check on one subject
  - real evidence refs, executor provenance, inputs, outputs, status, and confidence
- `verification_subject_verdict_v1`
  - aggregated subject-level verdict
  - explicit `missing_decisive_checks`
- `verification_coverage_v1`
  - run-level coverage summary over subjects and missing decisive checks

The schema design must stay provider-neutral and artifact-backed. It must not embed HEP-only taxonomy as generic authority.

## Explicit No-Go

- No runtime / scheduler / project-state redesign
- No second project-state SSOT
- No edits to `packages/orchestrator/src/computation/result.ts`, `packages/orchestrator/src/computation/followup-bridges.ts`, or `packages/hep-mcp/src/core/writing/evidence.ts` beyond the minimal compile-time/export surface strictly required by codegen
- No producer wiring in Batch 1
- No deletion, renaming, soft-deprecation wrapper, or fallback preservation for `physicsValidator` in Batch 1; Batch 3 owns deletion
- No reopen of `EVO-02`, `EVO-03`, `EVO-13`, `EVO-14`, or `EVO-15`
- No prompt-only checklist standing in for typed artifact authority

## Acceptance

- `git diff --check`
- `bash meta/scripts/codegen.sh`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/shared test`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "verification_subject_v1|verification_check_run_v1|verification_subject_verdict_v1|verification_coverage_v1" meta/schemas meta/generated packages/shared/src/generated`

## Review Focus

- Are the new verification artifacts genuinely provider-neutral, typed, and artifact-backed?
- Does Batch 1 stay bounded to schema authority rather than drifting into producer wiring or runtime redesign?
- Do the schemas align with the existing `computation_result_v1` / followup-bridge / writing-evidence substrate without inventing a second project-state authority?
- Is `physicsValidator` treated only as future deletion residue rather than a protected fallback?
- Are missing decisive checks explicit and machine-visible rather than hidden in free-text commentary?

## Closeout Requirements

1. Formal three-reviewer review: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`
2. Formal self-review after reviewer convergence
3. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, and `.serena/memories/architecture-decisions.md` to the final schema facts
4. Update `AGENTS.md` current-progress summary only if phase counts change
