# Phase 3 Implementation Prompt — NEW-SEM-06f: Multimodal Scientific Retrieval

> **推荐窗口**: `NEW-SEM-06e` closeout 之后、search-heavy `agent-arxiv` work 之前。
> **定位**: `NEW-SEM-06f` 是 retrieval backbone 的**可选** follow-up，不是新的 discovery substrate，也不是 `agent-arxiv` runtime / product lane。
> **核心边界**: 只允许在现有 canonical-paper + semantic evidence + structure-aware localization backbone 上，加一层 **bounded multimodal retrieval signal**。禁止借题发挥成新 server、新 index、新 parser/OCR、或搜索型 `agent-arxiv` 功能。

---

## 1. 开工前必须读取（硬要求）

至少读取并对齐以下材料：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` 中 `NEW-SEM-06-INFRA` / `NEW-SEM-06b` / `NEW-SEM-06d` / `NEW-SEM-06e` / `NEW-SEM-06f` / retrieval lane / optional follow-up 的完整描述
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/sota-monorepo-architecture-2026-03-06.md` 中 retrieval roadmap、`SEM-06f`、`IRPAPERS`、long-document / multimodal retrieval 相关段落
6. `meta/docs/sota-sem-batch10-2026-03-05.md` 中 multi-stage retrieval / reranking / late-interaction / fallback policy 段落
7. `meta/docs/prompts/prompt-phase3-impl-new-sem06b.md`
8. `meta/docs/prompts/prompt-phase3-impl-new-sem06d.md`
9. `meta/docs/prompts/prompt-phase3-impl-new-sem06e.md`
10. `packages/shared/src/discovery/` 当前 authority（至少：`canonical-paper.ts`, `candidate-generation-artifact.ts`, `rerank-artifact.ts`, `search-log.ts`, `query-plan.ts`, `evidence-localization.ts`）
11. `packages/hep-mcp/src/core/evidence.ts`
12. `packages/hep-mcp/src/core/evidenceSemantic.ts`
13. `packages/hep-mcp/src/core/evidenceRetrievalSubstrate.ts`
14. `packages/hep-mcp/src/core/pdf/evidence.ts`
15. `packages/hep-mcp/tests/core/pdfEvidence.test.ts`
16. `packages/hep-mcp/tests/eval/evalSem06EvidenceRetrieval.test.ts`
17. `packages/hep-mcp/tests/eval/evalSem06bHybridDiscovery.test.ts`
18. `packages/hep-mcp/tests/eval/evalSem06dTriggeredReformulation.test.ts`
19. `packages/hep-mcp/tests/eval/evalSem06eStructureAwareLocalization.test.ts`
20. `packages/hep-mcp/tests/eval/evalSem06eFailureModes.test.ts`
21. `.serena/memories/architecture-decisions.md`

### Tracker / plan bootstrap（硬要求）

`NEW-SEM-06f` 当前在 `REDESIGN_PLAN` 中仍主要以 optional follow-up 形式出现，且可能尚未在 `meta/remediation_tracker_v1.json` 中拥有独立条目。

因此执行本 prompt 时，**不得**假设 tracker 生命周期已天然存在。必须先完成以下 bootstrap：

1. 确认 `meta/remediation_tracker_v1.json` 是否已有 `NEW-SEM-06f` 条目；
2. 若没有，则在真正进入实现前，先补一个最小但持久的 tracker anchor（至少含 `title`、`status`、`complexity`、`depends_on`、`note/design_doc`）；
3. 无论条目是新建还是已存在，在开始正式 preflight / implementation 前，都必须把该项置为 `status: "in_progress"`，并填写当前实际执行模型作为 `assignee`；
4. 若本轮 preflight 直接得到 `No-Go / Defer`，结论也必须落到该 tracker 条目与必要的 `meta/REDESIGN_PLAN.md` 同步中，禁止只留在 prompt、chat、`.review/` 或 `.tmp/`。

换言之：本 prompt 本身可以作为本轮执行规范，但**不能**替代持久 SSOT 生命周期记录。

### SOTA preflight（必须先做；允许得出 No-Go）

先产出 `SEM-06f` preflight，并采用 **archive-first**：

- canonical archive：`~/.autoresearch-lab-dev/sota-preflight/<YYYY-MM-DD>/NEW-SEM-06f/preflight.md`
- 当前 `worktree` 副本 / 指针：`.tmp/new-sem06f-sota-preflight.md`
- 同目录建议附：`summary.md`、`manifest.json`

preflight 至少必须回答：

1. 对本仓最现实的 multimodal 落点是什么：`page-image`、`pdf-region`、`figure-caption + page-native evidence`、还是其他更小切面？
2. v1 应优先做 **multimodal rerank / signal fusion**，还是需要额外 **multimodal candidate channel**？
3. 哪些 query 真正需要视觉 / page-native evidence，哪些仍应坚持 text-first？
4. 什么情况下必须 `fallback` / `unsupported` / `abstain`，而不是假装 multimodal 命中？
5. 这件事是否存在一个 bounded、可审计、可评估的 v1？若没有，必须给出 `No-Go`。

### SOTA 不得只拿粗思想（硬门禁）

前几批 retrieval lane 的 preflight 不是摆设：

- `NEW-SEM-06b` 吸收了 multi-stage retrieval / rerank 的结构化做法；
- `NEW-SEM-06d` 吸收了 triggered reformulation / QPP / fail-closed telemetry 的 policy 细节；
- `NEW-SEM-06e` 吸收了 typed localization unit、citation-context 边界、以及 unavailable-path coverage 的细节。

因此本批**禁止**只写“多模态通常更强”“视觉信息可能有帮助”这类粗结论。preflight 必须先产出 **至少 3 条核心 findings**；若还有会改变实现、评审或 defer 结论的重要细节，必须继续列出，**不设硬上限**。`3` 是质量下限，不是数量上限。

findings 应尽量覆盖可吸收的细节，例如：

- 哪类 query 才应触发 multimodal path
- 何种 visual/page evidence 才足以 override text baseline
- caption 稀疏、正文弱复述、版面冲突、跨页图表、region ambiguity 等 failure mode
- capability detection / provider availability / local-binary availability 的 gate
- 成本、延迟、触发率、fallback 率、unsupported 率的观测方式
- figure / page / region / table / equation 与 `06e` localization 的兼容边界
- negative finding：哪些看似合理的 SOTA 技巧在本仓当前约束下**不值得吸收**

收尾时，每条 finding 都必须归类为以下之一：

- `adopted`：已体现在代码 / contract / policy / eval / baseline 中
- `rejected`：经证据判定不适合本仓当前约束，并说明原因
- `deferred`：仍有后续价值，但属于 lane 外或依赖后续 phase，并已同步到持久 SSOT

建议在 self-review 中附一个简短 traceability 表：`finding -> adopted/rejected/deferred -> code/test/SSOT evidence`。若 findings 很多，traceability **至少覆盖最关键的 3–7 条**，其余可放附录；但凡会改变 scope / policy / eval / defer 结论的 finding，都不得因“超过 7 条”而省略。

> 注意：`NEW-SEM-06f` 在 `REDESIGN_PLAN` 中仍是 optional follow-up。若 preflight 结论是只有“大规模新 index / 新服务 / 新 parser”才能做出有意义 uplift，则本批必须 `No-Go / Defer`，不得硬做越界实现。

---

## 2. GitNexus 对齐（硬要求）

### 2.1 开工前

必须先读取 `gitnexus://repo/{name}/context`；若 index stale，先运行 `npx gitnexus analyze`。

至少完成以下对齐：

1. `context(queryProjectEvidenceSemantic)`：确认 `06e` 后 semantic-query entrypoint、surface loading、localization 输出面
2. `context(...)` / `impact(...)` 指向 `packages/hep-mcp/src/core/pdf/evidence.ts` 相关符号：确认 PDF page / region evidence 的生产与消费边界
3. 对 eval harness integration point 建立证据，至少覆盖：
   - `evalSem06EvidenceRetrieval`
   - `evalSem06eStructureAwareLocalization`
   - 任何新增 `SEM-06f` eval 文件
4. 若计划引入新的 shared artifact / telemetry contract，先对 `packages/shared/src/discovery/*` 建立 authority 边界认知，确认不会旁路既有 canonical-paper / search-log / rerank / localization 语义

### 2.2 审核前

若实现新增/重命名符号、改变关键调用链、或 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 使用 `detect_changes`
3. 至少补两类证据：
   - `impact(...)`：multimodal integration point 的 blast radius
   - `context(...)`：关键 entrypoint 与下游 eval / output contract 的调用链

禁止在 stale index 上直接声称“影响面小”。

---

## 3. 实现目标（仅在 preflight = Go 时进入）

### 3.1 必须做到

1. 为**视觉 / PDF-native scientific evidence query** 引入一个 bounded multimodal retrieval path
2. 最终 authority 仍回到 **canonical paper identity + typed localization**；不得产生一套 provider-local page identity
3. multimodal signal 必须是**显式、可审计、可关停、可评估**的一层，必须能解释“为什么该结果因为 visual / PDF-native evidence 被提升”
4. 文本 query 不得无故退化；只有真正需要视觉 / page-native evidence 的 query 才允许触发 multimodal path
5. multimodal path 与 `06e` localization 兼容：可以帮助找到更对的 page/figure/table/equation 候选，但不能伪造不存在的精确 locator

### 3.2 明确不做

- 新 discovery MCP server
- 新的全量 multimodal index / always-on page-image store / 独立 ANN service
- 重做 `pdf-mcp` / Docling / OCR pipeline
- 搜索型 `agent-arxiv` 产品功能
- 推翻 `NEW-SEM-06e` 的 typed localization contract
- 旁路 `NEW-DISC-01` canonical paper / search-log / rerank artifact authority

### 3.3 实现建议

优先考虑 **library-first / broker-first** 的最小落点：

- 在 `packages/hep-mcp/src/core/evidenceSemantic.ts` 集成 multimodal policy / routing / fusion
- 复用 `packages/hep-mcp/src/core/pdf/evidence.ts` 已有的 page / region / metadata surface
- 若需要 shared contract，只新增小型 `multimodal signal / telemetry / artifact` authority，禁止把业务逻辑塞进 `packages/shared`
- 若依赖可选 provider / model / local binary，必须 capability-gated、fail-closed，并且未配置时仍保持 deterministic 的 text-only baseline/fallback

禁止：

- 新建 `utils.ts` / `helpers.ts` / `service.ts` 式万能文件
- 把 routing、scoring、telemetry、eval glue 全塞进单一大文件
- 用 `new_`, `v2`, `legacy_`, `experimental_` 等过渡命名规避收敛
- 引入巨大新依赖，却没有清晰 eval 增益与 capability gate

---

## 4. Eval-first / test-first（硬顺序）

在写实现前，先锁定：

1. regression fixtures
2. baseline / holdout / non-update expectation
3. failure-path fixtures：
   - multimodal support unavailable
   - capability advertised but artifact surface missing
   - multimodal score insufficient to override text baseline
   - visual ambiguity / conflicting candidates
   - budget exhausted / policy-disabled path
4. 至少一个 text-only baseline 不退化切片

建议新增并锁定（可调整命名，但职责必须清楚）：

- `packages/hep-mcp/tests/eval/evalSem06fMultimodalScientificRetrieval.test.ts`
- `packages/hep-mcp/tests/eval/fixtures/sem06f_multimodal_scientific_retrieval_eval.json`
- `packages/hep-mcp/tests/eval/fixtures/sem06f_multimodal_scientific_retrieval_holdout.json`
- `packages/hep-mcp/tests/eval/baselines/sem06f_multimodal_scientific_retrieval.baseline.json`

至少覆盖以下 eval 维度：

1. **Figure / page-seeking retrieval**：明确找 figure/diagram/plot/page-level visual evidence 的 query 是否优于 text-only baseline
2. **PDF-native uplift**：caption 稀疏、正文弱复述但 page/region/visual surface 明显时是否有稳定 uplift
3. **Text-first non-regression**：普通 prose / citation / equation query 不应被无意义拉低
4. **Localized output compatibility**：最终结果仍能回到 `06e` localization semantics
5. **Fail-closed behavior**：不可用、证据不足、冲突明显时是否明确 fallback / unsupported / abstain
6. **Cost / latency observability**：至少有一个 auditable 指标反映额外成本与触发率

没有 fixture / baseline / holdout / failure-path，不得声称 `06f` closeout。

---

## 5. 验收命令

### 5.1 Go 实现路径

至少运行：

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/openalex-mcp test
pnpm --filter @autoresearch/openalex-mcp build
pnpm --filter @autoresearch/arxiv-mcp test
pnpm --filter @autoresearch/arxiv-mcp build
pnpm --filter @autoresearch/hep-mcp test -- tests/core/pdfEvidence.test.ts
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp build
pnpm lint
pnpm -r test
pnpm -r build
```

若新增 `SEM-06f` 专项 eval / holdout gate，还必须显式单跑一次；若 multimodal path 有 capability-gated 分支，至少覆盖：

- capability enabled
- capability unavailable / disabled

### 5.2 No-Go / Defer 路径

若 preflight 给出 `No-Go`，最小验收为：

1. preflight archive + `.tmp` 指针
2. checked-in defer / no-go note 或后续 prompt
3. tracker / `AGENTS.md` / 必要时 `meta/REDESIGN_PLAN.md` 同步
4. 不得留下半实现 / 失效测试 / 悬空 contract

---

## 6. review-swarm / self-review（硬门禁）

### 6.1 Go 实现路径

实现完成且 acceptance 通过后，必须执行正式 `review-swarm`：

- reviewer 固定为：`Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)`
- 若任一 reviewer 本地不可用，必须记录失败原因，并由人类明确批准 fallback reviewer；禁止静默降级
- 任一 reviewer 有 blocking issue，就必须修正并进入下一轮，直到三审 `0 blocking`

review 必须显式检查：

1. scope discipline（是否越界到 `agent-arxiv` / parser / 新 substrate）
2. multimodal path 是否真正建立在 canonical paper + localization backbone 之上
3. text-first non-regression 是否守住
4. holdout / failure-path / unsupported-path 是否可信
5. GitNexus post-change evidence 是否充分
6. capability gate / telemetry / cost policy 是否可审计

外部三审收敛后，当前执行 agent 仍必须做正式 `self-review`，记录：

- blocking / non-blocking findings
- adopted / deferred / declined amendments
- tests / eval / holdout / baseline / GitNexus 证据摘要
- `finding -> adopted/rejected/deferred -> code/test/SSOT evidence` traceability

建议路径：

- SOTA preflight：`.tmp/new-sem06f-sota-preflight.md`
- self-review：`.tmp/review-swarm/new-sem06f-self-review-r1.md`

### 6.2 No-Go / Defer 路径

若 preflight 结论为 `No-Go`，仍需要：

1. 用同样的 reviewer trio 对“为何 defer、为何不应越界硬做”做 clean-room review，至少一轮
2. 当前 agent 做一轮正式 self-review，确认 defer 理由确实符合 lane / infra / SOTA / eval 约束
3. 把 defer 理由同步到持久 SSOT；禁止只留在 chat 或 `.review/` 临时产物里

---

## 7. 收尾同步

### 7.1 Go 实现路径

完成前必须同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. `.serena/memories/architecture-decisions.md`
4. `meta/REDESIGN_PLAN.md`（推荐同步，因为 `06f` 当前仍是 optional follow-up，若落地需把 optional 状态改写为实际 closeout）

只有在以下条件全部满足后，`NEW-SEM-06f` 才可标记为 `done`：

- preflight = Go，且 archive 已落盘
- acceptance commands 全绿
- `review-swarm` 三审收敛且 `0 blocking`
- `self-review` 无未处理 blocking
- tracker / memory / `AGENTS.md` / 必要时 `REDESIGN_PLAN` 已同步
- closeout 明确说明：为什么 `06f` 值得做，以及为什么没有越界做成 `agent-arxiv` 或新 substrate
- 完成汇报给出条件化的下一批建议：下一个更合理的 prompt / lane 是什么、为什么是它、以及为什么不是相邻但更诱人的项

### 7.2 No-Go / Defer 路径

若 preflight = `No-Go`，则**不得**把 `NEW-SEM-06f` 标为 `done`。必须：

1. 在 `meta/remediation_tracker_v1.json` 中记录 defer / blocked / no-go 理由
2. 更新 `AGENTS.md` 当前进度摘要
3. 在 `.serena/memories/architecture-decisions.md` 记录稳定结论：为什么 `06f` 暂不值得做、真正阻塞点是什么、何时再评估
4. 同步 `meta/REDESIGN_PLAN.md`，把 optional note 细化为下一次重评估前提
5. 给出条件化 next-step recommendation，说明为什么不应继续硬推 `06f`

---

## 8. 一句话原则

`NEW-SEM-06f` 若要做，必须是**在现有 canonical-paper + structure-aware localization backbone 上，以 evalable、capability-gated、fail-closed 的方式，补一层真正有增益、且能吸收 SOTA 细节而非只复述大方向的 multimodal scientific retrieval signal**；若做不到，就应明确 `No-Go / Defer`。
