# NEW-RT-08 Agent Loop Robustness First

## Intent

This is the canonical implementation prompt for the first bounded `NEW-RT-08` slice after the 2026-03-31 runtime ratification.

The goal is **not** to finish every robustness follow-up in one lane. The goal is to land the smallest truthful runtime-hardening slice that improves long-turn durability without reopening unrelated runtime work:

- plumb backend usage metadata into the live `AgentRunner` seam;
- normalize / classify `stop_reason` values fail-closed instead of treating every non-tool turn as terminal completion;
- add bounded, auditable truncation / overflow recovery markers on the real runtime path;
- keep runtime tool filtering (`NEW-RT-09`) and delegated approval/task scoping (`NEW-RT-10`) explicitly out of scope.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-RT-08` / `NEW-RT-09` / `NEW-RT-10` queue section in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. live runtime sources:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/backends/chat-backend.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/backends/anthropic-backend.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
6. adjacent tests and host-path locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner-manifest.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-parallel-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-stage-gated-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchestratorPackageFreshness.test.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is still clean at first read-through, do not block the lane on a full `npx gitnexus analyze --force` reindex before any code change; initial repo-context + direct source inspection is sufficient.
- Once the worktree becomes dirty or introduces new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence or preparing review evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed runtime callers or recovery seams are not obvious from direct source inspection.

## Exact Scope

### In scope

- Extend the live backend response seam so `AgentRunner` can observe turn-level usage/token metadata instead of only `content` + `stop_reason`.
- Introduce a bounded runtime state / marker seam for window pressure, truncation recovery, and compaction attempts on the real `AgentRunner` path.
- Fail-closed normalize stop reasons at runtime:
  - terminal completion stays limited to explicit completion reasons such as `end_turn` / `stop_sequence` and provider aliases;
  - truncation reasons such as `max_tokens` and provider aliases must not be treated as `done`;
  - unknown stop reasons fail closed.
- Add the smallest truthful recovery path for truncation / overflow:
  - at least one auditable continuation or retry path;
  - at least one auditable compaction/trim marker when recovery is attempted;
  - bounded retries only.
- Update only directly affected orchestrator + host-path tests.

### Out of scope

- Do not implement runtime tool filtering or delegated tool visibility here; that belongs to `NEW-RT-09`.
- Do not widen into approval scoping, agent-scoped pending approvals, or background-task lifecycle changes; that belongs to `NEW-RT-10`.
- Do not redesign the research-loop substrate, delegation protocol, or fleet layer.
- Do not introduce a streaming/token-budget subsystem copied from another product.
- Do not claim `NEW-RT-08` is fully done after this slice unless source + acceptance prove the whole item, which is not the intended target.

## Required Design Constraints

1. Recovery markers must be auditable in runtime artifacts or emitted events; do not silently rewrite or drop prior history.
2. Runtime bookkeeping and observability must stay distinct:
   - telemetry may report usage/window pressure;
   - runtime state alone may drive retry / compaction / truncation continuation.
3. Unknown or unsupported `stop_reason` values must fail closed rather than defaulting to completion.
4. Any recovery retry must remain bounded and explicit; no unbounded self-loop.
5. This slice must preserve existing durable execution, lane queue, and approval gate behavior.

## Front-door Surface Audit

Because this slice changes live orchestrator runtime behavior, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/backends/chat-backend.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/orchestrator/tools.ts`
- the listed host-path tests that exercise the shared runtime surface

If live docs or locks still imply the old “any non-tool turn is done” behavior after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner.test.ts tests/agent-runner-manifest.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "stop_reason|max_tokens|end_turn|endTurn|usage|token|truncate|compact|window" /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests /Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether the runtime now distinguishes terminal completion from truncation/overflow truthfully on the live host path.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- live `AgentRunner` runtime now sees turn-level usage metadata and no longer collapses every non-tool response into unqualified completion;
- truncation/overflow recovery has at least one bounded, auditable runtime path;
- runtime tool filtering and delegated approval/task scoping remain pending follow-up slices.

Anything broader than that needs fresh source evidence and should not be claimed by default.
