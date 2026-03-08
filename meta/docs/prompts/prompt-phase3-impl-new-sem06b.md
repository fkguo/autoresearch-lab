# Phase 3 Implementation Standalone: `NEW-SEM-06b` Hybrid Candidate Generation + Strong Reranker

> **状态**: `NEW-DISC-01` 已完成 closeout，shared canonical paper / query-plan / dedup / search-log authority 与 broker eval baseline 已落地；当前 retrieval/discovery lane 的下一批次是 `NEW-SEM-06b`。执行前仍需自行确认工作树与远端状态。
> **本 prompt 定位**: 这是一个 **Phase 3 standalone implementation prompt**，只用于完成 `NEW-SEM-06b`：在 canonicalized discovery substrate 上实现 hybrid candidate generation + strong reranker，并接入现有 eval plane。不要把它与 `NEW-SEM-06d`、`NEW-SEM-06e`、`NEW-RT-06/07`、`NEW-LOOP-01`、`EVO-13` 混做。
> **SOTA 对齐说明**: `NEW-SEM-06b` 涉及 scholarly hybrid retrieval、candidate generation、reranking、known-item retrieval、cross-provider canonicalized corpora，这些判断具有明显时效性。**任何关于 backbone 选型、reranker 策略、negative sampling、fusion/routing、eval 指标、是否仍需 provider-local fallback 的判断，都必须先基于 2025–2026 最新 official docs / primary papers / benchmark evidence，而不是仅凭记忆或沿用 `SEM-06a` / kickoff 时的静态假设。**
> **作用域澄清**: 本 prompt **只覆盖 `NEW-SEM-06b`**。不得顺手启动 `NEW-SEM-06d`（triggered reformulation / QPP）、`NEW-SEM-06e`（structure-aware evidence localization）、`NEW-RT-06`、`NEW-RT-07`、`NEW-LOOP-01`、`EVO-13`，也不得重做 `NEW-DISC-01` 已完成的 canonicalization / dedup / search-log substrate。
> **通用硬门禁继承**: 本 prompt 默认继承 `AGENTS.md` 与 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若下述条目与 checklist 同时覆盖同一主题，以更严格者为准。

---

## 0. 执行定位

这是一个 **单工作面、retrieval backbone closeout** prompt：

### `NEW-SEM-06b` — `Hybrid Candidate Generation + Strong Reranker`

目标是在 **不重开 `NEW-DISC-01`、不越界到 `NEW-SEM-06d/e`** 的前提下，把 retrieval backbone 从 `SEM-06a` baseline 推进到真正可用的 hybrid stack：

- 在 `NEW-DISC-01` 已提供的 **canonical paper / provider capability / dedup / search-log** substrate 上建立 hybrid candidate generation；
- 把 strong reranker 明确接到 canonicalized document space，而不是重新 hard-fork provider-local identity；
- 与现有 `NEW-RT-05` / `NEW-DISC-01` eval plane 对齐，至少覆盖 known-item retrieval、hard-query recall、precision / ranking quality、failure-path regression；
- 先锁 fixtures / baselines / holdout / regression，再实现；
- 所有 retrieval 决策、fallback、以及 inability-to-rank 路径必须 evidence-first、可审计、可测试、可重放；
- 为 `NEW-SEM-06d` / `NEW-SEM-06e` 留出明确接口，但**本批不实现它们**。

> **边界重申**:
> - `NEW-SEM-06-INFRA` 已完成：只冻结了 substrate decision / eval protocol / baseline lock，**并未实现 `NEW-SEM-06b`**。
> - `NEW-DISC-01` 已完成：canonical identity / provider capability / dedup / search-log / broker eval substrate 已就绪，不要重做。
> - 本批 **不** 做 query reformulation / QPP（`NEW-SEM-06d`）与 structure-aware evidence localization（`NEW-SEM-06e`）。
> - 本批 **不** 创建新的 discovery MCP server，也不新建平行 eval plane。

---

## 1. 开工前必须读取

### 1.1 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-SEM-06-INFRA`
   - `NEW-DISC-01`
   - `NEW-SEM-06b`
   - `NEW-SEM-06d` / `NEW-SEM-06e` 的边界说明
   - `NEW-RT-05` eval plane 相关说明
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `meta/docs/prompts/prompt-phase3-impl-batch12.md`
   - 尤其是 `NEW-SEM-06-INFRA` 的 substrate decision / eval protocol / baseline lock 约束
7. `meta/docs/prompts/prompt-phase3-impl-new-disc01-closeout.md`
   - 尤其是 D4 / D5 closeout 形成的 canonical substrate / eval harness / scope boundary
8. `meta/docs/sota-monorepo-architecture-2026-03-06.md`

### 1.2 必做 SOTA preflight（先于设计判断）

在开始实现前，必须联网完成一轮 **hybrid retrieval / reranking / scholarly search SOTA evidence collection**。至少包含：

1. **官方 provider / platform 文档（primary / official）**
   - OpenAlex 官方文档：works search / filter / cursor / known-item / fulltext / citation surfaces
   - arXiv 官方 API / source access 文档
   - INSPIRE 官方检索 / identifier / citation / reference surfaces（若本轮 candidate generation 或 known-item retrieval 触及其语义）
2. **近 12–18 个月 primary literature / benchmark evidence（至少 2 份）**
   - hybrid retrieval / strong reranking / scholarly search benchmark
   - learned reranker / cross-encoder / late-interaction / query-aware ranking 在 paper retrieval 或 closely related benchmark 上的结果
   - 若涉及 fusion / routing / hard-query policy，需有对应 benchmark 或 primary paper 依据
3. **实现约束提炼**
   - 哪些结论直接影响 `NEW-SEM-06b` backbone 设计？
   - 哪些看似高价值但其实属于 `NEW-SEM-06d/e`，本批必须显式拒绝？
   - 当前 provider capability schema / canonical artifact 是否已足够支撑 reranker，或尚缺必须补齐的事实字段？

**硬要求**:
- 不得用博客营销文、二手总结代替 primary / official source。
- 不得把“最新模型似乎能做”当成实现依据；必须落到与本项直接相关的 design implication。
- 必须把 SOTA 调研结论写成简短审计记录（建议 `.tmp/new-sem06b-sota-preflight.md`），供后续 review / self-review 引用。

### 1.3 代码 / 测试（必须读）

#### Shared / discovery substrate

- `packages/shared/src/discovery/`
- `packages/shared/src/types/paper.ts`
- `packages/shared/src/types/identifiers.ts`

#### Existing retrieval / eval authority

- `packages/hep-mcp/src/core/evidence.ts`
- `packages/hep-mcp/src/core/evidenceSemantic.ts`
- `packages/hep-mcp/src/tools/research/federatedDiscovery.ts`
- `packages/hep-mcp/src/tools/utils/discoveryHints.ts`
- `packages/hep-mcp/tests/eval/evalDisc01BrokerCloseout.test.ts`
- `packages/hep-mcp/tests/eval/fixtures/disc01_broker_eval.json`
- `packages/hep-mcp/tests/eval/fixtures/disc01_broker_eval_holdout.json`
- `packages/hep-mcp/tests/eval/baselines/disc01_broker.baseline.json`

#### Related prompt / acceptance precedent

- `meta/docs/prompts/prompt-phase3-impl-new-rt07.md`
- `meta/docs/prompts/prompt-phase3-impl-new-disc01-closeout.md`

---

## 2. GitNexus 硬门禁

1. 开工前先读取 `gitnexus://repo/{name}/context`（或等价 repo context）。
2. 若 index stale，先运行 `npx gitnexus analyze`，再继续。
3. 若实现过程中新增/重命名关键符号、改变调用链、或当前 index 已不反映工作树，正式审核前必须再次刷新。
4. 完成后必须至少提供：
   - `detect_changes(scope=unstaged|all)`
   - `impact(...)` 对 backbone authority / reranker entrypoint 的 blast-radius 证据
   - `context(...)` 对关键符号（例如 candidate planner / reranker runner / eval harness integration point）的调用链证据

禁止在 stale index 上直接得出“影响面很小”的结论。

---

## 3. 实现目标（必须同时满足）

### 3.1 Backbone 目标

1. 在 canonicalized paper space 上实现 **hybrid candidate generation**：
   - 不再把 provider-local result set 当成最终 authority；
   - 可以融合 lexical / metadata / provider-native candidate channels，但输出必须回到 canonical identity。
2. 引入 **strong reranker**：
   - 必须是显式、可测、可审计的 reranking stage；
   - 对 inability-to-rank / insufficient evidence / unsupported query path 必须 fail-closed，不得静默伪造高置信排序。
3. 与 `SEM-06a` baseline 保持可比较：
   - 新增 eval slices 必须能证明 hybrid+r reranker 是否真实改善 hard-query / known-item retrieval；
   - 若某些子任务没有改善，也必须让 regression 可见。

### 3.2 Integration 目标

1. 继续沿用 **library-first / broker-first** 方向，避免创建新的 discovery MCP server。
2. 复用 `NEW-DISC-01` canonical paper / query-plan / search-log / dedup artifacts，而不是旁路再造一套。
3. 与现有 eval plane 对齐，不创建孤立测试 harness。
4. 所有新增 artifact / cache / log 写入必须遵守 evidence-first 与 atomic write 约束。

### 3.3 Scope boundary 目标

以下内容必须显式不做：

- triggered query reformulation / QPP (`NEW-SEM-06d`)
- structure-aware evidence localization (`NEW-SEM-06e`)
- provider orchestration runtime / session / queue substrate (`NEW-LOOP-01` / `EVO-13`)
- 重做 `NEW-DISC-01` 已完成的 canonicalization / dedup / search-log authority

---

## 4. Eval-first / test-first（硬顺序）

### 4.1 先补或锁定的测试资产

在写实现前，先确定并补齐：

1. hybrid candidate generation regression fixtures
2. reranker-specific fixtures（含 known-item、ambiguous query、hard negatives）
3. baseline / holdout / non-update expectation
4. failure-path regression：
   - reranker unavailable
   - insufficient candidate evidence
   - canonical merge 不足以支撑 rerank
   - provider subset / partial outage

### 4.2 至少要覆盖的 eval 维度

1. **Known-item retrieval**
   - DOI / arXiv / title+author / citation-style query 是否能在 canonicalized result space 中稳定召回并正确排序
2. **Hard-query recall**
   - 模糊标题、缩写、跨 provider metadata 不齐全时，hybrid candidate generation 是否优于纯 baseline
3. **Ranking quality**
   - precision / MRR / nDCG / recall@k 中至少选择与当前 eval plane 相容的一组，并说明理由
4. **Canonical consistency**
   - rerank 前后是否保持 canonical identity，不重新分叉为 provider-local duplicates
5. **Negative / fail-closed paths**
   - 不能排序时是否明确输出 inability / uncertainty，而非伪装成成功

### 4.3 验收哲学

- 没有 fixture / baseline / holdout / regression，不得声称 closeout 完成。
- 若 eval harness 缺少某个必要切片，必须先补 harness，再接实现。
- 若结果只在训练样例好看、holdout 不稳，不得硬标完成。

---

## 5. 实现建议（不是强制文件清单，但需满足职责清晰）

你可以按仓库现有结构调整，但必须保持 authority 清晰、单文件职责明确、200 LOC 规则尽量满足。推荐优先检查：

- `packages/shared/src/discovery/` 是否已有适合承载 hybrid candidate plan / rerank metadata contract 的 authority 文件
- `packages/hep-mcp/src/core/evidence*.ts` 中现有 retrieval / ranking logic 的 authority 边界
- `packages/hep-mcp/tests/eval/` 中是否已有可复用 eval harness，可在不破坏 `NEW-DISC-01` baseline 的前提下扩展

禁止：

- 新建 `utils.ts` / `helpers.ts` 式万能文件
- 把 candidate generation、reranking、eval glue 全塞进单一大文件
- 用 feature flag / 过渡命名（`new_`, `v2`, `legacy_` 等）规避设计收敛

---

## 6. 验收命令（完成前必须全部通过）

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

如果实现触及额外 provider adapter / package，再补跑受影响 package 的 `test` / `build`。

---

## 7. review-swarm / self-review（硬门禁）

实现完成且 acceptance 通过后，必须执行正式 `review-swarm`：

- reviewer 固定为：`Opus` + `OpenCode(kimi-for-coding/k2p5)`
- 若任一 reviewer 有 blocking issue，必须修正并进入下一轮，直到双审 0 blocking
- review 必须显式检查：
  - scope discipline（是否越界到 `NEW-SEM-06d/e`）
  - hybrid backbone / reranker 设计是否真的建立在 canonical substrate 上
  - eval-first / test-first 是否真实约束行为
  - holdout / baseline / failure-path credibility
  - GitNexus post-change evidence 是否充分

外部双审收敛后，当前执行 agent 仍必须做正式 self-review，并记录：

- blocking / non-blocking findings
- adopted / deferred amendments
- tests / eval / holdout / baseline / GitNexus 证据摘要

建议路径：

- SOTA preflight：`.tmp/new-sem06b-sota-preflight.md`
- self-review：`.tmp/review-swarm/new-sem06b-self-review-r1.md`

---

## 8. 收尾同步

完成前必须同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. `.serena/memories/architecture-decisions.md`
4. 必要时同步 `meta/REDESIGN_PLAN.md`

只有在以下条件全部满足后，`NEW-SEM-06b` 才可标记为 `done`：

- acceptance commands 全绿
- 正式 `review-swarm` 收敛且双审 0 blocking
- 正式 `self-review` 通过
- tracker / memory / `AGENTS.md` 已同步

---

## 9. 明确禁止

- 未做 SOTA preflight 就直接实现
- 未读 GitNexus context / stale index 下直接开工
- 没有 baseline / holdout / regression 就宣称 reranker 改善
- 把 provider-local duplicates 重新当成主 authority
- 用 query reformulation / structure-aware localization 偷渡补洞
- 未经人类再次明确授权就 `git commit` / `git push`
