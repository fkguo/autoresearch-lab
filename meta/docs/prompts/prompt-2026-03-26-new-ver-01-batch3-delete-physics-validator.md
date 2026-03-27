# NEW-VER-01 Batch 3 — Delete `physicsValidator`

## Goal

Finish the verification-kernel delete-and-replace closeout by removing the heuristic residue `physicsValidator` and proving that the only surviving authority is the already-landed typed artifact-backed path:

- computation result emit of `verification_refs`
- bridge payload pass-through of `verification_refs`
- `buildRunWritingEvidence()` metadata-path surfacing of verification artifacts

Batch 3 is a bounded deletion slice. Do not reopen runtime, scheduler, project-state, broader writing/review wiring, or Batch 2 producer/bridge/consumer semantics.

## Required Reads

1. `AGENTS.md`
2. `meta/REDESIGN_PLAN.md`
3. `meta/remediation_tracker_v1.json`
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/prompt-2026-03-26-new-ver-01-batch2-minimal-producer-pass-through-wiring.md`
6. `packages/hep-mcp/src/tools/research/physicsValidator.ts`
7. `packages/hep-mcp/src/tools/research/index.ts`
8. `packages/hep-mcp/tests/physicsValidator.test.ts`
9. `packages/hep-mcp/src/core/writing/evidence.ts`
10. `packages/hep-mcp/tests/core/writingEvidence.test.ts`
11. `packages/orchestrator/src/computation/result.ts`
12. `packages/orchestrator/src/computation/followup-bridges.ts`
13. `packages/orchestrator/src/computation/followup-bridge-review.ts`
14. `packages/shared/src/__tests__/verification-kernel-contracts.test.ts`
15. `packages/orchestrator/tests/compute-loop-feedback.test.ts`
16. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. If the worktree is dirty, run `npx gitnexus analyze --force`; otherwise run at least `npx gitnexus analyze`.
3. Before formal review, rerun `npx gitnexus analyze --force` if the deletion or anti-regression edits changed symbol availability or the surviving replacement-authority call path, then collect source-grounded post-change evidence.

## Source-Grounded Context

- Batch 2 already landed the only intended replacement authority:
  - `writeComputationResultArtifact()` emits typed `verification_refs`
  - `planComputationFollowupBridges()` / `buildReviewFollowup()` pass those refs through unchanged
  - `buildRunWritingEvidence()` resolves bridge-carried verification refs and writes `writing_evidence_meta_v1.json.verification`
- `physicsValidator.ts` is heuristic text-pattern residue that must not remain as a fallback, diagnostic authority, wrapper, renamed helper, or provider prior on any live path.
- Pre-change deletion work must confirm where the live `validatePhysics` call chain actually ends before removing it.

## Batch 3 Owned Files / Surfaces

- `packages/hep-mcp/src/tools/research/physicsValidator.ts`
- `packages/hep-mcp/src/tools/research/index.ts`
- `packages/hep-mcp/tests/physicsValidator.test.ts`
- `packages/hep-mcp/src/core/writing/evidence.ts`
- `packages/hep-mcp/tests/core/writingEvidence.test.ts`
- current-truth governance/docs surfaces that still present `physicsValidator` as live authority

## Delete-And-Replace Requirements

You must explicitly answer and prove all of the following:

1. Where the pre-change `physicsValidator` live call chain actually ends.
2. Which typed artifact-backed path replaces it after deletion.
3. Which tests are deleted.
4. Which tests are updated to lock:
   - the replacement authority still exists
   - the heuristic exports no longer exist
5. Which docs / exports / registry surfaces need sync.

## Replacement Authority (Locked)

After deletion, the only surviving authority must remain:

- computation-result emit of `verification_refs`
- bridge payload pass-through of `verification_refs`
- `buildRunWritingEvidence()` metadata-path surfacing of verification artifacts into `writing_evidence_meta_v1.json.verification`

Do not invent any new verification family, fallback path, or renamed heuristic helper.

## Explicit No-Go

- No reopening `EVO-02`, `EVO-03`, or `EVO-13`
- No runtime / scheduler / project-state redesign
- No new verification family
- No `research-writer`, `paper-reviser`, `referee-review`, or broader review-revision wiring expansion
- No Batch 2 producer / bridge / consumer semantic changes
- No fallback, diagnostic downgrade, renamed keep-alive helper, or provider prior that preserves `physicsValidator` logic on a live path
- No lane-external cleanup

## Acceptance (Locked Regression Set)

- `git diff --check`
- `pnpm --filter @autoresearch/shared exec vitest run src/__tests__/verification-kernel-contracts.test.ts`
- `pnpm --filter @autoresearch/orchestrator exec vitest run tests/compute-loop-feedback.test.ts tests/compute-loop-writing-review-bridge.test.ts`
- `pnpm --filter @autoresearch/hep-mcp exec vitest run tests/core/writingEvidence.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `pnpm --filter @autoresearch/hep-mcp build`

Supplemental checks:

- deleted-file absence checks for `packages/hep-mcp/src/tools/research/physicsValidator.ts`
- deleted-file absence checks for `packages/hep-mcp/tests/physicsValidator.test.ts`

Deleted-file checks are supplemental only; they do not replace the regression set above.

## Review

- Formal external review: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`
- Formal self-review after reviewer convergence or explicit human direction on reviewer handling
- If Gemini cannot produce an archivable verdict and the human explicitly authorizes ignoring it for this bounded closeout, record that approval basis verbatim in the closeout notes rather than silently treating Gemini as converged

## Closeout Requirements

1. Delete `packages/hep-mcp/tests/physicsValidator.test.ts` by default; do not preserve it under a renamed or transitional heuristic path.
2. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, `.serena/memories/architecture-decisions.md`, and `AGENTS.md` (only if counts change) to final Batch 3 truth.
3. Keep the historical citation file `meta/docs/semantic-understanding-heuristics-audit-2026-03-04.md` either:
   - fixed in the same round, or
   - explicitly recorded as historical/non-front-door and out of scope for this batch
4. Stop at `done_pending_version_control_authorization` or `merge_ready`; do not commit, push, or merge without explicit authorization.
