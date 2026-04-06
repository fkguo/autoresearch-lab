# Post-Runtime Runtime Diagnostics Bridge First

## Intent

This is the canonical implementation prompt for the first bounded **post-runtime diagnostics bridge** slice after the 2026-04-05 primary-source SOTA ratification.

It is intentionally **not** a new tracker item id by itself. It is a checked-in next-lane prompt that turns the ratified post-runtime diagnostics direction into an executable, bounded implementation target.

The goal is not to replace the runtime substrate. The goal is to bridge the runtime evidence that already exists into typed, auditable diagnostic evidence:

- `run-manifest` checkpoints already exist;
- `spans.jsonl` already exists;
- runtime markers such as `context_overflow_retry`, `truncation_retry`, `low_gain_turn`, and `diminishing_returns_stop` already exist;
- but there is still no typed trajectory-level failure-localization / violation-log-style bridge artifact.

This slice should add that first bridge without creating a third observability silo.

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
6. live runtime evidence seams:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/run-manifest.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tracing.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-runtime-state.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-view.ts`
7. existing shared/REP diagnostic-event surfaces:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/meta/schemas/research_event_v1.schema.json`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/shared/src/generated/research-event-v1.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/rep-sdk/src/model/research-event.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/rep-sdk/tests/signals-extract.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/rep-sdk/tests/schema-parity.test.ts`
8. existing diagnostics-artifact pattern:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/diagnostics.ts`
9. adjacent orchestrator/host-path tests:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-parallel-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-stage-gated-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunApprove.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchestratorPackageFreshness.test.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is still clean at first read-through, do not block the lane on a full `npx gitnexus analyze --force` reindex before any code change; initial repo-context plus direct source inspection is sufficient.
- Once the worktree becomes dirty or introduces new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence or preparing review evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed runtime-diagnostics path is not obvious from direct source inspection.

## Locked Current Truth

### Already live

- Durable step checkpoints already exist in `run-manifest`.
- span-level execution traces already exist in `spans.jsonl`.
- structured runtime markers already exist for overflow, truncation, and low-gain / diminishing-returns paths.
- team runtime already maps some of those conditions into statuses such as `needs_recovery`.

### Real remaining gap

- The runtime evidence is still fragmented across checkpoints, spans, state transitions, and markers.
- `research_event_v1` already has `stagnation_detected` and `diagnostic_emitted`, but their current payload surface is too generic to serve as the needed trajectory-level failure-localization bridge by itself.
- The repo lacks a typed bridge artifact/event path that answers: what degraded, why, from which source evidence, and where should a downstream evaluator or operator look next.

### Authority boundary

- The underlying runtime artifacts remain the source of record.
- This slice adds a typed bridge, not a second runtime truth.

## Exact Scope

### In scope

1. Add the first typed bridge from runtime evidence into durable diagnostic evidence.
   The bridge must be built from real source evidence such as:
   - run-manifest checkpoints
   - `spans.jsonl`
   - runtime markers
   - team runtime recovery/interruption truth
2. Keep provenance explicit.
   - The bridge output must point back to the underlying evidence instead of collapsing everything into free-form prose.
3. Choose one narrow truthful bridge shape.
   - A dedicated typed bridge artifact is preferred if that yields clearer authority.
   - If a `research_event_v1` extension is also needed, keep it narrow and reference the bridge artifact instead of stuffing opaque blobs into `diagnostic_emitted`.
4. Prove at least one real consumer/read path through tests or host-path artifacts.
5. Update only directly affected orchestrator/shared/REP/host-path surfaces.

### Out of scope

- Do not replace `run-manifest`, `spans.jsonl`, or runtime markers.
- Do not create a generic diagnostics dashboard, reporting UI, or new event bus.
- Do not add a second telemetry pipeline parallel to existing runtime artifacts.
- Do not widen into fleet diagnostics, scheduler diagnostics, or unrelated package-local warnings.
- Do not let this slice drift into multi-axis eval contract or perturbation harness work.
- Do not use LLM-authored narrative summaries as the new authority layer.

## Required Design Constraints

1. The bridge must be typed and auditable.
   - Free-form strings alone are insufficient.
2. The bridge must preserve source evidence pointers.
   - A downstream reader must be able to trace the diagnosis back to concrete runtime artifacts.
3. The bridge must not become a second runtime state machine.
   - `run-manifest`, spans, and runtime markers remain source truth.
4. If `research_event_v1` is touched, keep the added surface provider-neutral and bounded.
5. If a new artifact schema is introduced, generated/shared surfaces must stay in sync and acceptance must cover them.

## Independent Review Targets

Formal reviewers must independently inspect at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/run-manifest.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tracing.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-runtime-state.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/schemas/research_event_v1.schema.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/core/diagnostics.ts`
- the listed orchestrator/REP/hep-mcp tests

Reviewers must explicitly challenge, not assume:

- whether the lane truly added a bridge artifact/event rather than another loose logging path;
- whether source evidence links remained intact;
- whether the bridge accidentally became a second authority over runtime truth;
- whether the scope stayed bounded to runtime-diagnostics bridging.

## Front-door Surface Audit

Because this slice changes the truthful diagnostic/evidence surface, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/2026-04-05-primary-source-runtime-eval-sota.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/schemas/research_event_v1.schema.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/shared/src/generated/research-event-v1.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- any newly introduced bridge artifact schema or orchestrator export surface

If any live docs/tests still imply that runtime diagnostics are only implicit in scattered logs after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `bash meta/scripts/codegen.sh`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/rep-sdk test -- tests/signals-extract.test.ts tests/schema-parity.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "runtime_marker|diminishing_returns|truncation_retry|context_overflow_retry|diagnostic_emitted|stagnation_detected|spans.jsonl|manifest.json" /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator /Users/fkg/Coding/Agents/autoresearch-lab/packages/shared /Users/fkg/Coding/Agents/autoresearch-lab/packages/rep-sdk /Users/fkg/Coding/Agents/autoresearch-lab/meta/schemas`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect source, callers, tests, and whether the bridge now provides typed failure-localization evidence without replacing underlying runtime truth.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If this slice succeeds, the truthful closeout claim is narrow:

- live runtime evidence is now bridged into one typed, auditable diagnostics surface;
- the bridge preserves direct pointers back to runtime artifacts instead of becoming a second runtime authority;
- runtime diagnostics are materially more useful for evaluation/recovery loops;
- multi-axis eval contract and perturbation harness still remain separate follow-up work.
