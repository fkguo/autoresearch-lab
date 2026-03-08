# Skeleton — future `prompt-phase5-impl-evo13.md`

> **状态**: checked-in scaffold；**不是**现在立即执行的 implementation prompt。  
> **激活前提**: 只有当 `NEW-LOOP-01` closeout 已稳定、future owner 明确决定启动 `EVO-13` 时，才能把本 skeleton 升格为正式 prompt。  
> **设计来源**: `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md` + `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`

---

## 0. 激活门禁（升格为正式 prompt 之前必须满足）

1. `NEW-LOOP-01` 已完成 closeout，且 `ResearchWorkspace` / `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint` / typed handoff seams 不再高频抖动。
2. 已确认本轮目标是**单项目内多 Agent team runtime**，而不是 community infrastructure、registry/reputation、或 search-heavy `agent-arxiv`。
3. 已确认 `EVO-13` 不会重建第二套 project state；workspace/task/event substrate 继续是 SSOT。
4. 已确认将同时读取：
   - 基础 memo
   - governance/control-plane amendment
   - `NEW-LOOP-01` closeout 结果
   - 本 skeleton 文件本身
5. 若本轮仍无法界定 team-local runtime 与 fleet-level scheduler 的边界，则**不得**升格为正式 implementation prompt。
6. 已阅读并理解 `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md` 中关于 delegation permission matrix、intervention vocabulary 分层、以及 `EVO-13` / `EVO-14` 边界的关键约束。

---

## 1. 开工前必须读取（骨架）

future formal prompt 至少应列出：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` 中 `NEW-LOOP-01` / `EVO-13` / `EVO-14` / `EVO-15/16` 完整描述与依赖边界
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
6. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`
7. `packages/orchestrator/src/research-loop/` 当前 substrate 代码与测试
8. `packages/orchestrator/src/{approval-gate,state-manager,mcp-client,sampling-handler}/` 等当前运行时相邻边界
9. `.serena/memories/architecture-decisions.md` 中 `NEW-LOOP-01` / `EVO-13` / governance 相关决策
10. `meta/docs/prompts/prompt-phase5-impl-evo13-skeleton.md`（本 scaffold，本轮 formal prompt 的 origin document）

如需额外 preflight，重点应围绕：

- delegation permission matrix best practices
- intervention semantics (`pause` / `resume` / `redirect` / `cancel` / `cascade_stop`)
- team-local lifecycle / health / timeout handling
- control-plane replay/live-status 作为 view 的实现边界

---

## 2. 范围边界（骨架）

future formal prompt 应明确：

### 2.1 这批必须解决

1. `TeamExecutionState` 与 workspace/task/event substrate 的关系
2. typed delegation protocol + permission matrix
3. agent / delegate lifecycle 与 team-local health / timeout / cascade stop
4. team-local checkpoint / restore
5. operator intervention vocabulary 与结构化事件流
6. `research-team` / 既有 workflow 对统一 runtime 的桥接面

### 2.2 这批明确不做

- community-scale registry / publication / reputation / evolution
- transcript/session 取代 workspace/task/event substrate
- search-heavy `agent-arxiv` 功能
- retrieval / evidence / paper identity 主干改造
- fleet-level scheduler / cross-run resource manager（留给 `EVO-14`）
- 重新打开或重构 `NEW-LOOP-01` substrate contract（`ResearchWorkspace` / `ResearchTask` / `ResearchEvent` / `ResearchCheckpoint` 等）—— 视为已稳定输入
- skills-market / remote skill lifecycle 产品化（仅可见性或 capability consumption 可讨论）

---

## 3. 必须新增的设计要求（来自 amendment）

future formal prompt 应显式要求：

1. **delegation permission matrix**
   - role -> role delegation allowlist/denylist
   - task-kind -> handoff-kind compatibility
   - 哪些动作允许 agent 自主执行，哪些必须 human approval
2. **intervention vocabulary 分层**
   - task-local
   - team-wide
   - project-wide
   - 至少评估 `cancel` / `cascade_stop` 是否需要 first-class 建模
3. **health / timeout / cascade-stop 进入结构化事件流**
   - 不是隐藏在日志或 UI 状态里
4. **live-status / replay / operator dashboard 只是 view/control-plane surface**
   - 绝不能成为项目状态 SSOT
5. **skills visibility 属于 control plane / registry 边界**
   - 不得把 skill 管理耦合进 runtime 核心

---

## 4. 测试与验收资产（骨架）

future formal prompt 应先锁定 fixtures / tests / smokes，再写实现。**本节应与** `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md` **§5 的检查清单对齐**。至少覆盖：

1. **checkpoint / restore**
   - kill/restart 后已完成 delegation 不重跑
2. **permission-matrix fail-closed**
   - 非法 delegation / 非法 intervention 必须显式拒绝
3. **intervention semantics**
   - `pause` / `resume` / `redirect` / `inject_task`
   - 若纳入 `cancel` / `cascade_stop`，必须有独立 negative-path coverage
4. **health / timeout / stalled detection**
   - team-local delegate 卡死、超时、失联时的状态迁移与事件记录
5. **replay / audit surface**
   - intervention、handoff、checkpoint、restore、health transition 可回放
6. **bridge integration**
   - `research-team` 或 future workflow consumer 至少有 1 条 integration smoke

建议 future prompt 明确哪些测试在：

- `packages/orchestrator/tests/`
- `packages/shared/tests/`（若 shared schema/contract 被触及）
- integration / smoke 层（如新增 team-runtime bridge）

---

## 5. 新增验收项（骨架）

future formal prompt 除现有 runtime/TS 验收外，应新增检查。**本节应与** `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md` **§5 的检查清单对齐**：

1. permission matrix 已实现并可 fail-closed 验证
2. intervention vocabulary 已清晰区分 task-local / team-wide / project-wide
3. `cancel` / `cascade_stop` 若被纳入，必须被**显式建模**，而不是散落在错误处理或人工约定里；其行为、边界、审计证据、negative path 全部锁定
4. team-local lifecycle / health / timeout / stalled transition 有结构化事件证据
5. live-status / replay surface 仅消费 structured event log，不形成第二套 project state
6. `EVO-13` 与 `EVO-14` 边界清晰：前者不偷渡 cross-run / fleet-level scheduler 责任
7. skills visibility 若被涉及，必须走 registry / control-plane 边界，而不是耦合进 runtime 核心

若未来 formal prompt 需要命令级验收，至少应补：

- `pnpm --filter @autoresearch/orchestrator test`
- `pnpm --filter @autoresearch/orchestrator build`
- 若触及 shared contract：`pnpm --filter @autoresearch/shared test/build`
- 以及 workspace 级 `pnpm -r test` / `pnpm -r build`

但正式命令集仍应以 future implementation 触及的真实文件面为准，不能机械复用本 skeleton。

---

## 6. 新增 review 检查项（骨架）

future formal prompt 的外部 review / self-review，除常规实现检查外，还应额外深查。**本节应与** `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md` **§5 的检查清单逐条对应**：

1. 是否仍坚持 substrate-first，而非 dashboard-first / transcript-first
2. permission matrix 是否真实限制了 delegation 与 intervention，而不是形式化存在
3. intervention semantics 是否清楚，尤其是 `cancel` / `cascade_stop` 是否被**显式建模**、是否与 `pause` / `resume` 混淆
4. health / timeout / stalled / cascade-stop 是否进入结构化事件流并可 replay
5. live-status / replay 是否只是 view/control-plane surface，而非新 SSOT
6. skills visibility / control-plane boundary 是否被守住，而不是耦合进 runtime 核心
7. `EVO-13` / `EVO-14` 职责边界是否被守住
8. `research-team` bridge 是否复用 substrate，而不是绕开 substrate 造私有状态

---

## 7. 收尾同步（骨架）

future formal prompt 完成后，至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. `.serena/memories/architecture-decisions.md`
4. 必要时 `meta/REDESIGN_PLAN.md`

完成汇报必须显式回答：

- 为什么现在适合启动 `EVO-13`
- 为什么没有把 `EVO-13` 做成第二套 project state
- 为什么没有把 fleet-level / cross-run 责任错误吸入 `EVO-13`
- 下一批为什么应是某个具体 lane，而不是直接跳去 community-scale 层

---

## 8. 使用说明

当 future owner 决定真正启动 `EVO-13` 时，应：

1. 复制本 skeleton 为正式 prompt（通常是 `meta/docs/prompts/prompt-phase5-impl-evo13.md`）
2. 用当时最新的 `NEW-LOOP-01` closeout、memo、amendment、runtime 代码面替换占位内容
3. 明确列出真实触及文件、真实 acceptance commands、真实 review packet 范围
4. 再进入正式 implementation conversation

在这之前，本文件只作为**防遗忘 scaffold**，不应被误当作已激活的实施 prompt。
