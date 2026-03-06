# Phase 3 Implementation Batch 10: NEW-SEM-01 + NEW-SEM-06

> **前置条件**: Batch 8 (`NEW-RT-05`) + `NEW-MCP-SAMPLING` + Batch 9 (`NEW-SEM-07`) 已完成并通过验证。  
> **本批目标**: 交付语义质量轨 P1 核心双项：`NEW-SEM-01`（quantity semantics）+ `NEW-SEM-06`（evidence retrieval upgrade）。  
> **项目级要求（强制）**: 方案必须从整个 Autoresearch 生态视角设计，显式考虑后续未完成项（尤其 Batch 11/12/13，对应 G3/G4/G5）可复用性与接口稳定性。

---

## 范围

本批次实现 2 个 Phase 3 item：

1. **NEW-SEM-01**: Quantity Semantics Adjudicator（P1 / high）
2. **NEW-SEM-06**: Evidence Retrieval Upgrade（P1 / medium）

---

## 全局约束（不是局部 patch）

### 1) 为后续 batch 预留稳定语义接口

- **面向 Batch 11 (`NEW-SEM-02`)**：本批产出的 quantity 对齐结果、retrieval 结果必须可直接进入 claim→evidence→stance grading 管线。
- **面向 Batch 12 (`NEW-SEM-03/04`)**：输出需包含可用于 stance/conflict adjudication 的最小语义证据元数据（来源、置信度、不确定路径）。
- **面向 Batch 13 (`NEW-SEM-05`) 与 G5 之后**：分类/检索信号字段命名保持一致，避免重复定义同义字段。

### 2) 不破坏既有 gate 与 contract

- 不回退 Batch 9 已建立的 structured/fail-closed gate 语义。
- 不引入 CONTRACT 禁止项（类型逃逸、静默吞错、未注册配置键等）。
- NEW-SEM-01 的 LLM 语义判定必须经 MCP sampling（`ctx.createMessage`）路径调用，禁止内嵌 provider SDK/client。
- 变更必须保持 `@autoresearch/hep-mcp` 在 monorepo 构建/测试可通过。

### 3) 质量轨硬性要求（来自语义审计）

- 每个语义模块都必须有：**标注 eval set + baseline + target delta + failure policy**。
- 仅“JSON 可解析”不算达标，必须证明语义质量改进。

---

### 4) 禁止闭集枚举（质量护栏）

- 禁止通过“少量物理量名/单位/关键词枚举”来驱动核心语义决策（`match|split|uncertain`、relevance 排序）。枚举只能用于：格式规范化、统计 tag、以及 **解析成功时** 的确定性 post-guard。
- Eval set 必须显式包含 `other/long-tail` 与 OOD 情况；指标必须分 `overall` 与 `long-tail/OOD` 汇报，避免闭集过拟合。
- 需保留 locked holdout（建议 `>=10%` case，且以 `other/long-tail` 与 OOD 为主），禁止在实现迭代中反复对齐该部分；仅用于最终 gate 验证。

---

## SOTA 原则（必需执行）

实施前必须联网调研近两年（优先 2024–2026）的相关最佳实践，并形成简要记录文档：

- `quantity normalization / entity alignment`（单位换算、语义聚类、冲突判定）
- `semantic retrieval + reranking`（dense/bi-encoder/cross-encoder/混合检索）
- `fallback policy`（timeout/低置信度退化策略）

建议输出：`meta/docs/sota-sem-batch10-2026-03-05.md`（文件名可调整）。

SOTA 调研结论必须反映到实现设计（不是只写报告），至少覆盖：
- quantity semantics 判定（identity/comparability）；单位换算仅作为“可解析时的确定性特征/护栏”，不是主判定来源
- semantic retrieval 的模型或算法选型依据
- rerank 策略取舍依据
- fallback 阈值策略依据

2025–2026 近期 SOTA 方向（仅作参考，最终以本 repo 的 eval 结果选型）：

- Retrieval：multi-stage hybrid（sparse→dense/late-interaction→cross-encoder/list-wise rerank）+ 低成本 query reformulation 可显著提升 recall 与整体排序质量（例如 arXiv:2602.10321）。
- Rerank：cross-encoder 仍是上限，但可考虑更高效的 minimal-interaction 变体以降低 latency，并关注 OOD 泛化（例如 arXiv:2602.16299）。
- Late interaction / multi-vector retrieval：作为 dense 单向量的替代路线，在 OOD 上更稳健，值得在 rerank/二阶段中评测（例如 arXiv:2511.00444）。
- Alignment（类比 entity matching/ER）：将判定分解为多步结构化推理（token 对齐→关键属性→最终决策）或引入对比/辩论以提高鲁棒性；以及用 selecting/clustering 引入全局一致性、降低 pairwise 误差与调用成本（例如 arXiv:2511.22832, arXiv:2506.02509, COLING 2025 2025.coling-main.8）。

若本 repo 的 eval 结论与上述文献方向相反（例如本地显示“更简单路径更好”），不得直接下结论；必须先做快速 sanity check 并把结论写入实现记录：

1. **任务/约束同构性**：目标任务定义、指标口径、top-k、latency/cost 预算与文献是否一致；不一致需解释为何仍可对比。
2. **数据集质量**：`other/long-tail` 与 locked holdout/OOD 是否到位；是否存在 data leakage 或“按 holdout 调参”。
3. **统计稳定性**：n 是否足够；重复运行/置信区间是否显示差异显著；避免偶然波动驱动选型。
4. **实现对齐**：SOTA 路线是否实现到同等强度（关键超参、ablation、同等 rerank 深度），而非“弱实现 vs 强 baseline”。
5. **闭集过拟合**：是否出现“补枚举/补规则就能过”的迹象；若有，必须回到语义判定与 long-tail 修复。
6. **端到端复现**：收益是否能在下游消费侧（Batch 11/12）复现，而不是只在单点评测上提升。

> 若使用 GitNexus 做代码理解，先确认索引 freshness；若 stale，先运行 `npx gitnexus analyze`。

---

## 关键文件（预计）

### NEW-SEM-01
- `packages/hep-mcp/src/core/hep/measurements.ts`（existing，modify）
- `packages/hep-mcp/src/core/hep/compareMeasurements.ts`（existing，modify）
- `packages/hep-mcp/src/tools/research/measurementExtractor.ts`（existing，modify）
- `packages/hep-mcp/src/tools/research/conflictDetector.ts`（existing，modify）

### NEW-SEM-06
- `packages/hep-mcp/src/core/evidence.ts`（existing，modify）
- `packages/hep-mcp/src/core/evidenceSemantic.ts`（existing，modify）
- `packages/hep-mcp/src/core/writing/evidence.ts`（existing，modify）

### Eval / 测试（两项共用）
- `packages/hep-mcp/src/eval/*`（复用 Batch 8 eval framework）
- `packages/hep-mcp/src/eval/metrics.ts`（existing，modify if needed）
- `packages/hep-mcp/tests/eval/*`
- `packages/hep-mcp/tests/eval/fixtures/*`

---

## Item 1: NEW-SEM-01 — Quantity Semantics Adjudicator

### 目标

将 quantity/entity 对齐从“词面近似优先”升级为“语义判定优先 + 确定性护栏”：

```text
候选召回(规则/词面) -> 语义判定(LLM/模型) -> 单位/维度/schema 确定性校验
```

### 最小实现要求

1. 建立结构化输出契约（建议单独 type/schema）：
   - `decision`: `match | split | uncertain`
   - `canonical_quantity`
   - `unit_normalization`
   - `confidence`
   - `reason_code`（可枚举，便于后续统计；必须包含 `other`，不得承载“物理量闭集枚举”）
2. 对 `uncertain` / 超时 / 响应无效提供显式降级路径（不得静默当作 `match`）。
3. 保留 deterministic guard：单位维度冲突、schema 非法、关键字段缺失时 fail-closed 或返回 `uncertain`。
4. LLM 调用统一走 MCP sampling（`ctx.createMessage`），参考现有 `theoreticalConflicts.ts` 模式；禁止直接嵌入 SDK/client。
5. `reason_code` 枚举与 `confidence` 合法区间必须在可复用类型/schema 中显式定义，供 Batch 11/12 直接复用。
6. 任何单位/量名/术语列表只能用于“解析与规范化”；当解析失败或遇到未见形式时，必须走语义判定或返回 `uncertain`，不得靠补枚举“修到通过”。

### Eval 要求（强制）

1. 构建 quantity 对齐标注集（pairs/groups），`n >= 50`（建议 `n >= 100`）；必须覆盖 hard cases（同量纲不同表达、近义但不同物理量、单位混用等，**非穷尽清单**），并保留 `other/long-tail` 类别（建议占比 `>= 20%`）以覆盖未枚举场景（建议从真实运行/语料随机抽样补足 long-tail，避免手工挑例导致闭集偏差）。
   - 建议将 `other/long-tail` 中一部分（例如 `>=10%` 总量）划为 locked holdout，仅在最终验收时运行一次，用于检验泛化与避免“靠补枚举修到通过”。
2. 记录 baseline（现有 lexical/heuristic 路径），并在实现前声明数值化 target（禁止“显著提升”这类非量化描述）。
3. 记录目标指标与实际结果，至少包含：
   - `wrong_merge_rate`
   - `false_split_rate`
   - `pairwise_f1`（或等价聚类质量指标）
4. target 需可验收（例如每项满足“绝对阈值 + 相对改善阈值”，取更严格者；推荐相对改善门槛 `>=30%`）。
5. 指标计算公式需在 eval 代码中显式实现并文档化（避免“口径不一致”）；必要时扩展 `src/eval/metrics.ts`。
6. 指标报告需同时给出 overall + 分类别结果（含 `other/long-tail`），避免仅在枚举类别上“看起来提升”。
7. 若未达 target，必须输出失败分析与后续动作，不得把未达标标记为 done。

---

## Item 2: NEW-SEM-06 — Evidence Retrieval Upgrade (Quality-First Default)

### 目标

将 evidence 检索默认路径升级为 semantic + rerank，lexical 仅保留 fallback：

```text
query/claim -> semantic retrieval -> rerank -> structured evidence candidates
                      \-> lexical fallback (only on policy trigger)
```

### 最小实现要求

1. 默认路径优先 semantic retrieval（可混合 lexical 信号，但不再 lexical-first）。
2. 输出结构需包含后续 SEM-02/03 可复用字段（至少：`evidence_id/source`, `score`, `retrieval_mode`, `rank`, `provenance`）。
3. 明确 fallback 触发策略（timeout、embedding 失败、低置信度等）并可观测（计数/比率）。

### Eval 要求（强制）

1. 构建 claim→evidence relevance 标注集，`n >= 50`（建议 `n >= 100`），至少覆盖 citation、support/contradiction、无关干扰样本三类，并包含 `other/long-tail`（如术语漂移、符号别名、跨段落隐式证据）以避免闭集过拟合。
   - 建议从 `other/long-tail` 中划出 locked holdout（例如 `>=10%`），仅用于最终验收，避免按该集合“定向调参”。
2. 记录 baseline（当前 retrieval 路径）与新路径对比，并在实现前声明数值化 target。
3. 至少报告：
   - `P@k`（推荐 k=5/10）
   - `R@k`
   - `MRR@k`（如适用）
   - `fallback_rate`
   - 延迟指标（至少 p50/p95）
4. 明确成本/性能边界：需给出数值阈值（p95 延迟上限、单 query 成本上限、fallback_rate 上限）及参数化降级策略。

---

## 跨项集成要求（Batch 10 的核心）

1. **统一语义结果结构**：SEM-01 与 SEM-06 的输出字段命名与错误语义保持一致（`confidence` / `uncertain` / `reason_code` 风格对齐）。
2. **可追踪性**：结果需保留足够 provenance 信息，支持后续 Batch 11/12 追查“为何判定如此”。
3. **评测工件可复用**：本批新增 eval set/metric 报告应可直接复用于 G3 证据包，不做一次性脚本。
4. **为 G4/G5 预留字段**：本批输出需预留 stance/conflict 与统一分类复用字段，避免 Batch 12/13 发生破坏性 schema 变更。

---

## 非目标（本批不做）

- 不实现 NEW-SEM-02/03/04/05 的完整业务逻辑。
- 不在本批引入新的全局 orchestrator/gate 机制。
- 不做无关大规模重构（保持范围收敛）。

---

## 验收检查点

- [ ] NEW-SEM-01 语义判定路径已落地，含 deterministic guard 与 uncertainty 路径
- [ ] NEW-SEM-06 semantic-first 检索已落地，lexical 路径仅作 fallback
- [ ] 两项均有标注 eval set、baseline、target、结果报告
- [ ] NEW-SEM-01 的语义调用经 `ctx.createMessage`（MCP sampling）实现，未嵌入 provider SDK/client
- [ ] 结果字段可复用于 Batch 11/12（已显式设计并测试）
- [ ] G3 gate artifact 已产出：SEM-01 报告证明 `wrong_merge_rate` 与 `false_split_rate` 达到数值 target，并可作为 Batch 11 启动依据
- [ ] `pnpm --filter @autoresearch/hep-mcp test:eval` 通过
- [ ] `pnpm --filter @autoresearch/hep-mcp test` 通过（若失败需说明是否既有失败）
- [ ] `pnpm -r build` 通过
- [ ] 实施方案经 `Opus + K2.5` 双模型审核收敛（0 blocking；如有 amendments 需记录采纳与理由）

---

## 建议执行顺序

1. 先定 eval contract + baseline（避免“先改后测”）
2. 实现 NEW-SEM-01（先解决 quantity 关键语义缺陷，支撑 G3）
3. 实现 NEW-SEM-06（检索质量升级，支撑后续 claim/evidence/stance）
4. 做跨项字段对齐与回归
5. 输出 G3-ready 证据包（指标、失败分析、fallback 统计）

---

## 实施后审核要求（强制）

- Batch 10 实施完成前，必须通过 `Opus + K2.5` 双模型独立审核并收敛。
- 收敛判定：两模型均 0 blocking；若有 amendments，需记录采纳/不采纳及理由。
- 审核重点：全项目视角、下游 Batch 11/12/13 兼容性、G3/G4/G5 风险、eval-first 可验收性。
