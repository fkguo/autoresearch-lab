# Phase 3 Implementation Batch 11: `NEW-SEM-02` + `NEW-DISC-01` kickoff + `NEW-RT-06`

> **状态**: 基于 `v1.9.2-draft` 规划与 `Opus + Kimi K2.5` 外部双审核后的 clarified 版本。  
> **前置条件**: Batch 8 (`NEW-RT-05`) ✅、Batch 9 (`NEW-SEM-07`) ✅、Batch 10 (`NEW-SEM-01` + `NEW-SEM-06a`) ✅。  
> **本批目标**: 在不打乱既有 SEM lane 的前提下，完成 `NEW-SEM-02`（本批 gate item）+ `NEW-RT-06`（完整完成）+ `NEW-DISC-01` kickoff（D1/D2/D3，**不要求本批 closeout**）。

---

## 0. 执行定位

这是一个 **三工作面 batch**：

1. **`NEW-SEM-02`** — `Evidence/Claim Semantic Grading V2`  
   - 本批主 gate item；目标是建立 claim → evidence → stance 的结构化语义 SoT，并满足 **G3** 启动条件。
2. **`NEW-RT-06`** — `Provider-Agnostic Orchestrator Routing`  
   - 本批建议完整关闭；只做 **Plane 1 / orchestrator runtime**，不得越界到 `NEW-RT-07`。
3. **`NEW-DISC-01 kickoff`** — `Federated Scholar Discovery` 的 D1/D2/D3  
   - 本批只做 kickoff：shared identifiers + capability schema + discovery scaffold。  
   - `canonicalization / dedup / search-log / broker-level eval closeout` 留给 Batch 13–14。

---

## 1. 开工前必须读取

### 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-SEM-02`
   - `NEW-RT-06`
   - `NEW-DISC-01`
   - Batch 11–19 的 parallel lane / retrieval lane 排期
4. `meta/docs/sota-monorepo-architecture-2026-03-06.md`
5. `.serena/memories/architecture-decisions.md`
6. `.serena/memories/codebase-gotchas.md`（若存在）

### 代码 / 测试（必须读）

#### `NEW-SEM-02`

- `packages/hep-mcp/src/tools/research/evidenceGrading.ts`
- `packages/hep-mcp/src/tools/research/conflictDetector.ts`
- `packages/hep-mcp/src/core/semantics/quantityAdjudicator.ts`
- `packages/hep-mcp/tests/eval/evalSem01QuantityAlignment.test.ts`
- `packages/hep-mcp/tests/eval/evalSem06EvidenceRetrieval.test.ts`
- `packages/hep-mcp/tests/research/stance.test.ts`
- `packages/hep-mcp/tests/research/stanceDetection.test.ts`

#### `NEW-RT-06`

- `packages/orchestrator/src/agent-runner.ts`
- `packages/orchestrator/src/types.ts`
- `packages/orchestrator/src/index.ts`
- `packages/orchestrator/tests/agent-runner.test.ts`

#### `NEW-DISC-01`

- `packages/shared/src/types/identifiers.ts`
- `packages/shared/src/types/paper.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/__tests__/`
- `packages/openalex-mcp/src/tools/registry.ts`
- `packages/arxiv-mcp/src/tools/registry.ts`
- `packages/hep-mcp/src/tools/registry/openalex.ts`
- `packages/hep-mcp/src/tools/registry/shared.ts`

### GitNexus

开始前按 `AGENTS.md` 约定：

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 读取 `.claude/skills/gitnexus/exploring/SKILL.md`
3. 用 GitNexus 理解：
   - `AgentRunner`
   - shared paper schema / provider registry wiring
   - `evidenceGrading` 与 Batch 10 语义模块的衔接

禁止未读即改。

---

## 2. 开工时的 tracker 协议（强制）

开始编码前更新 `meta/remediation_tracker_v1.json`：

- `NEW-SEM-02` → `in_progress`
- `NEW-RT-06` → `in_progress`
- `NEW-DISC-01` → 一旦 kickoff 真正开始，标记 `in_progress`
- `assignee` 填实际模型名

完成后：

- `NEW-SEM-02`：若验收全过，可标 `done`
- `NEW-RT-06`：若验收全过，可标 `done`
- `NEW-DISC-01`：**本批不要标 `done`**；若 D1/D2/D3 完成，保持 `in_progress`，note 写清已交付 kickoff 与剩余 D4/D5

若任一项阻塞：标 `blocked`，写明原因，不得静默跳过。

---

## 3. 全局硬约束

### A. 质量优先，不要回退到 heuristic authority

- `NEW-SEM-02` 的核心语义判断必须是 **LLM-first**，并走 MCP sampling / `ctx.createMessage` 路径。
- deterministic / lexical / regex 只能做：
  - parse guard
  - schema guard
  - cheap post-check
  - fail-closed fallback
- 禁止把 keyword catalog / regex pattern 升级成新的语义权威。

### B. 网络 / API 不是问题，不要引入伪 `local-only` 约束

- 这是自动研究工具，不是离线 demo。
- 如果联网 / API / sampling 能显著提升质量，应优先保质量。
- 只有 `REP` 的 publication-layer `RDI` 要求 local-computable；**这不约束本批实现**。

### C. `NEW-DISC-01` 只做 shared library，不得滑向新 MCP server

- v1 形态必须是 `packages/shared/src/discovery/` 下的 **in-process shared TS library**。
- 本批不得创建 `scholar-broker` MCP server。
- 本批只做 kickoff，不得虚报“federated discovery 已完成”。

### D. `NEW-RT-06` 只做 orchestrator plane

- 本批 routing 只覆盖 `@autoresearch/orchestrator` 的 `AgentRunner` 及其 backend selection。
- 不得扩展到 host-side MCP sampling routing（那是 `NEW-RT-07`）。
- 不得把 provider-specific 假设继续硬写在 `AgentRunner` 主体里。

### E. Batch 11 不得破坏后续主线

- 不得打乱既有 Batch 12–16 的 SEM lane。
- 不得把 `NEW-DISC-01` closeout 变成 `NEW-LOOP-01` 的硬阻塞；它应 ideally precede / overlap，但 runtime scaffolding 不是它的下游 blocker。
- `UX-06` 已完成；后续 loop 只复用其 taxonomy 作为 UX hints，不得误读成“要恢复线性 stage engine”。

### F. 模块化纪律（强制）

- 不要把新逻辑继续堆进大文件；优先按职责拆到 `src/core/semantics/`、`src/discovery/`、`src/backends/` 等子模块。
- `index.ts` 只做 export，不放业务逻辑。
- 禁止 `utils.ts` / `helpers.ts` 万能文件。

---

## 4. 工作面 A — `NEW-SEM-02`（本批主 gate item）

### 4.1 目标

建立 **claim → evidence → stance** 的权威结构化语义 SoT，供 Batch 12 (`NEW-SEM-03/04`) 与后续 conflict / stance / challenge 工作复用。

### 4.2 推荐落点

不要继续把所有逻辑塞回 `packages/hep-mcp/src/tools/research/evidenceGrading.ts`。优先采用：

- `packages/hep-mcp/src/core/semantics/claimTypes.ts`（新）
- `packages/hep-mcp/src/core/semantics/claimSampling.ts`（新）
- `packages/hep-mcp/src/core/semantics/claimExtraction.ts`（新）
- `packages/hep-mcp/src/core/semantics/evidenceClaimGrading.ts`（新）
- `packages/hep-mcp/src/tools/research/evidenceGrading.ts`（保留 tool-facing wrapper / wiring）
- `packages/hep-mcp/tests/eval/evalSem02EvidenceClaimGrading.test.ts`（新）
- `packages/hep-mcp/tests/eval/fixtures/sem02_evidence_claim_grading_eval.json`（新）
- `packages/hep-mcp/tests/eval/fixtures/sem02_evidence_claim_grading_holdout.json`（新）
- `packages/hep-mcp/tests/eval/baselines/sem02_evidence_claim_grading.baseline.json`（新）

### 4.3 必做要求

1. 语义调用统一走 `ctx.createMessage` / MCP sampling；参考 Batch 10 `quantityAdjudicator.ts` 的风格：
   - `prompt_version`
   - structured output parsing
   - provenance（backend / used_fallback / prompt_version / input_hash / model）
   - conservative fallback
2. 输出 schema 至少覆盖：
   - `claim_id`
   - `claim_text`
   - `evidence_id | evidence_ref`
   - `stance`
   - `confidence`
   - `reason_code`
   - `provenance`
   - `used_fallback`
3. 必须覆盖 hard cases：
   - negation
   - hedge / weak support
   - neutral / not-supported
   - conflicting evidence
   - same-topic-but-different-claim confusion
4. 不能把旧 `evidenceGrading.ts` 里的 keyword / pattern 直接升格成 authority；若保留旧逻辑，只能作为：
   - low-cost proposal / segmentation hints
   - fallback diagnostics
   - regression baseline
5. 与 Batch 10 对齐：
   - 字段风格与 `SEM-01` / `SEM-06a` 对齐
   - eval harness 复用 `tests/eval/`
   - 不要再发明一套平行 baseline / snapshot 机制

### 4.4 Eval 与 gate

必须提供：

- 标注 eval set
- locked holdout
- baseline
- target
- failure policy

至少报告：

- stance accuracy / macro-F1（或与 schema 对应的主指标）
- negation / hedge 子集指标
- abstention / fallback rate
- overall 与 hard-subset 分开报告

### 4.5 `NEW-SEM-02` 完成定义

- [ ] claim → evidence → stance 的结构化 schema 成为唯一 SoT
- [ ] MCP sampling 路径落地，且 parse / invalid / failure 走 fail-closed / conservative fallback
- [ ] eval / holdout / baseline / target 全部存在
- [ ] 新实现可直接为 Batch 12 (`NEW-SEM-03/04`) 提供稳定上游字段
- [ ] `pnpm --filter @autoresearch/hep-mcp test:eval`
- [ ] `pnpm --filter @autoresearch/hep-mcp test`
- [ ] `pnpm --filter @autoresearch/hep-mcp build`
- [ ] G3-ready 证据包可产出

---

## 5. 工作面 B — `NEW-DISC-01 kickoff`（D1 / D2 / D3）

### 5.1 本批只做 kickoff

本批完成：

- **D1**: `openalex_id` 进入 shared identifier foundation
- **D2**: provider capability schema 成为 shared SoT
- **D3**: discovery scaffold / planner contract

本批不做：

- D4 canonicalization / dedup / search-log artifact closeout
- D5 broker-level eval closeout
- 独立 discovery MCP server

### 5.2 推荐落点

- `packages/shared/src/types/identifiers.ts`
- `packages/shared/src/types/paper.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/discovery/`（新目录）
  - `capabilities.ts`
  - `query-intent.ts`
  - `provider-descriptor.ts`
  - `canonical-candidate.ts`
  - `planner.ts`
  - `index.ts`
- `packages/shared/src/__tests__/discovery-*.test.ts`（新）
- provider mapping（按实际需要最小修改）：
  - `packages/openalex-mcp/src/tools/registry.ts`
  - `packages/arxiv-mcp/src/tools/registry.ts`
  - `packages/hep-mcp/src/tools/registry/openalex.ts`
  - `packages/hep-mcp/src/tools/registry/shared.ts`

### 5.3 必做要求

1. **只加 `openalex_id`** 作为本批 shared identifier 扩展。  
   - 不要顺手扩 scope 加一堆新 ID。  
   - `semantic_scholar_id` 不是本批必需项。
2. capability schema 必须在 shared 层定义，provider 仅做映射，不得各自再造结构。
3. discovery scaffold 必须是 library contract，不直接注册工具，不直接引入 MCP sampling。
4. 设计要为 Batch 13–14 的 canonicalization / dedup / search-log 留清晰接口，但本批不实现这些 closeout 功能。
5. 导出路径保持清晰：`@autoresearch/shared` 或其子路径可稳定消费 discovery contract。

### 5.4 `NEW-DISC-01 kickoff` 完成定义

- [ ] `PaperIdentifiersSchema` / `PaperSummarySchema` 支持 `openalex_id`
- [ ] shared tests 覆盖新增 identifier 字段
- [ ] provider capability schema 在 `packages/shared/src/discovery/` 或等价 shared 位置成为唯一 SoT
- [ ] `packages/shared/src/discovery/` 存在可编译 scaffold（intent / provider descriptor / canonical candidate / planner contract）
- [ ] provider packages 只做 capability mapping，不发明新 capability shape
- [ ] `pnpm --filter @autoresearch/shared test`
- [ ] `pnpm --filter @autoresearch/shared build`

### 5.5 Tracker 期望结果

- `NEW-DISC-01` 在本批结束后应为 `in_progress`
- note 至少写明：D1/D2/D3 已完成；D4/D5 留到 Batch 13–14

---

## 6. 工作面 C — `NEW-RT-06`（本批建议完整关闭）

### 6.1 目标

把 `AgentRunner` 从 Anthropic-shaped runtime 改成 **provider-agnostic backend + JSON route key**，同时保留现有：

- lane queue
- approval gate
- tracing
- MCP dispatch
- `_messagesCreate` test seam

### 6.2 推荐落点

- `packages/orchestrator/src/agent-runner.ts`
- `packages/orchestrator/src/types.ts`
- `packages/orchestrator/src/index.ts`
- `packages/orchestrator/src/backends/`（新目录）
  - `chat-backend.ts`
  - `anthropic-backend.ts`
  - `backend-factory.ts`
- `packages/orchestrator/src/routing/`（新目录）
  - `schema.ts`
  - `loader.ts`
  - `types.ts`
- `packages/orchestrator/tests/agent-runner.test.ts`

### 6.3 必做要求

1. `AgentRunner` 本体不再直接 lazy import `@anthropic-ai/sdk`。
2. provider SDK 必须下沉到 backend adapter / factory。
3. `model` 不再被当作 provider-specific assumption；改为 route key / backend selector。
4. routing registry 必须：
   - JSON-configured
   - 有 schema 校验
   - unknown route / invalid config / unknown backend 时 fail-closed
5. 不得把 host-side MCP sampling routing 混进本批实现。
6. 若引入新配置键，必须按 CFG-01 注册并有验证。

### 6.4 `NEW-RT-06` 完成定义

- [ ] `ChatBackend` / backend factory 存在
- [ ] Anthropic adapter 存在，默认路径行为不回退
- [ ] `AgentRunner` 不再直接依赖 provider SDK
- [ ] routing registry 有 schema 校验、默认 route、fail-closed
- [ ] `packages/orchestrator/tests/agent-runner.test.ts` 覆盖 route resolution / fail-closed / lane queue / approval / tracing 回归
- [ ] `pnpm --filter @autoresearch/orchestrator test`
- [ ] `pnpm --filter @autoresearch/orchestrator build`

### 6.5 Tracker 期望结果

- 若验收全过，`NEW-RT-06` → `done`
- note 必须明确：
  - routing 只覆盖 orchestrator plane
  - `NEW-RT-07` 仍保留给 host-side MCP sampling routing

---

## 7. 推荐实施顺序

1. **先做 `NEW-DISC-01` D1/D2**  
   - 先把 shared identifiers / capability SoT 打稳，避免后续接口回滚。
2. **再做 `NEW-RT-06`**  
   - 这是 Batch 11 的基础 runtime 项，做完后能稳定后续模型/后端解耦。
3. **最后做 `NEW-SEM-02`**  
   - 本批主 gate item，放在后段统一跑 eval / holdout / regression 最稳。

如果上下文 / 时间冲突，硬优先级为：

1. `NEW-SEM-02`
2. `NEW-RT-06`
3. `NEW-DISC-01 kickoff`

但本批的目标仍是三者都交付。

---

## 8. 总验收命令

```bash
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/orchestrator test
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp build
```

若有既有失败：

- 必须明确区分“既有失败”与“本批引入失败”
- 禁止删测过关
- 禁止以“看起来对了”代替验证

---

## 9. Review-Swarm（如执行）

本批实现审核若执行，使用：

- `Opus`
- `OpenCode(kimi-for-coding/k2p5)`

审核问题至少覆盖：

1. `NEW-SEM-02` 是否真正建立 claim → evidence → stance 的结构化语义 SoT，而不是 regex authority 换皮
2. `NEW-RT-06` 是否严格停留在 orchestrator plane，没有污染 `NEW-RT-07`
3. `NEW-DISC-01 kickoff` 是否坚持 library-first，没有滑向新 MCP server
4. 本批接口是否为 Batch 12 / Batch 13–14 / Batch 15–16 保留稳定扩展点

收敛规则按 `AGENTS.md`：两模型 `0 blocking` 才可过关。

---

## 10. 交付后必须同步

1. 更新 `meta/remediation_tracker_v1.json`
2. 如有必要，同步 `meta/REDESIGN_PLAN.md` 的 batch/checklist 状态
3. 更新 `.serena/memories/architecture-decisions.md`
4. 若批次状态摘要变化，更新 `AGENTS.md`
5. 记录：
   - 本批哪些 amendments 被采纳
   - 哪些未采纳，以及理由

---

## 11. 不要做的事

- 不要把 `NEW-DISC-01` 做成 discovery MCP server
- 不要把 `NEW-RT-06` 做成全系统 routing 重写
- 不要把 `NEW-SEM-02` 做成旧 `evidenceGrading.ts` 的 keyword 补丁集
- 不要顺手启动 `NEW-SEM-06-INFRA`、`NEW-RT-07` 或 `NEW-LOOP-01`
- 不要引入“local-only because reproducible”这类错误硬约束到 near-term runtime / retrieval / grading
- 不要破坏 Batch 12–19 的既定排期语义
