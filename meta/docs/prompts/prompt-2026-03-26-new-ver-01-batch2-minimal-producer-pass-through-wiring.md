# NEW-VER-01 Batch 2 — Minimal Producer + Pass-Through Wiring

## Goal

Implement the first live verification-kernel wiring slice without reopening runtime architecture. Batch 2 must prove that the new provider-neutral verification artifacts can be emitted on the computation-result path, passed through the deterministic writing/review bridges, and surfaced by writing-evidence metadata without inventing a second authority or preserving `physicsValidator` as fallback.

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `.serena/memories/architecture-decisions.md`
5. `/Users/fkg/.autoresearch-lab-dev/SOTA-preflight/2026-03-25/gpd-get-physics-done/verification-kernel-design.md`
6. `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-25/gpd-get-physics-done/deep-source-analysis.md`
7. `packages/orchestrator/src/computation/result.ts`
8. `packages/orchestrator/src/computation/followup-bridges.ts`
9. `packages/orchestrator/src/computation/followup-bridge-review.ts`
10. `packages/hep-mcp/src/core/writing/evidence.ts`
11. `packages/hep-mcp/src/tools/research/physicsValidator.ts`
12. `packages/hep-mcp/src/tools/research/index.ts`
13. `packages/orchestrator/tests/compute-loop-feedback.test.ts`
14. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
15. `packages/hep-mcp/tests/core/writingEvidence.test.ts`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. If the implementation worktree is dirty, run `npx gitnexus analyze --force`; otherwise run at least `npx gitnexus analyze`.
3. Before formal review, rerun `npx gitnexus analyze --force` if the computation-result path, bridge path, or writing-evidence consumer path changed, then collect `detect_changes` evidence for those touched authority surfaces.

## Source-Grounded Context

- `writeComputationResultArtifact()` in `packages/orchestrator/src/computation/result.ts` is the existing canonical computation-result producer.
- `planComputationFollowupBridges()` in `packages/orchestrator/src/computation/followup-bridges.ts` and `buildReviewFollowup()` in `packages/orchestrator/src/computation/followup-bridge-review.ts` already own the deterministic writing/review bridge payloads.
- `buildRunWritingEvidence()` in `packages/hep-mcp/src/core/writing/evidence.ts` currently reads bridge artifacts only as metadata/status inputs and writes `writing_evidence_meta_v1.json`.
- `physicsValidator.ts` is still a heuristic text-pattern validator with a direct re-export surface from `packages/hep-mcp/src/tools/research/index.ts`; Batch 3 owns deletion, not Batch 2.

Batch 2 does not need an extra planning split. The repo already has one canonical upstream seam (`writeComputationResultArtifact`) and one bounded downstream consumer (`buildRunWritingEvidence`), while bridge writers are pure pass-through surfaces.

## Fixed Batch Order

1. Batch 1: schema foundation
2. Batch 2: minimal producer + pass-through wiring
3. Batch 3: heuristic deletion

Do not merge, reorder, or split these batches without a checked-in governance update.

## Batch 2 Owned Files / Surfaces

- `packages/orchestrator/src/computation/result.ts`
- `packages/orchestrator/src/computation/followup-bridges.ts`
- `packages/orchestrator/src/computation/followup-bridge-review.ts`
- `packages/hep-mcp/src/core/writing/evidence.ts`
- Adjacent tests required to prove emission, bridge pass-through, and writing-evidence metadata surfacing

`packages/shared`, schema/codegen authority, scheduler/runtime/project-state surfaces, and `physicsValidator` deletion stay out of scope for Batch 2.

## Locked Batch 2 Truth

### Sole Producer

- The only Batch 2 producer is `writeComputationResultArtifact()` in `packages/orchestrator/src/computation/result.ts`.
- Do not generalize Batch 2 to "all providers", `hep-calc`, broader derivation surfaces, or a new verification runtime.

### First Emitted Artifact Set

Emit exactly these three provider-neutral verification artifacts:

- `verification_subject_computation_result_v1.json`
- `verification_subject_verdict_computation_result_v1.json`
- `verification_coverage_v1.json`

Do not emit `verification_check_run_v1` in Batch 2. There is no non-heuristic executed-check producer in the current source tree that can truthfully back a check-run artifact yet.

### Subject / Verdict Rules

- Emit a single provider-neutral verification subject with `subject_kind = "result"`.
- Anchor that subject to existing computation authority only:
  - `manifest_ref`
  - `produced_artifact_refs`
  - the stored `computation_result_v1` artifact itself
- Do not invent a second project-state object, prompt-only checklist record, or provider-local surrogate.
- Verdict behavior is fixed:
  - `execution_status = "completed"` -> subject verdict `status = "not_attempted"` with one `missing_decisive_checks` entry using `check_kind = "decisive_verification_pending"`
  - `execution_status = "failed"` -> subject verdict `status = "blocked"` with the same `check_kind` and a reason tied to execution failure
  - `check_run_refs` stays empty in Batch 2
- Coverage behavior is fixed:
  - summarize exactly one subject
  - mirror the verdict status in the coverage summary counts
  - carry the same missing decisive check entry into `verification_coverage_v1`

### Pass-Through Surfaces

- `computation_result_v1.json` must populate `verification_refs` with refs to the three emitted artifacts.
- Because `BridgeAuthorityInput` in `packages/orchestrator/src/computation/followup-bridges.ts` currently selects only `run_id`, `objective_title`, `summary`, `manifest_ref`, `produced_artifact_refs`, and `feedback_lowering`, Batch 2 must explicitly widen that input shape to carry `verification_refs` from `ComputationResultV1` into bridge construction.
- Note: the current bridge producers do not populate `verification_refs` today. Batch 2 must add that field to bridge payload construction; this is new wiring, not a no-op copy.
- `packages/orchestrator/src/computation/followup-bridges.ts` must copy the same `verification_refs` container unchanged into `writing_followup_bridge_v1.json`.
- `packages/orchestrator/src/computation/followup-bridge-review.ts` must copy the same `verification_refs` container unchanged into `review_followup_bridge_v1.json` when that bridge exists.
- Bridge payloads remain pass-through only. They must not derive new verification verdicts, mutate missing-check semantics, or become a second verification authority.

### First Consumer

- The first and only Batch 2 consumer is `buildRunWritingEvidence()` in `packages/hep-mcp/src/core/writing/evidence.ts`.
- The consumer receives bridge artifacts only through `bridge_artifact_names` and reads them through `readBridgeArtifact()`; Batch 2 should extend that existing read path rather than inventing a parallel verification-loading surface.
- It must read bridge-carried `verification_refs` and write a structured `verification` section into `writing_evidence_meta_v1.json`.
- The writing consumer must stay narrow:
  - record the passed-through ref lists
  - resolve and summarize subject-verdict / coverage status into metadata
  - do not add verification artifacts to LaTeX catalogs, PDF catalogs, embeddings, enrichment, or paragraph-level evidence items
  - do not create new writing-side verification artifact families
  - do not widen the tool response summary unless an existing test requires it

## Explicit No-Go

- No `packages/shared` schema or codegen work
- No `deriveNextIdeaLoopState()` or `feedback_lowering` redesign
- No scheduler, runtime, project-state, or approval redesign
- No additional verification families beyond the three locked Batch 2 artifacts
- No broader evidence redesign
- No `writing_evidence_source_status.json`, `evidenceSemantic`, `exportProject`, `research-writer`, `paper-reviser`, or `referee-review` expansion in Batch 2
- No prompt-only checklist substitute for typed artifact paths
- No `physicsValidator` fallback, wrapper, rename, partial keep-alive, or "temporary guardrail" semantics

## Batch 2 Acceptance

- `git diff --check`
- `pnpm --filter @autoresearch/shared exec vitest run src/__tests__/verification-kernel-contracts.test.ts`
- `pnpm --filter @autoresearch/orchestrator exec vitest run tests/compute-loop-feedback.test.ts tests/compute-loop-writing-review-bridge.test.ts`
- `pnpm --filter @autoresearch/hep-mcp exec vitest run tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/hep-mcp exec vitest run tests/physicsValidator.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp build`

## Review Focus

- Is the producer only the computation-result path?
- Is the first consumer only writing-evidence metadata?
- Do bridges remain pass-through rather than new verification authority?
- Is `verification_check_run_v1` correctly omitted from Batch 2?
- Does the writing consumer surface typed verification state without fabricating evidence items?
- Is `physicsValidator` still treated purely as future deletion residue?
- Does Batch 1 -> Batch 2 -> Batch 3 ordering remain intact?

## Batch 3 Preconditions

Batch 3 may delete `physicsValidator` only after Batch 2 proves all of the following on real code/tests:

- typed verification subject / verdict / coverage artifacts are emitted on the computation-result path
- writing and review bridge artifacts preserve those refs unchanged
- `writing_evidence_meta_v1.json` exposes the passed-through verification state without fabricating evidence items
- regression tests cover computation-result emission, bridge pass-through, and bridge-only writing-evidence consumption

Batch 3 deletion scope must explicitly include:

- `packages/hep-mcp/src/tools/research/physicsValidator.ts`
- its re-export block in `packages/hep-mcp/src/tools/research/index.ts`
- `packages/hep-mcp/tests/physicsValidator.test.ts`
- any live docs or registry surfaces that still present `physicsValidator` as current truth

## Closeout Requirements

1. Formal three-reviewer review: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`
2. Formal self-review after reviewer convergence
3. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, and `.serena/memories/architecture-decisions.md` to the final Batch 2 facts
4. Update `AGENTS.md` current-progress summary only if phase counts change
