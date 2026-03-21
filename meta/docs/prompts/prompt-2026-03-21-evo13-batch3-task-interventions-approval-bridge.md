# Prompt: 2026-03-21 `EVO-13` Batch 3 — Task-Scoped Intervention Completion + Approval Bridge

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `EVO-14` 预实现，也不是把 `project` scope、fleet health、cross-run scheduler、sequential parity 一次性做完。目标只有一个：补齐 `EVO-13 Batch 1/2` 之后仍缺失的 **task-scoped intervention contract**，并为 delegated runtime 的 `approval_required` 事件补上最小 **team-local approval bridge**，让 assignment-local control plane 真正可操作、可回放、可验收。

## 0. Worktree Requirement

本批默认**直接在主仓 `main` worktree 实施**，不要新建 worktree。

当前 canonical 路径：

- `/Users/fkg/Coding/Agents/autoresearch-lab`

只有当满足以下任一条件时，才允许偏离：

1. 已证明存在并行 lane / 并行分支；
2. 需要把未收敛实现与主工作区物理隔离；
3. 人类随后明确要求独立 worktree。

## 1. Why This Batch Next

`EVO-13 Batch 1` 已把 team-local unified runtime core 接到 live shared surface，`Batch 2` 已把 `parallel` fan-out 与 team-local lifecycle/control-plane 路径补齐；当前剩余的最小、独立、可验收缺口就是：

1. `approve` / `redirect` / `inject_task` 仍缺少完整的 **task-scoped team-local** 语义闭环；
2. delegated runtime 的 `approval_required` 事件尚未形成 assignment-local 可持久化 bridge，导致进入 `awaiting_approval` 后 control plane 可见但不可继续操作；
3. 默认权限、schema、view 与 runtime state 之间仍有 contract 毛边，容易把“存在字段/权限”误读成“语义已闭合”。

现在不该先做相邻 lane：

- 不是 `EVO-14`：本批只补 **team-local** gap，不做 cross-run / fleet scheduler。
- 不是 stalled/health heuristics 扩批：Batch 2 已完成 team-local lifecycle 最小闭环，本批不再新增 health taxonomy。
- 不是 sequential parity：当前最小价值缺口是 intervention/approval contract，不是再开一个执行策略 lane。

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `packages/orchestrator/src/` 中 task-scoped `approve` / `redirect` / `inject_task`
2. assignment-local approval metadata 与 replay/live-status/control-plane 可见性
3. team-local persisted state / view / schema / permission 默认值之间的 contract 对齐
4. 与上述实现直接相关的 orchestrator tests
5. 若 shared host contract 需要同步，则允许最小 `hep-mcp` contract test 同步
6. 本批 closeout 所需的 canonical prompt / tracker / `AGENTS.md` / review artifact 同步

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `project` scope intervention 的真实实现
- stalled/health heuristics 扩张
- cross-run / fleet scheduler
- sequential multi-assignment parity
- 第二套 project-state pending-approval authority
- `TeamRoleOrchestrator` 退役或 Python surface 清理
- `hep-mcp` / `hep-autoresearch` 的大规模 authority 迁移

## 3. Archive-First SOTA Preflight

本批默认执行新的 archive-first SOTA preflight，并显式落路径。

### 3.1 Canonical archive path

- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch3-task-interventions-approval-bridge/preflight.md`
- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch3-task-interventions-approval-bridge/summary.md`
- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch3-task-interventions-approval-bridge/manifest.json`

### 3.2 Worktree pointer

- `/Users/fkg/Coding/Agents/autoresearch-lab/.tmp/evo13-batch3-sota-preflight.md`

### 3.3 Preflight questions

1. assignment-local approval bridge 最小需要哪些 persisted fields，才能让 replay/live control plane 可继续执行但不发明第二套 SSOT
2. task-scoped operator intervention 在 bounded team runtime 里应如何 fail-closed
3. shared tool host / package surface 如何避免“本包 src 正确、下游 dist 漂移”的假通过

## 4. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch3-task-interventions-approval-bridge.md`
6. `meta/docs/prompts/prompt-2026-03-21-evo13-batch2-parallel-fanout-lifecycle.md`
7. `meta/docs/prompts/prompt-2026-03-21-evo13-batch1-team-runtime.md`
8. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
9. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`
10. `.serena/memories/architecture-decisions.md`

然后继续读取以下直接相关源码与测试：

11. `packages/orchestrator/src/team-unified-runtime.ts`
12. `packages/orchestrator/src/team-unified-runtime-support.ts`
13. `packages/orchestrator/src/team-execution-types.ts`
14. `packages/orchestrator/src/team-execution-assignment-state.ts`
15. `packages/orchestrator/src/team-execution-bootstrap.ts`
16. `packages/orchestrator/src/team-execution-clone.ts`
17. `packages/orchestrator/src/team-execution-interventions.ts`
18. `packages/orchestrator/src/team-execution-intervention-payloads.ts`
19. `packages/orchestrator/src/team-execution-permissions.ts`
20. `packages/orchestrator/src/team-execution-tool-bridge.ts`
21. `packages/orchestrator/src/team-execution-view.ts`
22. `packages/orchestrator/src/orch-tools/team-schemas.ts`
23. `packages/orchestrator/src/orch-tools/schemas.ts`
24. `packages/hep-mcp/src/tools/dispatcher.ts`
25. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
26. `packages/orchestrator/tests/team-execution-state.test.ts`
27. `packages/orchestrator/tests/team-unified-runtime.test.ts`
28. `packages/hep-mcp/tests/contracts/orchRunApprove.test.ts`
29. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
30. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`

禁止只看局部 diff 就动手。

## 5. Current Reality To Fix

当前源码树里，`EVO-13 Batch 2` 已经让 team-local runtime 能执行、回放、干预，但仍有以下 Batch 3 级缺口：

1. `approve` / `redirect` / `inject_task` 只有部分语义，缺少 task-scoped completion contract
2. delegated runtime `approval_required` 只在事件层暴露，不足以让 team-local state/replay/control-plane 继续操作
3. 默认权限与输入 schema 仍可能让调用者误以为 unsupported scopes 是真实开放的

本批真正要补上的，是：

1. assignment-local approval bridge metadata：`approval_id`、`approval_packet_path`、`approval_requested_at`
2. task-scoped `approve`：只允许在 `awaiting_approval` + metadata 完整的 assignment 上工作
3. task-scoped `redirect`：只落到目标 assignment 的下一次 delegated launch/resume context
4. task-scoped `inject_task`：经现有 assignment registration/bootstrap 路径新增 follow-on assignment
5. shared package surface anti-drift：证明 `packages/orchestrator` 源码与 `@autoresearch/orchestrator` 下游消费之间不存在第二套实现，只存在 `dist` 漂移风险

## 6. GitNexus Hard Gate

### 6.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. dirty `main` worktree 默认运行 `npx gitnexus analyze --force`
3. 在改代码前，至少对以下符号做 `impact` / `context`：
   - `applyTeamIntervention`
   - `executeUnifiedTeamRuntime`
   - `buildTeamControlPlaneView`
   - `handleToolCall`

### 6.2 审核前

若本批新增/重命名符号或改变关键调用链：

1. 再次刷新 GitNexus（dirty worktree 默认 `--force`）
2. 运行 `detect_changes`
3. 必要时补 `impact` / `context`
4. 把 shared host entrypoint、downstream package surface、以及 live callers 纳入 review packet

## 7. Preferred Implementation Shape

### 7.1 Approval bridge stays assignment-local

新增 persisted fields 仅服务于 team-local replay/live-status/control-plane：

- `approval_id`
- `approval_packet_path`
- `approval_requested_at`

禁止把 orchestrator top-level `pending_approval` authority 上提到 team layer。

### 7.2 Intervention semantics must be real or fail closed

- `approve`：仅 task scope，且仅允许 `awaiting_approval` + metadata 完整
- `redirect`：仅 task scope，持久化为目标 assignment 的 `pending_redirect`
- `inject_task`：仅 task scope，经现有 assignment registration/bootstrap 路径落地
- `project` scope：继续 fail-closed

### 7.3 Package surface must stay singular

- `packages/orchestrator/` 是源码工作区
- `@autoresearch/orchestrator` 是其 workspace package surface
- 下游 host 必须消费包导出，而不是复制 generic orchestrator authority
- acceptance 必须覆盖 `build + host-path contract`，避免 `src`/`dist` 漂移假通过

## 8. Mandatory Tests And Acceptance

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner.test.ts tests/research-loop-runtime.test.ts tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/team-unified-runtime.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/compute-loop-writing-review-bridge.test.ts
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/executeManifestDelegatedLaunchContract.test.ts tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts
pnpm --filter @autoresearch/hep-mcp build
```

## 9. Formal Review-Swarm And Self-Review

### 9.1 Formal review-swarm

必须使用固定 reviewer trio：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

reviewer 必须：

1. 读实际源码，而不是只看 packet/diff
2. 检查 `applyTeamIntervention` / `executeUnifiedTeamRuntime` / `handleToolCall` 的 shared path
3. 检查 orchestrator 与 hep-mcp host-path acceptance
4. 检查 packet 对 “无 project scope / 无第二套 approval authority / 无 duplicate implementation” 的前提是否成立

### 9.2 Self-review

外部 review-swarm 收敛后，必须再做正式 self-review，至少覆盖：

1. task-scoped intervention correctness
2. assignment-local approval bridge 没有越权成 project-level authority
3. shared package/host entrypoint 仍是 singular surface
4. adopted / deferred / declined amendments 是否记录完整

## 10. Post-Closeout Sync

完成态至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch3-task-interventions-approval-bridge.md`

若本批抽出新的稳定架构不变量，则同步 `.serena/memories/architecture-decisions.md`；若没有，则明确说明不更新。

本批默认**不**更新 `meta/REDESIGN_PLAN.md`，除非 phase/lane 边界或依赖顺序被实际实现推翻。
