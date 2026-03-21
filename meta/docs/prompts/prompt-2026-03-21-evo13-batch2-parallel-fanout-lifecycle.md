# Prompt: 2026-03-21 `EVO-13` Batch 2 — Parallel Fan-out + Team-Local Lifecycle / Control Plane

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `EVO-14` 预实现，也不是回切 `M-22 -> NEW-02/03/04` 或 `trace-jsonl` 的治理/可观测性 lane。目标只有一个：把 `EVO-13 Batch 1` 已经落下的 team-local unified runtime core，继续收束到一个**真实的 `parallel` 多 assignment fan-out 路径**，并补齐 **team-local lifecycle / timeout / stalled / replay-control-plane** 的源码、测试与审核证据，同时继续守住 `ResearchWorkspace` / task graph / event substrate 作为唯一 project-state SSOT。

## 0. Worktree Requirement

本批默认**应**在一个新的并行 worktree 中实施，而不是当前主 worktree。

推荐路径：

- `/Users/fkg/Coding/Agents/autoresearch-lab-evo13-batch2`

原因：

- 本批会同时触碰 `packages/orchestrator/src/`、`packages/orchestrator/tests/`、可能触碰 `packages/hep-mcp/tests/contracts/`、以及 `meta/` closeout 文档；
- `EVO-13 Batch 1` 已经把 shared runtime 热路径接通，下一批风险点集中在 live orchestrator lane，不适合与规划/讨论混在主 worktree；
- 本批需要新的 archive-first SOTA preflight、formal review-swarm、以及更高强度的 negative-path tests，独立 worktree 更容易保持边界清晰。

若当前还没有该 worktree：

1. 先创建并切换到新 worktree；
2. 再开始实施；
3. 不要在主 worktree 里直接把实现和规划混写。

## 1. Why This Batch Next

当前 live repo 状态已经非常明确，不再适合把 `EVO-13` 暂停在 “Batch 1 bridge slice 已经够用了”：

- `NEW-LOOP-01` 已稳定为 single-project substrate；
- `EVO-13 Batch 1` 已把 `executeUnifiedTeamRuntime()` 接到 live shared runtime lane，并让 `stage_gated` 成为第一个真实多 assignment path；
- tracker 已明确记录：`coordinationPolicy = parallel` 的完整 fan-out semantics 仍是 deferred with future value，因此 `EVO-13` 仍应保持 `in_progress`；
- `EVO-13` design memo / amendment 也都明确要求：team-local lifecycle / health / timeout / cascade stop 属于 `EVO-13`，而不是 `EVO-14`。

因此，现在最值得做的不是切去相邻 lane，而是把 `EVO-13` 自己尚未完成的 team-local runtime 核心补完：

1. `parallel` 不再只是“非 stage_gated 就按单 assignment bucket 串行循环”；
2. timeout / stalled / replay / control-plane 不再只是局部状态字段，而是有结构化事件与恢复语义；
3. intervention scope 分层不再只停在类型与最小权限表面。

相邻 lane 当前都不该先启动：

- 不是 `EVO-14`：`EVO-14` 明确依赖 `EVO-13`，且只负责 cross-run / fleet-level 调度与健康；本批要补的是 `EVO-13` 自己的 team-local 缺口。
- 不是 `M-22 -> NEW-02/03/04`：该 lane 当前存在 tracker / `REDESIGN_PLAN` 状态漂移；若要重启，应先做 re-baseline，而不是在 `EVO-13 Batch 1` closeout 之后抢占 runtime 主线。
- 不是 `trace-jsonl`：这是横切 observability / infra lane，不是当前 live team-runtime 热路径上的最短补口。

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `packages/orchestrator/src/` 内 `EVO-13` unified runtime 的 `parallel` 多 assignment fan-out 路径
2. team-local lifecycle / timeout / stalled / heartbeat / replay-control-plane 的最小完备实现
3. `TeamExecutionState`、structured event log、checkpoint/restore 与 derived live-status view 的关系补强
4. task / team / project intervention scope 的明确 fail-closed 语义
5. 与上述实现直接相关的 orchestrator tests
6. 若 live shared host contract 需要同步，则允许最小 `hep-mcp` contract test 同步
7. 本批 closeout 必需的 tracker / `AGENTS.md` / prompt 文档同步

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `EVO-14` 的 cross-run scheduler、fleet health、resource manager、global agent pool
- `EVO-15+` 的 community / publication / autonomous research community
- `trace-jsonl` 的全链路 event schema / SQLite trace index
- `M-22 -> NEW-02/03/04` 的审批治理 / CLI / 报告产物统一化
- `NEW-LOOP-01` substrate contract 重写
- transcript/session/log 反向成为 project-state SSOT
- root product shell / packaged end-user agent
- 旧 Python `TeamRoleOrchestrator` 的退役或整包重写
- provider-local runtime authority 迁移、`hep-mcp` / `hep-autoresearch` 大规模结构改造

若发现相邻缺口，只允许记录为 out-of-scope evidence，不得借机扩批。

## 3. Archive-First SOTA Preflight

本批**默认应执行新的 archive-first SOTA preflight**，且 prompt 中显式落路径。

### 3.1 Canonical archive path

- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch2-parallel-fanout-lifecycle/preflight.md`
- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch2-parallel-fanout-lifecycle/summary.md`
- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch2-parallel-fanout-lifecycle/manifest.json`

### 3.2 Worktree pointer

- `/Users/fkg/Coding/Agents/autoresearch-lab-evo13-batch2/.tmp/evo13-batch2-sota-preflight.md`

### 3.3 Preflight questions

preflight 只围绕以下问题，不要发散成完整 agent-framework landscape survey：

1. 单项目 team runtime 的真实 `parallel` fan-out / partial-failure / cascade-stop 语义应该如何最小建模
2. team-local `heartbeat / timeout / stalled` 应如何进入 checkpoint/replay，而不膨胀成 `EVO-14`
3. live-status / replay / compact replay 如何保持 derived view，而不是第二套 project state
4. bounded concurrency / backpressure / deterministic test harness 如何在 team-local runtime 中落地

### 3.4 Preflight boundary

- 优先参考 primary-source / official docs / runtime design materials；
- 真正约束后续实现的稳定结论，必须同步到 checked-in SSOT 或 `.serena/memories/architecture-decisions.md`；
- 只把与本批实现直接相关的结论带进 prompt，不要把临时调查全文抄进 closeout。

## 4. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch2-parallel-fanout-lifecycle.md`
6. `meta/docs/prompts/prompt-2026-03-21-evo13-batch1-team-runtime.md`
7. `meta/docs/prompts/prompt-phase5-impl-evo13-skeleton.md`
8. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
9. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`
10. `meta/docs/2026-03-07-single-user-multi-agent-runtime-sota.md`
11. `.serena/memories/architecture-decisions.md`

然后继续读取以下直接相关源码与测试：

12. `packages/orchestrator/src/team-unified-runtime.ts`
13. `packages/orchestrator/src/team-unified-runtime-types.ts`
14. `packages/orchestrator/src/team-unified-runtime-support.ts`
15. `packages/orchestrator/src/team-execution-runtime.ts`
16. `packages/orchestrator/src/team-execution-bridge.ts`
17. `packages/orchestrator/src/team-execution-types.ts`
18. `packages/orchestrator/src/team-execution-assignment-state.ts`
19. `packages/orchestrator/src/team-execution-interventions.ts`
20. `packages/orchestrator/src/team-execution-events.ts`
21. `packages/orchestrator/src/team-execution-view.ts`
22. `packages/orchestrator/src/team-execution-storage.ts`
23. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
24. `packages/orchestrator/tests/team-execution-state.test.ts`
25. `packages/orchestrator/tests/team-execution-runtime.test.ts`
26. `packages/orchestrator/tests/team-unified-runtime.test.ts`
27. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
28. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
29. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
30. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
31. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
32. `packages/hep-mcp/tests/contracts/executeManifestDelegatedLaunchContract.test.ts`
33. `packages/hep-mcp/tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts`
34. `packages/idea-core/src/idea_core/hepar/orchestrator.py`

禁止只看单文件就动手。

## 5. Current Reality To Fix

当前源码树里，`EVO-13 Batch 1` 已经打通 unified engine 与 live shared lane，但仍存在以下 Batch 2 级缺口：

1. `executeUnifiedTeamRuntime()` 在 `stage_gated` 之外仍按 assignment bucket 串行 `await` 执行，不是 “真实 parallel fan-out”
2. `markTimedOutAssignments()` 已存在，但 timeout/stalled 仍缺少完整 runtime-path integration、negative coverage 与 replay-oriented team view 证据
3. `applyTeamIntervention()` 已支持 `task/team/project` scope 类型，但当前行为仍偏最小实现，project-wide 语义与 fail-closed 边界需要复核
4. live-status / replay view 已存在，但仍需在真实 `parallel` + lifecycle path 下证明它们只是 derived control-plane surface

本批真正要补上的，不是“再多写几个 helper”，而是：

1. 一个真实的 `parallel` team-local execution path
2. timeout / stalled / cancel / cascade-stop 的结构化 team runtime 语义
3. checkpoint / restore / replay 在部分并行完成场景下的 determinism
4. 不越界到 `EVO-14` 的前提下，形成 team-local lifecycle/control-plane 的完整 closeout 证据

## 6. GitNexus Hard Gate

### 6.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 若当前 worktree dirty，默认运行 `npx gitnexus analyze --force`
4. 在改代码前，至少对以下符号做 `impact` / `context` 对齐：
   - `executeUnifiedTeamRuntime`
   - `executeAssignment`
   - `markTimedOutAssignments`
   - `applyTeamIntervention`
   - `buildTeamControlPlaneView`
   - `handleOrchRunExecuteAgent`

### 6.2 审核前

若本批新增/重命名符号或改变关键调用链：

1. 再次刷新 GitNexus（dirty worktree 默认 `--force`）
2. 运行 `detect_changes`
3. 必要时补 `impact` / `context`
4. 把 callers / affected flows / downstream surface 纳入 review packet

若 GitNexus MCP 仍不可用：

- 必须明确记录失败；
- 改用 direct source inspection + targeted tests；
- 不得假装已经拿到 graph-backed evidence。

## 7. Preferred Implementation Shape

### 7.1 Real parallel fan-out, not a renamed serial loop

本批优先目标是把 `coordinationPolicy = parallel` 变成**真实的多 assignment fan-out 路径**。

最低要求：

- 同一 `run_id` / `workspace_id` 下至少两个 assignments 能在 unified runtime 中进入真实 parallel execution
- 不是仅靠 for-loop + `await` 串行执行再把 policy 命名成 `parallel`
- 保持 per-assignment manifest isolation：`runId__assignmentId`
- 部分 assignment 失败 / timeout / cancellation 时，team state、replay、live-status 仍保持 deterministic

若实现需要 bounded concurrency：

- 允许引入最小并发控制，但不要扩成 global scheduler
- 必须有 deterministic test harness 证明行为，而不是靠肉眼推断

### 7.2 Lifecycle / timeout / stalled stays team-local

本批只允许实现 team-local 范围内的：

- heartbeat
- timeout
- stalled / needs_recovery / partial completion 的结构化状态迁移
- cancel / cascade_stop
- checkpoint / restore binding

不允许实现：

- cross-run queue
- fleet health
- resource scheduler
- global agent pool management

### 7.3 Intervention layering must be real or fail closed

当前类型层已有 `task` / `team` / `project` scope。

本批要求：

- 若某个 scope 有真实语义，就把它 first-class 化并写入 negative-path tests
- 若某个 scope 在当前 lane 无法真实落地，就明确 fail-closed，而不是保留模糊“以后再说”的假语义
- `cancel` / `cascade_stop` 必须继续走结构化事件流

### 7.4 Live status / replay remains derived

若需要补 view helper 或 compact replay：

- 只能消费 `TeamExecutionState` + structured event log + checkpoint bindings
- 不得产生新的 canonical state 文件
- 不得用 transcript/session/log 替代 substrate

## 8. Mandatory Tests And Acceptance

最低 acceptance：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/team-unified-runtime.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/compute-loop-writing-review-bridge.test.ts
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/executeManifestDelegatedLaunchContract.test.ts tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts
pnpm --filter @autoresearch/hep-mcp build
```

若本批触及 `packages/shared/` 导出或 schema/contract：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
```

本批必须新增并通过至少一条 integration gate，证明：

1. `parallel` 中至少两个 delegate assignments 由 unified runtime 真正 fan-out 管理，而不是串行 loop
2. 部分 assignment 完成、部分 timeout / blocked / cancelled 时，team state 与 replay 可解释且 deterministic
3. checkpoint / restore 后已完成 assignment 不会重复执行，未完成 assignment 可继续恢复
4. invalid intervention / permission-matrix violations 继续 fail-closed
5. live-status / replay surface 能从结构化 state 推导出 team-local status，而不形成第二套 authority

## 9. Review Packet Expectations

formal review 与 self-review 必须显式回答：

1. `parallel` path 是否真实存在于 `packages/orchestrator/src/` 的 non-test source，而不是只是命名或 wrapper 层“看起来支持”
2. `ResearchWorkspace` / task/event/checkpoint 是否仍是唯一 project-state SSOT
3. timeout / stalled / cancel / cascade-stop 是否进入结构化事件/状态流并可 replay
4. intervention scope 分层是否真实成立；若某 scope 未实现，是否已 fail-closed
5. live-status / replay 是否只是 derived view，而不是新的 authority
6. 本批是否错误吸入 `EVO-14` 或 cross-run scheduler 责任
7. 旧 Python `TeamRoleOrchestrator` 是否仍保持 reference-only，而没有在当前 lane 被顺手重写

reviewer 必须基于真实源码、真实调用链、真实 tests / acceptance 证据判断，不得只看 diff 摘要。

默认 reviewer trio：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

若其中任一 reviewer 不可用：

- 必须记录失败原因；
- 必须由人类明确确认 fallback；
- 禁止静默降级。

## 10. Required Deliverables

最少交付：

1. `packages/orchestrator/src/` 中补完的 `parallel` unified runtime core
2. team-local lifecycle / timeout / replay-control-plane 相关实现
3. 对应 orchestrator integration / regression tests
4. 必要时最小 `hep-mcp` host contract tests 同步
5. `meta/remediation_tracker_v1.json` 更新
6. `AGENTS.md` 当前进度摘要同步
7. 若本批沉淀出新的长期稳定架构不变量，更新 `.serena/memories/architecture-decisions.md`
8. 若本批改变了 `EVO-13` / `EVO-14` 边界叙事或 closeout ordering，再更新 `meta/REDESIGN_PLAN.md`
9. formal review / self-review artifacts
10. archive-first SOTA preflight artifacts 与路径记录

若没有新增稳定架构不变量，必须在 closeout 中明确写：

- “无新增稳定架构不变量，不更新 `.serena/memories/architecture-decisions.md`”

若没有设计层边界变化，必须明确写：

- “无设计层变更，不更新 `meta/REDESIGN_PLAN.md`”

## 11. Explicit Next-Step Recommendation Requirement

本批 closeout 结束时，必须给出条件化的下一批建议，并明确解释：

- 推荐下一批是继续 `EVO-13 Batch 3`，还是切到 `EVO-14`，还是回到非 runtime 相邻 lane
- 为什么是它
- 为什么不是相邻但当前不该启动的 lane

不得只写模糊的 “继续推进后续工作”。

## 12. Suggested Launch Instruction For The New Conversation

新对话建议直接使用下面这句作为启动指令：

```text
请在 /Users/fkg/Coding/Agents/autoresearch-lab-evo13-batch2 中按 /Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/prompt-2026-03-21-evo13-batch2-parallel-fanout-lifecycle.md 执行。先完成 AGENTS.md / tracker / REDESIGN_PLAN / IMPLEMENTATION_PROMPT_CHECKLIST / GitNexus 对齐，再做 archive-first SOTA preflight、实现、验收、formal review-swarm、self-review，并同步 tracker/AGENTS。
```
