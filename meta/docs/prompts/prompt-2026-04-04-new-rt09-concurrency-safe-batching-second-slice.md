# NEW-RT-09 Concurrency-Safe Tool Batching Second Slice

## Intent

This is the canonical implementation prompt for the **second bounded `NEW-RT-09` slice** after the 2026-04-03 `runtime tool filtering first` closeout.

The first slice already landed the fail-closed runtime permission boundary:

- `ToolPermissionView` is now real runtime authority, not prompt-only guidance;
- delegated tool visibility is derived from `TeamPermissionMatrix`;
- and `McpClient.callTool()` now denies unauthorized tools before `tools/call`.

What remains for this item is the smallest truthful batching follow-up:

- partition one assistant turn into **serial vs concurrency-safe tool-use groups** using orchestrator-owned execution policy metadata;
- run only the explicitly safe read-only group in parallel;
- preserve output ordering, approval semantics, and fail-closed behavior;
- and keep all broader runtime/session/fleet concerns out of scope.

This lane should improve live loop throughput without reopening `NEW-RT-10`, broader `M-22`, or any scheduler/fleet work.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-RT-09` / `NEW-RT-10` / `M-22` sequencing section in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. the already-landed first-slice prompt for boundary context only:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/prompt-2026-04-03-new-rt09-runtime-tool-filtering-first.md`
6. current runtime batching / permission seams:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tool-execution-policy.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-permissions.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-tool-bridge.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
7. adjacent tests and host-path locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/mcp-client-sampling.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-execution-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-sequential.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-unified-runtime-sequential-resume.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-sequential.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/tests/contracts/orchestratorPackageFreshness.test.ts`

## GitNexus And Serena

- Activate Serena on the implementation worktree before using Serena output as authority.
- Run onboarding check before Serena-guided navigation.
- Read GitNexus repo context before coding.
- If the implementation worktree is still clean at first read-through, do not block the lane on a full `npx gitnexus analyze --force` reindex before any code change; initial repo-context + direct source inspection is sufficient.
- Once the worktree becomes dirty or introduces new symbols/callsites, refresh with `npx gitnexus analyze --force` before relying on graph evidence or preparing review evidence.
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed batching or permission execution path is not obvious from direct source inspection.

## Exact Scope

### In scope

1. Reuse the existing orchestrator-owned execution policy seam in
   `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tool-execution-policy.ts`
   to express the first truthful concurrency distinction:
   - explicitly batch-safe read-only tools;
   - serial-only tools for mutation / approval / uncertain cases;
   - unknown metadata remains restrictive by default.
2. Add one-turn batching at the real assistant-response execution seam:
   - partition assistant `tool_use` blocks into ordered execution groups;
   - permit parallel execution only for contiguous groups whose tools all resolve to the batch-safe read-only class;
   - keep serial execution for every stateful / approval-required / unknown group.
3. Preserve deterministic, auditable result ordering:
   - returned `tool_result` blocks must still appear in the original assistant `tool_use` order;
   - event ordering must remain understandable in replay/tests even if the actual safe calls run concurrently.
4. Preserve fail-closed approval semantics:
   - approval-required tools must stay serial;
   - no mixed approval + batch-safe group may be silently parallelized;
   - if a tool call in a batch fails, the result must settle per-tool in a way that preserves current runtime error semantics instead of collapsing the whole turn into one opaque batch failure.
5. Keep the live delegated runtime path on the same authority:
   - the team/unified runtime must consume the same batching behavior through the shared orchestrator path;
   - no host-local parallel batching wrapper may be introduced in hep-mcp.
6. Update only directly affected orchestrator + host-path tests.

### Out of scope

- Do not widen into `NEW-RT-10` approval/session/task scoping.
- Do not widen into broader `M-22` rollout or new gate ids.
- Do not redesign `TeamPermissionMatrix` into a second permission system.
- Do not introduce cross-turn batching, speculative execution, worker pools, or queue/scheduler semantics.
- Do not widen into fleet-layer behavior or `EVO-14`.
- Do not change public tool names or prompt surface wording unrelated to batching truth.
- Do not claim full `NEW-RT-09` completion unless source + acceptance prove more than this intended slice.

## Required Design Constraints

1. Runtime deny remains real:
   the final authorization seam must still remain inside `McpClient.callTool()` or a wrapper that it cannot bypass.
2. Batch eligibility must derive only from orchestrator execution policy authority:
   no naming heuristic, no prompt hint, no host-local allowlist.
3. Unknown tool metadata stays restrictive:
   unknown tools default to serial-only and must not silently become batch-safe.
4. Output order must remain stable:
   parallel execution may change wall-clock ordering, but not the emitted `tool_result` ordering or replay interpretation.
5. The lane must preserve current non-batching behavior for mixed or unsafe groups:
   if the turn contains any stateful / approval-required / uncertain segment, only the safe contiguous subgroups may parallelize.
6. This slice is about **one-turn concurrency-safe batching**, not a generic async runtime subsystem.

## Independent Review Targets

Formal reviewers must independently inspect at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tool-execution-policy.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
- the listed orchestrator + hep-mcp host-path tests

Reviewers must explicitly challenge, not assume:

- whether the lane really stayed bounded to single-turn batching;
- whether any mixed approval/mutation path was accidentally widened;
- whether delegated runtime truly consumes the same shared batching semantics;
- whether the result ordering is still auditable after concurrency is introduced.

## Front-door Surface Audit

Because this slice changes live runtime execution behavior, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tool-execution-policy.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/orchestrator/tools.ts`
- the listed host-path contract tests

If any live docs/locks still imply prompt-only tool sequencing or “all tools always run serially” after implementation, either update them in-batch or explicitly justify why they remain unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/mcp-client-sampling.test.ts tests/agent-runner.test.ts tests/team-execution-runtime.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-sequential-resume.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "concurrency|serial_only|batch_safe|ToolPermissionView|callTool\\(|Promise\\.all|tool_use" /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests /Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect source, callers, tests, and whether batching is now truly derived from orchestrator execution policy authority instead of hidden heuristics.
- Reviewers must explicitly verify that unauthorized tools are still denied at runtime before any batching behavior matters.
- Reviewers must explicitly verify that the lane stayed bounded to single-turn batching and did not silently widen into `NEW-RT-10`, fleet semantics, or broader `M-22`.
- If `Gemini(auto)` or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If this slice succeeds, the truthful closeout claim is narrow:

- live orchestrator runtime now partitions one assistant turn into serial vs explicitly batch-safe tool-use groups using orchestrator-owned execution policy metadata;
- only the safe read-only group runs concurrently, while approval/stateful/unknown groups remain serial and fail closed;
- delegated runtime continues to consume the same shared batching semantics on the host path;
- `NEW-RT-09` still remains `in_progress` because this slice does not widen into broader orchestration/runtime work beyond the one-turn batching seam.
