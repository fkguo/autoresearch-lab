# Review Bundle (v8): idea-generator architecture spec + schemas + RPC

Please review the bundle below. Focus on:
- Contract machine-enforceability (JSON Schema + OpenRPC)
- Campaign scoping + idempotency correctness (retry safety)
- Pagination and budget observability consistency

Files included verbatim:

- `docs/plans/2026-02-12-idea-generator-architecture-spec.md`
- `schemas/idea_core_rpc_v1.openrpc.json`
- `schemas/campaign_charter_v1.schema.json`
- `schemas/seed_pack_v1.schema.json`
- `schemas/budget_envelope_v1.schema.json`
- `schemas/budget_snapshot_v1.schema.json`
- `schemas/island_state_v1.schema.json`
- `schemas/campaign_init_result_v1.schema.json`
- `schemas/campaign_status_v1.schema.json`
- `schemas/search_step_result_v1.schema.json`
- `schemas/idea_list_filter_v1.schema.json`
- `schemas/node_list_result_v1.schema.json`
- `schemas/evaluator_config_v1.schema.json`
- `schemas/eval_result_v1.schema.json`
- `schemas/ranking_result_v1.schema.json`
- `schemas/promotion_result_v1.schema.json`
- `schemas/formalism_registry_v1.schema.json`
- `schemas/rationale_draft_v1.schema.json`
- `schemas/idea_card_v1.schema.json`
- `schemas/idea_node_v1.schema.json`

--- BEGIN: docs/plans/2026-02-12-idea-generator-architecture-spec.md ---

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
5. **可控成本**：预算（token/$/时间/节点数）是一级参数；系统必须能早停/剪枝/降级。

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
  - `campaign.init` / `campaign.status`
  - `search.step`
  - `node.get` / `node.list` / `node.promote`
  - `eval.run`
  - `rank.compute`
- **错误码约定**：至少包含 `budget_exhausted` / `schema_validation_failed` / `grounding_audit_failed` / `formalism_not_in_registry` / `insufficient_eval_data` / `campaign_not_found` / `node_not_found` / `node_not_in_campaign`

**硬语义补充（machine-enforceable）**：

1. **Campaign scoping MUST**：涉及 `campaign_id` 的 RPC（包括 `node.get/node.list/node.promote`、`eval.run`、`rank.compute`、`search.step`），engine 必须验证所有涉及的 `node_id/node_ids` 都属于该 campaign；否则返回 `node_not_in_campaign`（防止跨 campaign 污染）。
2. **Idempotency MUST（side-effecting calls）**：对会落盘/写 artifact/更新节点的 RPC（`campaign.init`/`search.step`/`eval.run`/`rank.compute`/`node.promote`），adapter **必须**提供 `idempotency_key`（OpenRPC 要求）；engine 必须按 `(method, campaign_id?, idempotency_key)` 去重，确保重试不会产生重复产物或非确定性写入（`campaign.init` 无 `campaign_id`，因此该项为空；参考 OpenClaw gateway protocol 的同类纪律）。

> 备注：hepar skill 的“翻译层”应当只是把 hepar 命令映射到上述 RPC，并把返回写入 artifacts；不得把核心搜索逻辑塞回 skill。

> **契约 SSOT 规则（硬约束）**：`schemas/*.schema.json` 是唯一数据契约真源；`schemas/idea_core_rpc_v1.openrpc.json` 只通过 `$ref` 引用这些 schema，不得复制粘贴出第二份结构定义（避免漂移）。任何“打包成单文件”的需要必须通过机械化 bundling（脚本/CI）完成，而不是手工合并。

---

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
- `CrossDomainAnalogy`：结构/方法/现象映射（强制输出 mapping table）
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

推荐 v0.2 就引入 **softmax-bandit**（IdeaSearchFitter 给出可复用机制）：

- 为每个 backend/operator 维护近期 reward 的 EMA
- 用 `softmax(score/T)` 分配生成配额（避免单点收敛）；更具体地，可采用：
  - `p_i = exp(s_i / T_model) / Σ_j exp(s_j / T_model)`  
  - 其中 `s_i` 为后端/算子的 reward EMA，`T_model` 控制探索-利用权衡

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

> **成本感知约束**：Team topology 的 token 消耗近似为 `Σ(roles) × per-role-cost`；Distributor 在分配预算时必须将 team composition 纳入每步成本估算（而非假设每步 = 1 次 LLM 调用）。`BudgetEnvelope.extensions` 可承载 `team_cost_multiplier`/`role_cost_table` 等运行时参数。

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
4. **folklore 预筛**：产出 `folklore_risk_score ∈ [0,1]`；超过阈值则必须走 `A0-folklore` 人类裁定。

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

**formalism registry（为 C2 提供可校验映射）**：
- DomainPack 必须声明 `formalism_id → {c2_schema_ref, validator, compiler}` 的映射。
- `candidate_formalisms[]` 必须来自该 registry；否则 `node.promote` 必须失败（schema_validation_failed 或 grounding_audit_failed 或 formalism_not_in_registry）。

---

## 8. 与现有生态圈集成（HEP-Autoresearch）

### 8.1 输入（seed sources）

- C1 gaps（系统性缺口）
- KB priors（已有笔记/失败记录/方法痕迹）
- PDG/HEPData tensions（反常/张力）
- user seeds（`seeds.yaml` / `ideas.md`）

### 8.2 输出（handoff）

`idea_handoff_c2_v1.json` 是唯一允许进入 C2 的入口：
- 缺字段 → 直接拒绝（不可“口头交接”）

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

--- BEGIN: schemas/idea_core_rpc_v1.openrpc.json ---

{
  "openrpc": "1.2.6",
  "info": {
    "title": "idea-core RPC (v1)",
    "version": "1.4.0",
    "description": "JSON-RPC interface between the idea-generator adapter (hepar skill) and the standalone idea-core engine. Contract schemas are referenced via $ref to sibling files in this directory."
  },
  "methods": [
    {
      "name": "campaign.init",
      "summary": "Initialize a campaign.",
      "paramStructure": "by-name",
      "params": [
        { "name": "charter", "schema": { "$ref": "#/components/schemas/CampaignCharterV1" }, "required": true },
        { "name": "seed_pack", "schema": { "$ref": "#/components/schemas/SeedPackV1" }, "required": true },
        { "name": "budget", "schema": { "$ref": "#/components/schemas/BudgetEnvelopeV1" }, "required": true },
        {
          "name": "formalism_registry",
          "schema": { "$ref": "#/components/schemas/FormalismRegistryV1" },
          "description": "Override or supplement the DomainPack default formalism registry. If omitted, the engine uses the DomainPack built-in registry. If provided, entries are merged (caller entries take precedence on formalism_id collision)."
        },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "result": { "name": "campaign_init_result", "schema": { "$ref": "#/components/schemas/CampaignInitResultV1" } },
      "errors": [
        { "code": -32001, "message": "budget_exhausted" },
        { "code": -32002, "message": "schema_validation_failed" },
        { "code": -32010, "message": "invalid_charter" }
      ]
    },
    {
      "name": "campaign.status",
      "summary": "Get campaign status.",
      "paramStructure": "by-name",
      "params": [{ "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true }],
      "result": { "name": "campaign_status", "schema": { "$ref": "#/components/schemas/CampaignStatusV1" } },
      "errors": [{ "code": -32003, "message": "campaign_not_found" }]
    },
    {
      "name": "search.step",
      "summary": "Advance the search by a bounded step budget.",
      "paramStructure": "by-name",
      "params": [
        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
        {
          "name": "n_steps",
          "schema": { "type": "integer", "minimum": 1, "default": 1 },
          "description": "Number of search steps to execute. Defaults to 1."
        },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "result": { "name": "search_step_result", "schema": { "$ref": "#/components/schemas/SearchStepResultV1" } },
      "errors": [
        { "code": -32001, "message": "budget_exhausted" },
        { "code": -32003, "message": "campaign_not_found" }
      ]
    },
    {
      "name": "node.get",
      "summary": "Fetch a single IdeaNode by node_id within a campaign scope.",
      "paramStructure": "by-name",
      "params": [
        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
        { "name": "node_id", "schema": { "type": "string", "format": "uuid" }, "required": true }
      ],
      "result": { "name": "node", "schema": { "$ref": "#/components/schemas/IdeaNodeV1" } },
      "errors": [
        { "code": -32003, "message": "campaign_not_found" },
        { "code": -32004, "message": "node_not_found" },
        { "code": -32014, "message": "node_not_in_campaign" }
      ]
    },
    {
      "name": "node.list",
      "summary": "List IdeaNodes in a campaign (paginated).",
      "paramStructure": "by-name",
      "params": [
        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
        { "name": "filter", "schema": { "$ref": "#/components/schemas/IdeaListFilterV1" } },
        { "name": "cursor", "schema": { "type": "string", "minLength": 1 } },
        { "name": "limit", "schema": { "type": "integer", "minimum": 1 } }
      ],
      "result": { "name": "node_list", "schema": { "$ref": "#/components/schemas/NodeListResultV1" } },
      "errors": [{ "code": -32003, "message": "campaign_not_found" }]
    },
    {
      "name": "node.promote",
      "summary": "Promote a node to a C2 handoff artifact (after schema + grounding + formalism gates) within a campaign scope.",
      "paramStructure": "by-name",
      "params": [
        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
        { "name": "node_id", "schema": { "type": "string", "format": "uuid" }, "required": true },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "result": { "name": "promotion_result", "schema": { "$ref": "#/components/schemas/PromotionResultV1" } },
      "errors": [
        { "code": -32003, "message": "campaign_not_found" },
        { "code": -32004, "message": "node_not_found" },
        { "code": -32014, "message": "node_not_in_campaign" },
        { "code": -32002, "message": "schema_validation_failed" },
        { "code": -32011, "message": "grounding_audit_failed" },
        { "code": -32012, "message": "formalism_not_in_registry" }
      ]
    },
    {
      "name": "eval.run",
      "summary": "Run evaluation (multi-agent scoring) on a set of nodes and persist eval_info.",
      "paramStructure": "by-name",
      "params": [
        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
        {
          "name": "node_ids",
          "schema": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uuid" } },
          "required": true
        },
        { "name": "evaluator_config", "schema": { "$ref": "#/components/schemas/EvaluatorConfigV1" }, "required": true },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "result": { "name": "eval_result", "schema": { "$ref": "#/components/schemas/EvalResultV1" } },
      "errors": [
        { "code": -32001, "message": "budget_exhausted" },
        { "code": -32002, "message": "schema_validation_failed" },
        { "code": -32003, "message": "campaign_not_found" },
        { "code": -32004, "message": "node_not_found" },
        { "code": -32014, "message": "node_not_in_campaign" }
      ]
    },
    {
      "name": "rank.compute",
      "summary": "Compute rankings (Pareto/Elo) for a campaign.",
      "paramStructure": "by-name",
      "params": [
        { "name": "campaign_id", "schema": { "type": "string", "minLength": 1 }, "required": true },
        { "name": "method", "schema": { "enum": ["pareto", "elo"] }, "required": true },
        { "name": "filter", "schema": { "$ref": "#/components/schemas/IdeaListFilterV1" } },
        { "name": "idempotency_key", "schema": { "type": "string", "minLength": 1 }, "required": true }
      ],
      "result": { "name": "ranking_result", "schema": { "$ref": "#/components/schemas/RankingResultV1" } },
      "errors": [
        { "code": -32001, "message": "budget_exhausted" },
        { "code": -32003, "message": "campaign_not_found" },
        { "code": -32013, "message": "insufficient_eval_data" }
      ]
    }
  ],
  "components": {
    "schemas": {
      "CampaignCharterV1": { "allOf": [{ "$ref": "campaign_charter_v1.schema.json" }] },
      "SeedPackV1": { "allOf": [{ "$ref": "seed_pack_v1.schema.json" }] },
      "BudgetEnvelopeV1": { "allOf": [{ "$ref": "budget_envelope_v1.schema.json" }] },
      "CampaignInitResultV1": { "allOf": [{ "$ref": "campaign_init_result_v1.schema.json" }] },
      "CampaignStatusV1": { "allOf": [{ "$ref": "campaign_status_v1.schema.json" }] },
      "SearchStepResultV1": { "allOf": [{ "$ref": "search_step_result_v1.schema.json" }] },
      "IdeaNodeV1": { "allOf": [{ "$ref": "idea_node_v1.schema.json" }] },
      "IdeaListFilterV1": { "allOf": [{ "$ref": "idea_list_filter_v1.schema.json" }] },
      "NodeListResultV1": { "allOf": [{ "$ref": "node_list_result_v1.schema.json" }] },
      "EvaluatorConfigV1": { "allOf": [{ "$ref": "evaluator_config_v1.schema.json" }] },
      "EvalResultV1": { "allOf": [{ "$ref": "eval_result_v1.schema.json" }] },
      "RankingResultV1": { "allOf": [{ "$ref": "ranking_result_v1.schema.json" }] },
      "PromotionResultV1": { "allOf": [{ "$ref": "promotion_result_v1.schema.json" }] },
      "FormalismRegistryV1": { "allOf": [{ "$ref": "formalism_registry_v1.schema.json" }] }
    }
  }
}

--- BEGIN: schemas/campaign_charter_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "campaign_charter_v1.schema.json",
  "title": "CampaignCharter v1",
  "description": "A0.1 campaign charter: defines direction, constraints, and governance for a campaign.",
  "type": "object",
  "required": ["domain", "scope", "approval_gate_ref"],
  "properties": {
    "campaign_name": { "type": "string", "minLength": 1 },
    "domain": {
      "type": "string",
      "minLength": 1,
      "description": "HEP-first recommended values: hep-ph | hep-th | nucl-th. Keep as string for extensibility."
    },
    "scope": { "type": "string", "minLength": 10 },
    "approval_gate_ref": {
      "type": "string",
      "minLength": 1,
      "description": "Reference to the orchestrator gate config or an artifact URI for A0.1."
    },
    "objectives": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "constraints": { "type": "array", "items": { "type": "string", "minLength": 1 } },
    "search_policy_id": { "type": "string", "minLength": 1 },
    "team_policy_id": { "type": "string", "minLength": 1 },
    "notes": { "type": "string" },
    "extensions": {
      "type": "object",
      "description": "DomainPack-specific knobs (kept out of the stable surface).",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/seed_pack_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "seed_pack_v1.schema.json",
  "title": "SeedPack v1",
  "description": "Normalized seed inputs for a campaign. Sources may include C1 gaps, PDG tensions, KB priors, and user-provided seeds.",
  "type": "object",
  "required": ["seeds"],
  "properties": {
    "seeds": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["seed_type", "content"],
        "properties": {
          "seed_id": { "type": "string", "format": "uuid" },
          "seed_type": { "type": "string", "minLength": 1 },
          "content": { "type": "string", "minLength": 1 },
          "source_uris": { "type": "array", "items": { "type": "string", "format": "uri" } },
          "tags": { "type": "array", "items": { "type": "string", "minLength": 1 } },
          "metadata": { "type": "object", "additionalProperties": true }
        },
        "additionalProperties": false
      }
    },
    "created_at": { "type": "string", "format": "date-time" },
    "extensions": { "type": "object", "additionalProperties": true }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/budget_envelope_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "budget_envelope_v1.schema.json",
  "title": "BudgetEnvelope v1",
  "description": "Budget envelope for a campaign/search step. Used by the Budget Circuit Breaker.",
  "type": "object",
  "required": ["max_tokens", "max_cost_usd", "max_wall_clock_s"],
  "properties": {
    "max_tokens": { "type": "integer", "minimum": 1 },
    "max_cost_usd": { "type": "number", "minimum": 0 },
    "max_wall_clock_s": { "type": "number", "minimum": 0 },
    "max_nodes": {
      "type": "integer",
      "minimum": 1,
      "description": "Optional hard cap on the total number of IdeaNodes that may be created in this campaign."
    },
    "max_steps": { "type": "integer", "minimum": 1 },
    "degradation_order": {
      "type": "array",
      "description": "Optional ordered degradation strategy when budget is tight.",
      "items": {
        "enum": [
          "reduce_eval_rounds",
          "reduce_islands",
          "disable_cross_domain_operators",
          "reduce_population",
          "early_stop"
        ]
      }
    },
    "extensions": {
      "type": "object",
      "description": "Implementation-specific knobs (kept out of the stable surface).",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/budget_snapshot_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "budget_snapshot_v1.schema.json",
  "title": "BudgetSnapshot v1",
  "description": "Budget usage snapshot returned by the engine for monitoring and circuit breaking.",
  "type": "object",
  "required": [
    "tokens_used",
    "tokens_remaining",
    "cost_usd_used",
    "cost_usd_remaining",
    "wall_clock_s_elapsed",
    "wall_clock_s_remaining",
    "steps_used",
    "nodes_used"
  ],
  "properties": {
    "tokens_used": { "type": "integer", "minimum": 0 },
    "tokens_remaining": { "type": "integer", "minimum": 0 },
    "cost_usd_used": { "type": "number", "minimum": 0 },
    "cost_usd_remaining": { "type": "number", "minimum": 0 },
    "wall_clock_s_elapsed": { "type": "number", "minimum": 0 },
    "wall_clock_s_remaining": {
      "type": "number",
      "minimum": 0,
      "description": "Remaining wall-clock seconds under the BudgetEnvelope."
    },
    "steps_used": { "type": "integer", "minimum": 0 },
    "steps_remaining": {
      "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }],
      "description": "null if max_steps was not set in the BudgetEnvelope."
    },
    "nodes_used": {
      "type": "integer",
      "minimum": 0,
      "description": "Total IdeaNodes created so far in the campaign."
    },
    "nodes_remaining": {
      "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "null" }],
      "description": "null if max_nodes was not set in the BudgetEnvelope."
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/island_state_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "island_state_v1.schema.json",
  "title": "IslandState v1",
  "description": "Observable state of a strategy island in the multi-island search policy.",
  "type": "object",
  "required": ["island_id", "state", "population_size"],
  "properties": {
    "island_id": { "type": "string", "minLength": 1 },
    "state": { "enum": ["SEEDING", "EXPLORING", "CONVERGING", "STAGNANT", "REPOPULATED", "EXHAUSTED"] },
    "population_size": { "type": "integer", "minimum": 0 },
    "team_policy_id": {
      "type": "string",
      "minLength": 1,
      "description": "Reference to the TeamPolicy governing role composition and coordination on this island."
    },
    "stagnation_counter": { "type": "integer", "minimum": 0 },
    "best_score": { "type": ["number", "null"] },
    "repopulation_count": { "type": "integer", "minimum": 0 }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/campaign_init_result_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "campaign_init_result_v1.schema.json",
  "title": "CampaignInitResult v1",
  "description": "Result of campaign.init.",
  "type": "object",
  "required": ["campaign_id", "created_at", "budget_snapshot", "island_states"],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "created_at": { "type": "string", "format": "date-time" },
    "budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" },
    "island_states": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "island_state_v1.schema.json" }
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/campaign_status_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "campaign_status_v1.schema.json",
  "title": "CampaignStatus v1",
  "description": "Campaign status returned by the engine. Must expose island states and budget for observability.",
  "type": "object",
  "required": ["campaign_id", "status", "budget_snapshot", "island_states"],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "status": { "enum": ["running", "early_stopped", "exhausted", "completed"] },
    "created_at": { "type": "string", "format": "date-time" },
    "budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" },
    "island_states": { "type": "array", "minItems": 1, "items": { "$ref": "island_state_v1.schema.json" } },
    "node_count": { "type": "integer", "minimum": 0 },
    "last_step_id": { "type": "string", "format": "uuid" }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/search_step_result_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "search_step_result_v1.schema.json",
  "title": "SearchStepResult v1",
  "description": "Result of a bounded search step. Must expose budget and island states for observability and control.",
  "type": "object",
  "required": [
    "campaign_id",
    "step_id",
    "n_steps_requested",
    "n_steps_executed",
    "new_node_ids",
    "island_states",
    "budget_snapshot"
  ],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "step_id": { "type": "string", "format": "uuid" },
    "n_steps_requested": { "type": "integer", "minimum": 1 },
    "n_steps_executed": { "type": "integer", "minimum": 0 },
    "new_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "new_nodes_artifact_ref": { "type": "string", "format": "uri" },
    "island_states": { "type": "array", "minItems": 1, "items": { "$ref": "island_state_v1.schema.json" } },
    "budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" },
    "early_stopped": { "type": "boolean", "default": false },
    "early_stop_reason": { "type": "string" }
  },
  "allOf": [
    {
      "if": { "properties": { "early_stopped": { "const": true } }, "required": ["early_stopped"] },
      "then": { "required": ["early_stop_reason"] }
    },
    {
      "if": { "properties": { "new_node_ids": { "type": "array", "minItems": 1 } }, "required": ["new_node_ids"] },
      "then": { "required": ["new_nodes_artifact_ref"] }
    }
  ],
  "additionalProperties": false
}

--- BEGIN: schemas/idea_list_filter_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_list_filter_v1.schema.json",
  "title": "IdeaListFilter v1",
  "description": "Filter options for listing IdeaNodes in a campaign.",
  "type": "object",
  "properties": {
    "idea_id": { "type": "string", "format": "uuid" },
    "node_id": { "type": "string", "format": "uuid" },
    "island_id": { "type": "string", "minLength": 1 },
    "operator_id": { "type": "string", "minLength": 1 },
    "has_idea_card": { "type": "boolean" },
    "grounding_status": { "enum": ["pass", "fail", "partial"] }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/node_list_result_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "node_list_result_v1.schema.json",
  "title": "NodeListResult v1",
  "description": "Result of node.list (paginated).",
  "type": "object",
  "required": ["campaign_id", "nodes", "cursor"],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "nodes": { "type": "array", "items": { "$ref": "idea_node_v1.schema.json" } },
    "cursor": {
      "type": ["string", "null"],
      "description": "Opaque pagination cursor. null if no more results."
    },
    "total_count": { "type": "integer", "minimum": 0 }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/evaluator_config_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "evaluator_config_v1.schema.json",
  "title": "EvaluatorConfig v1",
  "description": "Configuration for multi-agent evaluation (dimensions, reviewer count, debate trigger).",
  "type": "object",
  "required": ["dimensions", "n_reviewers"],
  "properties": {
    "dimensions": {
      "type": "array",
      "minItems": 1,
      "items": { "enum": ["novelty", "feasibility", "impact", "tractability", "grounding"] }
    },
    "n_reviewers": { "type": "integer", "minimum": 1 },
    "clean_room": { "type": "boolean", "default": true },
    "debate_threshold": { "type": "number", "minimum": 0 },
    "weights": {
      "type": "object",
      "additionalProperties": { "type": "number", "minimum": 0 }
    },
    "extensions": { "type": "object", "additionalProperties": true }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/eval_result_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "eval_result_v1.schema.json",
  "title": "EvalResult v1",
  "description": "Result of eval.run. Engine persists eval_info into IdeaNodes and returns artifact refs + budget snapshot.",
  "type": "object",
  "required": ["campaign_id", "node_ids", "scorecards_artifact_ref", "budget_snapshot"],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "node_ids": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uuid" } },
    "scorecards_artifact_ref": { "type": "string", "format": "uri" },
    "budget_snapshot": { "$ref": "budget_snapshot_v1.schema.json" }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/ranking_result_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "ranking_result_v1.schema.json",
  "title": "RankingResult v1",
  "description": "Result of rank.compute (Pareto or Elo).",
  "type": "object",
  "required": ["campaign_id", "method", "ranked_nodes"],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "method": { "enum": ["pareto", "elo"] },
    "ranked_nodes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["node_id", "rank"],
        "properties": {
          "node_id": { "type": "string", "format": "uuid" },
          "idea_id": { "type": "string", "format": "uuid" },
          "rank": { "type": "integer", "minimum": 1 },
          "pareto_front": { "type": "boolean" },
          "elo_rating": { "type": "number" }
        },
        "additionalProperties": false
      }
    },
    "ranking_artifact_ref": { "type": "string", "format": "uri" }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/promotion_result_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "promotion_result_v1.schema.json",
  "title": "PromotionResult v1",
  "description": "Result of promoting an idea to a C2 handoff artifact (after schema + grounding + formalism checks).",
  "type": "object",
  "required": [
    "campaign_id",
    "node_id",
    "idea_id",
    "handoff_artifact_ref",
    "formalism_check",
    "grounding_audit_summary"
  ],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "node_id": { "type": "string", "format": "uuid" },
    "idea_id": { "type": "string", "format": "uuid" },
    "handoff_artifact_ref": { "type": "string", "format": "uri" },
    "formalism_check": {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": { "enum": ["pass", "fail"] },
        "missing_formalisms": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": false
    },
    "grounding_audit_summary": {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": { "enum": ["pass", "fail", "partial"] },
        "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 },
        "failures": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Summary of grounding failures that blocked promotion."
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/formalism_registry_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "formalism_registry_v1.schema.json",
  "title": "Formalism Registry v1",
  "description": "DomainPack-declared registry mapping formalism IDs to C2 validation/compilation contracts.",
  "type": "object",
  "required": ["entries"],
  "properties": {
    "entries": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["formalism_id", "c2_schema_ref", "validator_id", "compiler_id"],
        "properties": {
          "formalism_id": {
            "type": "string",
            "pattern": "^[a-z0-9_]+\\/[a-z0-9_.-]+$",
            "description": "Format: <namespace>/<name>."
          },
          "c2_schema_ref": { "type": "string", "format": "uri" },
          "validator_id": { "type": "string", "minLength": 1 },
          "compiler_id": { "type": "string", "minLength": 1 },
          "description": { "type": "string" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/rationale_draft_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "rationale_draft_v1.schema.json",
  "title": "RationaleDraft v1",
  "description": "Stage-1 (Explain) artifact: human-readable motivation, intuition, risks, and minimal validation plan before formalization.",
  "type": "object",
  "required": ["rationale", "risks", "kill_criteria"],
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "rationale": { "type": "string", "minLength": 1 },
    "mechanism": { "type": "string" },
    "analogy_mapping": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source", "target", "mapping"],
        "properties": {
          "source": { "type": "string", "minLength": 1 },
          "target": { "type": "string", "minLength": 1 },
          "mapping": { "type": "string", "minLength": 1 }
        },
        "additionalProperties": false
      }
    },
    "risks": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "kill_criteria": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "references": { "type": "array", "items": { "type": "string", "format": "uri" } }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/idea_card_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_card_v1.schema.json",
  "title": "IdeaCard v1",
  "description": "Stage-2 (Formalize) artifact: C2-ready structured research idea with claim-level provenance and an executable minimal plan.",
  "type": "object",
  "required": [
    "thesis_statement",
    "testable_hypotheses",
    "required_observables",
    "candidate_formalisms",
    "minimal_compute_plan",
    "claims"
  ],
  "properties": {
    "thesis_statement": { "type": "string", "minLength": 20 },
    "testable_hypotheses": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "required_observables": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "candidate_formalisms": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "minLength": 1,
        "pattern": "^[a-z0-9_]+\\/[a-z0-9_.-]+$",
        "description": "Formalism ID. Expected format: <namespace>/<name> (validated against the DomainPack formalism registry at runtime)."
      }
    },
    "minimal_compute_plan": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["step", "method", "estimated_difficulty"],
        "properties": {
          "step": { "type": "string", "minLength": 1 },
          "method": { "type": "string", "minLength": 1 },
          "estimated_difficulty": { "enum": ["straightforward", "moderate", "challenging", "research_frontier"] },
          "estimate_confidence": {
            "enum": ["high", "medium", "low"],
            "description": "Confidence in the difficulty/compute-hours estimate."
          },
          "estimated_compute_hours_log10": {
            "type": "number",
            "description": "Order-of-magnitude estimate: log10(compute hours). Example: -2 ~ seconds, 0 ~ 1 hour, 3 ~ 1000 hours."
          },
          "required_infrastructure": { "enum": ["laptop", "workstation", "cluster", "not_yet_feasible"] },
          "blockers": {
            "type": "array",
            "items": { "type": "string", "minLength": 1 },
            "description": "Known blockers or unknowns that could affect feasibility of this step."
          },
          "tool_hint": { "type": "string" }
        },
        "additionalProperties": false
      }
    },
    "claims": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["claim_text", "support_type", "evidence_uris"],
        "properties": {
          "claim_text": { "type": "string", "minLength": 1 },
          "support_type": {
            "enum": ["literature", "data", "calculation", "llm_inference", "assumption", "expert_consensus"],
            "description": "Source category. 'expert_consensus' should be backed by ≥1 review-level reference (PDG review, SPIRES review, community white paper) in evidence_uris."
          },
          "evidence_uris": { "type": "array", "items": { "type": "string", "format": "uri" } },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "verification_plan": {
            "type": "string",
            "description": "Required when support_type is llm_inference or assumption."
          },
          "verification_status": { "enum": ["verified", "unverified", "falsified"], "default": "unverified" },
          "verification_notes": { "type": "string" }
        },
        "allOf": [
          {
            "if": {
              "properties": { "support_type": { "enum": ["llm_inference", "assumption"] } },
              "required": ["support_type"]
            },
            "then": { "required": ["verification_plan"] }
          },
          {
            "if": {
              "properties": { "support_type": { "enum": ["literature", "data", "calculation", "expert_consensus"] } },
              "required": ["support_type"]
            },
            "then": { "properties": { "evidence_uris": { "minItems": 1 } } }
          }
        ],
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}

--- BEGIN: schemas/idea_node_v1.schema.json ---

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_node_v1.schema.json",
  "title": "IdeaNode v1",
  "description": "A single candidate node in the ideation search space, with lineage, traces, diagnostics, and optional formalized IdeaCard.",
  "type": "object",
  "required": [
    "campaign_id",
    "idea_id",
    "node_id",
    "parent_node_ids",
    "island_id",
    "operator_id",
    "origin",
    "operator_trace",
    "rationale_draft"
  ],
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "idea_id": { "type": "string", "format": "uuid" },
    "node_id": { "type": "string", "format": "uuid" },
    "parent_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "island_id": { "type": "string", "minLength": 1 },
    "operator_id": { "type": "string", "minLength": 1 },
    "rationale_draft": { "$ref": "rationale_draft_v1.schema.json" },
    "idea_card": { "oneOf": [{ "$ref": "idea_card_v1.schema.json" }, { "type": "null" }] },
    "origin": {
      "type": "object",
      "required": ["model", "temperature", "prompt_hash", "timestamp", "role"],
      "properties": {
        "model": { "type": "string", "minLength": 1 },
        "temperature": { "type": "number", "minimum": 0 },
        "prompt_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
        "timestamp": { "type": "string", "format": "date-time" },
        "role": {
          "type": "string",
          "minLength": 1,
          "description": "Physicist role/persona that produced this node (e.g., Ideator, Librarian, Formalizer, Derivation, Checker, Referee, Editor)."
        }
      },
      "additionalProperties": false
    },
    "operator_trace": {
      "type": "object",
      "required": ["inputs", "params", "evidence_uris_used"],
      "properties": {
        "inputs": { "type": "object" },
        "params": { "type": "object" },
        "random_seed": { "type": "integer" },
        "evidence_uris_used": { "type": "array", "items": { "type": "string", "format": "uri" } },
        "prompt_snapshot_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" }
      },
      "additionalProperties": false
    },
    "eval_info": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "required": ["fix_suggestions", "failure_modes"],
          "properties": {
            "novelty_delta_table": {
              "type": "array",
              "description": "Optional structured novelty deltas to avoid mistaking superficial changes for innovation.",
              "items": {
                "type": "object",
                "required": ["closest_prior_uris", "delta_types", "delta_statement", "verification_hook"],
                "properties": {
                  "closest_prior_uris": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uri" } },
                  "delta_types": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                      "enum": [
                        "new_mechanism",
                        "new_observable",
                        "new_regime",
                        "new_method",
                        "new_formalism",
                        "new_dataset",
                        "new_constraint"
                      ]
                    }
                  },
                  "delta_statement": { "type": "string", "minLength": 1 },
                  "non_novelty_flags": {
                    "type": "array",
                    "items": {
                      "enum": [
                        "parameter_tuning_only",
                        "relabeling_only",
                        "equivalent_reformulation",
                        "no_new_prediction",
                        "known_components_no_testable_delta"
                      ]
                    }
                  },
                  "verification_hook": { "type": "string", "minLength": 1 }
                },
                "additionalProperties": false
              }
            },
            "fix_suggestions": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["failure_mode", "suggested_action", "target_field", "priority"],
                "properties": {
                  "failure_mode": {
                    "enum": [
                      "missing_evidence",
                      "too_similar",
                      "physics_inconsistency",
                      "not_computable",
                      "folklore_overlap",
                      "untestable"
                    ]
                  },
                  "suggested_action": { "type": "string", "minLength": 1 },
                  "target_field": { "type": "string", "minLength": 1 },
                  "operator_hint": { "type": "string" },
                  "priority": { "enum": ["critical", "major", "minor"] }
                },
                "additionalProperties": false
              }
            },
            "failure_modes": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Superset of failure modes (may include free-text diagnostics beyond the fix_suggestions enum). Structured actionable failures should appear in fix_suggestions; this field captures all detected issues including informational ones."
            }
          },
          "additionalProperties": false
        }
      ]
    },
    "grounding_audit": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "required": ["status", "folklore_risk_score", "failures", "timestamp"],
          "properties": {
            "status": { "enum": ["pass", "fail", "partial"] },
            "folklore_risk_score": { "type": "number", "minimum": 0, "maximum": 1 },
            "failures": { "type": "array", "items": { "type": "string" } },
            "timestamp": { "type": "string", "format": "date-time" }
          },
          "additionalProperties": false
        }
      ]
    },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp of last mutation (e.g., eval_info update, grounding re-audit)."
    }
  },
  "additionalProperties": false
}

