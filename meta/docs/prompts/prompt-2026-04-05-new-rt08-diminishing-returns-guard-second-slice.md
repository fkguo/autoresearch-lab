# NEW-RT-08 Diminishing-Returns Guard Second Slice

## Intent

This is the canonical implementation prompt for the next truthful `NEW-RT-08` slice after the already-landed 2026-04-03 runtime-hardening first slice.

The goal is **not** to reopen all runtime robustness work. The goal is to land the smallest truthful live-runtime guard that stops obvious low-gain looping without turning into a cost ceiling, a semantic judge, or a fleet/session redesign:

- keep the already-landed usage / stop-reason / truncation / overflow hardening intact;
- add a bounded diminishing-returns / low-gain-turn signal on the real `AgentRunner` path;
- make the guard auditable in runtime state / emitted events / artifacts;
- keep `NEW-RT-09`, `NEW-RT-10`, `M-22`, and broader `EVO-13` widening out of scope.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-RT-08` / `NEW-RT-09` / `NEW-RT-10` queue section in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. prior bounded slice for context only:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/prompt-2026-04-03-new-rt08-agent-loop-robustness-first.md`
6. live runtime sources:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/backends/chat-backend.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/backends/anthropic-backend.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
7. adjacent runtime tests and host-path locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner-manifest.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-parallel-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-stage-gated-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchestratorPackageFreshness.test.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree becomes dirty or introduces new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence or preparing formal review evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed runtime callers or low-gain guard seam are not obvious from direct source inspection.

## Exact Scope

### In scope

- Add the smallest truthful diminishing-returns / low-gain-turn guard on the live `AgentRunner` runtime path.
- Introduce explicit runtime-state or emitted-marker truth for:
  - when a turn is classified as low-gain;
  - current streak / bounded retry state if such a streak is tracked;
  - when the guard triggers an explicit stop / synthesize / handoff outcome.
- Update only the directly affected runtime callers and tests.
- Sync:
  - `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
  - `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
  if the closeout truth changes.

### Out of scope

- Do not reopen usage plumbing, stop-reason normalization, truncation recovery, or overflow recovery unless a source-grounded bug blocks this slice.
- Do not widen into runtime tool filtering or delegated tool visibility; that belongs to `NEW-RT-09`.
- Do not widen into agent-scoped pending approvals, session/MCP inheritance, or cleanup semantics; that belongs to `NEW-RT-10`.
- Do not introduce a semantic-quality scorer, rubric engine, domain heuristic classifier, or LLM-judged "good/bad answer" subsystem.
- Do not turn this into a raw token/cost budget limit or a fleet-level scheduler concern.

## Required Design Constraints

1. Prefer a simple structural runtime signal over a semantic evaluator.
2. The guard must be auditable. Do not silently stop, silently summarize, or silently rewrite history.
3. The guard must be bounded and fail closed.
4. A single short or tool-free turn is not enough evidence by itself; the design must target repeated low-gain looping rather than ordinary concise progress.
5. The implementation must preserve existing durable execution, lane queue, approval gate, and host-path runtime behavior.
6. If the chosen design uses a threshold or streak, it must be small, explicit, and tested; do not hide it in prompt prose only.

## Front-door Surface Audit

Because this slice changes live orchestrator runtime behavior, the review packet must include at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/orchestrator/tools.ts`
- the listed orchestrator + hep-mcp runtime tests

If live docs or locks still imply "loop until done/error only" after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner.test.ts tests/agent-runner-manifest.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "diminishing|low-gain|streak|stop_reason|max_tokens|end_turn|endTurn|truncate|compact|window" /Users/fkg/Coding/Agents/autoresearch-lab-new-rt08-diminishing-returns-guard-second-slice/packages/orchestrator/src /Users/fkg/Coding/Agents/autoresearch-lab-new-rt08-diminishing-returns-guard-second-slice/packages/orchestrator/tests /Users/fkg/Coding/Agents/autoresearch-lab-new-rt08-diminishing-returns-guard-second-slice/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab-new-rt08-diminishing-returns-guard-second-slice/meta/remediation_tracker_v1.json`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether the low-gain guard is real runtime authority rather than prompt-only guidance.
- Reviewers must explicitly check that the guard is not merely a cost ceiling and does not reopen `NEW-RT-09` / `NEW-RT-10`.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- live runtime now has an auditable diminishing-returns / low-gain-turn guard;
- obvious repeated low-gain looping no longer continues indefinitely without an explicit runtime decision;
- the already-landed usage / truncation / overflow hardening remains intact;
- runtime tool filtering, delegated scoping, and broader runtime widening remain separate items.

Anything broader than that needs fresh source evidence and should not be claimed by default.
