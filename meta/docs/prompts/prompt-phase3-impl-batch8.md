# Phase 3 Implementation Batch 8: NEW-RT-05 — Eval Framework

> **前置条件**: Phase 3 Batch 7 (NEW-SKILL-WRITING + NEW-CONN-05) 已完成并通过 review-swarm 收敛（R3, 0 BLOCKING from Codex + Gemini）。
> **SEM Track 起点**: 本 batch 是语义理解质量轨 (SEM track, Batch 8~16) 的 P0 基础设施。无此框架则无法度量 baseline、验证后续 SEM-01~13 的改进。
>
> **SOTA 原则（适用于本 batch 及后续所有 SEM track batch）**: 实现前**必须联网调研**当前最新的最佳实践、框架、算法。若发现成熟的外部框架/库能提升质量，可以引入或借鉴，不应预设"自建"。决策依据和调研结论记录在实现过程中。参见 `CLAUDE.md` §SOTA 原则。

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。


## 范围

本批次实现 1 个 Phase 3 item：

1. **NEW-RT-05**: Eval Framework — Agent-level 端到端评估框架 (~500 LOC)

---

## 前置步骤

### 1. 读取 Serena memory，确认是否最新

用 `serena:list_memories` 列出所有记忆文件，然后读取与本批次相关的记忆：

- `architecture-decisions` — 跨组件设计决策（SEM track batch split、quality gates G1-G5）
- `task-completion-checklist` — 交付流程检查清单
- `codebase-gotchas` — 代码库陷阱（TypeScript 构建、Zod SSOT 约定、vitest 配置）

确认各记忆文件与 git log 的实际状态一致；若发现过时条目，先更新后再开始实现。

### 2. 前置确认

- 确认 `meta/REDESIGN_PLAN.md` 中 NEW-RT-01 和 NEW-RT-03 均已标记为 ✅（NEW-RT-05 的依赖）
- 确认 `meta/remediation_tracker_v1.json` 中 NEW-RT-01 和 NEW-RT-03 的 `status` 均为 `"done"`
- 确认 Phase 3 Batch 7 已完成

### 3. 理解现有 eval 基础设施

当前 `packages/hep-mcp/tests/eval/` 已有：

| 文件 | 内容 |
|------|------|
| `evalSnapshots.ts` | `readEvalFixture<T>()` + `assertEvalSnapshot()` 工具函数 |
| `evalRetrieval.test.ts` | Recall@k / MRR@k 指标计算 + evidence retrieval 评测 |
| `evalEvidence.test.ts` | Evidence 质量评测 |
| `evalDataset.test.ts` | Dataset export 评测 |
| `evalE2E.test.ts` | 端到端评测 |
| `evalCoverage.test.ts` | Coverage report 评测 |
| `fixtures/` | 评测用 fixtures（JSON） |
| `snapshots/` | Baseline snapshots（JSON） |

**现有问题**：
- 无统一的 eval harness — 每个 test 文件自行管理 setup/teardown/metrics
- 无标准化的 eval set 格式 — fixture 结构各不相同
- 无 baseline comparison 机制 — `assertEvalSnapshot` 仅做 exact match，不支持 metric delta 比较
- 无 eval 运行报告 — 结果散落在 vitest 输出中，无法追踪历史趋势

**脚本**：
- `pnpm test:eval` — 运行 eval 测试
- `pnpm test:eval:update` — 更新 baseline snapshots (`EVAL_UPDATE_SNAPSHOTS=1`)

---

## Item 1: NEW-RT-05 — Eval Framework

### 目标

构建一个轻量级但标准化的 eval 框架，满足 SEM track 所有 item 的度量需求：

1. **标准化 eval set 格式** — 统一的输入/期望输出/标注 schema
2. **自动化 eval runner** — 可定义评估场景并自动运行
3. **指标计算库** — 通用指标（P/R/F1/Accuracy/MRR/Recall@k）+ 自定义指标接口
4. **Baseline 管理** — 记录/比较 baseline，支持 delta 检测
5. **报告生成** — eval 结果可追踪到具体场景 + 可输出结构化报告

### 设计原则

1. **SOTA 导向**：实现前先联网调研当前主流 eval 框架（如 promptfoo、deepeval、braintrust 等）的最新能力和最佳实践。若有成熟框架能直接满足需求（fixture-driven eval、metric computation、baseline tracking），可直接引入或借鉴其设计；若均不贴合 SEM track 的特定需求（如 MCP tool-level eval、HEP 领域特定指标），则自建。决策依据记录在实现 PR 中。
2. **渐进式**：在现有 `tests/eval/` 结构上扩展，不重写已有 eval 测试。
3. **Fixture-driven**：eval set 以 JSON fixture 文件为 SSOT（Single Source of Truth），非代码内定义。
4. **Fixture-first**：大部分 eval case 使用预制 fixture（本地化、可重复）。需要网络的 eval（如端到端 evidence retrieval）不禁止，但应标记为 `online` tag 以便按需跳过。
5. **与 vitest 集成**：eval 以 vitest test case 形式运行，享受 vitest 的并行化、watch mode、filter 等。

### 实现计划

#### Step 1: Eval Set Schema（~80 LOC）

定义统一的 eval set schema（Zod），所有 SEM-01~13 的 eval set 遵循同一结构。

**文件**: `packages/hep-mcp/src/eval/schema.ts`

```typescript
// Eval set 统一 schema
export const EvalCaseSchema = z.object({
  id: z.string(),                    // 唯一标识
  input: z.unknown(),                // 评测输入（由具体 eval set 定义子 schema）
  expected: z.unknown(),             // 期望输出
  tags: z.array(z.string()).default([]),  // 标签（"hard-case", "negation", "hedging" 等）
  metadata: z.record(z.unknown()).optional(), // 附加元数据
});

export const EvalSetSchema = z.object({
  name: z.string(),                  // eval set 名称
  version: z.number().int().positive(), // 版本号
  description: z.string(),           // 描述
  module: z.string(),                // 对应的 SEM module ID（如 "SEM-01"）
  cases: z.array(EvalCaseSchema).min(1),
});
```

注意：`input` 和 `expected` 是 `z.unknown()`，由各 SEM item 的 eval set 在使用时提供子 schema 进行二次校验。这允许统一的 runner 处理不同类型的 eval，同时保持各 eval set 的类型安全。

#### Step 2: 指标计算库（~120 LOC）

提取/统一现有散落的指标计算，提供标准接口。

**文件**: `packages/hep-mcp/src/eval/metrics.ts`

```typescript
// 分类指标
export function precision(tp: number, fp: number): number;
export function recall(tp: number, fn: number): number;
export function f1(p: number, r: number): number;
export function accuracy(correct: number, total: number): number;

// 排序指标（现有 evalRetrieval.test.ts 中 inline 定义的 → 提取）
export function recallAtK(ranks: Array<number | null>, k: number): number;
export function mrrAtK(ranks: Array<number | null>, k: number): number;
export function precisionAtK(ranks: Array<number | null>, k: number): number;

// 校准指标（SEM track 需要的）
export function abstentionRate(results: Array<{ abstained: boolean }>): number;
export function fallbackRate(results: Array<{ usedFallback: boolean }>): number;

// 泛型 metric 接口
export type MetricFn<T> = (results: T[]) => number;
```

现有 `evalRetrieval.test.ts` 中的 `computeRecallAtK` 和 `computeMrrAtK` 应改为导入自 `metrics.ts`（不删除原实现，改为 re-export 包装，保持向后兼容——但因无外部用户，可直接改导入路径）。

#### Step 3: Eval Runner（~150 LOC）

统一的 eval 执行器，读取 eval set fixture、执行评测函数、收集指标、输出报告。

**文件**: `packages/hep-mcp/src/eval/runner.ts`

```typescript
export type EvalResult<TOutput = unknown> = {
  caseId: string;
  input: unknown;
  expected: unknown;
  actual: TOutput;
  metrics: Record<string, number>;
  tags: string[];
  passed: boolean;       // 由 judge 函数判定
  durationMs: number;
};

export type EvalReport = {
  evalSetName: string;
  module: string;
  timestamp: string;
  aggregateMetrics: Record<string, number>;
  caseResults: EvalResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
};

export type EvalConfig<TInput, TOutput> = {
  /** 执行函数: input → output */
  run: (input: TInput) => Promise<TOutput>;
  /** 判定函数: (expected, actual) → { passed, metrics } */
  judge: (expected: unknown, actual: TOutput, evalCase: EvalCase) => {
    passed: boolean;
    metrics: Record<string, number>;
  };
  /** 聚合指标函数: case results → aggregate metrics */
  aggregate?: (results: EvalResult<TOutput>[]) => Record<string, number>;
};

/** 运行一个 eval set，返回结构化报告 */
export async function runEvalSet<TInput, TOutput>(
  evalSet: EvalSet,
  config: EvalConfig<TInput, TOutput>,
): Promise<EvalReport>;
```

#### Step 4: Baseline 管理（~80 LOC）

扩展现有 snapshot 机制，支持 metric delta 比较（不仅是 exact match）。

**文件**: `packages/hep-mcp/src/eval/baseline.ts`

```typescript
export type BaselineRecord = {
  evalSetName: string;
  module: string;
  timestamp: string;
  metrics: Record<string, number>;
  evalSetVersion: number;
};

/**
 * 保存 baseline（当 EVAL_UPDATE_BASELINES=1 时）
 */
export function saveBaseline(report: EvalReport, baselineDir: string): void;

/**
 * 加载最近一次 baseline
 */
export function loadBaseline(evalSetName: string, baselineDir: string): BaselineRecord | null;

/**
 * 比较当前报告与 baseline，返回 delta
 */
export function compareWithBaseline(
  report: EvalReport,
  baseline: BaselineRecord | null,
): {
  deltas: Record<string, { baseline: number; current: number; delta: number; improved: boolean }>;
  isFirstRun: boolean;
};
```

Baseline 存储在 `packages/hep-mcp/tests/eval/baselines/` 目录下，以 `{evalSetName}.baseline.json` 命名。

#### Step 5: Demo Eval Set（~70 LOC）

创建一个 demo eval set 用于验收 G1 gate（"至少 1 个 demo eval set"）。基于现有 `retrieval_cases.json` 构建，证明整个 pipeline 可运行。

**文件**: `packages/hep-mcp/tests/eval/fixtures/demo_retrieval_eval.json`

这个 demo eval set 遵循 Step 1 定义的 `EvalSetSchema`，包含 ≥10 个 case，覆盖：
- 正常检索（evidence 存在，rank ≤ 10）
- 困难检索（相似但不匹配的 evidence）
- 空结果（query 与任何 evidence 都不相关）

**测试文件**: `packages/hep-mcp/tests/eval/evalFramework.test.ts`

```typescript
describe('eval framework: demo retrieval eval set', () => {
  it('loads and validates demo eval set against EvalSetSchema', ...);
  it('runs demo eval set through runner and produces EvalReport', ...);
  it('computes aggregate metrics (recall@10, MRR@10)', ...);
  it('saves and loads baseline', ...);
  it('compares with baseline and detects delta', ...);
});
```

### 目录结构

```
packages/hep-mcp/
├── src/eval/
│   ├── index.ts          # barrel export
│   ├── schema.ts         # EvalSetSchema, EvalCaseSchema
│   ├── metrics.ts        # precision, recall, F1, recallAtK, mrrAtK, ...
│   ├── runner.ts         # runEvalSet(), EvalConfig, EvalReport
│   └── baseline.ts       # saveBaseline, loadBaseline, compareWithBaseline
├── tests/eval/
│   ├── evalSnapshots.ts  # (existing, unchanged)
│   ├── evalRetrieval.test.ts  # (existing, refactor: import metrics from src/eval/metrics)
│   ├── evalEvidence.test.ts   # (existing, unchanged initially)
│   ├── evalDataset.test.ts    # (existing, unchanged initially)
│   ├── evalE2E.test.ts        # (existing, unchanged initially)
│   ├── evalCoverage.test.ts   # (existing, unchanged initially)
│   ├── evalFramework.test.ts  # (new: framework integration tests)
│   ├── fixtures/
│   │   ├── *.json             # (existing fixtures)
│   │   └── demo_retrieval_eval.json  # (new: demo eval set)
│   └── baselines/
│       └── demo_retrieval.baseline.json  # (generated by EVAL_UPDATE_BASELINES=1)
```

### 不做的事情

- **不引入 LLM-as-judge**：Batch 8 只建 harness。LLM-based judging 随各 SEM item 按需添加。
- **现有 eval 测试应迁移到新框架**：`evalRetrieval.test.ts` 等现有 eval 使用 ad-hoc 结构，应改写为基于新框架的统一模式。项目无向后兼容负担，不需要保留旧模式。
- **不建 eval dashboard/UI**：报告为 JSON 文件 + vitest 输出，够用即可。
- **不建 CI 自动 eval**：后续 SEM batch 按需决定是否加 CI 集成。

---

## 验收检查点

- [ ] `packages/hep-mcp/src/eval/schema.ts` 定义 `EvalSetSchema` + `EvalCaseSchema`（Zod SSOT）
- [ ] `packages/hep-mcp/src/eval/metrics.ts` 提供标准指标函数（P/R/F1/Accuracy/recallAtK/mrrAtK/abstentionRate/fallbackRate）
- [ ] `packages/hep-mcp/src/eval/runner.ts` 提供 `runEvalSet()` — 读取 eval set、执行、收集指标、生成 `EvalReport`
- [ ] `packages/hep-mcp/src/eval/baseline.ts` 提供 baseline 保存/加载/比较功能
- [ ] `packages/hep-mcp/tests/eval/fixtures/demo_retrieval_eval.json` 遵循 `EvalSetSchema`（≥10 cases）
- [ ] `packages/hep-mcp/tests/eval/evalFramework.test.ts` 覆盖：schema 校验、runner 执行、指标计算、baseline 管理
- [ ] 现有 eval 测试（`evalRetrieval`、`evalEvidence`、`evalDataset`、`evalE2E`、`evalCoverage`）迁移到新框架（`EvalSetSchema` + `runEvalSet()`）
- [ ] `pnpm -r test` 全部通过（现有 eval 测试不破坏）
- [ ] `pnpm -r build` 通过（TypeScript 编译无错误）
- [ ] G1 gate 满足："eval framework 可用 + 至少 1 个 demo eval set"

---

## Review-Swarm 审核

完成实现后，执行双模型审核：

```bash
python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/phase3-batch8-r1-review \
  --system ~/.autoresearch-lab-dev/batch-reviews/phase3-batch8-review-system.md \
  --prompt ~/.autoresearch-lab-dev/batch-reviews/phase3-batch8-review-r1.md
```

审核重点：
1. Eval schema 是否足够灵活以支撑后续 SEM-01~13 的不同 eval 需求
2. Runner 是否正确处理异步 eval 函数 + 错误/超时
3. Baseline 比较逻辑是否正确（delta 计算、first-run 处理）
4. Demo eval set 是否有代表性（覆盖正常/困难/空结果场景）
5. Metrics 提取是否完整（确认现有 eval 测试不破坏）

---

## 交付

1. 实现代码
2. 通过 review-swarm 收敛（0 BLOCKING from both models）
3. 更新 `meta/remediation_tracker_v1.json` — NEW-RT-05 status → "done"
4. 更新 `meta/REDESIGN_PLAN.md` — NEW-RT-05 标记 ✅
5. 更新 Serena memory（如有新的架构决策或 codebase gotchas）
6. 生成下一个 batch prompt: `prompt-phase3-impl-batch9.md`（NEW-SEM-07）
