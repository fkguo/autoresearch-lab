# Post-Runtime Multi-Axis Eval Contract First

## Intent

This is the canonical implementation prompt for the first bounded **post-runtime** evaluation slice after the 2026-04-05 primary-source SOTA ratification.

It is intentionally **not** a new tracker item id by itself. It is a checked-in next-lane prompt that turns the ratified planning direction into an executable, bounded implementation target.

The goal is not to build a brand-new eval subsystem. The goal is to extend the **already live** `packages/hep-mcp/src/eval/*` substrate so that evaluation can stop collapsing everything into pass/fail plus flat numeric metrics.

This slice should:

- keep the existing fixture-driven eval runner and baseline flow;
- introduce typed multi-axis outcome semantics for `task_success`, `partial_progress`, and `cost/time/token` overhead;
- prove those semantics on real existing eval suites;
- and explicitly avoid inventing `packages/orchestrator/src/eval/*` or a second generic eval stack.

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
6. the live eval substrate:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/schema.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/runner.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/metrics.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/baseline.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/index.ts`
7. adjacent runtime/telemetry surfaces that may feed overhead axes:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-runtime-state.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/backends/chat-backend.ts`
8. existing eval and telemetry tests:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalFramework.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalCoverage.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalDataset.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalSem02EvidenceClaimGrading.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalSem06eStructureAwareLocalization.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/toolUsageTelemetry.test.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is still clean at first read-through, do not block the lane on a full `npx gitnexus analyze --force` reindex before any code change; initial repo-context plus direct source inspection is sufficient.
- Once the worktree becomes dirty or introduces new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence or preparing review evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed eval contracts or callers are not obvious from direct source inspection.

## Locked Current Truth

### Already live

- `packages/hep-mcp/src/eval/*` already provides a real fixture-driven eval substrate.
- Existing eval reports already support case-level outputs, aggregate metrics, timeouts, and baseline comparison.
- Multiple SEM eval suites already depend on this substrate for truthful package-local regression gates.

### Real remaining gap

Current eval truth is still too flat:

- `EvalResult.metrics` is only `Record<string, number>`;
- `EvalReport.aggregateMetrics` is only `Record<string, number>`;
- top-line summary still collapses the outcome to `passed/failed/passRate`.

That is not sufficient for the source-grounded post-runtime direction ratified in the 2026-04-05 memo.

### Authority boundary

- The next move is to extend the existing `hep-mcp` eval substrate.
- There is **no** live `packages/orchestrator/src/eval/*` authority to converge onto.
- This slice must not invent a second eval stack just because the new semantics are richer.

## Exact Scope

### In scope

1. Extend the live `EvalResult` / `EvalReport` / `EvalConfig` contract so that multi-axis evaluation becomes typed runtime truth instead of convention-only metric naming.
   At minimum the new contract must distinguish:
   - `task_success`
   - `partial_progress`
   - resource overhead observations spanning `cost/time/token` or a clearly justified typed subset if exact cost is unavailable on the current path
2. Preserve fixture-driven eval ergonomics.
   - Existing eval suites should still run through `runEvalSet(...)` rather than being rewritten into a second harness.
   - Baseline comparison should remain meaningful after the richer outcome shape lands.
3. Update a small set of already-live eval suites so the new semantics are proven on real cases instead of only on a synthetic demo.
4. Keep arbitrary numeric metrics available only as supporting detail if they still add value.
   - They must no longer be the sole authority for the top-line eval outcome.
5. Update only directly affected `hep-mcp` eval code/tests and any adjacent shared/runtime type surface that is strictly required to support typed overhead observations.

### Out of scope

- Do not create `packages/orchestrator/src/eval/*`.
- Do not introduce a second generic evaluation package or a repo-wide scorecard framework.
- Do not turn `cost/time/token` into a runtime hard gate; they remain evaluation/observability axes.
- Do not reopen raw PDF authority or multimodal ingestion policy.
- Do not widen into trajectory-level diagnostics or perturbation harness work in this lane; those belong to separate follow-up slices.
- Do not add compatibility shims whose only purpose is to keep the old pass/fail-only authority alive indefinitely.
- Do not create new tracker item ids in this slice.

## Required Design Constraints

1. `task_success` and `partial_progress` must not be synonyms.
   - A case may have strong partial progress while still not being a full task success.
2. Resource overhead must stay typed and auditable.
   - If a dimension is unavailable on the current path, represent that truth explicitly instead of fabricating a zero.
3. Richer eval semantics must not rely on stringly-typed metric-name conventions alone.
4. Because this ecosystem has no backwards-compat burden yet, prefer one truthful contract over dual old/new authorities.
5. This slice must remain package-local first unless source evidence proves a shared cross-package contract is already needed now.

## Independent Review Targets

Formal reviewers must independently inspect at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/schema.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/runner.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/baseline.ts`
- the listed eval tests
- any touched runtime/telemetry type surface

Reviewers must explicitly challenge, not assume:

- whether the lane truly extended the existing `hep-mcp` eval substrate instead of introducing a second authority;
- whether `task_success` and `partial_progress` are genuinely separable in the new contract;
- whether resource-overhead truth is typed and auditable rather than hand-waved into free-form metrics;
- whether the lane stayed bounded and did not silently absorb diagnostics-bridge or perturbation-harness work.

## Front-door Surface Audit

Because this slice changes the truthful meaning of eval reports, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/2026-04-05-primary-source-runtime-eval-sota.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval/evalFramework.test.ts`
- any touched baseline fixtures or eval snapshot helpers

If any live docs/tests still imply that eval truth is only pass/fail plus flat metrics after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalFramework.test.ts tests/eval/evalCoverage.test.ts tests/eval/evalDataset.test.ts tests/eval/evalSem02EvidenceClaimGrading.test.ts tests/eval/evalSem06eStructureAwareLocalization.test.ts tests/contracts/toolUsageTelemetry.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "task_success|partial_progress|aggregateMetrics|passRate|durationMs|input_tokens|output_tokens|total_tokens|cost" /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/eval /Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/eval /Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/2026-04-05-primary-source-runtime-eval-sota.md`

If the final implementation touches shared schemas/codegen anyway, then the lane must additionally run:

- `bash meta/scripts/codegen.sh`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/shared test`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect source, callers, tests, and whether the new eval contract really moved authority away from flat pass/fail-only summaries.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If this slice succeeds, the truthful closeout claim is narrow:

- the live `hep-mcp` eval substrate now exposes typed multi-axis outcome semantics for task success, partial progress, and resource overhead;
- existing eval suites still run on the same substrate and baseline flow;
- no new orchestrator-local eval stack was introduced;
- trajectory diagnostics and protocol perturbation still remain separate follow-up work.
