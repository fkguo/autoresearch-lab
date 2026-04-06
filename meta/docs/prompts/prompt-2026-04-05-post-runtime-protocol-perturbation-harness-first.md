# Post-Runtime Protocol Perturbation Harness First

## Intent

This is the canonical implementation prompt for the first bounded **post-runtime protocol/interface perturbation harness** slice after the 2026-04-05 primary-source SOTA ratification.

It is intentionally **not** a new tracker item id by itself. It is a checked-in next-lane prompt that turns the ratified perturbation-harness direction into an executable, bounded implementation target.

The goal is not to make production tool schemas more permissive. The goal is to add a reproducible, package-local eval harness that can detect when the system is overfitting to one exact tool/protocol surface.

This slice should:

- live in the already-existing `packages/hep-mcp/src/eval/*` + `packages/hep-mcp/tests/eval/**` world;
- perturb interface shape only inside fixtures/harness logic;
- measure whether the current front-door surface remains robust or fails closed in the right way;
- and explicitly avoid inventing a fuzzy-parser compatibility layer or a new generic orchestrator eval stack.

## Worktree Requirement

Do not implement this slice on the governance/doc-sync worktree.

Use a dedicated implementation worktree for the package changes.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the runtime-follow-up and next-batch planning context in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/2026-04-05-primary-source-runtime-eval-sota.md`
5. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. the live eval substrate and fixture helpers:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/schema.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/runner.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalFramework.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalSnapshots.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalSem06EvidenceRetrieval.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalSem06eFailureModes.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalEvidence.test.ts`
7. default front-door surfaces with the strongest existing fixture/contract support:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/index.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/toolContracts.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/tools.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/nextActionsExposure.test.ts`
8. if the lane chooses to include one orchestrator host-path surface, also read:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tool-execution-policy.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is still clean at first read-through, do not block the lane on a full `npx gitnexus analyze --force` reindex before any code change; initial repo-context plus direct source inspection is sufficient.
- Once the worktree becomes dirty or introduces new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence or preparing review evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed harness or chosen front-door surface is not obvious from direct source inspection.

## Locked Current Truth

### Already live

- `hep-mcp` already has a real package-local eval substrate with fixtures, baselines, holdouts, and helper utilities.
- `hep-mcp` also already has front-door tool contract tests that lock schema/registry truth.
- Some eval suites already exercise robustness-like failure modes, but there is no dedicated perturbation harness that systematically checks tool-interface overfitting.

### Real remaining gap

- Today the repo can say whether a canonical surface works.
- It is much weaker at telling us whether success depends too heavily on one exact phrasing or one exact parameter layout.

### Authority boundary

- The perturbation harness belongs in `hep-mcp` eval/tests first.
- Production tool schemas remain strict and fail-closed.
- The harness is allowed to vary inputs; production code is **not** allowed to become a fuzzy recovery layer just to make the harness pass.

## Exact Scope

### In scope

1. Add a reproducible perturbation-harness layer on top of the existing `hep-mcp` eval substrate.
   - Perturbations must be fixture-backed and deterministic, not random fuzz.
2. Cover a very small set of already-live front-door surfaces with strong existing evidence.
   Default starting point:
   - `hep_project_query_evidence`
   - `hep_project_query_evidence_semantic`
   If source inspection reveals a better surface with equal or better fixture/contract support, the lane may swap it in, but must justify the change explicitly.
3. The harness may perturb:
   - phrasing/paraphrase around tool intent
   - argument ordering/layout in fixture payloads
   - irrelevant/noisy optional fields
   - interface variants that should fail closed rather than silently succeed
4. The harness must record robustness outcomes separately from ordinary accuracy.
   At minimum it must distinguish:
   - canonical success retained
   - acceptable fail-closed rejection
   - bad shortcutting / overfit failure
5. Update only directly affected eval fixtures/tests and any narrowly required helper code.

### Out of scope

- Do not loosen production schemas to accept malformed or ambiguous inputs.
- Do not add hidden auto-correction or fuzzy parsing to make perturbed cases pass.
- Do not invent `packages/orchestrator/src/eval/*`.
- Do not sweep the whole tool catalog in one slice.
- Do not widen into raw PDF / multimodal authority work.
- Do not widen into multi-axis eval contract or runtime diagnostics-bridge work.

## Required Design Constraints

1. Perturbations must be reproducible and reviewable.
   - No randomized fuzzing without deterministic seeds and saved fixtures.
2. The harness must differentiate desirable fail-closed behavior from true robustness regressions.
3. Production strictness is part of the success criteria.
   - A malformed input that is correctly rejected should not be scored the same as a brittle accidental failure.
4. The harness must remain package-local first unless source evidence proves a shared/generic harness is already necessary now.
5. This slice is about detection of interface overfitting, not about making the public tool surface more permissive.

## Independent Review Targets

Formal reviewers must independently inspect at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/schema.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/runner.ts`
- the newly added perturbation fixtures/harness helpers
- the chosen front-door tool surfaces and adjacent contract tests

Reviewers must explicitly challenge, not assume:

- whether the harness stayed deterministic and fixture-backed;
- whether the lane truly measured perturbation robustness instead of silently loosening production parsing;
- whether acceptable fail-closed behavior is distinguished from overfitting regressions;
- whether the chosen tool surfaces were grounded in existing fixture/contract strength rather than convenience.

## Front-door Surface Audit

Because this slice evaluates public tool/interface robustness, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/2026-04-05-primary-source-runtime-eval-sota.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/toolContracts.test.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/tools.test.ts`
- the newly added perturbation-harness fixtures/tests

If any live docs/tests still imply that canonical happy-path tests alone are sufficient for interface robustness after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalFramework.test.ts tests/eval/evalEvidence.test.ts tests/eval/evalSem06EvidenceRetrieval.test.ts tests/eval/evalSem06eFailureModes.test.ts tests/toolContracts.test.ts tests/tools.test.ts tests/contracts/nextActionsExposure.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "perturb|robust|fail_closed|fail-closed|overfit|shortcut|canonical_success|partial_progress" /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests`

If the implementation chooses to include an orchestrator host-path surface as part of the first slice, then the lane must additionally run:

- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect source, callers, tests, and whether the harness now detects interface overfitting without mutating production truth into a permissive compatibility layer.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If this slice succeeds, the truthful closeout claim is narrow:

- `hep-mcp` now has a deterministic, package-local perturbation harness layered onto the existing eval substrate;
- the harness distinguishes canonical success, acceptable fail-closed rejection, and real overfitting regressions;
- production tool-schema strictness remains intact;
- broader genericization of perturbation testing remains future work.
