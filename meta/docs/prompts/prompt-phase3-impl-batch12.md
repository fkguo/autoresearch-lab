# Phase 3 Implementation Batch 12: `NEW-SEM-03` + `NEW-SEM-04` + `NEW-SEM-06-INFRA`

> **状态**: 基于 `v1.9.2-draft` 规划、Batch 11 实现完成并经 `Opus + OpenCode(kimi-for-coding/k2p5)` 代码双审 `0 blocking` 后的执行 prompt。  
> **前置条件**: Batch 10 (`NEW-SEM-01` + `NEW-SEM-06a`) ✅、Batch 11 (`NEW-SEM-02` + `NEW-RT-06`) ✅，`NEW-DISC-01` 已 kickoff（D1/D2/D3 ✅，D4/D5 仍待 Batch 13–14）。  
> **本批目标**: 保持既有 SEM lane 节奏，完成 `NEW-SEM-03` + `NEW-SEM-04`，并在 parallel infra lane 完成 `NEW-SEM-06-INFRA` 的 substrate decision / eval protocol 冻结。

---

## 0. 执行定位

这是一个 **三工作面 batch**：

1. **`NEW-SEM-03`** — `LLM-First Stance Engine`  
   - 本批主 gate item；复用 Batch 11 的 claim→evidence→stance schema，但把 stance adjudication 从 heuristics-first 提升为 **LLM-first scoped stance engine**。
2. **`NEW-SEM-04`** — `Theoretical Conflict Reasoner`  
   - 本批配套完成项；面向 hard conflict / contradiction / not-comparable adjudication，必须给出可审计 rationale。
3. **`NEW-SEM-06-INFRA`** — `Retrieval Backbone Substrate Decision`  
   - 本批 parallel infra lane 收口项；只做 substrate decision + eval protocol + baseline lock，**不得提前启动 `NEW-SEM-06b`**。

---

## 1. 开工前必须读取

### 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-SEM-03`
   - `NEW-SEM-04`
   - `NEW-SEM-06-INFRA`
   - Batch 12–19 lane 排期
4. `meta/docs/sota-monorepo-architecture-2026-03-06.md`
5. `.serena/memories/architecture-decisions.md`
6. `.serena/memories/codebase-gotchas.md`（若存在）

### 代码 / 测试（必须读）

#### `NEW-SEM-03`

- `packages/hep-mcp/src/core/semantics/claimTypes.ts`
- `packages/hep-mcp/src/core/semantics/citationStanceHeuristics.ts`
- `packages/hep-mcp/src/core/semantics/evidenceClaimGrading.ts`
- `packages/hep-mcp/src/tools/research/evidenceGrading.ts`
- `packages/hep-mcp/tests/research/stance.test.ts`
- `packages/hep-mcp/tests/research/stanceDetection.test.ts`
- `packages/hep-mcp/tests/eval/evalSem02EvidenceClaimGrading.test.ts`

#### `NEW-SEM-04`

- `packages/hep-mcp/src/tools/research/theoreticalConflicts.ts`
- `packages/hep-mcp/src/tools/research/conflictDetector.ts`
- `packages/hep-mcp/tests/research/theoreticalConflicts.test.ts`
- `packages/hep-mcp/tests/research/conflictDetector.test.ts`

#### `NEW-SEM-06-INFRA`

- `packages/hep-mcp/src/core/evidence.ts`
- `packages/hep-mcp/src/core/evidenceSemantic.ts`
- `packages/hep-mcp/src/eval/metrics.ts`
- `packages/hep-mcp/tests/eval/evalSem06EvidenceRetrieval.test.ts`
- `meta/docs/sota-monorepo-architecture-2026-03-06.md` 中 `NEW-SEM-06-INFRA` / `NEW-SEM-06b` 相关段落

### GitNexus

开始前按 `AGENTS.md` 约定：

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 读取 `.claude/skills/gitnexus/exploring/SKILL.md`
3. 若评估 blast radius，读取 `.claude/skills/gitnexus/impact-analysis/SKILL.md`

---

## 2. tracker 开工要求

开始实现前先更新 `meta/remediation_tracker_v1.json`：

- `NEW-SEM-03` → `in_progress`
- `NEW-SEM-04` → `in_progress`
- `NEW-SEM-06-INFRA` → `in_progress`
- `assignee` 填当前实际模型

若本批完成并验证通过：

- `NEW-SEM-03` / `NEW-SEM-04` / `NEW-SEM-06-INFRA` → `done`
- note 必须写明：
  - 验收命令
  - 是否跑了实现代码双审
  - `NEW-SEM-06b` 仍未启动（只冻结 substrate decision）

---

## 3. 工作面 A — `NEW-SEM-03`（本批主 gate item）

### 3.1 目标

把 stance adjudication 提升为 **LLM-first scoped stance engine**：

- 支持 scoped negation
- 支持 multi-citation / multi-evidence bundle stance aggregation
- 支持 calibrated abstention / fallback accounting
- 继续复用 Batch 11 的 claim→evidence→stance schema，而不是再发明一套新 SoT

### 3.2 必做要求

1. `LLM-first` 是硬要求：heuristics 只能做 guard / fallback / observable diagnostics。
2. 不得回到 regex authority；pattern 命中不能直接成为 SoT。
3. 必须显式处理：
   - negation flip
   - hedging / partial support
   - support vs contradiction 混合 bundle
   - unrelated same-topic evidence
4. fallback rate 必须可观测（至少在 eval metrics 中可见）。
5. 若新增 prompt/version metadata，必须走现有 MCP sampling metadata 模式。

### 3.3 完成定义

- [ ] `NEW-SEM-02` stance schema 被复用而不是分叉
- [ ] scoped negation / hedge / mixed-bundle hard cases 有测试
- [ ] fallback / abstention 在 eval 中可见
- [ ] `pnpm --filter @autoresearch/hep-mcp test:eval`
- [ ] `pnpm --filter @autoresearch/hep-mcp test`
- [ ] `pnpm --filter @autoresearch/hep-mcp build`

---

## 4. 工作面 B — `NEW-SEM-04`

### 4.1 目标

实现 `Theoretical Conflict Reasoner`：

- 针对 hard conflict / contradiction / tension / incompatibility 给出 **可审计 rationale**
- 区分 `conflicting` 与 `not comparable`
- 保持 conservative，不要把“主题相近但问题不同”误判成真正冲突

### 4.2 必做要求

1. LLM-first adjudication；deterministic 规则只做 prefilter / hints / fallback。
2. 必须有明确的 `not comparable` 路径，而不是强行二元化成 support/conflict。
3. rationale 必须结构化、可回放，不接受只有 prose 结论。
4. 不得顺手重写 `conflictDetector.ts` 周边无关逻辑。

### 4.3 完成定义

- [ ] hard conflict / not-comparable fixtures 覆盖
- [ ] rationale 结构化输出存在
- [ ] 与 `NEW-SEM-03` / `NEW-SEM-02` schema 边界清晰
- [ ] `pnpm --filter @autoresearch/hep-mcp test:eval`
- [ ] `pnpm --filter @autoresearch/hep-mcp test`
- [ ] `pnpm --filter @autoresearch/hep-mcp build`

---

## 5. 工作面 C — `NEW-SEM-06-INFRA`（parallel infra lane）

### 5.1 目标

冻结 retrieval backbone substrate decision：

- embedding / index substrate
- hosted vs local 边界
- vector store / late-interaction / reranker 预留位
- 以 `SEM-06a` / `hashing_fnv1a32` baseline 为对照的 eval protocol

### 5.2 必做要求

1. **只做 substrate decision / eval protocol / baseline lock**，不实现 `NEW-SEM-06b`。
2. 输出必须足够让后续 Batch 17 的 `NEW-SEM-06b` 直接接手。
3. 必须明确：
   - canonical identity 依赖 `NEW-DISC-01` closeout
   - `NEW-SEM-06b` 不得先于 `NEW-DISC-01` + `NEW-SEM-06-INFRA`
4. 若写设计结论/配置 schema，必须与现有 eval plane 对齐，不再另起一套指标口径。

### 5.3 完成定义

- [ ] substrate decision 文档/代码锚点明确
- [ ] eval protocol 锁定 baseline / target metrics / comparison method
- [ ] 未提前实现 `NEW-SEM-06b`
- [ ] 相关测试/fixture/metric 入口可编译

---

## 6. 推荐实施顺序

1. **先做 `NEW-SEM-03`**
2. **再做 `NEW-SEM-04`**
3. **最后做 `NEW-SEM-06-INFRA`**

若上下文冲突，优先级为：

1. `NEW-SEM-03`
2. `NEW-SEM-04`
3. `NEW-SEM-06-INFRA`

---

## 7. 总验收命令

```bash
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp build
```

若为 `NEW-SEM-06-INFRA` 新增 shared / eval 层代码并触及其他包，补跑对应 package 的 test/build。

---

## 8. Review-Swarm（如执行）

若本批做实现审核，继续使用：

- `Opus`
- `OpenCode(kimi-for-coding/k2p5)`

审核问题至少覆盖：

1. `NEW-SEM-03` 是否真正 LLM-first，而不是 regex authority 换皮
2. `NEW-SEM-04` 是否给出结构化 rationale，并保留 `not comparable` 路径
3. `NEW-SEM-06-INFRA` 是否严格停留在 substrate decision / eval protocol，没有提前落地 `NEW-SEM-06b`
4. 本批接口是否与 Batch 13–19 lane 顺序保持一致

---

## 9. 交付后必须同步

1. 更新 `meta/remediation_tracker_v1.json`
2. 更新 `.serena/memories/architecture-decisions.md`
3. 若进度摘要有变化，更新 `AGENTS.md`
4. 记录：
   - 采用了哪些 review amendments
   - 哪些 deferred，以及原因

---

## 10. 不要做的事

- 不要把 `NEW-SEM-03` 做成 regex-heavy stance patch 集
- 不要把 `NEW-SEM-04` 简化成只有关键词的 contradiction detector
- 不要让 `NEW-SEM-06-INFRA` 提前实现 `NEW-SEM-06b`
- 不要顺手启动 `NEW-RT-07` 或 `NEW-DISC-01` D4/D5
- 不要破坏 Batch 13–19 的 lane 语义与依赖顺序
