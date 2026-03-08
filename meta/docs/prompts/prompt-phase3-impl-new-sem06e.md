# Phase 3 Implementation Prompt — NEW-SEM-06e: Structure-Aware Evidence Localization

> **推荐窗口**: Phase 3 Batch 19
> **为什么是下一批**: `NEW-SEM-06b` 已把 canonical-paper substrate 上的 hybrid candidate generation + strong reranker 锁稳，`NEW-SEM-06d` 进一步把 triggered reformulation / QPP / cost telemetry 收口；现在才适合把重点从“找到哪篇 paper”升级到“在长文档里精确定位哪一页 / 哪一段 / 哪个 table / 哪个 figure / 哪个 equation / 哪段 citation-context”。
> **为什么不是先做 search-heavy `agent-arxiv` 功能**: `NEW-SEM-06e` 就是这类能力的前置门。若 page / chunk / table / figure / equation / citation-context 级 evidence localization 还不稳定，直接上 search-heavy `agent-arxiv` 只会把 document-level 检索噪声放大到下游研究 loop。
> **为什么不是先做 late-interaction / 新 discovery server**: 这批的目标不是再次重做 retrieval substrate，而是在既有 `NEW-DISC-01` + `NEW-SEM-06b/d` backbone 上完成**within-document localization**。任何新的 discovery server、multi-vector substrate、或 runtime 产品化扩展都属于越界。

---

## 1. 开工前必须读取（硬要求）

至少读取并对齐以下材料：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` 中 `NEW-SEM-06b` / `NEW-SEM-06d` / `NEW-SEM-06e` / retrieval lane / Batch 19 说明
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/sota-monorepo-architecture-2026-03-06.md` 中 retrieval backbone / Batch 17–19 / structure-aware localization 段落
6. `meta/docs/prompts/prompt-phase3-impl-new-sem06d.md`
7. `packages/shared/src/discovery/` 当前 shared authority（canonical paper / query-plan / reformulation / rerank / search-log）
8. `packages/hep-mcp/src/core/pdf/evidence.ts`
9. `packages/hep-mcp/src/tools/research/latex/locator.ts` 及相邻 extractor（`citationExtractor.ts`, `equationExtractor.ts`, `figureExtractor.ts`, `tableExtractor.ts`, `sectionExtractor.ts`）
10. `packages/hep-mcp/src/core/evidence.ts`, `packages/hep-mcp/src/core/evidenceSemantic.ts`, `packages/hep-mcp/src/tools/research/federatedDiscovery.ts`
11. `packages/hep-mcp/tests/eval/evalSem06EvidenceRetrieval.test.ts`
12. `packages/hep-mcp/tests/eval/evalSem06dTriggeredReformulation.test.ts`
13. `packages/hep-mcp/tests/research/latex/locator.test.ts`
14. `.serena/memories/architecture-decisions.md`

### SOTA preflight（必须先做）

在真正改代码前，先产出新的 `SEM-06e` SOTA preflight，并采用 **archive-first**：

- canonical archive：`~/.autoresearch-lab-dev/sota-preflight/<YYYY-MM-DD>/new-sem06e/preflight.md`
- 当前 `worktree` 副本 / 指针：`.tmp/new-sem06e-sota-preflight.md`
- 同目录建议再附：`summary.md`、`manifest.json`

要求：

- 不是只读摘要；必须明确记录做过**全文深读**的论文 / benchmark / best-practice 来源
- 必须把结论映射到 `NEW-SEM-06e` 的具体设计约束（retrieval unit、typed locator contract、structure-availability policy、eval 指标、fail-closed 行为）
- 必须明确区分：哪些能力是本批要落地的 structure-aware localization，哪些仍留给后续 `agent-arxiv` / 更重 retrieval substrate 工作
- 必须显式回答：何时应优先 page / chunk，何时应提升到 table / figure / equation / citation-context，何时必须 abstain
- `manifest.json` 至少记录：prompt 路径、批次 / item、关键来源、archive 时间、以及已提炼到哪些 checked-in SSOT
- `~/.autoresearch-lab-dev` 下的 archive 不是治理 SSOT；真正影响后续实现约束的稳定结论仍必须同步到 `.serena/memories/architecture-decisions.md` 或其他 checked-in 文档

---

## 2. GitNexus 生命周期（硬要求）

### 2.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 用 GitNexus 明确当前 discovery → canonical paper → rerank → evidence retrieval → pdf/latex locator 的关键符号、调用链、下游 surface
4. 禁止在 stale index 上直接开始实现

### 2.2 审核前

若新增/重命名符号、改变关键调用链、或当前 index 不再反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 用 `detect_changes`
3. 必要时补 `impact` / `context`
4. 将 post-change 证据纳入 review packet，证明没有越界重做 discovery / runtime substrate

---

## 3. 任务目标（必须同时满足）

### 3.1 Structure-aware localization 目标

在 `NEW-SEM-06b` + `NEW-SEM-06d` 的 retrieval backbone 之上，实现 **structure-aware evidence localization**，使 within-document retrieval unit 从粗粒度 document / chunk 提升为显式、可审计的：

1. `page`
2. `chunk`
3. `table`
4. `figure`
5. `equation`
6. `citation-context`

要求：

- 命中结果必须带 typed locator / status / provenance，而不是只给一段文本预览
- locator 需要能区分“命中了 paper，但没有足够结构证据定位到 table/figure/equation/citation-context”与“真的命中了对应结构单元”
- citation-context 不是简单 citekey 命中；必须定位到**引用上下文片段**而不是只返回 bibliography entry
- equation / figure / table 命中必须能回指已有 PDF / LaTeX structure surface，而不是造一个脱离现有 parse 产物的新坐标体系

### 3.2 Integration / audit 目标

1. 继续坚持 **library-first / broker-first**，不创建新的 discovery MCP server
2. 复用已有 canonical paper / search-log / query-plan / reformulation / rerank artifact surface；`06e` 是新增 localization 层，不是替换前面几层
3. 优先复用现有 `pdf_page` / `pdf_region` 与 LaTeX locator / extractor surface；如需扩展，必须 typed、可审计、可回放
4. structure-aware decision / fallback / abstain 必须进入 artifact / trace / telemetry，而不是静默藏在函数内部
5. 不得因 `06e` 而让 `06b/06d` 的 document-level discovery 行为回退

### 3.3 Failure behavior 目标

`NEW-SEM-06e` 不是“尽量猜一猜 table/figure/equation 在哪里”的宽松功能，而是**结构证据优先**的定位层。至少要做到：

1. 缺少结构解析产物时显式 `unavailable` / `abstain`，不得伪造 structure hit
2. PDF 侧只有 page / region 粗信息时，不得冒充 equation / citation-context 精准命中
3. LaTeX locator 缺少 label/ref / AST 证据时，不得静默把普通 chunk 命中包装成 equation hit
4. citation-context 无法可靠定位时，应保留 page/chunk 命中并写出原因，而不是输出看似精确的假定位

### 3.4 Eval 目标

至少证明以下几点：

1. 长文档 page / chunk / table / figure / equation / citation-context 的召回或命中率相对现有 document-level baseline 可测提升
2. known-item / exact-ID / easy retrieval query 不因多一层 localization 而出现明显回退
3. structure-aware 命中与 unavailable / abstain 的边界是可解释、可审计的，不是把 recall 建立在乱猜上
4. 额外成本（parse / locator / region scan / extra passes）被显式观测并受控

---

## 4. 明确不做（硬 scope boundary）

以下内容必须显式不做：

- 新 discovery MCP server
- late-interaction / multi-vector retrieval substrate 迁移
- `agent-arxiv` runtime / product feature rollout
- 借 `06e` 重写 `06b` candidate generation / reranker backbone
- 无关的 `NEW-LOOP-01` / `EVO-13` runtime 结构改造
- 重新发明一套独立 PDF parser / OCR / docling pipeline（优先复用现有 evidence / parse surface）
- 借机修改 `06d` trigger policy，除非是 `06e` 集成所必需且有明确证据
- 借机清理大批与本项无关的历史 eval / metric debt

---

## 5. Eval-first / test-first（硬顺序）

### 5.1 实现前先锁的资产

在写实现前，先补齐或锁定：

1. page / chunk localization fixtures
2. table / figure / equation localization fixtures
3. citation-context fixtures（必须区分正文引用上下文与 bibliography entry）
4. cross-surface consistency fixtures（LaTeX locator 与 PDF region/page 一致或显式不一致）
5. failure-path fixtures：
   - structure data unavailable
   - pdf region only / no latex locator
   - latex locator only / no pdf region
   - ambiguous multi-hit requiring abstain
   - invalid structure payload
6. baseline / holdout / long-document subset eval

### 5.2 至少覆盖的 eval 维度

1. **Page / chunk retrieval**
   - 长文档 page / chunk recall@k 或 hit-rate 提升明确可测
2. **Structured unit hit rate**
   - table / figure / equation 的 locator accuracy 或 hit-rate 明确可测
3. **Citation-context accuracy**
   - 命中的是正文引用上下文，而不是 bibliography / unrelated mention
4. **No-regression guard**
   - canonical paper discovery / exact-ID / easy subset 不回退
5. **Failure-path guard**
   - structure unavailable / invalid / ambiguous 时显式 unavailable / abstain，而不是伪精确命中
6. **Cost telemetry**
   - 至少观测额外 parse / locator / region scan / fallback 次数或等价成本 proxy

### 5.3 推荐指标

在不破坏现有 eval plane 的前提下，至少覆盖一组与现有 harness 相容的指标：

- page / chunk: `MRR@k` / `nDCG@k` / `recall@k`
- table / figure / equation: hit-rate / top-k locator accuracy
- citation-context: context localization accuracy / hit-rate
- unavailable / abstain: precision guard / false-precision guard
- cost: average localization passes / average structure scans / latency proxy

---

## 6. 实现建议（建议，不是强制文件清单）

### 6.1 shared authority

优先检查 `packages/shared/src/discovery/` 是否适合承载：

- structure-aware localization artifact contract
- typed locator status / availability / abstain enum
- shared telemetry summary contract（若需要跨 provider / broker surface 复用）

前提：

- 只有在确实是 shared contract 时才放 shared；不要为了“看起来统一”把纯 hep-mcp 内部逻辑强行抬升为 shared package
- 不要引入临时命名（`v2`, `new_`, `legacy_`）规避收敛

### 6.2 hep-mcp authority surface

优先检查并尽量复用：

- `packages/hep-mcp/src/core/pdf/evidence.ts`
- `packages/hep-mcp/src/core/evidence.ts`
- `packages/hep-mcp/src/core/evidenceSemantic.ts`
- `packages/hep-mcp/src/tools/research/latex/locator.ts`
- `packages/hep-mcp/src/tools/research/latex/citationExtractor.ts`
- `packages/hep-mcp/src/tools/research/latex/equationExtractor.ts`
- `packages/hep-mcp/src/tools/research/latex/figureExtractor.ts`
- `packages/hep-mcp/src/tools/research/latex/tableExtractor.ts`
- `packages/hep-mcp/src/tools/research/federatedDiscovery.ts`

建议按职责拆分，而不是塞进单一大文件：

- localization contract / status
- pdf-side region normalization / typing
- latex-side locator / context extraction
- cross-surface reconciliation
- artifact / telemetry write path
- eval helpers

### 6.3 eval / test surface

优先扩展：

- `packages/hep-mcp/tests/eval/`
- `packages/hep-mcp/tests/eval/fixtures/`
- `packages/hep-mcp/tests/eval/baselines/`
- `packages/hep-mcp/tests/research/latex/locator.test.ts`

建议新增专项 eval 文件（文件名可按实现实际调整），例如：

- `packages/hep-mcp/tests/eval/evalSem06eStructureAwareLocalization.test.ts`

禁止：

- 新建 `utils.ts` / `helpers.ts` 万能文件
- 把 PDF evidence、LaTeX locator、cross-surface reconcile、artifact glue、eval glue 混到一个 >200 LOC 业务文件
- 新建平行但无人消费的孤立 eval harness

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
pnpm --filter @autoresearch/hep-mcp test -- tests/research/latex/locator.test.ts
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp build
pnpm lint
pnpm -r test
pnpm -r build
```

另外补一条专项 holdout / long-document 命令（文件名可按实现实际调整），例如：

```bash
EVAL_INCLUDE_HOLDOUT=1 pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalSem06eStructureAwareLocalization.test.ts
```

---

## 8. review-swarm / self-review（硬门禁）

实现完成且 acceptance 通过后，必须执行正式 `review-swarm`：

- reviewer 固定为：`Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)`
- 若其中任一模型本地不可用，必须记录失败原因，并由人类明确确认 fallback reviewer；禁止静默降级
- 若任一 reviewer 有 blocking issue，必须修正并进入下一轮，直到三审 0 blocking
- review 必须显式检查：
  - scope discipline（是否越界到新 discovery server / late-interaction / `agent-arxiv` rollout）
  - structure-aware hit 是否真的有证据，不是把 page/chunk 伪装成 table/figure/equation/citation-context
  - unavailable / abstain 边界是否清晰、可审计
  - page/chunk uplift 与 structured-unit hit-rate 是否真实成立
  - no-regression on canonical discovery / exact-ID / easy subset 是否真实成立
  - 成本 telemetry 与 GitNexus post-change evidence 是否充分

外部三审收敛后，当前执行 agent 仍必须做正式 self-review，并记录：

- blocking / non-blocking findings
- adopted / deferred / declined/closed dispositions
- tests / eval / holdout / baseline / GitNexus 证据摘要

建议路径：

- SOTA preflight：`.tmp/new-sem06e-sota-preflight.md`
- self-review：`.tmp/review-swarm/new-sem06e-self-review-r1.md`

---

## 9. 收尾同步

完成前必须同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. `.serena/memories/architecture-decisions.md`
4. `~/.autoresearch-lab-dev/sota-preflight/<YYYY-MM-DD>/new-sem06e/` canonical archive（若本批做了 SOTA preflight）
5. 必要时 `meta/REDESIGN_PLAN.md`

只有在以下条件全部满足后，`NEW-SEM-06e` 才可标记为 `done`：

- acceptance commands 全绿
- `review-swarm` 三审收敛且 `blocking_issues = 0`
- `self-review` 通过
- tracker / memory / AGENTS 已同步
- 高价值 non-blocking amendments 已按规则处理：要么本轮吸收，要么合法 deferred 并进入持久 SSOT，要么明确标记为 declined/closed

---

## 10. 条件化下一步建议（供执行 agent 收尾时引用）

若 `NEW-SEM-06e` 完成且 structure-aware localization 的 hit-rate / abstain discipline / no-regression / cost telemetry 都成立，则下一步才允许认真推进：

- search-heavy `agent-arxiv` retrieval-dependent features

理由：

- retrieval stack 此时才真正具备从 canonical paper → structure-aware evidence unit 的稳定落点
- `agent-arxiv` 的后续 search-heavy 能力不应建立在 document-level 命中却无法稳定定位证据单元的 substrate 上

若 `NEW-SEM-06e` 未能证明 structure-aware 命中质量与 fail-closed discipline，则不得直接推进 search-heavy `agent-arxiv`；应先留在 retrieval lane 内修正 localization contract / eval credibility / abstain policy。
