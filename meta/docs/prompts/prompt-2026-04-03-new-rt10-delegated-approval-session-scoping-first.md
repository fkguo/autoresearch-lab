# NEW-RT-10 Delegated Approval + Session Scoping First

## Intent

This is the canonical implementation prompt for the first bounded `NEW-RT-10` slice after the 2026-03-31 runtime ratification.

The goal is **not** to finish every delegated-runtime follow-up in one lane. The goal is to land the smallest truthful runtime-scoping slice that reduces shared-slot ambiguity on the live team runtime path:

- separate delegated approval truth from the root run's single `pending_approval` slot;
- add agent/assignment-aware session lineage to delegated runtime state and read models;
- project delegated/background-task lifecycle from existing `ResearchTask` authority instead of inventing a second scheduler substrate;
- keep MCP/tool inheritance and runtime tool filtering explicitly out of scope for this slice when they would widen back into `NEW-RT-09`.

## Read First

Implementation lane must read, in order:

1. `/Users/fkg/Coding/Agents/autoresearch-lab/AGENTS.md`
2. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
3. the full `NEW-RT-09` / `NEW-RT-10` queue section in `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
4. `/Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. current delegated-runtime state and read-model seams:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/types.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/state-manager.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/approval-gate.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-state.js`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-view.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-support.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime-types.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/research-loop/task-types.ts`
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/orch-tools/run-read-model.ts`
6. adjacent tests and host-path locks:
   - `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests/orchestrator.test.ts`
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
- Before formal review, rerun GitNexus freshness and capture `detect_changes`; use `impact` / `context` if the changed delegated state or approval/read-model seams are not obvious from direct source inspection.

## Exact Scope

### In scope

- Replace single-slot delegated approval ambiguity with an agent-aware collection shape on the live team-runtime path:
  - root run approvals remain represented explicitly rather than disappearing into delegated entries;
  - delegated approvals are keyed by `agent_id` / `assignment_id | null` or an equivalent typed authority shape;
  - read-model surfaces can report which approval is root-owned versus delegated.
- Add agent/session lineage fields needed to make delegated runtime state auditable after pause/recovery:
  - at minimum preserve assignment-aware session identity, runtime lineage, or equivalent typed metadata rather than relying on one run-global slot.
- Add the first truthful runtime projection from existing `ResearchTask` lifecycle into delegated/background-task state:
  - `pending -> pending`
  - `active -> running`
  - `completed -> completed`
  - `blocked -> failed`
  - `cancelled -> killed`
  while preserving assignment/session lineage and without introducing a second scheduler/task registry.
- Update only directly affected orchestrator + host-path tests.

### Out of scope

- Do not widen into runtime tool filtering or MCP inheritance enforcement; that belongs to `NEW-RT-09`.
- Do not redesign `ResearchTask` into a second durable substrate or fleet scheduler.
- Do not widen into global fleet/worker queue semantics or `EVO-14`.
- Do not claim full `NEW-RT-10` completion after this slice unless source + acceptance prove more than the intended target.
- Do not silently reopen broader approval authority migration outside the delegated runtime path.

## Required Design Constraints

1. Root-run approval truth must remain explicit and backward understandable; this slice may separate delegated approvals, but it must not silently erase the root approval surface.
2. Delegated approval/session scoping must be typed and auditable; do not hide it in unstructured metadata blobs.
3. Background-task lifecycle must remain a projection of existing `ResearchTask` authority, not a parallel registry.
4. Recovery semantics must stay fail-closed: ambiguous ownership or lifecycle state must not be treated as successful completion.
5. This slice must preserve existing queue / approval-gate / durable execution behavior for non-delegated runs.

## Front-door Surface Audit

Because this slice changes live delegated runtime state semantics, the review packet must include a front-door audit covering at least:

- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md`
- `/Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/index.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/types.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/state-manager.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-state.js`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-execution-view.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src/team-unified-runtime.ts`
- `/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-mcp/src/tools/orchestrator/tools.ts`
- the listed host-path tests

If live docs or locks still imply delegated approvals share one run-global slot after implementation, either update them in-batch or explicitly justify why they are unaffected.

## Acceptance Commands

Minimum acceptance for the implementation lane:

- `git diff --check`
- `pnpm --filter @autoresearch/orchestrator test -- tests/orchestrator.test.ts tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-unified-runtime-sequential-resume.test.ts`
- `pnpm --filter @autoresearch/orchestrator build`
- `node scripts/check-orchestrator-package-freshness.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `rg -n "pending_approval|pending_approvals|agent_id|assignment_id|approval_packet_path|approval_requested_at|ResearchTask|background-task|session lineage|delegate_assignments" /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/src /Users/fkg/Coding/Agents/autoresearch-lab/packages/orchestrator/tests /Users/fkg/Coding/Agents/autoresearch-lab/meta/REDESIGN_PLAN.md /Users/fkg/Coding/Agents/autoresearch-lab/meta/remediation_tracker_v1.json`

## Review Requirements

Formal trio review is mandatory:

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5.1)`

Rules:

- No fallback reviewer substitution without explicit human approval.
- Reviewers must check source, callers, tests, and whether delegated runtime approval/session truth is no longer collapsed into one shared slot.
- Reviewers must explicitly verify that this slice stayed bounded and did not silently widen back into runtime tool filtering, fleet scheduling, or broader `M-22`.
- If Gemini or OpenCode initial runs fail to produce a usable source-grounded verdict, prefer same-model rerun with an embedded-source packet rather than shrinking to diff-only review.
- Formal self-review is also required after trio convergence.

## Expected Closeout Claims

If the batch succeeds, the truthful closeout claim is narrow:

- delegated runtime approvals/session lineage are now agent-aware on the live host path instead of sharing one ambiguous slot;
- delegated/background-task lifecycle is projected from existing `ResearchTask` authority with explicit terminal semantics;
- MCP/tool inheritance and broader team-runtime widening remain pending follow-up slices.

Anything broader than that needs fresh source evidence and should not be claimed by default.
