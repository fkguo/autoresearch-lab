# NEW-RT-09 Runtime Tool Filtering First

## Intent

This is the canonical implementation prompt for the first bounded `NEW-RT-09` slice after the 2026-03-31 runtime ratification.

The goal is **not** to finish every in-turn orchestration improvement in one lane. The goal is to land the smallest truthful execution-time permission slice before broader `M-22` rollout:

- introduce orchestrator-side tool execution policy metadata as a runtime authority seam;
- wire agent/session-scoped tool visibility into the existing delegated runtime permission path;
- enforce allowlist / denylist truth at `McpClient.callTool()` time instead of only in prompts or packet structure;
- explicitly defer in-turn parallel batching of tool calls to a later follow-up once runtime filtering semantics are locked.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-RT-09` / `NEW-RT-10` and `M-22` sequencing sections in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. current runtime permission and tool-call seams:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/agent-runner-ops.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-types.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-permissions.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-tool-bridge.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
6. adjacent tests and host-path locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/mcp-client-sampling.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/agent-runner.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-execution-runtime.test.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-execution-state.test.ts`
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
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed permission or call-path surfaces are not obvious from direct source inspection.

## Exact Scope

### In scope

- Add an orchestrator-side execution-policy authority seam for tools, with explicit metadata such as:
  - read-only / mutation class;
  - concurrency-safety intent;
  - approval-required flag where relevant.
- Introduce an agent/session-scoped `ToolPermissionView` or equivalent allowlist/denylist input that is passed through the real runtime path rather than existing only in prompt text.
- Extend the existing `TeamPermissionMatrix` / `team-execution-permissions.ts` authority seam so delegated runtime permissions can derive concrete tool visibility from the same permission source.
- Enforce denial at `McpClient.callTool()` before `tools/call` is emitted to MCP.
- Update only directly affected orchestrator + host-path tests to prove:
  - authorized tools still work;
  - unauthorized delegated tools fail closed at runtime;
  - host-path delegated runtime still consumes the shared orchestrator package surface rather than a duplicate local wrapper.

### Out of scope

- Do not implement read-only tool batching / parallel execution in this slice; that follow-up may reuse this policy metadata later.
- Do not redesign `TeamPermissionMatrix` into a second unrelated permission registry.
- Do not widen into `NEW-RT-10` approval/session/task scoping.
- Do not widen into broader `M-22` rollout, convergence-gate adoption, or fleet semantics.
- Do not change public tool names or invent new public approval ids.
- Do not claim full `NEW-RT-09` completion after this slice unless source + acceptance prove more than the intended target.

## Required Design Constraints

1. Execution-time filtering must be real: the final deny seam must be inside `McpClient.callTool()` or a wrapper that it cannot bypass.
2. Unknown tool metadata must fail closed or degrade to the most restrictive safe behavior; do not silently infer elevated permissions from naming heuristics.
3. Tool visibility must be derived from existing delegation/intervention authority, not from a second hand-maintained allowlist map living elsewhere.
4. This slice may add policy metadata now, but it must not pre-claim safe parallel batching before there is host-path proof.
5. Root/runtime behavior for authorized tools must remain backward compatible.

## Front-door Surface Audit

Because this slice changes live runtime authorization behavior, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-types.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-permissions.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-tool-bridge.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/orchestrator/tools.ts`
- the listed host-path contract tests

If live docs or locks still imply prompt-only filtering after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/mcp-client-sampling.test.ts tests/agent-runner.test.ts tests/team-execution-runtime.test.ts tests/team-execution-state.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-sequential-resume.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "ToolPermissionView|allowlist|denylist|callTool\\(|TeamPermissionMatrix|tool visibility|concurrency_safe|approval_required|read_only" /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests /Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether delegated runtime tool visibility is now enforced at execution time instead of remaining prompt-only.
- Reviewers must explicitly verify that the lane stayed bounded and did not silently widen into batching, approval scoping, or broader `M-22`.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- orchestrator runtime now carries a real execution-time tool permission view;
- delegated tool visibility is enforced at runtime on the live host path;
- in-turn parallel tool batching, approval/session scoping, and broader `M-22` rollout remain pending follow-up slices.

Anything broader than that needs fresh source evidence and should not be claimed by default.
