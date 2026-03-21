# Prompt: 2026-03-21 `EVO-13` Batch 1 — Team-Local Unified Runtime Core

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `NEW-LOOP-01` follow-up，也不是 `EVO-14+` / `EVO-15+` 提前实现。目标只有一个：把当前已经存在但仍分散在 `orch_run_execute_agent.team`、`team-execution-*`、`research-loop/*` 与旧 Python `TeamRoleOrchestrator` 语义中的 team-local execution 能力，收束成一个真实、可导出的 orchestrator unified runtime core，并以源码、测试、review 证据证明它仍严格复用 single-project substrate 作为唯一 SSOT。

## 0. Worktree Requirement

本批默认**应**在一个新的并行 worktree 中实施，而不是当前主 worktree。

推荐路径：

- `/Users/fkg/Coding/Agents/autoresearch-lab-evo13-batch1`

原因：

- 本批会同时触碰 `packages/orchestrator/src/`、`packages/orchestrator/tests/`、可能触碰 `packages/hep-mcp/tests/contracts/`、以及 `meta/` closeout 文档；
- 当前对话已经积累了项目规划、Serena dashboard 排障、下一批路线讨论等上下文，不适合与正式实施混在同一线程；
- `EVO-13` 是单项目 runtime 收束的第一批，边界要比日常修补更清楚，最好在独立 worktree + 独立对话中完成。

若当前还没有该 worktree：

1. 先创建并切换到新 worktree；
2. 再开始实施；
3. 不要在主 worktree 里直接把实现和规划混写。

## 1. Why This Batch Next

当前 live repo 状态已经很清楚，不再适合停留在“继续讨论是否要做 `EVO-13`”：

- `NEW-05a Stage 3` 已完成，`idea-engine` provider-neutral seam 已稳定；
- `NEW-07` 已完成，team-local delegation permission / intervention vocabulary / A2A adapter 的最小语义已经落下；
- `NEW-RT-06` / `NEW-RT-07` 已完成，orchestrator-plane routing 与 host-side MCP sampling routing 已经落下；
- `NEW-COMP-02` 已完成，generic computation execution core + first host adapter 已落下；
- `NEW-LOOP-01` 已完成，`ResearchWorkspace` / `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint` / typed handoffs 已经构成 single-project substrate；
- 仓库中已经存在 `orch_run_execute_agent.team` → `executeTeamRuntimeFromToolParams()` → `executeTeamDelegatedRuntime()` 的 bridge slice，但它仍只是 team-local bridge，而不是正式的 unified engine。

因此，现在最值得做的不是再次扩外围能力，而是把已经落地的 substrate 与 team bridge 收束成 `EVO-13` 的第一批正式 runtime 核心。

本批之后的顺序建议才会重新轮到：

- `M-22 -> NEW-02/03/04` 审批产物统一化
- `trace-jsonl`
- `M-13 + NEW-R14` 债务收口

也就是说，本批就是当前最推荐启动的 lane，而不是再继续拖延。

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `packages/orchestrator/src/` 内的 team-local unified runtime core
2. `EVO-13` Batch 1 所需的最小 typed delegation protocol surface
3. `TeamExecutionState` 与 `ResearchWorkspace` / task/event substrate 的显式关系收口
4. team-local live-status / replay / intervention 的**只读 view / control-plane surface**
5. 与上述实现直接相关的 orchestrator tests
6. 若 shared runtime 入口通过 hep-mcp host contract 暴露，则允许最小 contract test 同步
7. 为本批 closeout 必需的 tracker / `AGENTS.md` / prompt 文档同步

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `EVO-14` 的 cross-run / fleet-level scheduler、agent pool health、resource manager
- `EVO-15+` 的 community / publication / autonomous research community
- `NEW-LOOP-01` substrate contract 重写
- transcript/session view 反向成为 project-state SSOT
- root product shell / packaged agent
- `skills-market` 产品化或 remote skill lifecycle
- `trace-jsonl`
- `M-22` / `NEW-02/03/04`
- `hep-mcp` 或 `hep-autoresearch` 的大规模 authority 迁移
- 旧 Python `TeamRoleOrchestrator` 的退役或整包重写

若发现相邻缺口，只允许记录为 out-of-scope evidence，不得借机扩批。

## 3. Completion Target

本批真正要补上的，不是“再加一点 team runtime helper”，而是：

1. 一个真实的 orchestrator unified runtime core
2. 该 core 明确复用 `ResearchWorkspace` / `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint` 作为 SSOT
3. 该 core 支持至少一个真实的 team-local coordination path，而不只是单 assignment bridge
4. 该 core 对 permission matrix、interventions、checkpoint/restore、live-status/replay 都有源码级与测试级证据

### 3.1 什么算本批成功

以下条件必须同时成立：

- `packages/orchestrator/src/` 中出现一个真实 exported unified runtime surface，名称可讨论，但职责必须明确；
- 该 surface 不是 dead helper，不是 tests-only wrapper，也不是 provider-local host shim；
- 它消费现有 `team-execution-*` 与 `research-loop/*`，而不是复制第二套 project state；
- `stage_gated` 与 `supervised_delegate` 至少有一个真实多 assignment path 被 integration tests 锁定；
- permission matrix 非法 delegation / intervention 会 fail-closed；
- `cancel` / `cascade_stop` 保持 first-class 且可 replay；
- live-status / replay surface 明确只是 view/control-plane layer，而不是新的 SSOT；
- 本批没有错误吸入 `EVO-14` 或 community-scale 责任。

### 3.2 什么不算成功

以下都 **不算** `EVO-13 Batch 1` closeout：

- 继续只在 `orch_run_execute_agent.team` 的局部 bridge 上叠更多 if/else
- 继续只有 single delegate / one-assignment happy path
- 只增加注释、tracker note、设计文档
- 只把 team runtime 再 export 一层，但没有真正形成 unified engine
- 让 dashboard / transcript / session surface 变成 project-state authority
- 顺手把 `EVO-14` 的 scheduler / fleet health 吸进来

## 4. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch1-team-runtime.md`
6. `meta/docs/prompts/prompt-phase5-impl-evo13-skeleton.md`
7. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
8. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`
9. `.serena/memories/architecture-decisions.md`

然后继续读取以下直接相关源码与测试：

10. `packages/orchestrator/src/orch-tools/agent-runtime.ts`
11. `packages/orchestrator/src/team-execution-bridge.ts`
12. `packages/orchestrator/src/team-execution-runtime.ts`
13. `packages/orchestrator/src/team-execution-types.ts`
14. `packages/orchestrator/src/team-execution-state.ts`
15. `packages/orchestrator/src/team-execution-storage.ts`
16. `packages/orchestrator/src/team-execution-bootstrap.ts`
17. `packages/orchestrator/src/team-execution-interventions.ts`
18. `packages/orchestrator/src/research-loop/runtime.ts`
19. `packages/orchestrator/src/research-loop/workspace-types.ts`
20. `packages/orchestrator/src/research-loop/task-types.ts`
21. `packages/orchestrator/src/research-loop/event-types.ts`
22. `packages/orchestrator/src/research-loop/checkpoint-types.ts`
23. `packages/orchestrator/src/research-loop/handoff-types.ts`
24. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
25. `packages/orchestrator/src/index.ts`
26. `packages/orchestrator/tests/team-execution-state.test.ts`
27. `packages/orchestrator/tests/team-execution-runtime.test.ts`
28. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
29. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
30. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
31. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
32. `packages/hep-mcp/tests/contracts/executeManifestDelegatedLaunchContract.test.ts`
33. `packages/hep-mcp/tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts`
34. `packages/idea-core/src/idea_core/hepar/orchestrator.py`

禁止只看单文件就动手。

## 5. GitNexus Hard Gate

### 5.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 若当前 worktree dirty，默认运行 `npx gitnexus analyze --force`
4. 在改代码前，至少对以下符号做 `impact` / `context` 对齐：
   - `handleOrchRunExecuteAgent`
   - `executeTeamRuntimeFromToolParams`
   - `executeTeamDelegatedRuntime`
   - `ResearchLoopRuntime`
   - `TeamRoleOrchestrator`

### 5.2 审核前

若本批新增/重命名符号或改变关键调用链：

1. 再次刷新 GitNexus（dirty worktree 默认 `--force`）
2. 运行 `detect_changes`
3. 必要时补 `impact` / `context`
4. 把 callers / affected flows / downstream surface 纳入 review packet

若 GitNexus MCP 仍不可用：

- 必须明确记录失败；
- 改用 direct source inspection + targeted tests；
- 不得假装已经拿到 graph-backed evidence。

## 6. Preferred Implementation Shape

### 6.1 First-class unified engine surface

优先实现一个新的 orchestrator runtime surface，例如：

- `packages/orchestrator/src/unified-engine.ts`

名称可审查后微调，但职责必须是：

- 统一 team-local execution entrypoint
- 组合现有 `team-execution-*` + `research-loop/*` + delegated runtime
- 对外暴露 team-local status / replay / checkpoint/restore 结果
- 不重建第二套 project state

### 6.2 Delegation protocol should be typed and explicit

本批允许且鼓励落一个最小 typed delegation contract，例如：

- `packages/orchestrator/src/delegation-protocol.ts`

最小要求：

- 明确 TASK / EXPECTED_OUTCOME / REQUIRED_TOOLS / MUST_DO / MUST_NOT_DO / CONTEXT 这类 sectioned protocol 的 typed representation
- 它是 team-local execution contract，不是 prompt decoration
- 它与 permission matrix / handoff kind / task kind 兼容
- 它不能把 provider-specific runtime policy 写死进去

### 6.3 Live status / replay is derived, not authoritative

若需要新增 view helper，允许例如：

- `packages/orchestrator/src/team-execution-view.ts`

但必须满足：

- 只消费 `TeamExecutionState` + `ResearchEvent` + checkpoint binding
- 不产生新的 canonical state 文件
- 不用 transcript/session/log 替代 substrate

### 6.4 Team-local lifecycle only

本批只允许实现 team-local 范围内的：

- heartbeat / timeout / stalled / cancel / cascade_stop
- assignment-level / team-level intervention
- checkpoint/restore binding

不允许实现：

- cross-run queue
- fleet health
- resource scheduler
- global agent pool management

### 6.5 Python orchestrator stays reference-only by default

`packages/idea-core/src/idea_core/hepar/orchestrator.py` 在本批默认只作为语义参考面：

- 对齐其 `parallel` / `sequential` / `stage gate` 语义
- 不要求本批就迁移或删除它
- 除非出现 closeout blocker，不要在 Python 侧做实现级扩批

## 7. Mandatory Tests And Acceptance

最低 acceptance：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/compute-loop-writing-review-bridge.test.ts
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/executeManifestDelegatedLaunchContract.test.ts tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts
pnpm --filter @autoresearch/hep-mcp build
```

若本批触及 `packages/shared/` 导出或 schema/contract：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
```

若 unified engine 新增多 assignment / `stage_gated` path，必须新增并通过至少一条 integration gate，证明：

- 同一 workspace / task graph 上至少两个 delegate assignments 能被统一 runtime 管理；
- `stage_gated` 中前一阶段失败会阻断后续 assignment；
- `cancel` / `cascade_stop` 会改变结构化 team state；
- checkpoint/restore 后已完成 assignment 不会重复执行；
- live-status / replay surface 可以从结构化 state 推导出当前 team-local status。

## 8. Review Packet Expectations

formal review 与 self-review 必须显式回答：

1. unified runtime 是否真实存在于 `packages/orchestrator/src/` 的 non-test source，而不是只是 bridge 增厚
2. `ResearchWorkspace` / task/event/checkpoint 是否仍是唯一 project-state SSOT
3. permission matrix 是否真实限制 delegation / intervention，而不是形式化存在
4. `cancel` / `cascade_stop` 是否被 first-class 建模并进入结构化事件/状态流
5. live-status / replay 是否只是 derived view，而不是新的 authority
6. 本批是否错误吸入 `EVO-14` 或 community-scale 责任
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

## 9. Required Deliverables

最少交付：

1. `packages/orchestrator/src/` 中的 unified runtime core
2. 若需要，最小 typed delegation protocol surface
3. 对应 orchestrator integration/regression tests
4. 必要时最小 hep-mcp host contract tests 同步
5. `meta/remediation_tracker_v1.json` 更新
6. `AGENTS.md` 当前进度摘要同步
7. 若本批沉淀出新的长期稳定架构不变量，更新 `.serena/memories/architecture-decisions.md`
8. 若本批改变了 `EVO-13` / `EVO-14` 边界叙事或 closeout ordering，再更新 `meta/REDESIGN_PLAN.md`
9. formal review / self-review artifacts

若没有新增稳定架构不变量，必须在 closeout 中明确写：

- “无新增稳定架构不变量，不更新 `.serena/memories/architecture-decisions.md`”

若没有设计层边界变化，必须明确写：

- “无设计层变更，不更新 `meta/REDESIGN_PLAN.md`”

## 10. Explicit Next-Step Recommendation Requirement

本批 closeout 结束时，必须给出条件化的下一批建议，并明确解释：

- 推荐下一批是 `M-22 -> NEW-02/03/04`，还是 `trace-jsonl`，还是继续 `EVO-13 Batch 2`
- 为什么是它
- 为什么不是相邻 lane

不得只写模糊的 “继续推进后续工作”。

## 11. Suggested Launch Instruction For The New Conversation

新对话建议直接使用下面这句作为启动指令：

```text
请按 /Users/fkg/Coding/Agents/autoresearch-lab/meta/docs/prompts/prompt-2026-03-21-evo13-batch1-team-runtime.md 执行。先完成 AGENTS.md / tracker / REDESIGN_PLAN / IMPLEMENTATION_PROMPT_CHECKLIST / GitNexus 对齐，再按 prompt 实施、验收、formal review-swarm、self-review，并同步 tracker/AGENTS。
```
