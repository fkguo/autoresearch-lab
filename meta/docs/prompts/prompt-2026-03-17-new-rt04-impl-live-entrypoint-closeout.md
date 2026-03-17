# Prompt: 2026-03-17 Standalone — `NEW-RT-04` Live Entrypoint Closeout

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `NEW-05a` follow-up，也不是 `NEW-07` / `EVO-13` 提前实现。目标只有一个：把已经存在但仍停留在 test/library 层的 `AgentRunner` + `RunManifestManager` 接到一个真实的 shared runtime surface 上，使 `NEW-RT-04` 可以按源码与验收证据真实 closeout。

## 0. Why This Batch Next

当前 live repo 状态已经收敛到一个很明确的顺序：

- `NEW-05a-shared-boundary`
- `NEW-05a-formalism-contract-boundary`
- `NEW-05a-idea-core-domain-boundary`
- `NEW-05a-stage3`
- `NEW-05a-runtime-root-boundary`

以上 lane 都已 closeout；不要重开。

相邻但仍未完成的项是 `NEW-RT-04`。`meta/remediation_tracker_v1.json` 与 `meta/REDESIGN_PLAN.md` 当前都明确承认同一个 blocker：

- `RunManifestManager` / checkpoint / resume 代码与 targeted tests 已存在；
- 但 **没有 live shared entrypoint / production caller** 实际消费 `AgentRunner` 或 `RunManifestManager`；
- 因此它不能继续被当作 live runtime capability。

本批不是再次做 reality-audit，也不是再次“下调叙事”。前一轮 repair 已经完成这个动作。此处的目标是把剩下的最后一段真正补上。

## 1. Hard Scope Boundary

本批只允许覆盖：

1. `NEW-RT-04`
2. 为 `NEW-RT-04` closeout 必要的最小 orchestrator shared runtime wiring
3. 与该 wiring 直接相关的 tests / tracker / `AGENTS.md` / `meta/REDESIGN_PLAN.md` 同步

### 明确禁止

不要启动、顺手吸收、或部分实现以下 lane：

- 任意 `NEW-05a-*`
- `NEW-07`
- `EVO-13`
- `EVO-14+`
- `NEW-LOOP-01` 的语义重写
- `NEW-COMP-02` / compute runner 重构
- 新的 provider-local host wrapper / `hep-mcp` authority
- root product shell / packaged agent
- A2A / registry / delegation permission matrix / team lifecycle / heartbeat
- 全仓 baseline 大扫除

若发现外部问题，只允许记录为 out-of-scope evidence，不得借机扩批。

## 2. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-17-new-rt04-impl-live-entrypoint-closeout.md`
6. `meta/docs/prompts/prompt-2026-03-15-retro-closeout-repair.md`

然后读取与 `NEW-RT-04` 直接相关的 live code / tests：

7. `packages/orchestrator/src/agent-runner.ts`
8. `packages/orchestrator/src/agent-runner-ops.ts`
9. `packages/orchestrator/src/run-manifest.ts`
10. `packages/orchestrator/src/index.ts`
11. `packages/orchestrator/src/research-loop/index.ts`
12. `packages/orchestrator/src/research-loop/runtime.ts`
13. `packages/orchestrator/src/computation/index.ts`
14. `packages/orchestrator/tests/agent-runner.test.ts`
15. `packages/orchestrator/tests/agent-runner-manifest.test.ts`
16. `packages/orchestrator/tests/run-manifest.test.ts`
17. `packages/orchestrator/tests/research-loop-smoke.test.ts`
18. `packages/orchestrator/tests/compute-loop-execution.test.ts`
19. repo 内所有 `new AgentRunner(` 与 `new RunManifestManager(` callsites

若阅读后发现 live consumer 还分散在别处，必须继续补读；禁止只看单文件就动手。

## 3. GitNexus Hard Gate

开工前按 checklist 做 GitNexus freshness：

1. 读 `gitnexus://repo/{name}/context`
2. dirty worktree 默认执行 `npx gitnexus analyze --force`
3. 对齐至少以下符号：
   - `AgentRunner`
   - `RunManifestManager`
   - `ResearchLoopRuntime`
   - `executeComputationManifest`

若 GitNexus MCP 仍报 `Transport closed`：

- 必须明确记录失败；
- 改用 direct source inspection + exact targeted tests；
- 不得假装已经拿到成功的 post-change graph evidence。

## 4. Completion Target

`NEW-RT-04` 的 closeout 现在缺的不是更多 checkpoint helpers，而是：

1. 一个 **真实的 shared runtime surface**
2. 该 surface 在 non-test source 中 **实际消费** `AgentRunner` + `RunManifestManager`
3. `resume_from` / `last_completed_step` 通过这个 surface 被 integration test 真实触发

### 4.1 首选收口方式

优先把 durable execution 接到 orchestrator 自己的 shared runtime seam，而不是 provider-local host layer。

优先级顺序：

1. `packages/orchestrator/src/research-loop/` 中的 delegated-task / runtime seam
2. 现有 orchestrator shared execution surface
3. 只有在以上两者都被源码证伪时，才考虑一个新的最小 shared exported runtime helper

### 4.2 什么算“有效 shared entrypoint”

以下条件必须同时成立：

- 调用点位于 `packages/orchestrator/src/**` 的 non-test source
- 不是 dead helper，也不是“仅为测试暴露”的 wrapper
- 该 surface 被 `packages/orchestrator/src/index.ts` 或现有 shared entrypoint 正式导出/接入
- 通过该 surface 触发时，`AgentRunner` 会创建或加载 run manifest
- 崩溃恢复 / 重入时，`RunManifestManager.shouldSkipStep()` 的结果会改变实际执行路径

### 4.3 明确不接受的伪收口

以下都 **不算** closeout：

- 继续只在 tests 中实例化 `AgentRunner`
- 仅增加 comments / docs / tracker note
- 仅新增一个未被 runtime 消费的 helper
- 只把 `AgentRunner` 重新 export 到更多 barrel
- 用 provider-local `hep-mcp` adapter 假装 shared runtime 已存在
- 把 `NEW-RT-04` 再次下调为 narrative-only foundation

## 5. Preferred Implementation Shape

实现不要求死守某个类名，但必须满足下面的边界：

### 5.1 推荐方向

新增一个最小 shared runtime executor，用于执行一类已有 orchestrator task / handoff，并在其中：

- 构造 `RunManifestManager`
- 构造 `AgentRunner`
- 将 manifest path / run id / checkpoint persistence 接到现有 run/workspace layout
- 在恢复时显式读取已有 manifest 并传给 `AgentRunner.run(...)`

### 5.2 推荐最小数据流

1. shared runtime surface 接收 `project_root` / `run_id` / messages / tools 或已有 task context
2. 从现有 run/workspace layout 解析 manifest 存放位置
3. 首次执行时创建 manifest
4. tool-use 成功后写 checkpoint
5. 再次调用且带 `resume_from` 时跳过已完成 step
6. 通过 event/result surface 暴露 “恢复后哪些步骤被跳过”

### 5.3 与现有 lane 的关系

- 可以复用 `research-loop` / delegated-task seam
- 可以复用现有 orchestrator tracing / routing / approval behaviors
- 不要改写 `NEW-LOOP-01` 的 task taxonomy
- 不要把 `EVO-01/02/03` 或 `EVO-13` 的 broader runtime 直接吸进来

## 6. Acceptance Requirements

最低 acceptance：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator test -- tests/run-manifest.test.ts tests/agent-runner-manifest.test.ts
pnpm --filter @autoresearch/orchestrator build
```

此外必须新增并通过至少一条 **non-test shared entrypoint integration gate**。验收必须证明：

- 真实 shared surface 会创建/读取 manifest
- 首次执行会写入 `last_completed_step`
- 模拟崩溃 / 二次调用后会走 resume path
- 已完成步骤不会重复执行

若接线触碰 `research-loop`：

```bash
pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-runtime.test.ts tests/research-loop-smoke.test.ts
```

若接线触碰 compute/bridge runtime：

```bash
pnpm --filter @autoresearch/orchestrator test -- tests/compute-loop-execution.test.ts tests/compute-loop-feedback.test.ts
```

若需要最小 host contract 验证，可补充：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/compute-loop-contract.test.ts
pnpm --filter @autoresearch/hep-mcp build
```

若 full build / full test 因 baseline 外问题失败，必须在 closeout note 中明确区分：

- `scoped gates passed`
- `canonical baseline still fails outside scope`

## 7. Review Packet Expectations

本批 formal review / self-review 必须显式回答：

1. 新增的 non-test consumer 是否真的是 shared runtime surface，而不是 dead helper
2. `AgentRunner` / `RunManifestManager` 是否仍只在 tests 中“真用”
3. `resume_from` / `last_completed_step` 是否通过真实接线面影响行为，而不是只测 helper
4. 是否错误扩大成 `NEW-07` / `EVO-13` / new product shell
5. tracker / `AGENTS.md` / `meta/REDESIGN_PLAN.md` 是否与 live code judgment 一致

## 8. Required Deliverables

最少交付：

1. `packages/orchestrator/src/**` 中一个真实 shared runtime consumer
2. 对应 integration / regression tests
3. `NEW-RT-04` tracker 状态与 note 更新
4. `AGENTS.md` 当前进度摘要同步
5. 若 closeout judgment 改变，`meta/REDESIGN_PLAN.md` 中 `NEW-RT-04` 描述同步
6. formal review / self-review artifacts

## 9. Suggested Prompt Closeout Language

若本批成功 closeout，最终结论应类似：

- `NEW-RT-04` 不再只是 library/test foundation
- `AgentRunner` / `RunManifestManager` 现已被某个 orchestrator shared runtime surface 真正消费
- crash recovery / `resume_from` 通过该 live surface 被 integration test 锁定
- 本批未启动 `NEW-07` / `EVO-13` / provider-local runtime shell

若源码审计后发现无法在 bounded 范围内实现上述目标，必须停止并如实记录 blocker；不要伪装 closeout。
