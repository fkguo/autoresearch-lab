# Idea-Generator 架构规格（v0.2 / Design Spec）

> 日期：2026-02-12  
> 目标：在 **HEP-first** 的前提下，建立一个可扩展到理论物理其它分支的 `idea-generator` 架构规格（可实现、可测试、可演进）。  
> 原则：研究质量优先 —— 所有机制尽量对应到可审计产物（artifacts）与可执行接口（operators / policies / plugins）。

---

## 1. 设计目标与非目标

### 1.1 目标（必须达成）

1. **可扩展**：HEP（hep-ph/hep-th/nucl-th）先做深；未来扩展到凝聚态/天体/数学物理时不改 core，只加 pack/plugin。
2. **证据优先（evidence-first）**：每个 idea 的关键 claim 必须能追溯到：
   - 文献证据（INSPIRE/arXiv/综述/讲义/会议报告），或
   - 数据证据（PDG/HEPData/实验结果），或
   - 明确标注的推断（LLM inference）并带不确定度与验证计划。
3. **可下游执行**：通过 A0.2 的 idea 必须能编译成 `C2 Method Design` 的结构化输入（不是一句话想法）。
4. **可审计**：全流程事件追加到账本（append-only）；核心产物遵循稳定 schema，可回放、可比较。
5. **可控成本**：预算（时间/节点数/token）是一级参数；系统必须能早停/剪枝/降级，但是不能降低质量。

### 1.2 非目标（v0.x 不做）

- 不追求“一键自动发表论文”；我们只负责把 idea **推进到可执行方法规格**（C2-ready）。
- 不在 v0.x 追求完整图数据库/向量库基础设施；先用 JSONL + 可替换接口。

---

## 2. 总体架构：Standalone `idea-core` + 薄适配层（Hybrid）

### 2.1 边界原则（强约束）

- `idea-core` **不得导入** hepar / orchestrator 内部代码：只通过 artifact 契约与 stdio/JSON-RPC 交互。
- hepar 负责：审批门禁、run lifecycle、ledger、权限与“何时启动/停止”。
- `idea-core` 负责：搜索/生成/评估/排名/溯源对象模型与算法。

### 2.2 组件图（逻辑）

```
┌───────────────────────────────────────────────────────────┐
│                    hepar / human operator                  │
│   A0.1 campaign charter  A0.2 idea promotion   A1..A5       │
└───────────────┬───────────────────────────────┬───────────┘
                │                               │
                ▼                               ▼
┌──────────────────────────┐          ┌──────────────────────┐
│ idea-generator skill      │          │ MCP tool layer        │
│ (thin adapter)            │          │ INSPIRE / PDG / Zotero │
│ - translate commands      │◀────────▶│ KB / LaTeX / etc.      │
│ - map artifacts           │          └──────────────────────┘
└───────────────┬──────────┘
                │ JSON (artifacts) / stdio
                ▼
┌───────────────────────────────────────────────────────────┐
│                    idea-core (standalone)                  │
│                                                           │
│  Campaign → Seed → Search → Ground → Evaluate → Rank → Select │
│                                                           │
│  + IdeaStore (append-only) + ProvenanceDAG + Metrics        │
│  + Plugin system: DomainPacks / Operators / SearchPolicies  │
└───────────────────────────────────────────────────────────┘
```

---

### 2.3 idea-core RPC 接口（v1）

`idea-core` 作为 standalone 引擎必须可独立测试，因此 adapter 与 core 的边界需要**可验证协议**（而不是口头约定）。

- **传输**：JSON-RPC 2.0（stdio；后续可换 HTTP/WebSocket 但不改方法语义）
- **接口 SSOT**：`schemas/idea_core_rpc_v1.openrpc.json`（OpenRPC）
- **最小方法集（v1）**：
  - `campaign.init` / `campaign.status` / `campaign.topup`
  - `campaign.pause` / `campaign.resume` / `campaign.complete`
  - `search.step`
  - `node.get` / `node.list` / `node.promote`
  - `eval.run`
  - `rank.compute`
- **错误码约定**：至少包含 `budget_exhausted` / `schema_validation_failed` / `invalid_charter` / `grounding_audit_failed` / `reduction_audit_failed` / `formalism_not_in_registry` / `insufficient_eval_data` / `campaign_not_found` / `campaign_not_active` / `node_not_found` / `node_not_in_campaign`

**硬语义补充（machine-enforceable）**：

1. **Campaign scoping MUST**：涉及 `campaign_id` 的 RPC，engine 必须保证严格的 campaign 隔离（防止跨 campaign 污染/泄漏）。
   - 对显式传入 `node_id/node_ids` 的 RPC（`node.get` / `node.promote` / `eval.run`），若任一 node 不属于该 campaign，engine **必须**返回 `node_not_in_campaign`，并且不得产生任何部分写入（保持原子性）。
   - 对 **read-only** 的“列表/过滤”RPC（`node.list`），引擎必须把结果 **天然限定在该 campaign 内**；若 filter 不匹配该 campaign，应返回空结果（而不是报错），以保持 list 语义简单且可组合。
     - **分页默认值（必须可测试）**：若 `node.list.limit` 省略，engine 必须视为 `50`；并强制上限 `500`。返回 `cursor=null` 表示到达末页。
   - 对 **side-effecting** 的 `rank.compute`：`filter` 仅用于在 campaign 内筛选候选集合；**Pareto 要求筛选后节点数 ≥ 1（0 则 fail）且有效评分维度 ≥ 2（不足则 `insufficient_eval_data`，建议 `error.data.reason=insufficient_dimensions`），Elo 要求节点数 ≥ 2（<2 则 fail）**；若 resolved 集合缺少任何可用 scorecards（即不存在 `status ∈ {complete, partial}` 的 scorecards；例如从未运行 `eval.run` 或全部评估失败），引擎必须返回 `insufficient_eval_data` 且建议 `error.data.reason=no_scorecards`；上述不足情形均不得写入 ranking artifacts（该方法不是 list，不允许“空成功结果”）。
2. **Idempotency MUST（side-effecting calls）**：对会落盘/写 artifact/更新节点的 RPC（`campaign.init`/`campaign.topup`/`campaign.pause`/`campaign.resume`/`campaign.complete`/`search.step`/`eval.run`/`rank.compute`/`node.promote`），adapter **必须**提供 `idempotency_key`（OpenRPC 要求）；engine 必须按 `(method, campaign_id?, idempotency_key)` 去重，确保重试不会产生重复产物或非确定性写入（`campaign.init` 无 `campaign_id`，因此该项为空；参考 OpenClaw gateway protocol 的同类纪律）。

   **Idempotency replay 规则（必须可测试）**：
   - 适用范围：`campaign.init` / `campaign.topup` / `campaign.pause` / `campaign.resume` / `campaign.complete` / `search.step` / `eval.run` / `rank.compute` / `node.promote`（所有 side-effecting methods）。
   - Duplicate hit：对同一 `(method, campaign_id, idempotency_key)`（`campaign.init` 为 `(method, idempotency_key)`），engine **必须**返回与首次调用相同的逻辑响应（成功 result 或 error），且不得重复 side-effects。为便于排障，所有 side-effecting 成功响应必须回声 `idempotency` 元信息：首次执行 `idempotency.is_replay=false`，duplicate hit 时 `idempotency.is_replay=true`；除该标志外，其余字段必须与首次响应一致。**对 `search.step` 等非确定性操作（LLM 生成），该性质必须通过“首次结果落盘 + 回放”实现，而不是重跑并期望输出一致。**
   - 失败重试：若首次调用返回 error，调用方如要表达“新的意图”（例如调整输入/预算），**必须**使用新的 `idempotency_key`；否则会 replay 原 error。
   - Key 冲突（必须拒绝）：若同一 `(method, campaign_id?, idempotency_key)` 被复用但 **输入 payload 不一致**（例如 `campaign.init` 的 charter/seed/budget 不同，或 `eval.run` 的 node_ids 不同），engine 必须返回 `schema_validation_failed`，并且必须设置 `error.data.reason=idempotency_key_conflict`，不得执行该请求（防止跨 run/caller 误回放）。
     - **Payload 等价（必须可机读）**：engine 必须把“payload 是否一致”定义为：对请求参数做 **RFC 8785 (JCS) JSON canonicalization** 后计算 `payload_hash = sha256(JCS(params_without_idempotency_key))`；其中：
       - `params_without_idempotency_key`：包含该 RPC 的所有入参字段，但**排除** `idempotency_key`
       - 对 optional 字段：若调用方省略，engine 应先做**默认值填充/显式化**后再计算 hash（例如 `node.list.limit` 省略视为 `50`），以确保“同一语义意图”不会因为省略字段而触发冲突
   - 保留期限：去重记录 **必须**至少保留到 campaign 结束（或未来新增 `campaign.delete/archive` 前，不得提前回收）。
   - `campaign.init` 的全局去重记录（无 campaign-scoping）必须保留至少 `24h`（建议可配置 TTL；成功时至少保留到该 campaign 结束，失败时至少保留到 TTL 到期），以支撑“初始化重试去重”和审计回放。
   - 作用域：除 `campaign.init` 外，idempotency store 必须 campaign-scoped（防跨 campaign 污染）。
   - **去重记录的最小落盘内容（必须可测试）**：每条 idempotency 记录至少包含 `(method, campaign_id?, idempotency_key, payload_hash, first_response_json_bytes, created_at)`；duplicate hit 必须回放 `first_response_json_bytes`（因此 replay 中的 `budget_snapshot`/`wall_clock` 等字段是“首次执行时的快照”，可能相对当前状态过期；如需当前预算，调用方应显式调用 `campaign.status`）。
   - **Idempotency 记录与副作用的一致性（必须）**：
     - 对成功响应：idempotency record 的提交必须与该 RPC 的副作用（写 nodes/artifacts/状态变更）处于同一“逻辑提交”中；不得出现“副作用已提交但 idempotency 未记录”或“idempotency 已记录但副作用未提交”的可见状态。
     - 对失败响应（含回滚）：必须先完成回滚，再提交 idempotency record（保证 replay 不会放大部分写入）。

3. **Step budget fuse SHOULD（防“单步抽干预算”）**：`search.step` 应支持可选的局部预算熔断（OpenRPC: `step_budget`），用于“这次只允许花 X（按 `cost_usd`/`tokens`/`wall_clock_s`/`nodes` 其中一维或多维计）”。当局部预算先耗尽时，engine 应返回 `SearchStepResult.early_stopped=true`（推荐 `early_stop_reason=step_budget_exhausted`），而不应无条件报全局 `budget_exhausted`。

   **`search.step` 的 step 语义（必须可测试）**：`search.step(n_steps=N)` 中的“一步”定义为 **一次 SearchPolicy tick**：
   - 至少选择一个 `(island_id, operator_id)`（并按该 island 的 `team_policy_id` 运行对应 Team/Role 拓扑，可能触发多次 LLM/tool 调用）
   - **tick 原子性（必须）**：单个 tick 内的写入必须 all-or-nothing（不得出现“半个 node / 半个 artifact”）；但整个 `search.step` 调用可在 tick 边界处部分完成并通过 `n_steps_executed` 暴露
   - 在不违反预算/门禁的前提下，写入本 tick 产生的 nodes/artifacts
   - `BudgetSnapshot.steps_used` 必须按 tick 次数递增；`SearchStepResult.n_steps_executed` 必须等于本次实际完成的 tick 数

4. **Error.data 合约 MUST（可机读）**：所有 error 响应必须携带 JSON-RPC `error.data`（object），最少包含：
   - `reason`：机器可读的子原因（string）
   - `details`：可选调试信息（object；可为空）

   其中对 `budget_exhausted`（`-32001`），`error.data.reason` **必须**为 `dimension_exhausted`，并且 `error.data.details.exhausted_dimensions` **必须**给出至少一个触发熔断的预算维度（如 `tokens/cost_usd/wall_clock_s/steps/nodes`），以便 adapter 可机读地决定“需要 topup 哪些维度”。

   其中对 `schema_validation_failed`（`-32002`），`error.data.reason` **必须**区分至少以下子类（避免把所有情况都揉成一个错误码）：
   - `schema_invalid`：真实的 schema/约束校验失败
   - `idempotency_key_conflict`：同一 key + 不同 payload
   - `elo_config_required`：`method=elo` 但缺少 `elo_config`
   - `elo_config_unexpected`：`method=pareto` 但提供了 `elo_config`

> 备注：hepar skill 的“翻译层”应当只是把 hepar 命令映射到上述 RPC，并把返回写入 artifacts；不得把核心搜索逻辑塞回 skill。

> **契约 SSOT 规则（硬约束）**：`schemas/*.schema.json` 是唯一数据契约真源；`schemas/idea_core_rpc_v1.openrpc.json` 只通过 `$ref` 引用这些 schema，不得复制粘贴出第二份结构定义（避免漂移）。任何“打包成单文件”的需要必须通过机械化 bundling（脚本/CI）完成，而不是手工合并。

---

### 2.3.1 Concurrency constraint（v0.x）

v0.x 在 RPC 层假设 **single-writer per campaign**：对同一个 `campaign_id` 的并发 side-effecting RPC（来自不同 adapter 实例，使用不同 `idempotency_key`）行为未定义。  
Idempotency 只保护“同一调用意图的重试”，不解决多写者竞态。v1.0+ 可考虑引入乐观并发控制（例如 `expected_version` 字段）。

### 2.4 Campaign 状态机（v1，必须写清；否则实现不可测试）

`CampaignStatusV1.status` 的含义（engine 侧，不是 hepar UI 状态）：

- `running`：允许 side-effecting 操作（`search.step` / `eval.run` / `rank.compute` / `node.promote`）。
- `paused`：通过 `campaign.pause` 进入；**禁止** side-effecting 操作；只允许 read-only（`campaign.status` / `node.get` / `node.list`）与 `campaign.resume` / `campaign.topup`。
- `early_stopped`：search policy 判定“应当停止”（例如 stagnation）；允许 `campaign.resume` 显式继续（否则视为非活动）。
- `exhausted`：预算熔断（BudgetEnvelope 耗尽）；允许 `campaign.topup` 注入预算。**强约束**：成功 topup 后必须能离开 `exhausted`（见下）。
- `completed`：通过 `campaign.complete` 进入；终态。只允许 read-only；`campaign.topup` 必须拒绝（`campaign_not_active`）。

术语消歧（避免实现分歧；必须遵守）：
- `CampaignStatusV1.status=exhausted` **只**表示“全局 BudgetEnvelope 耗尽/不可继续 side-effecting”；
- `CampaignStatusV1.status=early_stopped` **只**表示“SearchPolicy 判定应停（例如 stagnation）”，不得用来表达预算耗尽；
- `IslandStateV1.state=EXHAUSTED` 是 **岛屿局部** 状态（某方向/策略岛无法继续），与 campaign-level `exhausted` 不同域；两者不得混用。
- **状态优先级（必须）**：若同一时刻既触发“策略早停”又触发“预算熔断”，campaign-level `status` **必须**取 `exhausted`（预算不可继续 side-effecting 的事实优先于策略语义）；策略层面的停止原因应记录为 `early_stop_reason`（campaign 或 step 级）或写入 ledger/diagnostics。

允许的显式迁移（RPC 驱动）：

- `campaign.init`：`∅ → running`
- `campaign.pause`：`running|early_stopped|exhausted → paused`（把“算法早停/预算耗尽”冻结为“人工暂停”，便于 topup 后保持暂停态）
- `campaign.resume`：`paused|early_stopped → running`（若预算不足则 `budget_exhausted`）；`exhausted → exhausted`（固定拒绝：`budget_exhausted`）
- `campaign.complete`：`running|paused|early_stopped|exhausted|completed → completed`（`completed → completed` 视为 no-op）
- `campaign.topup`：`running|paused|early_stopped → (same state)` ∪ `exhausted → running|exhausted`（conditional：topup 后 **若预算已不再耗尽（各受限维度 remaining > 0）则转为 `running`，否则保持 `exhausted`**；避免“加了预算仍无法继续”的死状态，也避免“只 topup 一维但仍不可继续”的逻辑矛盾）；`completed → (reject: campaign_not_active)`

补充约定（避免实现分歧）：
- 若对 `status=exhausted` 调用 `campaign.resume`，必须返回 `budget_exhausted`（不改变状态；调用方应先 `campaign.topup`）。
- `campaign.resume` 从 `paused|early_stopped` 恢复时，必须检查**当前**预算是否已耗尽；若任一 BudgetEnvelope 维度 `remaining <= 0`，必须返回 `budget_exhausted`（不改变状态）。
- **Idempotency replay（MUST）**：若 `campaign.topup` 的响应中 `idempotency.is_replay=true`，调用方 **必须**在采取下一步动作前调用 `campaign.status` 获取**当前**状态与预算（因为 replay 返回的是“首次调用快照”，可能已被后续 topup/暂停/恢复改变）。
- 典型工作流（informative）：`exhausted → (optional) campaign.pause → campaign.topup → (still paused) campaign.resume → running`（pause 只是冻结为人工控制，不会自动恢复）。

隐式迁移（engine 内部触发）：

- `running → exhausted`：预算熔断触发
- `running → early_stopped`：search policy 早停触发（与单次 `SearchStepResult.early_stopped` 区分：单次 step 的 early_stop_reason 可能只是局部熔断，不一定改变 campaign status）

读写权限（强约束）：

- **Read-only RPC**（`campaign.status` / `node.get` / `node.list`）必须在任何 status 下可用（除 `campaign_not_found`/`node_not_found`/`node_not_in_campaign` 外不得拒绝）。
- **Side-effecting RPC**（`search.step` / `eval.run` / `rank.compute` / `node.promote`）仅在 `running` 允许；在 `paused|early_stopped|completed` 必须返回 `campaign_not_active`；在 `exhausted` 应优先返回 `budget_exhausted`（更具体）。

关于 idempotency replay 与状态冲突（明确行为）：
- duplicate hit 的 replay 必须回放首次响应（除 `idempotency.is_replay` 标志外一致），即使 campaign 当前 status 已变化；调用方不得用同一 `idempotency_key` 表达“新的意图”。

**Post-early-stop / post-exhaustion 使用模式（informative）**：当 `search.step` 返回 `early_stopped=true`（无论是 step-local budget fuse 还是全局预算耗尽/策略早停），调用方 **不得**用同一个 `idempotency_key` 重试期待“继续做剩下的工作”，因为这会 replay 原部分结果。若要在 `campaign.topup` 或策略调整后继续探索，调用方必须以新的 `idempotency_key` 重新调用 `search.step`。

## 3. 核心抽象：Operator + SearchPolicy + Distributor（可替换）

> 把“科学发现路径”落到可执行机制：Operator 是“如何变异/扩展 idea”；SearchPolicy 是“如何在树/种群中调度探索”；Distributor 是“预算如何分配到不同 LLM 与不同 operator/island”。

> 增补（2026-02-12）：为实现“多 agents 物理学家社区/组团探索”，我们引入 **Team/Role 作为可插拔运行时拓扑**：同一个 island/方向不再对应单一生成器，而是对应一个由角色组成的团队（并行/串行可配置），其输出通过 artifacts 汇聚回 IdeaStore。

### 3.1 `Operator`（发现算子）

**职责**：输入一个 seed/idea-node，输出若干候选（带 rationale 草稿），并附带操作痕迹（trace）。

建议最小接口（概念）：
- `operator_id` / `operator_family`
- `apply(input, context) -> [RationaleDraft]`
- `operator_trace`：包含策略参数、随机种子、引用的证据 URI（用于审计/复现/回放）

**Operator families（v0.2 建议）**  
（把科学史/科学哲学转成可执行算子族；HEP pack 可先实现其中 4–6 个）

- `AnomalyAbduction`：反常 → 解释（Kuhn/Peirce abduction）
- `AssumptionInversion`：假设反转（Popper；增强可证伪性）
- `SymmetryOperator`：对称性操作（破缺/恢复/推广/对偶）
- `LimitExplorer`：极限外推（强/弱耦合、能标极限、维数极限）
- `CrossDomainAnalogy`：结构/方法/现象映射（强制输出 mapping table；跨学科/跨分支方法迁移的一等公民）
- `ProblemReduction`：问题抽象→归约到数学/CS 标准问题（优化/推断/图/方程/几何…）→ 检索既有解法并生成 transfer plan（重点覆盖“物理里难，但数学里已成熟”的场景）
- `CombinatorialSynthesis`：方法×理论模块组合（IdeaSearch 风格再组合）
- `ProtectiveBeltPatch`：Lakatos（保持 hard core，改 protective belt）
- `RepresentationShift`：改变表述（变量替换、对偶变换、规范选择）

### 3.2 `SearchPolicy`（搜索策略）

**职责**：在预算约束下，决定“扩展哪个节点/哪个岛、使用哪个 operator、保留哪些候选”。

v0.x 推荐先支持：

1. **Divergent–Convergent 外环**（管线纪律）
2. **Multi-Island Evolution 内核**（IdeaSearch 风格：不同策略群体并行 + repopulate）
3. 可选：**BFTS / BeamSearch**（对树结构分支的局部 best-first）

> 设计要点：SearchPolicy 只依赖 `IdeaNode` 与 `Evaluator` 的输出，不依赖领域细节。

#### 3.2.1 Multi-Island 状态机（最小可实现规格）

为避免“同名多岛”但实现不可互换，v0.2 要求至少声明以下状态与迁移：

- **States**：`SEEDING → EXPLORING → CONVERGING → STAGNANT → REPOPULATED | EXHAUSTED`
- **Triggers（示例）**：
  - `SEEDING → EXPLORING`：population 达到 `min_pop_size`
  - `EXPLORING → CONVERGING`：top-k 语义多样性低于阈值（避免模式坍缩）
  - `EXPLORING/CONVERGING → STAGNANT`：`best_score_improvement(last_n_steps) < ε`
  - `STAGNANT → REPOPULATED`：执行 repopulate（从 donor islands 注入 migrants）
  - `STAGNANT → EXHAUSTED`：预算不足以完成一次最小 step（`budget_remaining < min_step_cost`）
  - `REPOPULATED → EXPLORING`：重置 stagnation 计数器后继续

需要对外暴露可替换的谓词/策略接口（概念）：
- `should_repopulate(island_state, history, budget_remaining) -> bool`
- `migrate(donor_islands, target_island, n_migrants, selection_fn) -> IdeaNode[]`

### 3.3 `Distributor`（预算分配/调度器）

**职责**：把生成请求分配给：

- 不同 LLM backends（异构模型表型互补：explorer vs converger vs critic）
- 不同 islands / operator families

v0.2 可先引入 **softmax+EMA** 作为 baseline（IdeaSearchFitter 给出可复用机制）：

- 为每个 backend/operator 维护近期 reward 的 EMA
- 用 $\mathrm{softmax}(\mathrm{score}/T)$ 分配生成配额（避免单点收敛）；更具体地，可采用：

$$
p_i = \frac{\exp(s_i / T_{\mathrm{model}})}{\sum_j \exp(s_j / T_{\mathrm{model}})}.
$$

其中 $s_i$ 为后端/算子的 reward EMA，$T_{\mathrm{model}}$ 控制探索-利用权衡。

> 但 softmax+EMA 不显式建模不确定性/方差、冷启动、非平稳漂移与成本约束；用于异构 LLM 编排时往往需要更强的 allocator。
> 建议将 Distributor 设计为 **BanditPolicy 可插拔**，并提供可回放的 decision trace（见 `docs/plans/2026-02-12-bandit-distributor-alternatives.md`；统计物理视角与可审计日志建议见 `docs/plans/2026-02-12-statphys-distributor-policies.md`）。

v0.3+ 推荐默认升级为 **cost-aware + non-stationary bandit**：
#### 3.3.1 BanditPolicy（Distributor policy）最小接口（契约级）

为避免不同实现产生不可回放的分歧，Distributor 的策略必须实现为“可回放状态机”，并暴露最小接口（概念）：

```text
BanditPolicySpec:
  policy_id: string
  policy_family: string
  select(eligible_actions, context_features, budget_snapshot) -> selected_action + diagnostics
  update(selected_action, reward, realized_cost, metadata) -> void
  state() -> DistributorStateSnapshotV1   # 可周期性落盘
  config() -> DistributorPolicyConfigV1   # 每 campaign 不可变
```

**硬约束（machine-enforceable）**：
- `CampaignCharter.distributor.factorization` 必须声明 action-space factorization：`joint | factorized`（默认 `factorized`），并写入 `distributor_policy_config_v1.json`（schema：`schemas/distributor_policy_config_v1.schema.json`）。
- `search.step` 的返回 `SearchStepResult.distributor_policy_config_ref` 必须指向该 campaign 的 `distributor_policy_config_v1.json`（便于审计/回放）。
- 每次 `select()` 的输入/输出必须写入 `distributor_events_v1.jsonl`（每 tick 一行；schema：`schemas/distributor_event_v1.schema.json`）。
- 若策略含运行时随机性，必须在事件中记录 `rng_seed_used`（或等价可复现信息），并声明 `rng_alg`（写入 config）。


- **不确定性/方差**：UCB 系列（如 variance-aware bonus）或 Bayesian（TS/Bayes-UCB）
- **非平稳**：discount / sliding-window 更新；必要时 change-point reset
- **成本敏感**：以 `cost_usd` / `tokens` / `wall_clock_s` / `team_cost` 等资源为约束或罚项（BwK / Lagrangian）
- **可审计/可复现**：deterministic mode（或固定 seed + 记录随机数）+ ledger 事件（per-step 的 per-arm stats 与 index 分解）

**Budget Circuit Breaker（全局熔断器，必须）**：
- 当 `total_cost > max_budget` 或 `total_tokens > max_tokens` 或 `wall_clock_s > max_wall_clock_s` 时，立即终止所有 pending 生成/评估，进入 `EarlyStop`，并写入 `budget_checkpoint` ledger 事件。
- 建议提供 `degradation_order[]`：当预算紧张时的降级顺序（例如先减少评估轮数，再减少 islands，再禁用跨域算子）。

reward 信号分两类：
- **短期 proxy**：grounding ratio、novelty proxy、结构化可编译率（是否能形成 Canonical IdeaCard）
- **长期 outcome**：A0.2 通过率、C2 成功率、W_compute 成功率（延迟奖励）

**Phenotype profiling（用于异构分工与调度，不是“模型排行榜”）**：
- 迁移自 IdeaSearchFitter 的动态过程指标：`Iter@k`（不同 epoch/step 的累积成功）、epoch 分布（中位数/3-4 分位）、成本（word/token）。
- ideation 侧建议最小映射：`A0_pass@k`、`epochs_to_first_grounded_claim`、`tokens_per_promoted_node`、`checker_disagreement_rate`。这些指标应写入 `origin`/`eval_info` 以便回放与调度学习。

### 3.4 Physicist Community：Team/Role 组团探索（OpenClaw Broadcast Groups 启发）

> 目的：把“多 agent 协作”从泛泛口号变成可配置、可审计、可扩展的运行时拓扑；同时避免把评审/审查逻辑硬编码进某个单体提示词。

#### 3.4.1 核心概念（最小可实现）

- **Role**：一个“具名职责 + 工具/模型权限 + 输出契约”的执行单元（可由不同 LLM 或工具沙箱承载）。
- **Team**：一组 Roles，围绕同一研究方向/策略 island 协作；Team 有协调策略（并行/串行/分阶段）。
- **Community**：多个 Teams 的集合 + 中央仲裁/汇总角色（用于跨团队排名、repopulate、冲突裁定）。

建议把 multi-island 解释为：`island_id` 同时标识
1) 搜索策略群体（operator/constraints 权重配置）与
2) 该策略群体对应的 Team（role composition + coordination policy）。

#### 3.4.2 角色建议（HEP-first 的最小社区）

> v0.2 不要求一次性全实现；但需要把“角色接口”设计出来，后续可逐步替换为更强的执行体。

- `Ideator`（发展想法）：发散生成、提出机制与测试点（输出 `RationaleDraft`）。
- `Librarian`（证据检索）：INSPIRE/PDG/讲义/综述检索，产出 `evidence_packet`（URI + 摘要 + 相关性）。
- `Formalizer`（结构化形式化）：把 rationale 收敛为 `IdeaCard`（schema-validated）。
- `Derivation`（推导/一致性检查）：对称性/量纲/极限/一致性快速检查，产出 `consistency_report`（可带最小手算/公式）。
- `Coder`（最小计算原型）：把 compute plan 落到可执行草图（最小脚本/伪代码/数值检查路径）。
- `Checker`（复核/复现）：独立重算/重查（clean-room），给出一致/不一致结论与最小反例。
- `Referee`（可行性/新颖性/影响审查）：按 rubric 打分，但必须输出“**创新增量**”而非修辞差异（见 6.2）。
- `Editor`（汇总/归档）：把各角色结构化输出合并为 `IdeaNode` 更新（trace 完整、可回放）。

> Packaging 建议：`Referee` 不建议作为“与 idea-generator 并列的独立产品 agent”。更合理的做法是：把它当作 **idea-generator 的可插拔 role**（可由独立 session/独立模型承载，以获得 clean-room 效果与更严格的工具权限），从而同时满足“模块化替换”和“端到端门禁一致性”。

#### 3.4.3 协调策略（并行 vs 串行 vs 分阶段）

三种基本模式（可作为 `TeamPolicy` 的枚举）：

1. **Parallel Divergence**：并行广播给多个 roles（尤其是多个 ideator/referee），提高多样性与盲点覆盖。
2. **Sequential Convergence**：`Librarian → Ideator → Formalizer → Referee`，用证据与结构化输出抑制幻觉与格式漂移。
3. **Stage-Gated**：在关键门禁前强制进入特定阶段（如 promote 前必须跑 `Checker` 与 `GroundingAudit`）。

> 关键纪律：默认 **Role clean-room**；role 之间不共享草稿，只共享输入上下文包与最终 artifacts。若触发辩论，则以 `debate_packet`（point/counterpoint + evidence_uris）形式显式发生。

> **成本感知约束**：Team topology 的 token 消耗近似为 $\sum_{\mathrm{role}} c_{\mathrm{role}}$（每个 role 的单位成本 $c_{\mathrm{role}}$ 可由 `role_cost_table` 给出；必要时再乘以 `team_cost_multiplier`）；Distributor 在分配预算时必须将 team composition 纳入每步成本估算（而非假设每步 = 1 次 LLM 调用）。`BudgetEnvelope.extensions` 可承载 `team_cost_multiplier`/`role_cost_table` 等运行时参数。

---

## 4. 强制两阶段：RationaleDraft → Canonical IdeaCard（Explain-Then-Formalize）

### 4.1 为什么必须强制

Explain-Then-Formalize 的价值在于：

- 允许 **发散**（类比、隐喻、反转假设）  
- 但必须在进入门禁/下游前完成 **形式化**（可验证字段齐全）

### 4.2 两阶段产物（建议）

1. `RationaleDraft`（允许高温）：
   - WHY：动机/反常/类比映射表/机制猜想
   - 风险：潜在已知/folklore、物理一致性风险、验证优先级
   - 下一步最小验证：1–3 个 kill criteria

2. `IdeaCard`（低温约束 + schema 校验）：
   - `thesis_statement`
   - `testable_hypotheses[]`
   - `required_observables[]`
   - `candidate_formalisms[]`（必须映射到 DomainPack 的 formalism registry；否则不得 promote 到 C2）
   - `minimal_compute_plan[]`
   - `claims[]`（claim-level 溯源；每条 claim 至少包含 support_type + evidence_uris；对 `llm_inference/assumption` 必须给 verification_plan；可选 verification_status）

> 硬规则：任何 idea 进入 Ranking / A0.2 前，必须完成 `IdeaCard` 生成与 schema 验证。

#### 4.2.1 Grounding Audit Gate（IdeaCard 生效前的强制门禁）

为避免“看似有引用但引用并不支撑 claim”的失真 provenance，IdeaCard 只有在通过 grounding audit 后才被视为“有效可推广对象”：

1. **URI 可解析（active resolution）**：`claims[].evidence_uris[]` 必须通过 **active lookup** 验证可解析（INSPIRE API / DOI resolver / KB artifact existence check 等），不得仅做格式校验；不存在 phantom 引用。解析失败必须写入 `IdeaNode.grounding_audit.failures[]`，并将 `status` 置为 `fail` 或 `partial`。
2. **数据一致性**：`support_type=data` 的数值类 claim，必须与 PDG/HEPData 在约定容差内一致（否则标记 FAIL）。
3. **推断透明**：`support_type=llm_inference/assumption` 必须有 `verification_plan`（至少 1 条 kill criterion）。
4. **folklore 预筛**：产出 `folklore_risk_score ∈ [0,1]`；超过阈值则必须走 `A0-folklore` 人类裁定。阈值应作为 `CampaignCharter.extensions.folklore_risk_threshold`（默认 `0.7`，DomainPack 可覆盖）显式暴露，而非硬编码。
5. **晋升门禁（强约束）**：`node.promote` 的成功条件必须包含 `grounding_audit.status == pass`。`partial/fail` 一律阻塞晋升（返回 `grounding_audit_failed`），避免“带着缺口进入 C2”。
6. **归约审计（reduction_audit，条件性强约束）**：当 `IdeaNode.reduction_report != null`（通常来自 `ProblemReduction`/`TechniqueTransplant`）时，`node.promote` 的成功条件**额外**要求 `reduction_audit != null` 且 `reduction_audit.status == pass`。若 `reduction_audit == null`，必须阻塞晋升并返回 `reduction_audit_failed`（`error.data.reason=reduction_audit_missing`）。`partial/fail` 一律阻塞晋升（返回 `reduction_audit_failed`）。审计最小检查项：
   - `assumptions`：归约所需的每条前提是否被验证或标注为 `pending_verification`（任一 pending_verification ⇒ `partial`；任一 violated ⇒ `fail`；全部 satisfied 且 toy check 通过才可能为 `pass`）
   - `toy_check_result: pass | fail | skipped`（`skipped` 仅在 `Coder/Checker` 角色不可用或预算熔断时允许，且必须标注 `skip_reason`；`skipped` 视为 `partial`）
   - `reduction_type_valid: bool`（抽象问题类型是否在 DomainPack 的 `abstract_problem_registry` 中注册）
   - `auditor_origin`（建议）：记录执行审计的 role/model/session（用于 clean-room 审计）
   - 审计输出写入 `IdeaNode.reduction_audit`；归约本体写入 `IdeaNode.reduction_report`（schema：`schemas/reduction_report_v1.schema.json`）。

审计输出写入 `IdeaNode.grounding_audit`（并可汇总进 `idea_evidence_graph_v1.json`）。Grounding Audit 的默认触发点应当是 `eval.run`（当 `EvaluatorConfig.dimensions` 包含 `grounding` 时）；也允许由 `Checker` 角色在生成后即时执行（以加速剪枝）。

---

## 5. 核心数据与产物契约（artifacts）

沿用 2026-02-11 的“9 类产物”思想，但补齐关键字段：`origin`、`operator_trace`、`eval_info`（可再投喂诊断）。

**v0.2 必交付的可机器校验契约**：
- `schemas/rationale_draft_v1.schema.json`
- `schemas/idea_card_v1.schema.json`
- `schemas/idea_node_v1.schema.json`

### 5.1 SSOT artifacts（建议保持稳定命名/版本）

- `idea_campaign_v1.json`
- `idea_seed_pack_v1.json`
- `idea_candidates_v1.jsonl`
- `idea_evidence_graph_v1.json`
- `idea_novelty_report_v1.json`
- `idea_scorecards_v1.json`
- `idea_tournament_v1.json`
- `idea_selection_v1.json`
- `idea_handoff_c2_v1.json`
- `distributor_policy_config_v1.json`（每 campaign 一份；不可变；schema：`schemas/distributor_policy_config_v1.schema.json`）
- `distributor_events_v1.jsonl`（append-only；每 tick 一行；schema：`schemas/distributor_event_v1.schema.json`）
- `distributor_state_snapshot_v1.json`（可选；周期性快照；schema：`schemas/distributor_state_snapshot_v1.schema.json`）
- `distributor_diagnostics_v1.json`（可选；run 结束汇总）
- `reduction_report_v1.json`（条件性；ProblemReduction/TechniqueTransplant 产出；schema：`schemas/reduction_report_v1.schema.json`）
- `novelty_delta_table_v1.json`（每次 novelty 评审产出；schema：`schemas/novelty_delta_table_v1.schema.json`）
- `failed_approach_v1.jsonl`（可选；结构化失败记录；schema：`schemas/failed_approach_v1.schema.json`）

### 5.2 `idea_candidates_v1.jsonl`（每行一个 IdeaNode，最关键字段）

必须包含：

- `campaign_id`, `idea_id`, `node_id`, `parent_node_ids[]`, `island_id`, `operator_id`
- `rationale_draft`（或其 artifact 引用）
- `idea_card`（或其 artifact 引用；未形式化则为 null）
- `origin`：
  - `model`, `temperature`, `prompt_hash`, `timestamp`, `role`
- `operator_trace`：
  - `inputs`, `params`, `random_seed`, `evidence_uris_used[]`, `prompt_snapshot_hash`
- `eval_info`（来自 evaluator 的可操作诊断）：
  - `fix_suggestions[]`（结构化对象：failure_mode / suggested_action / target_field / operator_hint? / priority）
  - `failure_modes[]`（如“缺证据/太相似/物理不一致/不可计算”）
- `grounding_audit`（pass|fail|partial + failures[] + timestamp）
- `reduction_report`（归约本体；ProblemReduction/TechniqueTransplant 条件性）
- `reduction_audit`（归约审计门禁；pass|fail|partial；条件性）

**关于 `idea_id` vs `node_id`（避免歧义）**

- `node_id`：图搜索中的“节点 ID”（一次具体生成/改写/形式化的版本）。`parent_node_ids[]` 只引用 `node_id`。
- `idea_id`：概念层面的“idea 族/谱系 ID”（允许多个节点属于同一 idea 的演进链）。

---

## 6. 评估与排名：Evaluator 必须产出“可迭代的信息”

### 6.1 Evaluator（多维 + 多 agent）

维度建议延续：
- novelty / feasibility / impact / tractability / grounding

关键工程约束：
- evaluator 返回不只是分数，还要返回 **可再投喂的诊断**（参考 IdeaSearch-framework 的 score+info）
- 多 agent 评审默认 **clean-room**（互不共享对话记忆），直到触发“结构化辩论”才允许受控信息流
- `eval.run` 不要求节点已完成 IdeaCard 形式化（`idea_card` 可为 null）；但评估未形式化的节点应降低 `tractability`/`feasibility` 评分（因为缺少结构化可执行计划）。评估者应在 `eval_info.fix_suggestions[]` 中建议 `{failure_mode: "not_computable", suggested_action: "formalize to IdeaCard", target_field: "idea_card", priority: "critical"}`。

#### 6.1.1 clean-room 与结构化辩论（最小协议）

- clean-room：每个 evaluator 在独立会话/上下文中完成评分与证据检索（不共享草稿、不中途互相影响）。
- 触发辩论：任一维度分歧超过阈值（例如 `|Δscore| > 2`）或出现互斥结论（“已发表/未发表”）。
- 辩论输出必须结构化：point/counterpoint + evidence_uris + 最终裁定理由（作为 `eval_info` 的一部分写回）。

### 6.2 Novelty：四层栈 + folklore 风险

沿用 2026-02-11 的四层 novelty pipeline，但把 folklore 风险变成显式字段：
- `folklore_risk`（高则必须走 `A0-folklore` 人类裁定）

**重要补充：避免把“细枝末节”当成创新（Referee 硬约束）**

当 `EvaluatorConfig.dimensions` 包含 `novelty` 时，负责 novelty 维度的 Referee 输出必须包含一个 `novelty_delta_table`（可作为 `eval_info` 的结构化字段或独立 artifact），至少回答：

1. **closest prior**：最相近的 1–3 篇/方向（URI + 一句摘要）
2. **delta type**（枚举，可多选）：`new_mechanism | new_observable | new_regime | new_method | new_formalism | new_dataset | new_constraint`
3. **delta statement**：每个 delta 必须是一句“可被证伪”的陈述（不是措辞变化）
4. **non-novelty flags**：显式标注以下情况不计为主要创新：参数微调、符号替换但等价、仅换叙述不换预测、仅合并已知组件但无新可检验结论
5. **verification hook**：每个 delta 关联一个最小验证（可文献/可计算/可观测）

### 6.3 Ranking：Pareto + Tournament（Elo）

- Pareto：多目标前沿保证不被单一分数绑架
- Tournament/Elo：降低评分尺度漂移影响，促进相对比较的稳定性
  - **硬约束**：Elo 必须是 **bounded + deterministic** 的（否则成本不可控/不可复现）。建议 `rank.compute(method=elo)` 接受 `elo_config={max_rounds, seed}`，并把 pairing 规则写入 ranking artifact 以便回放。

---

## 7. DomainPack（领域插件）最小化设计（避免过度抽象）

v0.2 建议把扩展点收敛为 6 类（HEP 先硬编码实现，再抽取接口）：

1. `seed_sources`
2. `operators`（或 operator 参数化/模板）
3. `constraints_and_validators`
4. `retrieval_recipes`（INSPIRE 查询模板、关键词扩展、分类映射）
5. `feasibility_estimators`
6. `method_compilers`（IdeaCard → C2 handoff；必须可校验）

> DomainPack 的“知识载体”主要是：ontology + prompt templates + validators，而不是把物理写成大量 Python 规则（可维护性更好）。

**重要：HEP-first ≠ HEP-only（跨学科方法迁移必须预留接口）**  
许多突破来自“方法/表述/直觉”的跨域迁移，而不是同一子领域内的微调。因此在架构层必须保证：
- `domain` 只是 campaign 的 **primary target domain**（用于验收/约束/评估权重），不应把检索与算子空间硬锁死在 HEP。
- 支持“可插拔的 MethodPacks / CrossDomainPacks”：它们提供跨学科的 `operators + retrieval_recipes + validators`（例如统计物理/信息论/数学工具/ML），由 `TeamPolicy`/预算降级策略显式启用/禁用（见 `disable_cross_domain_operators`）。
- 跨域算子必须产出显式 `mapping table + invariants + kill criteria`（避免隐喻式类比污染），并通过 grounding audit（引用可解析）与目标域硬约束（量纲/对称性/可证伪性）。
- **“数学已解决”优先发现**：当目标域瓶颈可被抽象/归约为数学或其他学科的标准问题时（如优化、统计推断、图算法、偏微分方程、几何/拓扑对象），系统应优先启用 `ProblemReduction`/`TechniqueTransplant` 类算子：先给出抽象对象与等价/近似归约，再检索该对象在数学/CS 的经典解法与已知边界条件；仅在 transfer plan 通过 toy check/硬约束后才允许进入晋升/排名。

**formalism registry（为 C2 提供可校验映射）**：
- DomainPack 必须声明 `formalism_id → {c2_schema_ref, validator, compiler}` 的映射。
- `candidate_formalisms[]` 必须来自该 registry；否则 `node.promote` 必须失败（schema_validation_failed 或 grounding_audit_failed 或 formalism_not_in_registry）。

**abstract_problem registry（为 ProblemReduction 提供可校验目标）**：
- DomainPack 必须声明 `abstract_problem_type → {description, known_solution_families[], prerequisite_checklist[], reference_uris[]}` 的注册表。
- **Schema SSOT**：`schemas/abstract_problem_registry_v1.schema.json`（campaign 可通过 `campaign.init.abstract_problem_registry` 覆盖/补充 DomainPack 默认 registry）。
- `ProblemReduction` 的 `reduction_report.abstract_problem` 必须引用该 registry；未注册类型必须使 `reduction_audit.reduction_type_valid=false` 且阻塞晋升（`reduction_audit_failed`）。

---

## 8. 与现有生态圈集成（HEP-Autoresearch）

### 8.1 输入（seed sources）

- C1 gaps（系统性缺口）
- KB priors（已有笔记/失败记录/方法痕迹）
- PDG/HEPData tensions（反常/张力）
- user seeds（`seeds.yaml` / `ideas.md`）
- failed approaches（结构化失败记录：`failed_approach_v1.jsonl`，含 `approach_summary`, `failure_mode`, `failure_evidence_uris[]`, `lessons[]`, `reuse_potential`）

### 8.2 输出（handoff）

`idea_handoff_c2_v1.json` 是唯一允许进入 C2 的入口：
- 缺字段 → 直接拒绝（不可“口头交接”）
- **Schema SSOT**：`schemas/idea_handoff_c2_v1.schema.json`（由 `node.promote` 产出；C2 侧必须以此做机读校验）

### 8.3 门禁（A0）

沿用双层：
- `A0.1` Campaign charter（方向/预算/风险）
- `A0.2` Idea promotion（选具体 idea 投入资源）

---

## 9. 里程碑（v0.2 → v0.3）

v0.2（本 spec）交付“架构与契约”优先：

1. 固化 artifacts 与 IdeaNode 字段（含 origin/operator_trace/eval_info/grounding_audit）
2. 交付机器校验 schema（`schemas/*.schema.json` + OpenRPC）
3. Multi-Island + Explain-Then-Formalize 作为硬约束（含最小状态机）
4. 最小 HEP DomainPack（实现 2–3 个 operator + novelty/grounding MVP）

v0.3（下一步）：

- 加入 bandit distributor（模型+operator 双分配）
- 引入 phenotype profiling（explorer/converger/critic 分工）
- 概念网络导航算子/策略（Deep Ideation 风格 Explore-Expand-Evolve；作为 DomainPack 可选资产）
- 第二领域 pack 试点（验证抽象是否过拟合 HEP）

---

## 10. 关联文档

- 设计总报告：`docs/plans/2026-02-11-idea-generator-design.md`
- 补充文献综述：`docs/plans/2026-02-12-literature-supplement.md`
- 可执行“科学发现算子库”：`docs/plans/2026-02-12-executable-discovery-operators.md`
- 深度调研（IdeaSearch + OpenClaw）：`docs/plans/2026-02-12-ideasearch-openclaw-deep-dive.md`
- OpenCode 调研与生态兼容：`docs/plans/2026-02-12-opencode-hepar-compatibility.md`
- 实施路线图（进度追踪 SSOT）：`docs/plans/2026-02-12-implementation-plan-tracker.md`
- Long-running agent harness（Anthropic/Quickstarts）映射笔记：`docs/plans/2026-02-12-long-running-agent-harness-notes.md`
