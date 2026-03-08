# Phase 3 Implementation Standalone: `NEW-DISC-01` Closeout (`D4` / `D5`)

> **状态**: `NEW-RT-07` 已完成、合并到 `main` 并做完 worktree closeout；当前 `main` 已包含 `NEW-LOOP-01` substrate、`NEW-RT-07` host-side sampling routing，以及 `NEW-DISC-01` kickoff (`D1` / `D2` / `D3`)。起草本 prompt 时 `main` 头位于 `1a4805c`；执行前仍需自行确认工作树与远端状态。
> **本 prompt 定位**: 这是一个 **Phase 3 standalone implementation prompt**，只用于完成 `NEW-DISC-01` 的 closeout（`D4 canonicalization / dedup / search-log artifacts` + `D5 broker-integrated eval slices`）。不要把它与 `NEW-SEM-06b/d/e`、`NEW-RT-06/07`、`NEW-LOOP-01`、`EVO-13` 混做。
> **SOTA 对齐说明**: `NEW-DISC-01` 涉及 scholarly discovery、cross-provider canonicalization、dedup、broker eval，这些判断具有明显时效性。**任何关于 provider 取舍、canonical identity、dedup 策略、eval 指标、是否需要额外 broker abstraction 的判断，都必须先基于 2025–2026 最新 official docs / primary papers / benchmark evidence，而不是仅凭记忆或沿用 Batch 11 kickoff 时的静态假设。**
> **作用域澄清**: 本 prompt **只覆盖 `NEW-DISC-01` 的 D4 / D5 closeout**。不得顺手启动 `NEW-SEM-06b`（hybrid retrieval / strong reranker）、`NEW-SEM-06d/e`（query reformulation / uncertainty calibration）、`EVO-13`（single-project multi-agent runtime）、或把 `NEW-DISC-01` 升级成新的 discovery MCP server。
> **通用硬门禁继承**: 本 prompt 默认继承 `AGENTS.md` 与 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若下述条目与 checklist 同时覆盖同一主题，以更严格者为准。

---

## 0. 执行定位

这是一个 **单工作面、retrieval/discovery closeout** prompt：

### `NEW-DISC-01` — `Federated Scholar Discovery` Closeout

目标是在 **不重开 kickoff、不越界到 NEW-SEM-06b** 的前提下，补齐 `NEW-DISC-01` 的 closeout surface：

- 为 `INSPIRE + OpenAlex + arXiv` 的多 provider 发现流程建立 **canonical paper / query-plan / dedup / search-log** artifact contract；
- 明确 **confident match** 与 **uncertain match** 路径，并把 provenance / evidence / conflict reason 结构化落盘；
- 保持当前 shared-library / broker-first 路线，**不新建 discovery MCP server**；
- 让 `NEW-SEM-06b` 后续需要的 canonical identity / provider capability / dedup substrate 真正 ready，而不是只有 kickoff scaffold；
- 把 broker-level eval slices 接到现有 `NEW-RT-05` 统一 eval plane，至少覆盖 provider recall / precision、canonicalization、dedup、known-item retrieval；
- 先锁 baseline / fixtures / regression，再实现；
- 所有 artifact 与 eval 结果必须 evidence-first、可审计、可测试、可重放。

> **边界重申**:
> - `D1` / `D2` / `D3` 已完成：shared identifier foundation、provider capability schema、discovery scaffold 已有，不要重做。
> - 本批 **不** 做 `NEW-SEM-06b` 的 hybrid recall / reranker 实现；`D4` / `D5` 只负责把 canonicalization / dedup / eval substrate 做到足以支撑它。
> - 本批 **不** 做新的 agent runtime / queue / session store / planner orchestration substrate；这些属于 `NEW-LOOP-01` / `EVO-13`。

---

## 1. 开工前必须读取

### 1.1 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-DISC-01`
   - `NEW-SEM-06-INFRA`
   - `NEW-SEM-06b` / `NEW-SEM-06d` / `NEW-SEM-06e` 的边界说明
   - `NEW-RT-05` eval plane 相关说明
4. `.serena/memories/architecture-decisions.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `meta/docs/prompts/prompt-phase3-impl-batch11.md`
   - 尤其是 `NEW-DISC-01 kickoff` 的 D1/D2/D3 约束与“本批不要做 closeout”的原始边界
7. `meta/docs/sota-monorepo-architecture-2026-03-06.md`

### 1.2 必做 SOTA preflight（先于设计判断）

在开始实现前，必须联网完成一轮 **retrieval/discovery/canonicalization SOTA evidence collection**。至少包含：

1. **官方 provider 文档（primary / official）**
   - OpenAlex 官方文档：works identity、filter/search/cursor、citation/fulltext/known-item surfaces
   - arXiv 官方 API / source access 文档
   - INSPIRE 官方检索 / identifier / citation surfaces（若本轮设计会触及其 canonical identity 语义）
2. **近 12–18 个月 primary literature / benchmark evidence（至少 2 份）**
   - scholarly retrieval / entity resolution / paper dedup / metadata canonicalization
   - 或与 query planning / federated discovery eval 强相关的 benchmark / paper
3. **实现约束提炼**
   - 哪些结论直接影响 `NEW-DISC-01` D4/D5？
   - 哪些看似高价值但其实属于 `NEW-SEM-06b/d/e`，本批必须显式拒绝？
   - 当前 provider capability schema 是否足够，还是缺了会影响 closeout 的事实字段？

**硬要求**:
- 不得用博客营销文、二手总结代替 primary / official source。
- 不得把“最新模型/论文似乎能做”当成实现依据；必须落到与本项直接相关的 design implication。
- 必须把 SOTA 调研结论写成简短审计记录（可放 `.tmp/new-disc01-sota-preflight.md` 或 review packet），供后续 review / self-review 引用。

### 1.3 代码 / 测试（必须读）

#### Shared discovery authority

- `packages/shared/src/types/identifiers.ts`
- `packages/shared/src/types/paper.ts`
- `packages/shared/src/discovery/capabilities.ts`
- `packages/shared/src/discovery/query-intent.ts`
- `packages/shared/src/discovery/provider-descriptor.ts`
- `packages/shared/src/discovery/canonical-candidate.ts`
- `packages/shared/src/discovery/planner.ts`
- `packages/shared/src/discovery/index.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/__tests__/discovery-capabilities.test.ts`
- `packages/shared/src/__tests__/discovery-planner.test.ts`

#### Provider descriptor / consumer surface

- `packages/openalex-mcp/src/tools/registry.ts`
- `packages/openalex-mcp/src/tooling.ts`
- `packages/openalex-mcp/src/__tests__/identifiers.test.ts`
- `packages/openalex-mcp/src/__tests__/toolContracts.test.ts`
- `packages/arxiv-mcp/src/tools/registry.ts`
- `packages/arxiv-mcp/src/tooling.ts`
- `packages/hep-mcp/src/tools/registry/shared.ts`
- `packages/hep-mcp/src/tools/research/discoverPapers.ts`
- `packages/hep-mcp/src/tools/utils/discoveryHints.ts`
- `packages/hep-mcp/tests/discoveryHints.test.ts`

#### Eval plane / retrieval baselines

- `packages/hep-mcp/src/eval/index.ts`
- `packages/hep-mcp/src/eval/runner.ts`
- `packages/hep-mcp/src/eval/schema.ts`
- `packages/hep-mcp/src/eval/metrics.ts`
- `packages/hep-mcp/src/eval/baseline.ts`
- `packages/hep-mcp/tests/eval/evalFramework.test.ts`
- `packages/hep-mcp/tests/eval/evalSnapshots.ts`
- `packages/hep-mcp/tests/eval/evalRetrieval.test.ts`
- `packages/hep-mcp/tests/eval/evalSem06InfraDecision.test.ts`
- `packages/hep-mcp/tests/eval/evalSem06EvidenceRetrieval.test.ts`
- `packages/hep-mcp/tests/eval/fixtures/retrieval_cases.json`
- `packages/hep-mcp/tests/eval/fixtures/demo_retrieval_eval.json`
- `packages/hep-mcp/tests/eval/baselines/retrieval_demo.baseline.json`
- `packages/hep-mcp/tests/eval/baselines/sem06_evidence_retrieval.baseline.json`

> **注意**: 若在阅读中发现 `NEW-DISC-01` closeout 的真正 authority 不止这些文件，必须先补读，再动手。禁止“读了一半就凭印象设计 canonicalization / dedup”。

---

## 2. GitNexus 硬门禁（必须执行）

### 2.1 实施前

1. 先读 `gitnexus://repo/{name}/context`。
2. 若 index stale，先运行 `npx gitnexus analyze`，再继续。
3. 至少用 GitNexus 对齐以下符号 / surface：
   - `planDiscoveryProviders`
   - `supportsCapabilities`
   - `DiscoveryProviderDescriptorSchema`
   - `OPENALEX_DISCOVERY_DESCRIPTOR`
   - `ARXIV_DISCOVERY_DESCRIPTOR`
   - `INSPIRE_DISCOVERY_DESCRIPTOR`
   - `runEvalSet`
   - `compareWithBaseline`
4. 在改代码前，明确：
   - 现有 discovery scaffold 的 callers / consumers 在哪里；
   - eval harness 当前如何接 baseline / fixtures；
   - 哪些路径会被 D4/D5 改动影响。

### 2.2 正式审核前

若实现新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`。
2. 使用 `detect_changes`。
3. 对关键新增 surface 做 `impact` / `context`，至少覆盖：
   - 新的 canonical artifact schema authority
   - 新的 dedup / search-log authority
   - 新增 eval entrypoint / baseline gate
4. 把 post-change 证据带入 `review-swarm` 与 `self-review`。

---

## 3. 本批实现工作面

## 3.1 `D4` — Canonicalization / dedup / search-log artifacts

本批必须把 kickoff scaffold 落成 **真正可消费的 closeout contract**。

### 必达目标

1. **Canonical paper object**
   - 为 broker / shared layer 提供统一的 canonical paper schema/type；
   - 至少能表达：canonical identifiers、标题、作者、年份、provider 来源、provenance、merge confidence、uncertain-match state；
   - 不允许把 provider-local identity 直接硬编码成 canonical truth；必须显式保留“为什么判定为同一论文”的 provenance / reason。

2. **Query-plan artifact**
   - 把一次 federated discovery 的 provider selection / intent / ordered plan / query normalization 结构化记录下来；
   - 必须能解释：为什么选这些 provider、用了哪些 capability filter、是否发生 fallback / narrowing；
   - 不得只保留最终 hits，而丢失 plan 过程。

3. **Cross-provider dedup artifact**
   - 对多 provider 返回结果做 dedup / merge 时，必须产出单独的 dedup artifact；
   - 至少区分：
     - confident merge
     - uncertain candidate pair/group
     - non-merge with reason
   - provenance 要能回溯到原始 provider candidate，而不是 merge 后不可逆丢失来源。

4. **Append-only search log**
   - 每次 discovery 查询必须有 append-only 的 query / provider / result summary / artifact locator log；
   - 不允许 silently overwrite 先前记录；
   - 路径、schema、命名必须符合 evidence-first + artifact naming 规则。

5. **Library-first，不新建 server**
   - 默认实现位置应优先保持在 `packages/shared/src/discovery/` 与已存在的 broker/consumer surface；
   - **不得**把 D4 借机做成新的 discovery MCP server；
   - 若你认为需要提炼更明确的 broker-local helper，必须先证明 shared-first 无法满足，并在 review packet 中给出证据。

### 设计约束

- uncertain match 是一等路径，不是异常分支；
- dedup / canonicalization 必须 fail-closed：证据不足时保留 uncertain，而不是强行 merge；
- 不要因为“后面还会 rerank”就偷懒省掉 provenance；`NEW-SEM-06b` 依赖的是可靠 substrate，而不是模糊 heuristics；
- 文件拆分必须遵守 200 LOC / SRP；如果 D4 需要新增多个 schema/helper，按职责分文件，不要堆到一个万能 `utils.ts`。

## 3.2 `D5` — Broker-integrated eval slices

本批必须把 `NEW-DISC-01` closeout 接入现有 eval plane，而不是只写几个 unit tests 就声称 ready。

### 必达目标

1. **新增 broker-level eval slices**
   - 至少覆盖：
     - provider recall / precision
     - canonicalization correctness
     - dedup correctness
     - known-item retrieval
   - 若需要 synthetic fixtures，必须说明它们模拟了什么 failure mode；
   - 至少应包含一类 ambiguous / near-duplicate / cross-provider metadata mismatch case。

2. **Baseline-first / holdout-aware**
   - 若当前没有对应 eval fixture / baseline，必须先创建，再实现；
   - baseline 要通过现有 `tests/eval` 基础设施落盘，不得只在测试里硬编码预期对象；
   - 如需更新 snapshot / baseline，开发过程中可用 update 命令，但最终 acceptance 必须在非 update 模式下通过。

3. **接入 `NEW-RT-05` eval plane**
   - 优先复用 `packages/hep-mcp/src/eval/*` 与现有 `tests/eval/*` 约定；
   - 不要重新发明一套平行 eval runner；
   - 至少要让后续 `NEW-SEM-06b` 可以直接继承/扩展这些 discovery broker eval slices。

4. **指标与门槛必须可解释**
   - 如果使用 recall/precision/MRR/coverage/canonicalization accuracy/dedup error rate 等指标，必须说明为什么这些指标支撑 `NEW-DISC-01` closeout；
   - 不得随意编造 improvement threshold；若缺少历史可比 baseline，先以“锁住 deterministic baseline + regression gate”为主。

### 范围约束

- D5 只做 broker-level discovery eval；
- 不要把 `NEW-SEM-06b` 的 hybrid retrieval / strong reranker 评测提前实现进来；
- 不要顺手把 `hep-mcp` 所有 retrieval eval 全部重写一遍。

## 3.3 Closeout 完成定义

- [ ] `NEW-DISC-01` kickoff 的 shared scaffold 被补齐为真正可消费的 canonicalization / dedup / search-log artifact contract
- [ ] canonical paper / query-plan / dedup / search-log 至少各有一个明确 authority schema/type 与写入路径
- [ ] uncertain-match / provenance / non-merge reason 是显式一等路径
- [ ] provider capability schema 仍保持 shared SoT，provider adapter 不回退为各自发明结构
- [ ] broker-level eval slices 已接入现有 eval plane，而不是平行私有测试
- [ ] baseline / fixtures / holdout gate 已在实现前锁住，并在实现后通过
- [ ] `NEW-SEM-06b` 所需 canonical identity / provider capability / dedup substrate 已具备可复用基础
- [ ] 未启动 `NEW-SEM-06b/d/e`、`NEW-RT-06/07`、`NEW-LOOP-01`、`EVO-13`

---

## 4. Eval-first / test-first 顺序（硬要求）

### 4.1 先补 tests / fixtures / baselines（先红后绿）

在写实现前，先把以下测试或等价测试补到位，并确认至少部分先红：

1. **Shared artifact contract tests**
   - canonical paper schema parse / reject cases
   - uncertain match path
   - dedup artifact provenance preservation
   - search-log append-only semantics
   - query-plan artifact captures provider selection rationale

2. **Cross-provider canonicalization / dedup tests**
   - 同一论文在 OpenAlex + arXiv + INSPIRE 的 merge path
   - metadata 近似但证据不足时保持 uncertain，不得强 merge
   - provider-local identifiers / provenance 在 merge 后仍可回溯

3. **Broker eval tests**
   - 新增 `tests/eval` 用例与 baseline/snapshot
   - 至少覆盖 known-item retrieval、canonicalization、dedup、ambiguous case
   - baseline update 与 non-update gate 都可运行

> **命名建议**（可调整，但要清晰）:
> - `packages/shared/src/__tests__/discovery-canonicalization.test.ts`
> - `packages/shared/src/__tests__/discovery-dedup.test.ts`
> - `packages/hep-mcp/tests/eval/evalDisc01BrokerCloseout.test.ts`
> - `packages/hep-mcp/tests/eval/fixtures/disc01_broker_eval.json`
> - `packages/hep-mcp/tests/eval/baselines/disc01_broker.baseline.json`

### 4.2 再写实现

只有在 tests / fixtures / baseline 已建立后，才允许实现 D4/D5 代码。

### 4.3 最后做收口验证

- 全部 targeted tests 过绿；
- eval suite 在非 update 模式下过绿；
- shared/provider/hep-mcp 相邻包 build/test 全过；
- 再进入 formal review。

---

## 5. 实施建议顺序

1. **先做 SOTA preflight + GitNexus mapping**
2. **再补 D5 需要的 eval fixtures / baselines / red tests**
3. **然后补 D4 的 canonical artifact schemas / typed contracts / append-only log**
4. **再把 provider result canonicalization / dedup 接到 broker/shared surface**
5. **最后收口 D5 eval、跑 acceptance、做 review-swarm + self-review**

> **为什么先 D5 再 D4**: 因为 `NEW-DISC-01` 最大风险不是“写不出 schema”，而是“实现了一套看似合理但无法被 eval 约束的 canonicalization/dedup 逻辑”。先把评测面锁住，能显著减少后面为了补证据而返工。

---

## 6. 总验收命令（完成前必须全部通过）

### 6.1 开发过程中允许使用（更新 baseline 时）

- `pnpm --filter @autoresearch/hep-mcp test:eval:update`

> 仅在**明确需要更新新建 eval baseline / snapshot** 时使用；最终 acceptance 不得依赖 update 模式。

### 6.2 正式 acceptance commands

- `pnpm --filter @autoresearch/shared test`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/openalex-mcp test`
- `pnpm --filter @autoresearch/openalex-mcp build`
- `pnpm --filter @autoresearch/arxiv-mcp test`
- `pnpm --filter @autoresearch/arxiv-mcp build`
- `pnpm --filter @autoresearch/hep-mcp test`
- `pnpm --filter @autoresearch/hep-mcp test:eval`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm lint`
- `pnpm -r test`
- `pnpm -r build`

> 若本批新增的 eval/test 命令无法被上述命令覆盖，必须先把它们纳入可重复执行的脚本，再视为完成。

---

## 7. 正式 `review-swarm`（必须执行）

完成实现并跑完 acceptance 后，必须执行正式双审：

- reviewer 固定为：
  - `Opus`
  - `OpenCode(kimi-for-coding/k2p5)`
- 审核必须基于：
  - 实际代码与调用链
  - GitNexus post-change evidence
  - tests / eval fixtures / baselines / holdout gate
  - SOTA preflight 结论与本批设计映射
  - scope discipline（确认未顺手拉入 `NEW-SEM-06b/d/e` / `EVO-13`）

### 收敛标准

- 任一 reviewer 有 blocking issue → 必须修复并继续下一轮；
- 只有当两位 reviewer 都达到 `CONVERGED` / `CONVERGED_WITH_AMENDMENTS` 且 `blocking_issues = 0`，才算通过；
- 低风险 amendments 优先吸收；deferred 项必须写理由。

---

## 8. 正式 `self-review`（外部双审后仍必须执行）

外部双审收敛后，当前执行 agent 仍必须做一轮正式自审，至少覆盖：

1. D4/D5 实现本身与关键下游 surface；
2. GitNexus `detect_changes` / `impact` / `context` post-change 证据；
3. eval fixtures / baselines / holdout gate 是否真的锁住 canonicalization / dedup 行为；
4. SOTA preflight 结论是否真正落到了实现，而不是只做表面引用；
5. scope boundary 是否守住。

自审若发现 blocking issue，必须先修复再进入完成态。

---

## 9. 交付后必须同步

完成后必须同步以下内容：

1. `meta/remediation_tracker_v1.json`
   - `NEW-DISC-01` 从 `in_progress` → `done`
   - note 写清：D4/D5 交付内容、关键 schema / artifact / eval gate、acceptance 结果、review / self-review 结果、commit hash
2. `.serena/memories/architecture-decisions.md`
   - 记录 canonicalization / dedup / eval substrate 的关键设计决策
   - 记录 SOTA preflight 中真正影响实现的结论
3. `AGENTS.md`
   - 更新当前进度摘要（`NEW-DISC-01` closeout done）
   - 若本批形成新的全局治理规则，再同步进去
4. `meta/REDESIGN_PLAN.md`
   - 必要时补齐 `NEW-DISC-01` closeout 状态与相关注释
   - 若 D4/D5 的 authority / acceptance 文字需要从“计划态”升级为“已完成事实”，同步更新
5. review artifacts / adopted/deferred amendments
   - `.review/` 继续保持 gitignored
   - adopted / deferred amendments 与理由要可追溯

---

## 10. 版本控制与 worktree closeout 门禁

- 未经人类在当前任务中明确授权，不要 `git commit` / `git push`。
- 即使得到授权，也只能在以下全部满足后执行：
  - acceptance 全绿
  - `review-swarm` 0 blocking
  - `self-review` 0 blocking
  - tracker / memory / `AGENTS.md` 已同步
- 若本批使用非主 worktree，清理前必须遵守 `AGENTS.md` 的 **Serena memory migration** 规则；未完成迁移前不得 `git worktree remove`。

---

## 11. 开工前 30 秒自检

- 确认当前目录是 **新开的专用 worktree**，不是 `main` 主 worktree；建议路径类似 `/Users/fkg/Coding/Agents/autoresearch-lab-disc01`
- 确认当前分支是本批专用分支（例如 `phase3-disc01-closeout`），而不是直接在 `main` 上开发
- 确认 `NEW-RT-07`、`NEW-LOOP-01` 已完成，不重新打开它们的实现范围
- 确认已完整读完：`AGENTS.md`、`meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`、本 prompt、`NEW-DISC-01` 相关计划/代码/测试
- 确认 GitNexus context 已读；若 stale，先 `npx gitnexus analyze`
- 确认 SOTA preflight 会先做，不会把 2025–2026 retrieval/discovery 判断建立在过期记忆上
- 确认本轮只做 `NEW-DISC-01` D4 / D5，不启动 `NEW-SEM-06b/d/e`、`EVO-13`

---

## 12. 补充背景（供继承上下文，不要重做）

- `NEW-DISC-01` kickoff (`D1` / `D2` / `D3`) 已在 Batch 11 完成，implementation commit 为 `299ff0d`
- kickoff 已完成内容：
  - `openalex_id` shared identifier foundation
  - shared provider capability schema
  - `packages/shared/src/discovery/` scaffold
  - provider descriptors in `openalex-mcp` / `arxiv-mcp` / `hep-mcp`
- `NEW-RT-07` 已在 standalone prompt 中完成，并已合并到 `main`
- `NEW-LOOP-01` 已完成 closeout；本批不要把 discovery closeout 与 runtime substrate 混做
- 当前 retrieval/discovery lane 的推荐顺序是：先完成 `NEW-DISC-01` closeout，再进入 `NEW-SEM-06b`

