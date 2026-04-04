# NEW-RT-10 Context + MCP Inheritance + Cleanup Second Slice

## Intent

This is the canonical implementation prompt for the **second bounded `NEW-RT-10` slice** after the 2026-04-03 `delegated approval + session scoping first` closeout.

The first slice already landed the basic team-local delegated-runtime scoping substrate:

- delegated approvals are no longer collapsed into one ambiguous root slot;
- assignment/session-aware lineage now exists in `TeamExecutionState`;
- `background_tasks` are projected from existing `ResearchTask` authority;
- and task-scoped approve intervention semantics are fail-closed on the live host path.

What still remains for `NEW-RT-10` is the smallest truthful follow-up that helps the automatic-research loop behave like a real delegated runtime rather than a prompt convention:

- add a **typed sub-agent context inheritance contract** on the live team runtime seam;
- make **MCP/tool inheritance** explicit at that same seam, with any override behavior fail-closed and bounded;
- and lock **cleanup / termination semantics** so delegated sessions, approvals, and background-task projections do not leave stale assignment-local residue after terminal transitions.

This lane should improve runtime coherence and recovery without reopening runtime tool filtering itself, broader `M-22`, `NEW-LOOP-01`, or any fleet/scheduler work.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-RT-09` / `NEW-RT-10` / `M-22` sequencing section in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. the already-landed first-slice prompt for boundary context only:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/prompt-2026-04-03-new-rt10-delegated-approval-session-scoping-first.md`
6. current team-runtime scoping and inheritance seams:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-types.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-scoping.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-view.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-permissions.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/delegation-protocol.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/tool-execution-policy.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
7. adjacent tests and host-path locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/team-execution-state.test.ts`
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
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed inheritance / cleanup path is not obvious from direct source inspection.

## Exact Scope

### In scope

1. Add the first **typed delegated context inheritance contract** on the live team runtime path.
   - The delegated runtime must carry explicit parent/runtime lineage through typed state and/or runtime input rather than relying only on rendered protocol prose.
   - At minimum, the lane should make fresh vs resumed/forked assignment-session context source-grounded and inspectable through the current `TeamExecutionState` / live-status surfaces.
2. Add the first **typed MCP inheritance / additive-override contract** for delegated assignments.
   - Reuse the already-landed `TeamPermissionMatrix -> ToolPermissionView -> McpClient.callTool()` authority seam from `NEW-RT-09`.
   - If this slice introduces assignment-local or session-local overrides, they must layer onto that same authority seam rather than creating a second registry.
   - Missing, ambiguous, or unsupported inheritance state must remain fail-closed.
3. Tighten **cleanup / termination semantics** for assignment-local runtime residue.
   - When a delegated assignment reaches a terminal state (`completed`, `failed`, `timed_out`, `cancelled`, `cascade_stopped`) or an explicit intervention settles it, assignment-local stale approval/session residue must not remain live.
   - Historical session lineage must stay auditable; cleanup should clear live residue, not erase history.
   - `pending_redirect`, assignment-local pending approvals, and session terminal markers should converge deterministically after save/recovery.
4. Keep the background-task view as a projection of existing `ResearchTask` authority.
   - This slice may improve how inherited context and terminal cleanup are surfaced in `background_tasks`, but must not introduce a second task/session registry.
5. Update only directly affected orchestrator + host-path tests.

### Out of scope

- Do not reopen runtime tool filtering or batching semantics; those belong to `NEW-RT-09`.
- Do not widen into broader `M-22` rollout or new gate ids.
- Do not redesign `ResearchTask` or add a second durable scheduler/task substrate.
- Do not widen into `EVO-14` fleet queue / worker / scheduler concerns.
- Do not introduce arbitrary prompt-only “context inheritance” claims without typed runtime evidence.
- Do not change public tool names or user-facing front-door behavior unrelated to delegated runtime inheritance/cleanup truth.
- Do not claim full `NEW-RT-10` completion unless source + acceptance prove more than this intended slice.

## Required Design Constraints

1. Inherited context must become typed runtime truth, not just protocol text.
2. MCP inheritance must remain anchored to the existing `ToolPermissionView` / `McpClient.callTool()` enforcement seam.
3. Any override semantics must be narrow and explicit:
   additive override is allowed only if it is typed, auditable, and still fail-closed by default.
4. Cleanup semantics must be assignment-local:
   they must not silently clear sibling or root-run approval/session truth.
5. Terminal cleanup must preserve historical lineage:
   ended sessions stay readable; only live residue should disappear.
6. This slice is about delegated runtime coherence, not a generic session-management platform.

## Independent Review Targets

Formal reviewers must independently inspect at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-types.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-scoping.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-permissions.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/mcp-client.ts`
- the listed orchestrator + hep-mcp host-path tests

Reviewers must explicitly challenge, not assume:

- whether the lane really introduced typed inherited context rather than just richer prompt text;
- whether MCP inheritance still uses the shared RT09 enforcement seam instead of drifting into a second authority path;
- whether cleanup semantics clear only live residue while preserving lineage;
- whether any terminal/intervention path still leaves orphaned assignment-local approvals or sessions;
- whether the lane stayed bounded to team-local runtime semantics and did not drift into fleet/scheduler work.

## Front-door Surface Audit

Because this slice changes live delegated runtime semantics, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-types.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-scoping.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-view.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/orchestrator/tools.ts`
- the listed host-path contract tests

If any live docs/locks still imply prompt-only inheritance or leave terminal cleanup semantics ambiguous after implementation, either update them in-batch or explicitly justify why they remain unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-sequential-resume.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "session_id|parent_session_id|pending_approvals|approval_requested_at|allowed_tool_names|ToolPermissionView|cleanup|terminal|cancelled|cascade_stopped|timed_out" /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests /Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini(auto)`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must inspect source, callers, tests, and whether inherited context / MCP visibility / cleanup truth is now typed on the live runtime path instead of remaining proposal-only.
- Reviewers must form independent judgment from code, adjacent surfaces, and tests rather than being guided by the prompt's preferred outcome.
- Reviewers must explicitly verify that the lane stayed bounded to delegated runtime inheritance/cleanup and did not silently widen into RT09 filtering logic, broader `M-22`, or fleet semantics.
- If `Gemini(auto)` or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If this slice succeeds, the truthful closeout claim is narrow:

- delegated runtime now has a typed inherited-context contract on the live team runtime seam rather than relying only on protocol prose;
- delegated MCP/tool inheritance is explicit and remains anchored to the shared RT09 permission-enforcement seam;
- terminal and intervention paths now clean assignment-local live residue deterministically while preserving auditable session lineage;
- `NEW-RT-10` still remains `in_progress` because broader delegated-runtime widening beyond this bounded inheritance/cleanup slice remains future work.
