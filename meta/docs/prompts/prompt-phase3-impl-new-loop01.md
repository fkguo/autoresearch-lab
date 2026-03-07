# Phase 3 Implementation: `NEW-LOOP-01` — Single-User Research Loop Runtime

> **状态**: implementation prompt 草稿（基于 2026-03-07 loop/OpenClaw/SOTA/EVO-13 专项调研回灌）  
> **目标项**: `NEW-LOOP-01`  
> **定位**: Phase 3 近中期主干；把单用户、单项目 research loop 从线性阶段机推进为 workspace-first 的 event/task graph substrate。  
> **硬约束**: 本项是 **single-user project substrate**，不是完整 multi-agent team runtime；完整单项目多 agent 执行层留给 `EVO-13`。

---

## 0. 开工前硬门禁（必须逐条满足）

### 0.1 必读文件

开工前必须完整读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `meta/docs/sota-monorepo-architecture-2026-03-06.md`
7. `meta/docs/2026-03-07-openclaw-loop01-research-outline.md`
8. `meta/docs/2026-03-07-single-user-multi-agent-runtime-sota.md`
9. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
10. 相关代码与测试（至少 `packages/orchestrator/src/` 与 `packages/orchestrator/tests/`）

### 0.2 GitNexus 门禁

实施前必须：

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. analyze 后重新读取 `gitnexus://repo/autoresearch-lab/context`；若 resource 仍短暂显示 stale，但 CLI 已明确返回 up-to-date / already up to date，则把该 CLI 输出一并纳入审查证据
4. 读取匹配任务的 GitNexus skill（至少 exploring；必要时 impact-analysis）
5. 在改代码前，用 GitNexus 明确以下锚点与调用面：
   - `AgentRunner`
   - `StateManager`
   - `run-manifest` / `ledger-writer`
   - `McpClient`
   - 现有 orchestrator tests

审核前若当前 index 已不反映工作树，必须再次刷新，并用 `detect_changes` / `impact` / `context` 形成 post-change 证据。

### 0.3 tracker 门禁

开工前：

- 把 `NEW-LOOP-01` 更新为 `in_progress`
- 写明当前实际模型

完成后：

- 只有在 acceptance commands 全绿 + `review-swarm` 收敛 + `self-review` 无 blocking + tracker/memory/AGENTS 同步后，才可标 `done`

### 0.4 依赖校验门禁

开工前必须在 `meta/remediation_tracker_v1.json` 中核对以下依赖状态：

- `NEW-WF-01`
- `UX-06`
- `NEW-RT-06`

要求：

- `UX-06` 与 `NEW-RT-06` 必须为 `done`；
- `NEW-WF-01` 若仍非 `done`，必须先报告 blocker，不得在错误前提上启动 `NEW-LOOP-01` 实现。

---

## 1. 项目级定位（必须先对齐）

### 1.1 本项真正要做什么

`NEW-LOOP-01` 的目标是：

- 在 `packages/orchestrator/` 中建立 **single-user, single-project** research runtime substrate；
- 让研究执行以 `ResearchWorkspace` / task graph / event log 为核心，而不是以线性阶段枚举为核心；
- 让 interactive / autonomous 共用同一 substrate，仅 policy 不同；
- 为 `EVO-01/02/03` 提供 typed handoff seams；
- 至少让 `EVO-01` compute handoff 与 `EVO-02` feedback handoff 各有 1 个 typed interface stub + integration smoke path；
- 为 future `EVO-13` 团队执行层留下稳定扩展面。

### 1.2 本项明确不做什么

本项**不做**：

- 完整 multi-agent runtime
- `sessions_spawn/send/history` 或 OpenClaw 式 subagent runtime
- team checkpoint / cascade stop / lifecycle / heartbeat / health
- per-agent workspace / per-agent session store
- category routing / skill registry / provider orchestration
- 社区级 registry / publication / reputation / evolution layer
- `NEW-DISC-01` D4/D5
- `NEW-SEM-06b/d/e`
- `RT-07` 返工
- `EVO-13` 提前实现

### 1.3 三层边界（必须守住）

始终按以下三层理解：

1. `NEW-LOOP-01` = 单用户 / 单项目 substrate
2. `EVO-13` = 单项目内多 agent team execution runtime
3. `EVO-15/16` = 社区级多团队

**禁止**借“single-user ≠ single-agent”之名，把 `EVO-13` scope 偷带进 `NEW-LOOP-01`。

---

## 2. 实现目标（本项完成定义）

完成后至少满足：

- [ ] 显式存在 `ResearchWorkspace` / `ResearchNode` / `ResearchEdge` / `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint` / `LoopIntervention` 抽象
- [ ] 运行时存在 event/task graph substrate，而不是只能依赖阶段枚举推导状态
- [ ] 合法回跳路径被建模并可测试：`compute -> literature|idea`、`review -> evidence_search`、`finding -> draft_update`
- [ ] interactive / autonomous 两种模式共享同一 substrate，仅 policy 不同
- [ ] `ResearchTask` / `ResearchEvent` 至少预留 `source` 与可空 `actor_id`
- [ ] 存在 typed handoff stubs（供 `EVO-01/02/03` 与 future `EVO-13` 消费）
- [ ] 存在最小外部任务注入 seam（如 `injectTask(...)` / `appendDelegatedTask(...)`）
- [ ] `UX-06` 阶段标签仍可作 UX hints，但不再是执行内核的互斥状态
- [ ] `EVO-01/02/03` 的依赖说明已明确为建立在 `NEW-LOOP-01` substrate 之上；若 closeout 时发现 `meta/REDESIGN_PLAN.md` 相邻描述仍未对齐，需一并同步
- [ ] 本项未顺手启动 `EVO-13` / `EVO-15/16` / `NEW-DISC-01` D4/D5 / `NEW-SEM-06b/d/e`

---

## 3. 代码组织约束（遵守 200 LOC / SRP）

`REDESIGN_PLAN.md` 把本项锚定为 `packages/orchestrator/src/research-loop.ts` + workspace/task graph types，但项目级硬规则要求：

- 单文件不得超过 200 LOC 有效代码
- 单文件单一职责
- `index.ts` 仅做 re-export

因此本项**允许且更推荐**使用模块目录，例如：

- `packages/orchestrator/src/research-loop/index.ts`（仅 re-export）
- `packages/orchestrator/src/research-loop/workspace-types.ts`
- `packages/orchestrator/src/research-loop/event-types.ts`
- `packages/orchestrator/src/research-loop/checkpoint-types.ts`
- `packages/orchestrator/src/research-loop/runtime.ts`
- `packages/orchestrator/src/research-loop/interventions.ts`
- `packages/orchestrator/src/research-loop/task-injection.ts`

禁止把全部逻辑塞进一个巨大的 `research-loop.ts`。

---

## 4. Test-first / smoke-first 实施顺序（硬要求）

### 4.1 先补 tests / fixtures / baselines，再写实现

在任何实现代码之前，先补最小测试面。至少新增：

- `packages/orchestrator/tests/research-loop-types.test.ts`
- `packages/orchestrator/tests/research-loop-runtime.test.ts`
- `packages/orchestrator/tests/research-loop-smoke.test.ts`
- 若需要序列化/事件流快照：
  - `packages/orchestrator/tests/fixtures/research-loop/*`
  - 对应 baseline / snapshot 文件

### 4.2 先红后绿的测试要求

至少覆盖：

1. **类型与 invariant**
   - workspace graph 构造
   - node/edge kinds
   - task/event/checkpoint shape
   - 非法 graph / missing refs fail-closed

2. **runtime 行为**
   - active tasks 更新
   - 事件驱动迁移
   - 合法回跳路径
   - 非法 transition 被拒绝

3. **interactive / autonomous dual-mode**
   - 两种模式共享同一 substrate
   - 行为差异只来自 policy
   - 不允许两套状态格式分叉

4. **审计字段与扩展 seam**
   - `ResearchEvent` / `ResearchTask` 至少支持：
     - `source: 'user' | 'agent' | 'system'`
     - `actor_id?: string | null`
   - handoff stub 的 payload/typing
   - 外部任务注入 seam 不破坏 workspace graph / event log SSOT

5. **smoke path**
   - 至少一条最小非线性路径：
     - `literature -> idea -> compute -> literature|idea -> draft/review`
   - `EVO-01` compute handoff 与 `EVO-02` feedback handoff 至少各有 1 条 integration smoke path

> 若当前项目无专门 eval harness，本项仍必须 test-first；不得以“暂无 eval”跳过验证。

---

## 5. 实现子任务拆分（建议顺序）

### 5.1 L1 — Workspace / graph types

实现最小对象模型：

- `ResearchWorkspace`
- `ResearchNode`
- `ResearchEdge`
- `ResearchTask`
- `ResearchEvent`
- `ResearchCheckpoint`
- `LoopIntervention`

`ResearchNode.kind` 至少覆盖：

- `question`
- `idea`
- `evidence_set`
- `compute_attempt`
- `finding`
- `draft_section`
- `review_issue`
- `decision`

### 5.2 L2 — Event/task runtime

落地最小 runtime：

- append-only `ResearchEvent` log
- active task set
- event-driven transition
- 最小 checkpoint / restore

同时要求：

- `ResearchEvent` 支持 `source` 与可空 `actor_id`
- 事件语义优先服务审计与 future extension，不服务 chat transcript

### 5.3 L3 — Valid backtrack semantics

显式建模并测试：

- `compute -> literature`
- `compute -> idea`
- `review -> evidence_search`
- `finding -> draft_update`

禁止把这些回跳用“临时 if 分支 + 阶段枚举魔改”偷渡实现。

### 5.4 L4 — Dual mode on one substrate

interactive / autonomous：

- 共享同一 runtime state
- 共享同一 workspace graph
- 共享同一 checkpoint/event log
- 仅 policy / intervention handling 不同

### 5.5 L5 — Handoff stubs + injection seam

至少提供 typed stubs：

- `ComputeHandoff`
- `ReviewHandoff`
- `LiteratureHandoff`
- 可选 `WritingHandoff`

同时提供最小外部任务注入 seam：

- `injectTask(...)` / `appendDelegatedTask(...)` 或等价接口

**注意**：

- 这里只做 typed seam definitions，不做 runtime bridge
- 不做真实 handoff execution / delegation runtime / inter-agent communication
- 不做真实 A2A runtime
- 不做 `sessions_spawn/send/history`
- 不做 team checkpoint / role assignment / cascade stop

---

## 6. 与现有代码的衔接要求

### 6.1 必须对读的现有锚点

至少检查：

- `packages/orchestrator/src/agent-runner.ts`
- `packages/orchestrator/src/state-manager.ts`
- `packages/orchestrator/src/run-manifest.ts`
- `packages/orchestrator/src/ledger-writer.ts`
- `packages/orchestrator/src/types.ts`
- `packages/orchestrator/tests/agent-runner.test.ts`
- `packages/orchestrator/tests/orchestrator.test.ts`

### 6.2 与 `research-team` 的关系

本项**不要求**让 `research-team` 立即消费新 substrate，但实现时必须确保：

- future `EVO-13` / `research-team bridge` 有明确接入面；
- 不把 `research-team` 当前 workflow 直接硬编码进 substrate；
- 通过 typed handoff / task injection seam 为未来桥接留位。

### 6.3 与 `EVO-13` memo 的关系

实现时必须遵守 `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md` 的约束：

- `EVO-13` 将来只能扩展 substrate，不能替代 substrate；
- 团队协调层必须引用 workspace/task/event，而不是复制第二套 project state；
- 本项的设计要为 future `EVO-13` 消费 substrate 做准备，但不能提前实现它。

---

## 7. 明确禁止事项

本项禁止：

- 把 `NEW-LOOP-01` 与 `EVO-13` 合并成一个大 prompt
- 在本项引入 full multi-agent runtime
- 引入 OpenClaw channel/gateway/provider 叙事来主导研究内核
- 让 session transcript 成为项目 SSOT
- 为 interactive / autonomous 各造一套 runtime
- 顺手实现 `RT-07` / `NEW-DISC-01` D4/D5 / `NEW-SEM-06b/d/e`
- `as any` / `@ts-ignore` / 静默吞错 / 破窗离场

---

## 8. 总验收命令

至少运行：

```bash
pnpm --filter @autoresearch/orchestrator test
pnpm --filter @autoresearch/orchestrator build
pnpm -r test
pnpm -r build
```

若触及 `packages/shared/`：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
```

若意外触及 `packages/idea-core/` 或 `skills/research-team/`（原则上不应）：

- 必须说明为何没有范围漂移
- 必须补跑相邻测试
- 必须在 review packet 中解释必要性

---

## 9. Review-Swarm / Self-Review（硬门禁）

### 9.1 正式 `review-swarm`

实现完成且 acceptance 通过后，必须执行正式 `review-swarm`：

- reviewer 固定：`Opus` + `OpenCode(kimi-for-coding/k2p5)`
- 这是对项目默认 `review-swarm` 配置的**有意 override**，原因是当前实现 lane 已由用户固定指定该 reviewer pair；不得静默回退到默认 reviewer
- 若本地默认 reviewer 不一致，必须显式 override
- 建议命令（若 `skills/review-swarm/SKILL.md` 语法未变）：
  ```bash
  python3 skills/review-swarm/scripts/bin/run_multi_task.py \
    --out-dir .review/loop01-impl-review \
    --system <review_system.md> \
    --prompt <review_packet.md> \
    --models claude/opus,kimi-for-coding/k2p5 \
    --backend-output claude=opus.json \
    --backend-output opencode=k2p5.json \
    --check-review-contract
  ```
  若本地 skill 语法不同，以 `skills/review-swarm/SKILL.md` 的当前 canonical entrypoint 为准
- 若显式传 `--backend-output`：相对路径会自动解析到 `--out-dir` 下，因此只传裸文件名（如 `opus.json`）或绝对路径；**不要**再把 `--out-dir` 前缀重复写进相对路径里，以免产出嵌套到 `out-dir/.review/...`。
- reviewer 必查：
  - runtime types / graph model
  - event flow / active task transitions
  - tests / fixtures / baselines / smoke path
  - `source` / `actor_id` / handoff seam / injection seam
  - scope boundary（确认没偷带 `EVO-13`）
  - 与 `EVO-13` memo 的一致性

任一 reviewer 有 blocking issue：

- 必须修正
- 继续下一轮
- 直到双审 `0 blocking`

### 9.2 正式 `self-review`

外部双审收敛后，当前执行 agent 仍必须再做一轮正式自审，至少覆盖：

- 关键代码与调用链
- GitNexus post-change 证据
- tests / smoke / baselines 是否真实守住行为
- 是否把 `EVO-13` / 社区层 scope 偷带进 `NEW-LOOP-01`
- adopted / deferred amendments 是否记录完整

建议最少形成以下自审 checklist：

1. 全部 acceptance commands 已运行并附结果
2. GitNexus `detect_changes`，必要时 `impact` / `context` 已收集
3. `source` / `actor_id` / handoff seam / injection seam 有代码级与测试级证据
4. 未发生 `EVO-13` scope creep（可绑定 symbol diff / file diff 证据）
5. adopted / deferred amendments 已在交付说明中记录

---

## 10. 交付同步与版本控制门禁

完成前必须同步：

- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `AGENTS.md`
- 必要时同步 `meta/REDESIGN_PLAN.md` 中 `EVO-01/02/03` 对 `NEW-LOOP-01` substrate 的依赖说明
- adopted / deferred amendments 及原因

**额外要求**：

- 完成汇报的“下一批建议”必须是**条件化推荐**，基于本批 closeout 的真实结果判断，而不是机械沿用旧顺序。至少要回答：
  - 若 `NEW-LOOP-01` substrate contract 已稳定、orchestrator 工作区已清、且 host-side sampling routing 仍待补齐，是否应推荐 standalone `meta/docs/prompts/prompt-phase3-impl-new-rt07.md` 作为下一批；
  - 若 `NEW-LOOP-01` closeout 暴露出 substrate repair / contract drift / follow-up hardening 需求，为什么不应立即启动 `NEW-RT-07`；
  - 为什么仍不应顺手启动 `NEW-DISC-01` D4/D5、`NEW-SEM-06b/d/e` 或提前升格 `EVO-13`。
- 完成汇报的“下一批建议”必须回链 `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
- 说明 `EVO-13` 完整 implementation prompt 仍需等待 `NEW-LOOP-01` closeout 与 substrate 稳定

`git commit` / `git push`：

- 默认不执行；需要人类明确授权
- 即使已授权，也只能在 acceptance + `review-swarm` + `self-review` + sync 全部完成后执行
- `.review/` 产物保持 gitignored，不进入提交

---

## 11. 一句话提醒

`NEW-LOOP-01` 的目标不是“先做个单 agent demo”，而是把 **future multi-agent team runtime 也能复用的单项目 research substrate** 做对；但“为未来留 seam”不等于“现在就把 `EVO-13` 全做了”。
