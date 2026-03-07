# Phase 3 Implementation Batch 14: `NEW-SEM-10` + `NEW-SEM-13`

> **状态**: 基于 `v1.9.2-draft` 规划、Batch 13（`NEW-SEM-05` + `NEW-SEM-09`）已完成并经 `Opus + OpenCode(kimi-for-coding/k2p5)` 代码双审 `0 blocking` 后的执行 prompt。  
> **前置条件**: Batch 10（`NEW-SEM-01` + `NEW-SEM-06a`）✅、Batch 11（`NEW-SEM-02` + `NEW-RT-06`）✅、Batch 12（`NEW-SEM-03` + `NEW-SEM-04` + `NEW-SEM-06-INFRA`）✅、Batch 13（`NEW-SEM-05` + `NEW-SEM-09`）✅。`NEW-DISC-01` 仍为 kickoff / `in_progress`（D1/D2/D3 ✅，D4/D5 仍待 Batch 13–14 parallel lane closeout）；`NEW-RT-07` 仍未启动；`NEW-SEM-06b` 仍未启动。  
> **本批目标**: 保持既有 SEM lane 节奏，完成 `NEW-SEM-10` + `NEW-SEM-13`，把 collection-level topic/method grouping 与 narrative challenge extraction 从 keyword-heavy / fixed-threshold 逻辑推进到更稳健、可评测、可重复的语义层。

> **作用域澄清**: 本 prompt 只覆盖 **SEM lane 的 Batch 14 主线**。`NEW-RT-07` 与 `NEW-DISC-01` D4/D5 closeout 仍属于 Batch 13–14 的 parallel infra lane，但**不在本 prompt 内联启动**；除非人类另行下达独立 prompt，不得把 host-side routing、federated discovery closeout、`NEW-LOOP-01`、或 `NEW-SEM-06b` 顺手并入本批。

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。

---

## 0. 执行定位

这是一个 **双工作面 batch**：

1. **`NEW-SEM-10`** — `Topic/Method Grouping Semanticizer`  
   - 本批主 gate item；目标是把 `analyzePapers.ts` 与 `synthesis/grouping.ts` 中依赖 top-keyword / fallback method terms / fixed threshold 的 grouping 逻辑，提升为 **更稳定、可重复、语义一致的 topic/method grouping backbone**。
2. **`NEW-SEM-13`** — `Synthesis Challenge Extractor`  
   - 本批配套完成项；目标是把 `synthesis/narrative.ts` 中基于 `includes()` 的 methodological challenge 检测，提升为 **结构化 challenge extraction + taxonomy + confidence / uncertain path**，供 narrative synthesis 与后续 analysis 消费。

---

## 1. 开工前必须读取

### 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-SEM-10`
   - `NEW-SEM-13`
   - Batch 14–19 lane 排期
   - `NEW-RT-07` / `NEW-DISC-01` closeout / `NEW-LOOP-01` / `NEW-SEM-06b` 的边界说明
4. `meta/docs/sota-monorepo-architecture-2026-03-06.md`
5. `.serena/memories/architecture-decisions.md`
6. `.serena/memories/codebase-gotchas.md`（若存在）

### 代码 / 测试（必须读）

#### `NEW-SEM-10`

- `packages/hep-mcp/src/tools/research/analyzePapers.ts`
- `packages/hep-mcp/src/tools/research/synthesis/grouping.ts`
- `packages/hep-mcp/src/tools/research/synthesis/tfidf.ts`
- `packages/hep-mcp/src/tools/research/synthesizeReview.ts`
- `packages/hep-mcp/src/tools/research/deepResearch.ts`
- `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
- `packages/shared/src/types/analysis-types.ts`
- `packages/hep-mcp/tests/research/analyzePapers.test.ts`
- `packages/hep-mcp/tests/research/synthesizeReview.test.ts`
- `packages/hep-mcp/tests/tools.test.ts`
- `packages/hep-mcp/tests/research/researchNavigator.test.ts`
- `packages/hep-mcp/tests/research/researchNavigatorAdvancedParity.test.ts`

#### `NEW-SEM-13`

- `packages/hep-mcp/src/tools/research/synthesis/narrative.ts`
- `packages/hep-mcp/src/tools/research/synthesis/grouping.ts`
- `packages/hep-mcp/src/tools/research/synthesis/markdown.ts`
- `packages/hep-mcp/src/tools/research/synthesizeReview.ts`
- `packages/hep-mcp/src/tools/research/criticalAnalysis.ts`
- `packages/hep-mcp/src/tools/research/deepAnalyze.ts`
- `packages/hep-mcp/tests/research/synthesizeReview.test.ts`
- `packages/hep-mcp/tests/research/analyzePapers.test.ts`
- `packages/hep-mcp/tests/tools.test.ts`

> **注意**: 当前 `NEW-SEM-10` / `NEW-SEM-13` 仍缺乏足够直接的专项 eval/tests。若验收所需 eval slice 不存在，必须**先创建、锁定 baseline，再实施，再验证**；禁止“没有测试就只看代码感觉正确”。创建新 eval 时，参考既有模式：`tests/eval/evalSem05UnifiedClassifier.test.ts` 与 `tests/eval/evalSem09SectionRoleClassifier.test.ts`（fixture 读取、baseline 对比、holdout gate 的写法）。

### GitNexus

开始前按 `AGENTS.md` 约定：

1. **先读取** `gitnexus://repo/autoresearch-lab/context`，检查 index freshness。
2. **若 context 显示 index stale，必须在实施前先运行** `npx gitnexus analyze`，然后重新读取 context；禁止带着 stale index 开工。
3. 读取 `.claude/skills/gitnexus/exploring/SKILL.md`。
4. 用 GitNexus 理解：
   - `analyzePapers`
   - `groupByMethodology` / `groupByImpact` / `groupForComparison`
   - `generateNarrativeSections` / `generateMethodologyChallenges`
   - 它们各自的调用方（`inspire_research_navigator(analyze)`, `synthesizeReview`, `deepResearch` 等）

实施完成后、正式 `review-swarm` 之前：

5. **再次检查是否需要刷新 GitNexus**：若本批新增/重命名了符号、改动了关键调用链、或 context 已不再反映当前工作树，必须再次运行 `npx gitnexus analyze`，确保 review/impact analysis 基于当前实现而不是旧索引。
6. 用 GitNexus 至少补做一轮 post-change evidence：优先使用 `detect_changes`、必要时配合 `impact` / `context`，把受影响 execution flows / callers / downstream surface 纳入 review-swarm 证据包。

**结论**：GitNexus 刷新优先发生在**实施之前**（这是硬要求）；若实现过程让索引相对工作树失真，则在**审核之前再刷新一次**。禁止未读即改，也禁止用 stale index 做最终审查。

---

## 2. tracker 开工要求

开始实现前先更新 `meta/remediation_tracker_v1.json`：

- `NEW-SEM-10` → `in_progress`
- `NEW-SEM-13` → `in_progress`
- `assignee` 填当前实际模型

若本批完成并验证通过：

- `NEW-SEM-10` / `NEW-SEM-13` → `done`
- note 必须写明：
  - 验收命令
  - 是否跑了实现代码双审
  - `NEW-RT-07` / `NEW-DISC-01` D4/D5 / `NEW-LOOP-01` / `NEW-SEM-06b` **未在本 prompt 中启动**
  - 锁定的 eval baseline / fixture artifact 路径
  - `NEW-SEM-10` 与 `synthesis/grouping.ts` / `analyzePapers.ts` 的共享锚点是什么

若任一项阻塞：标 `blocked`，写明原因，不得静默跳过。

---

## 3. 工作面 A — `NEW-SEM-10`（本批主 gate item）

### 3.1 目标

把 collection-level topic/method grouping 从 **top-keyword / fixed-threshold / ad hoc fallback terms** 提升为 **稳定、可重复、语义一致的 grouping backbone**：

- `analyzePapers.ts` 的 `topics` 结果不应继续只是 top keywords 拼盘
- `synthesis/grouping.ts` 中 methodology / comparison grouping 不应继续与 `analyzePapers.ts` 平行漂移
- 同一批论文在输入顺序变化、关键词稀疏、方法术语变化时，grouping 结果应保持稳定且可解释

### 3.2 必做要求

1. **去掉 top-keyword authority** 是硬要求：
   - 不能继续把 `extractTopics()` 的 top keywords 直接当 topic grouping SoT
   - 不能继续让 `grouping.ts` 与 `analyzePapers.ts` 分别维护不同 grouping authority
2. `NEW-SEM-10` **不应顺手引入 MCP sampling / provider SDK 路径**：
   - 此项依赖仅为 `NEW-RT-05`，**不是** `NEW-MCP-SAMPLING`
   - 若实现需要新的语义表示，优先使用本地 deterministic / lexical-semantic 路径
   - 若引入本地 embedding model / embedding 依赖，必须 `lazy-load` 且挂在 feature flag 之后；默认代码路径必须保持 embedding-free、deterministic，并不得改变默认 bundle / CI footprint
   - 不得在本批引入 provider 直连或 host-side routing 新需求
3. 必须显式处理：
   - 同义方法名 / terminology drift（如 formalism / framework / setup / pipeline / strategy 等）
   - 多方法 / 多主题论文（不能被硬塞进单一 keyword bucket）
   - 关键词稀疏或关键词缺失的论文（abstract / methodology / conclusions / categories 仍能参与 grouping）
   - 输入顺序打乱时的 grouping 稳定性 / repeatability
   - 需要 `uncertain` / `cross_cutting` / `mixed` 类路径时，必须显式设计，而不是偷偷降成 arbitrary bucket
4. 调用方迁移必须收敛：
   - `analyzePapers.ts` 的 `topics` 输出与 `synthesis/grouping.ts` 的 methodology/topic grouping 应共享同一语义 backbone，或至少共享同一 scoring / clustering core
   - **优先抽出共享核心模块**（例如 `src/tools/research/synthesis/topicMethodCore.ts`），由 `analyzePapers.ts` 与 `synthesis/grouping.ts` 共同 import，而不是让其中一个文件变成另一个的隐式 SoT
   - 共享核心至少应承载：paper-level method/topic signal extraction、collection-level grouping、以及共享 taxonomy/type 定义
   - 不要再让 collection analysis 与 synthesis grouping 平行演化两套 topic/method taxonomy
5. 输出兼容策略必须清楚：
   - 现有 `CollectionAnalysis` / `topics` surface 尽量保持兼容
   - 如需扩展字段（例如 `group_id`, `group_label`, `method_signals`, `confidence`, `uncertain_reason`），必须同步更新 shared schema，并补跑对应 package 的 test/build
6. 模块化纪律：
   - 不要把所有逻辑继续塞回 `analyzePapers.ts` / `grouping.ts`
   - 优先抽成小模块（例如 `src/tools/research/synthesis/groupingSemantic.ts` / `topicGrouping.ts` 等）
   - 单文件仍应尽量遵守 200 LOC 硬限制

### 3.3 完成定义

- [ ] `analyzePapers.ts` 与 `synthesis/grouping.ts` 不再各自维护漂移的 topic/method authority
- [ ] fixed corpus 的 permutation stability / repeatability 有测试或 eval fixture
- [ ] sparse-keyword / terminology-drift / cross-cutting papers 有 hard-case fixture
- [ ] 输出兼容或迁移边界明确（尤其是 shared `CollectionAnalysis` surface）
- [ ] grouping 逻辑可解释，不再只是 top keyword frequency 排序

### 3.4 Eval / 验收要求

必须新增并锁定最小可审计评测面（若当前不存在则创建）：

- `tests/eval/evalSem10TopicMethodGrouping.test.ts`
- `tests/eval/fixtures/sem10/sem10_topic_method_grouping_eval.json`
- `tests/eval/fixtures/sem10/sem10_topic_method_grouping_holdout.json`
- `tests/eval/baselines/sem10_topic_method_grouping.baseline.json`

fixture / baseline 结构必须与现有 SEM eval plane 对齐（参照 `sem05` / `sem09`）：开发集 `_eval.json` + 锁定集 `_holdout.json` + 单独 baseline JSON。

至少报告：

- topic/method grouping 的 pairwise precision / recall / F1（或等价 cluster quality 指标）
- permutation stability / repeatability 指标（同语料打乱输入顺序后结果一致性）
- sparse-keyword / terminology-drift hard subset 指标
- `uncertain` / `cross_cutting` / `mixed`（若存在）占比或 fallback-like rate

最小通过门槛至少包括：

- eval set 上的 grouping F1 ≥ locked baseline + 0.05
- 5 次随机乱序下的 permutation stability ≥ 0.85（可用 group-assignment Jaccard / 等价一致性指标）
- sparse-keyword / terminology-drift hard subset 指标 ≥ locked baseline + 0.05

> **强约束**: baseline 必须体现“当前 keyword-heavy / fixed-threshold grouping”的锁定表现；改进版必须对 locked baseline 报 improvement，而不是拿当前实现直接当 improved 结果。

---

## 4. 工作面 B — `NEW-SEM-13`

### 4.1 目标

把 `synthesis/narrative.ts` 中对 methodological challenge 的识别，从 **`includes()` 式关键词判断** 提升为 **结构化 challenge extraction + taxonomy + confidence / uncertain path**：

- 让 narrative synthesis 能引用更稳健的 challenge 信号
- 避免“看到 systematic/background/model-dependent 就拼一句话”的 brittle 逻辑
- 为后续审稿/综合分析保留结构化 challenge 锚点

### 4.2 必做要求

1. **结构化 challenge authority** 是硬要求：
   - 不得继续让 `generateMethodologyChallenges()` 以内联关键词列表作为唯一 authority
   - challenge taxonomy / confidence / uncertain/no-challenge 路径必须是显式结构，而不是 prose 拼接副产物
2. `NEW-SEM-13` **不应顺手引入 MCP sampling / provider SDK**：
   - 此项依赖仅为 `NEW-RT-05`
   - 若需要 richer signals，应优先复用本地已提取结构（methodology, conclusions, critical results, conflict summaries 等）
3. 必须显式处理：
   - methodological vs evidentiary vs theoretical concerns 的边界（至少要么区分，要么明确只抽取 methodological 并过滤其余）
   - taxonomy 必须覆盖显式 challenge 类型与显式负类：至少包括 `systematic_uncertainty`, `background_control`, `selection_bias`, `model_dependence`, `acceptance_or_coverage_limit`, `simulation_mismatch`, `fit_instability`, `extrapolation_risk`, `cross_cutting_methodology`, `no_challenge_detected`, `uncertain`
   - “没有 challenge” 的真实情况（禁止强行生成 challenge prose）
   - 多 challenge 论文 / 多论文聚合后的去重与归并
   - hard cases：systematic uncertainty、background control、selection bias、model dependence、limited coverage / acceptance、simulation mismatch、fit instability、extrapolation risk 等
   - implicit challenge 表述（不一定含 challenge taxonomy 原词）
4. narrative consumer 边界必须清楚：
   - `narrative.ts` 可以消费结构化 challenge 结果并生成 prose
   - 但 challenge 的 authority 不应继续散落在 `narrative.ts` + `synthesizeReview.ts` 多处
   - 如需抽新模块，优先小模块（例如 `synthesis/challengeExtraction.ts`）
5. 输出兼容必须清楚：
   - 现有 `NarrativeSections` / markdown 输出尽量保持兼容
   - 若新增结构化 challenge 字段，必须说明其如何映射回 narrative prose / markdown 展示
6. 不得顺手重写 narrative 的其它无关部分：
   - introduction / outlook / current state 的 prose 结构不在本批主范围
   - 不要把 Batch 14 做成 narrative subsystem 大翻修

### 4.3 完成定义

- [ ] challenge 提取不再以内联关键词列表为唯一 authority
- [ ] taxonomy + confidence / uncertain / no-challenge 路径明确
- [ ] hard-case challenge fixture 存在
- [ ] prose generation 与 structured challenge extraction 的边界清晰
- [ ] narrative 输出兼容或迁移说明明确

### 4.4 Eval / 验收要求

必须新增并锁定最小 challenge eval slice（若当前不存在则创建）：

- `tests/eval/evalSem13ChallengeExtractor.test.ts`
- `tests/eval/fixtures/sem13/sem13_challenge_extractor_eval.json`
- `tests/eval/fixtures/sem13/sem13_challenge_extractor_holdout.json`
- `tests/eval/baselines/sem13_challenge_extractor.baseline.json`

fixture / baseline 结构必须与现有 SEM eval plane 对齐：开发集 `_eval.json` + 锁定集 `_holdout.json` + baseline JSON。

至少报告：

- challenge recall / precision（或等价 audit-set 指标）
- taxonomy exact/subset match 指标
- no-challenge / uncertain 覆盖率
- false-positive / over-extraction rate

最小通过门槛至少包括：

- eval set 上 challenge recall ≥ locked baseline + 0.10
- no-challenge / uncertain 识别准确率 ≥ 0.85
- false-positive / over-extraction rate ≤ locked baseline

---

## 5. 推荐实施顺序

1. **先为 `NEW-SEM-10` 创建 eval fixtures + lock baseline**（当前 keyword-heavy / fixed-threshold grouping）
2. **再实现 `NEW-SEM-10`**
3. **为 `NEW-SEM-13` 创建 eval fixtures + lock baseline**（当前 `includes()`-based challenge extraction）
4. **再实现 `NEW-SEM-13`**
5. **最后做跨工作面的 targeted regressions + acceptance pass**

若上下文冲突，优先级为：

1. `NEW-SEM-10`
2. `NEW-SEM-13`

---

## 6. 总验收命令

```bash
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp build
pnpm -r build
```

- `test:eval` 是本批主 gate；若没有 `evalSem10*` / `evalSem13*` 对应 eval 测试与 fixture，则本批不得标记完成。
- 若 `pnpm --filter @autoresearch/hep-mcp test:eval` script 不存在，必须先按 `NEW-RT-05` / 现有 eval plane 模式补齐，再实施本批；禁止默认假设脚本已存在。
- `review-swarm` 是**必须执行**的正式收尾步骤；在 `Opus + OpenCode(kimi-for-coding/k2p5)` 双审完成并达到 `0 blocking` 收敛前，本批**不得**标记完成。
- 若 `NEW-SEM-10` 触及 shared `CollectionAnalysis` / schema / type surface，再补跑：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
```


---

## 7. Review-Swarm（必须执行，且必须做深）

本批实现完成并通过验收命令后，**必须**执行正式 `review-swarm`，继续使用：

- `Opus`
- `OpenCode(kimi-for-coding/k2p5)`

审核要求：

1. **禁止蜻蜓点水式审核**：review prompt 必须明确要求 reviewer 逐项检查实现代码、调用链、测试、eval fixtures、baseline 以及 lane boundary，而不是只根据 diff 摘要做表面判断。
2. **必须带证据给结论**：每个 blocking issue / amendment 都应绑定到具体文件、符号、测试或 eval 观察；禁止只给抽象评价。
3. **必须检查语义真实性**：重点判断实现是否只是把 keyword / threshold 逻辑换皮包装成 semantic layer。
4. **必须检查回归与可重复性**：重点检查固定 fixture、乱序输入、no-challenge / uncertain 路径、legacy 映射与 downstream 消费者是否稳定。
5. **必须检查 scope discipline**：明确确认本批没有顺手启动 `NEW-RT-07` / `NEW-DISC-01` closeout / `NEW-LOOP-01` / `NEW-SEM-06b`。

审核问题至少覆盖：

1. `NEW-SEM-10` 是否真正摆脱 top-keyword / fixed-threshold authority，并让 `analyzePapers.ts` 与 `synthesis/grouping.ts` 收敛到一个共享 grouping backbone
2. `NEW-SEM-10` 的 grouping 是否在固定语料 / 乱序输入下保持可重复、可解释，而不是换一种 keyword clustering 包装
3. `NEW-SEM-13` 是否真正形成结构化 challenge extractor（含 no-challenge / uncertain 路径），而不是给 `narrative.ts` 再塞一份更大的关键词表
4. 新增/更新的 tests、eval fixtures、baselines 是否足以锁住本批行为，而不是只验证 happy path
5. 本批是否保持 Batch 14–19 lane 顺序，没有顺手启动 `NEW-RT-07` / `NEW-DISC-01` closeout / `NEW-LOOP-01` / `NEW-SEM-06b`

审核收敛规则：

- 只有当 `Opus` 与 `OpenCode(kimi-for-coding/k2p5)` 都达到 `CONVERGED` 或 `CONVERGED_WITH_AMENDMENTS`，且 **`blocking_issues = 0`** 时，才可视为审核收敛。
- 若任一 reviewer 给出 blocking issue，必须修正后重新跑下一轮 `review-swarm`，直到收敛。
- 低风险 amendments 应优先集成；若选择 deferred，必须在交付说明中逐条记录原因。

---

## 8. 收敛后交付与版本控制

1. 更新 `meta/remediation_tracker_v1.json`
2. 更新 `.serena/memories/architecture-decisions.md`
3. 若进度摘要有变化，更新 `AGENTS.md`
4. 记录：
   - 采用了哪些 review amendments
   - 哪些 deferred，以及原因
   - `NEW-SEM-10` 的共享 grouping 锚点是什么
   - `NEW-SEM-13` 的 structured challenge taxonomy / output anchor 是什么
5. **仅在 review-swarm 已收敛（双审 `0 blocking`）且上述同步完成后，才允许执行 `git commit` 与 `git push`。**
6. `git commit` message 应显式标注 Batch / remediation item（如 `Phase 3 Batch 14: NEW-SEM-10 + NEW-SEM-13`）；`git push` 前需再次确认工作树仅包含本批应交付内容。

---

## 9. 不要做的事

- 不要把 `NEW-SEM-10` 做成“top keywords + 多几个词表/阈值”的换皮版本
- 不要让 `analyzePapers.ts` 与 `synthesis/grouping.ts` 分别继续演化 topic/method logic
- 不要把 `NEW-SEM-13` 简化成 narrative.ts 中更长的 `includes()` 列表
- 不要顺手重写 `synthesizeReview.ts` / `deepResearch.ts` 的无关 narrative 流程
- 不要把 `NEW-RT-07`、`NEW-DISC-01` D4/D5、`NEW-LOOP-01`、`NEW-SEM-06b` 拉进本批
- 不要破坏 Batch 14–19 的 lane 语义与依赖顺序
