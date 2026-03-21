# Prompt: 2026-03-21 `EVO-13` Batch 4 — Src/Dist Anti-Drift Cleanup

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批是一个明确的 cleanup slice，不是 `EVO-14`，也不是新的 team-runtime feature lane。目标只有一个：把 `packages/orchestrator/src` 与 `@autoresearch/orchestrator` package surface 之间仍依赖手工 `build` 才能避免下游 host-path contract 假通过的历史隐患，收束成有源码、测试、acceptance 证据的 anti-drift contract。

## 0. Worktree Requirement

本批默认**直接在主仓 `main` worktree 实施**，不要新建 worktree。

当前 canonical 路径：

- `/Users/fkg/Coding/Agents/autoresearch-lab`

只有当满足以下任一条件时，才允许偏离：

1. 已证明存在并行 lane / 并行分支；
2. 需要把未收敛实现与主工作区物理隔离；
3. 人类随后明确要求独立 worktree。

## 1. Why This Batch Next

`EVO-13 Batch 3` 已明确证明：

1. `packages/orchestrator/` 与 `@autoresearch/orchestrator` 不是两套实现。
2. 真正的历史遗留风险是 workspace 源码与 built `dist` 的漂移，会让下游 host contract 看到陈旧 surface。
3. 该风险已经影响实际 acceptance 策略，因此不能继续只靠口头提醒保留。

因此下一批应先做一个独立 cleanup slice，把这条 anti-drift contract 显式落下，再继续后续 runtime feature slice。

## 2. Hard Scope Boundary

### 2.1 In scope

1. `packages/orchestrator` 的 package surface anti-drift contract
2. `@autoresearch/orchestrator` 被下游 host（至少 `hep-mcp`）消费时的 build/export freshness gate
3. 必要的 host-path acceptance / test harness / helper 更新
4. 与上述 anti-drift 直接相关的 prompt / tracker / closeout 同步

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- 新的 team-runtime feature
- `EVO-14` scheduler / fleet health
- team-local intervention / lifecycle 新语义
- 无关的 monorepo build 系统重写
- 通过把 host 改成直接 import `packages/orchestrator/src/**`、临时 `tsconfig paths`、或其他绕过 package surface 的方式“解决” stale-`dist`
- 为 `@autoresearch/orchestrator` 另起一套本地 authority / wrapper surface

## 3. Current Baseline To Reuse

本批不是从零发明 anti-drift 机制；至少要先理解并复用当前已存在的 closeout 资产：

1. 根 `package.json` 里的 `accept:new-rt-04`
2. `scripts/verify-new-rt04-closeout.mjs`
3. `packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
4. `packages/hep-mcp/tests/toolContracts.test.ts`
5. `packages/hep-mcp/scripts/sync_tool_counts.ts`

关键区分：

1. `accept:new-rt-04` 当前证明的是**冷态重建后 closeout 可复现**
2. Batch 4 还必须补上**stale-`dist` 负向门禁**，防止“忘记 build 但 host-path tests/build 仍假通过”

不要把这两类 gate 混为一谈。

## 4. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `.serena/memories/architecture-decisions.md`
6. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch4-src-dist-anti-drift-cleanup.md`
7. `meta/docs/prompts/prompt-2026-03-21-evo13-batch3-task-interventions-approval-bridge.md`

然后继续读取以下直接相关源码、脚本与测试：

8. 根 `package.json`
9. `scripts/verify-new-rt04-closeout.mjs`
10. `packages/orchestrator/package.json`
11. `packages/orchestrator/src/index.ts`
12. `packages/orchestrator/src/orch-tools/index.ts`
13. `packages/hep-mcp/package.json`
14. `packages/hep-mcp/vitest.config.ts`
15. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
16. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
17. `packages/hep-mcp/src/tools/dispatcher.ts`
18. `packages/hep-mcp/src/tools/index.ts`
19. `packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
20. `packages/hep-mcp/tests/contracts/orchRunApprove.test.ts`
21. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
22. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
23. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
24. `packages/hep-mcp/tests/toolContracts.test.ts`

禁止只看局部 diff 或只看 Batch 3 closeout 摘要就动手。

## 5. What Must Be Proven

本批完成态必须同时证明三件事：

1. `packages/orchestrator/src -> @autoresearch/orchestrator package surface -> hep-mcp host-path contract` 仍是单一 authority path
2. 冷态下删除 `dist` / `tsbuildinfo` 后，canonical acceptance 仍可从源码重建并通过
3. 若 `packages/orchestrator/src` 比 emitted package output 更新，host-side build/test 会**显式失败**，而不是继续假通过

第 2 条不等于第 3 条，两者都必须有证据。

## 6. Preferred Implementation Shape

优先采用以下实现形状：

1. 新增一个**有源码级单元/合同测试覆盖**的 bounded freshness gate，用来判断 `packages/orchestrator` package output 是否陈旧
2. 该 gate 应被 canonical acceptance 复用，并尽量接到日常 host-side `build` / `test` 入口，而不是只留在聊天里的手工步骤
3. 若需要新增 helper，优先升级/复用现有 `accept:new-rt-04` 或其相邻脚本，不要再平行发明一套无人拥有的 closeout wrapper
4. stale-`dist` 负例验证优先使用 **tempdir / synthetic mtime fixture / hermetic helper test**；不要为了造负例把真实工作树故意留脏

默认**不**为本批新开 archive-first SOTA preflight；这是一个 bounded build/acceptance cleanup，而不是新的架构 lane。只有当实现被迫升级为 package-resolution / workspace-layout redesign 时，才暂停并补做新的 preflight。

## 7. GitNexus Hard Gate

### 7.1 实施前

1. 先读取 `gitnexus://repo/{name}/context`
2. 若 stale，先运行 `npx gitnexus analyze`
3. 在改代码前，至少对以下 live surface 做 `impact` / `context`：
   - `ORCH_TOOL_SPECS`
   - `handleToolCall`
   - `getToolSpecs`

### 7.2 审核前

若本批新增 helper / test harness / acceptance wiring 或改变关键调用链：

1. 再次刷新 GitNexus（dirty worktree 默认 `npx gitnexus analyze --force`）
2. 运行 `detect_changes`
3. 必要时补 `impact` / `context`
4. 把 package surface、host-path contract、以及 acceptance helper 纳入 review packet

## 8. Mandatory Acceptance And Negative Validation

最终 acceptance 至少应包含：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check
npm run accept:new-rt-04
```

若引入新的 freshness helper / contract test，应把它纳入最终命令。

### 8.1 冷态 gate

最终 closeout 必须保留一个 repo-real cold-baseline gate：清掉相关 `dist` / `tsbuildinfo` 后，按依赖顺序重建并重新跑 host-path contract slice。

### 8.2 stale-`dist` 负例 gate

最终 closeout 还必须保留至少一个**负向** gate，证明 stale-`dist` 不会再假通过。默认推荐二选一：

1. freshness helper 的 hermetic test：在 tempdir 构造 `src` / `dist` 时间戳关系，断言陈旧 package output 被明确拒绝
2. 等价的 bounded contract test：明确证明 host-side `build` / `test` 在 orchestrator output 过期时 fail closed

若采用非上述方案，review packet 必须明确解释其为何等价。

## 9. Formal Review-Swarm And Self-Review

本批虽是 cleanup slice，但仍触及 shared package surface + host-path acceptance，因此 formal review-swarm 仍默认必需。

reviewer 必须：

1. 检查实际源码，而不是只看 prompt / diff 摘要
2. 检查 `packages/orchestrator/src/index.ts` 与 `packages/hep-mcp/src/tools/orchestrator/tools.ts` / `dispatcher.ts` 的真实 package path
3. 检查冷态 gate 与 stale-`dist` 负例 gate 是否都存在，且没有通过 source-path 绕过 package boundary
4. 检查 packet 对“无第二套 authority / 无绕过 package surface / 无 lane 外 build-system 重写”的前提是否成立

外部 review-swarm 收敛后，self-review 仍必须再确认：

1. anti-drift gate 真正拦住的是 stale package output，而不是其它偶发条件
2. host 仍消费 `@autoresearch/orchestrator` package surface
3. `accept:new-rt-04` 与新增 helper 没有形成重复 authority

## 10. Post-Closeout Sync

closeout note 必须明确写清：

1. Batch 4 最终保留的 canonical cold-baseline gate 是什么
2. Batch 4 最终保留的 stale-`dist` 负向 gate 是什么
3. `accept:new-rt-04` 是被复用、升级还是被同等 canonical 命令替代
4. 是否需要更新 `.serena/memories/architecture-decisions.md`；若无需更新，必须明确写“无新增稳定不变量”
