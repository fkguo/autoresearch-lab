# Phase 3 Implementation Prompt — NEW-SEM-06d: Triggered Query Reformulation + QPP

> **推荐窗口**: Phase 3 Batch 18
> **为什么是下一批**: `NEW-SEM-06b` 已经把 canonical-paper substrate 上的 hybrid candidate generation + strong reranker 落地，并锁住了 baseline / holdout / failure-path；现在应该在**强 backbone**之上叠加 triggered reformulation / query performance prediction，而不是先跳到更重的 `NEW-SEM-06e` 结构化 evidence localization。
> **为什么不是先做 `NEW-SEM-06e`**: `NEW-SEM-06e` 是更重的 locator pipeline（page / chunk / table / figure / equation / citation-context）升级，依赖更大、对 `agent-arxiv` 的 search-heavy retrieval 扩展更近；在 `06b` 刚收口后，先完成 `06d` 的 hard-case trigger policy / QPP / cost telemetry，能更低风险地验证 retrieval planner 层的收益边界。

---

## 1. 开工前必须读取（硬要求）

至少读取并对齐以下材料：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` 中 `NEW-SEM-06d` / `NEW-SEM-06e` / retrieval lane 依赖与窗口说明
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/sota-monorepo-architecture-2026-03-06.md` 中 retrieval backbone / Stage 0 query understanding / `SEM-06d` 相关段落
6. `meta/docs/prompts/prompt-phase3-impl-new-sem06b.md`
7. `packages/shared/src/discovery/` 与 `packages/hep-mcp/src/tools/research/discovery/` 当前 `NEW-SEM-06b` authority / eval / fixture / holdout 面
8. `.serena/memories/architecture-decisions.md`

### SOTA preflight（必须先做）

在真正改代码前，先产出新的 `SEM-06d` SOTA preflight，放在：

- `.tmp/new-sem06d-sota-preflight.md`

要求：

- 不是只读摘要；必须明确记录做过**全文深读**的论文/benchmark/best-practice 来源
- 必须把结论映射到 `NEW-SEM-06d` 的具体设计约束（触发条件、QPP 输出、成本预算、fail-closed 行为、eval 指标）
- 明确说明哪些能力是 `06d` 范围内做，哪些要留给 `06e`

---

## 2. GitNexus 生命周期（硬要求）

### 2.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 用 GitNexus 明确当前 retrieval / discovery planner / reranker / eval harness 的关键符号、调用链、下游 surface
4. 禁止在 stale index 上直接开始实现

### 2.2 审核前

若新增/重命名符号、改变关键调用链、或当前 index 不再反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 用 `detect_changes`
3. 必要时补 `impact` / `context`
4. 将 post-change 证据纳入 review packet

---

## 3. 任务目标（必须同时满足）

### 3.1 Planner / policy 目标

在 `NEW-SEM-06b` 的 canonical-paper retrieval backbone 之上，实现 **triggered query reformulation + query performance prediction (QPP)**：

1. 先估计 query 的 difficulty / ambiguity / low-recall risk
2. 仅在 hard / low-recall / high-ambiguity 场景触发 reformulation
3. exact-ID / structured-identifier known-item query 默认**不得**触发 reformulation
4. reformulation 必须是显式、可测、可审计的 stage，而不是隐式多查一轮
5. reformulation 失败、QPP unavailable、预算不足时必须 fail-closed，保留 `SEM-06b` 原始路径，而不是静默改变行为

### 3.2 Integration 目标

1. 继续沿用 **library-first / broker-first**，不创建新的 discovery MCP server
2. 复用 `NEW-DISC-01` / `NEW-SEM-06b` 已有 canonical paper / query-plan / candidate_generation / rerank artifacts，而不是绕开现有 authority 再造 planner
3. reformulation / QPP 的决策必须进入审计 surface（artifact / trace / telemetry）
4. 保持与现有 eval plane 对齐，不创建孤立测试 harness

### 3.3 Eval 目标

`NEW-SEM-06d` 不是“多查一轮可能更好”的宽松功能，而是**有触发纪律的优化层**。至少要证明：

1. hard subset 指标优于 `NEW-SEM-06b`
2. easy subset / exact-ID subset 不因误触发而回退
3. 额外成本（sampling / provider calls / latency proxy）被显式观测并受控
4. reformulation trigger precision 不是随意放大到“几乎全触发”

---

## 4. 明确不做（硬 scope boundary）

以下内容必须显式不做：

- `NEW-SEM-06e` 的 structure-aware evidence localization（page / chunk / table / figure / equation / citation-context）
- late-interaction / multi-vector retrieval substrate 迁移
- 新 discovery MCP server
- provider runtime / queue / session substrate 改造（`NEW-LOOP-01` / `EVO-13`）
- 把 `06d` 做成 unconditional multi-query expansion
- 借机修一批与本项无关的旧 eval / metric debt

---

## 5. Eval-first / test-first（硬顺序）

### 5.1 实现前先锁的资产

在写实现前，先补齐或锁定：

1. triggered reformulation fixtures
2. QPP / ambiguity / low-recall-risk fixtures
3. no-trigger regression fixtures（exact-ID / easy query）
4. failure-path fixtures：
   - QPP unavailable
   - reformulation sampling unavailable
   - reformulation returns invalid / abstain
   - trigger budget exhausted
5. baseline / holdout / hard-subset eval

### 5.2 至少覆盖的 eval 维度

1. **No-trigger correctness**
   - DOI / arXiv / exact known-item query 默认不触发 reformulation
2. **Hard-query uplift**
   - 模糊标题 / 缩写 / author-year under-specified query 在 hard subset 上获得 measurable uplift
3. **Trigger discipline**
   - 不是所有 query 都触发；easy subset 触发率应受控
4. **Cost telemetry**
   - 至少观测 reformulation 调用次数、额外 sampling 次数或等价成本 proxy
5. **Fail-closed behavior**
   - reformulation/QPP 不可用时显式回退到 `SEM-06b` 原路径并写出可审计状态

### 5.3 推荐指标

在不破坏现有 eval plane 的前提下，至少覆盖一组与现有 harness 相容的指标：

- hard subset: `MRR@k` / `nDCG@k` / `recall@k`
- easy subset: no-regression guard
- trigger policy: trigger rate / useful-trigger rate / false-trigger guard
- cost: average reformulation count or equivalent telemetry metric

---

## 6. 实现建议（建议，不是强制文件清单）

优先检查并按现有 authority 放置逻辑：

### 6.1 shared authority

检查 `packages/shared/src/discovery/` 是否适合承载：

- reformulation / trigger / QPP artifact contract
- reformulation status enum
- cost / telemetry summary contract（若需要 shared type）

### 6.2 hep-mcp discovery surface

优先检查：

- `packages/hep-mcp/src/tools/research/discovery/`
- `packages/hep-mcp/src/tools/research/federatedDiscovery.ts`
- `packages/hep-mcp/src/core/evidenceRetrievalSubstrate.ts`

建议拆分为清晰职责，而不是塞进单一大文件：

- query difficulty / ambiguity estimation
- reformulation prompt / parser
- reformulation runner / fail-closed wrapper
- trigger policy / budget gate
- artifact / telemetry write path

### 6.3 eval / test surface

优先扩展：

- `packages/hep-mcp/tests/research/`
- `packages/hep-mcp/tests/eval/`
- `packages/hep-mcp/tests/eval/fixtures/`
- `packages/hep-mcp/tests/eval/baselines/`

禁止：

- 新建 `utils.ts` / `helpers.ts` 万能文件
- 把 planner、trigger、sampling、artifact、eval glue 混到一个 >200 LOC 文件
- 用 feature flag / `v2` / `new_` / `legacy_` 命名规避设计收敛

---

## 7. 验收命令（完成前必须全部通过）

至少运行：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/openalex-mcp test
pnpm --filter @autoresearch/openalex-mcp build
pnpm --filter @autoresearch/arxiv-mcp test
pnpm --filter @autoresearch/arxiv-mcp build
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp build
pnpm lint
pnpm -r test
pnpm -r build
```

另外补一条专项 holdout / hard-subset 命令（文件名可按实现实际调整），例如：

```bash
EVAL_INCLUDE_HOLDOUT=1 pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalSem06dTriggeredReformulation.test.ts
```

---

## 8. review-swarm / self-review（硬门禁）

实现完成且 acceptance 通过后，必须执行正式 `review-swarm`：

- reviewer 固定为：`Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)`
- 若其中任一模型本地不可用，必须记录失败原因，并由人类明确确认 fallback reviewer；禁止静默降级
- 若任一 reviewer 有 blocking issue，必须修正并进入下一轮，直到三审 0 blocking
- review 必须显式检查：
  - scope discipline（是否越界到 `NEW-SEM-06e`）
  - reformulation trigger 是否真的只在 hard / ambiguous / low-recall 风险场景触发
  - QPP / trigger / reformulation 是否有可审计证据而不是隐式魔法
  - hard-subset uplift 与 easy-subset no-regression 是否真实成立
  - 成本 telemetry 是否真实可见
  - GitNexus post-change evidence 是否充分

外部三审收敛后，当前执行 agent 仍必须做正式 self-review，并记录：

- blocking / non-blocking findings
- adopted / deferred / declined/closed dispositions
- tests / eval / holdout / baseline / GitNexus 证据摘要

建议路径：

- SOTA preflight：`.tmp/new-sem06d-sota-preflight.md`
- self-review：`.tmp/review-swarm/new-sem06d-self-review-r1.md`

---

## 9. 收尾同步

完成前必须同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. `.serena/memories/architecture-decisions.md`
4. 必要时 `meta/REDESIGN_PLAN.md`

只有在以下条件全部满足后，`NEW-SEM-06d` 才可标记为 `done`：

- acceptance commands 全绿
- `review-swarm` 三审收敛且 `blocking_issues = 0`
- `self-review` 通过
- tracker / memory / AGENTS 已同步
- 高价值 non-blocking amendments 已按规则处理：要么本轮吸收，要么合法 deferred 并进入持久 SSOT，要么明确标记为 declined/closed

---

## 10. 条件化下一步建议（供执行 agent 收尾时引用）

若 `NEW-SEM-06d` 完成且 hard-subset uplift / cost telemetry / no-regression 都成立，则下一批优先建议：

- `NEW-SEM-06e`

理由：

- retrieval planner 层已稳定，下一步才应该升级到结构化 evidence localization
- `NEW-SEM-06e` 是 search-heavy `agent-arxiv` retrieval 能力的更直接前置

若 `NEW-SEM-06d` 未能证明受控收益，则不得直接硬推 `NEW-SEM-06e`，应先修正 `06d` 的 trigger policy / telemetry / eval credibility。
