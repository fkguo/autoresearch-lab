# Phase 3 Implementation Batch 13: `NEW-SEM-05` + `NEW-SEM-09`

> **状态**: 基于 `v1.9.2-draft` 规划、Batch 12（`NEW-SEM-03` + `NEW-SEM-04` + `NEW-SEM-06-INFRA`）已完成并经 `Opus + OpenCode(kimi-for-coding/k2p5)` 代码双审 `0 blocking` 后的执行 prompt。  
> **前置条件**: Batch 10（`NEW-SEM-01` + `NEW-SEM-06a`）✅、Batch 11（`NEW-SEM-02` + `NEW-RT-06`）✅、Batch 12（`NEW-SEM-03` + `NEW-SEM-04` + `NEW-SEM-06-INFRA`）✅。`NEW-DISC-01` 仍为 kickoff / `in_progress`（D1/D2/D3 ✅，D4/D5 仍待 Batch 13–14 closeout）。  
> **本批目标**: 保持既有 SEM lane 节奏，完成 `NEW-SEM-05` + `NEW-SEM-09`，为后续 `NEW-SEM-12` 和 deeper synthesis/analysis work 提供统一分类与 section-role semantic substrate。

> **作用域澄清**: 本 prompt 只覆盖 **SEM lane 的 Batch 13 主线**。`NEW-RT-07` 与 `NEW-DISC-01` D4/D5 closeout 仍属于 Batch 13–14 的 parallel infra lane，但**不在本 prompt 内联启动**；除非人类另行下达独立 prompt，不得把 host-side routing 或 discovery closeout 顺手并入本批。

---

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。


## 0. 执行定位

这是一个 **双工作面 batch**：

1. **`NEW-SEM-05`** — `Hybrid Paper/Review/Content Classifier`  
   - 本批主 gate item；目标是把当前分散在 `paperClassifier.ts` / `reviewClassifier.ts` / `criticalQuestions.ts` 的关键词驱动分类逻辑，提升为 **统一的、LLM-first + metadata-prior backed 分类 SoT**，供后续 `NEW-SEM-12` 复用。
2. **`NEW-SEM-09`** — `Deep Analysis Section Role Classifier`  
   - 本批配套完成项；目标是把 `deepAnalyze.ts` 中对 introduction/methodology/results/discussion/conclusions 的 heading-keyword 推断，提升为 **section-role semantic labeling**，要求不依赖 heading 关键词作为唯一权威。

---

## 1. 开工前必须读取

### 治理 / 规划

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-SEM-05`
   - `NEW-SEM-09`
   - Batch 13–19 lane 排期
   - `NEW-DISC-01` closeout / `NEW-RT-07` / `NEW-SEM-06b` 的边界说明
4. `meta/docs/sota-monorepo-architecture-2026-03-06.md`
5. `.serena/memories/architecture-decisions.md`
6. `.serena/memories/codebase-gotchas.md`（若存在）

### 代码 / 测试（必须读）

#### `NEW-SEM-05`

- `packages/hep-mcp/src/tools/research/reviewClassifier.ts`
- `packages/hep-mcp/src/tools/research/paperClassifier.ts`
- `packages/hep-mcp/src/tools/research/criticalQuestions.ts`
- `packages/hep-mcp/src/tools/research/criticalResearch.ts`
- `packages/hep-mcp/src/tools/research/traceSource.ts`
- `packages/hep-mcp/src/tools/research/fieldSurvey.ts`
- `packages/hep-mcp/src/tools/research/seminalPapers.ts`
- `packages/hep-mcp/src/tools/registry/inspireSchemas.ts`
- `packages/hep-mcp/src/tools/registry/inspireSearch.ts`
- `packages/hep-mcp/tests/tools.test.ts`
- `packages/hep-mcp/tests/limits/limitsRegression.test.ts`

#### `NEW-SEM-09`

- `packages/hep-mcp/src/tools/research/deepAnalyze.ts`
- `packages/hep-mcp/src/tools/research/deepResearch.ts`
- `packages/hep-mcp/src/tools/research/synthesizeReview.ts`
- `packages/hep-mcp/src/tools/research/synthesis/grouping.ts`
- `packages/hep-mcp/src/tools/research/synthesis/narrative.ts`
- `packages/hep-mcp/tests/tools.test.ts`
- `packages/hep-mcp/tests/research/latex/parserHarness.test.ts`
- `packages/hep-mcp/tests/research/latex/multiFileSourceMap.test.ts`
- `packages/hep-mcp/tests/research/latex/equationExtractor.macroWrapped.test.ts`

> **注意**: 当前 `NEW-SEM-05` / `NEW-SEM-09` 缺少足够直接的专项 eval/tests。若验收命令所需测试尚不存在，必须先创建，再实施，再验证；禁止“没有测试就只看代码感觉正确”。

### GitNexus

开始前按 `AGENTS.md` 约定：

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 读取 `.claude/skills/gitnexus/exploring/SKILL.md`
3. 用 GitNexus 理解：
   - `classifyReviews`
   - `classifyPaper` / `classifyPapers`
   - `deepAnalyze`
   - 它们各自的调用方（`criticalResearch`, `deepResearch`, `synthesizeReview`, `traceSource`, `fieldSurvey`, `seminalPapers` 等）

禁止未读即改。

---

## 2. tracker 开工要求

开始实现前先更新 `meta/remediation_tracker_v1.json`：

- `NEW-SEM-05` → `in_progress`
- `NEW-SEM-09` → `in_progress`
- `assignee` 填当前实际模型

若本批完成并验证通过：

- `NEW-SEM-05` / `NEW-SEM-09` → `done`
- note 必须写明：
  - 验收命令
  - 是否跑了实现代码双审
  - `NEW-RT-07` / `NEW-DISC-01` D4/D5 **未在本 prompt 中启动**
  - `NEW-SEM-12` 将复用哪一个统一分类锚点
  - 锁定的 eval baseline / fixture artifact 路径

若任一项阻塞：标 `blocked`，写明原因，不得静默跳过。

---

## 3. 工作面 A — `NEW-SEM-05`（本批主 gate item）

### 3.1 目标

把当前 paper/review/content 相关分类逻辑提升为 **统一分类器 (single authority classifier)**：

- 替代分散在 `paperClassifier.ts` / `reviewClassifier.ts` / `criticalQuestions.ts` 的 drift-prone keyword catalogs
- 使用 **metadata priors + LLM adjudication** 做主判定
- 保持 deterministic 逻辑只做 prior / hint / fallback / observable diagnostics
- 统一输出分类 SoT，供 `criticalResearch`, `traceSource`, `fieldSurvey`, `seminalPapers`, `NEW-SEM-12` 等复用

### 3.2 必做要求

1. **LLM-first + single authority** 是硬要求：
   - 不能继续让 `paperClassifier.ts` 与 `reviewClassifier.ts` 各自维护独立 authority。
   - `criticalQuestions.ts` 里的 paper-type 判定不得继续与统一分类器平行演化。
2. 不得把旧 keyword catalog 直接升级成新权威；关键词只能做：
   - metadata priors
   - cheap routing / prefilter
   - fallback diagnostics
3. 必须显式处理：
   - terminology drift（标题不写 “review” 但实际是 review / survey / report）
   - review-like title hard cases：如 `Status of ...` / `Progress in ...` / `Introduction to ...` / `Lectures on ...` / `Snowmass ...` / `White Paper ...`
   - misleading title hard cases：如标题含 `Critique of ...` 但实际更接近 consensus report / broad assessment
   - conference / review / primary-research 的边界情况
   - experimental / theoretical / mixed / methodological content distinction
   - authoritative consensus source vs ordinary review 的区分
4. 所有新增的 LLM 语义判定 **必须** 走 MCP sampling（`ctx.createMessage` 或等价 `ToolHandlerContext` 路径）：
   - 禁止在 MCP server 内嵌 provider SDK/client（OpenAI / Anthropic / Gemini 等）直接调用
   - implementor 必须显式把 sampling context 透传到 unified classifier
5. 若新增 schema / prompt version / metadata，必须复用现有 MCP sampling metadata 模式：
   - `module`
   - `prompt_version`
   - `used_fallback`
   - `input_hash`
   - `model`
6. 调用方迁移策略必须直接、干净：
   - 不要为了“兼容”而保留多套死 API surface / shim layer
   - 如需引入 unified classifier core，应直接把现有调用方迁移到同一权威入口，并确保所有调用点编译通过、测试通过
   - wrapper 仅可作为短期 tool-facing 适配层，不能保留平行 authority
7. 模块化纪律：
   - 不要继续把所有逻辑堆进现有巨型文件
   - 优先拆出 `src/core/semantics/` 或 `src/tools/research/classification/` 下的小模块
   - 单文件仍应尽量遵守 200 LOC 硬限制

### 3.3 完成定义

- [ ] paper/review/content 分类存在**单一权威 SoT**，不再多处平行漂移
- [ ] `criticalQuestions.ts` 不再拥有与主分类器冲突的独立 authority
- [ ] terminology drift / review-like / consensus-like / mixed-content hard cases 有测试或 eval fixture
- [ ] fallback / abstention / uncertainty 在结果或 eval 中可见
- [ ] 为 `NEW-SEM-12` 复用保留稳定锚点（类型、字段或模块）

### 3.4 Eval / 验收要求

必须新增并锁定最小可审计评测面（若当前不存在则创建）：

- `tests/eval/evalSem05UnifiedClassifier.test.ts`（建议新建）
- `tests/eval/fixtures/sem05/` 下的最小 labeled fixture / holdout
- `tests/eval/baselines/` 下的 locked baseline（命名与现有 eval plane 对齐）

至少报告：

- review / non-review 主分类指标
- consensus-vs-ordinary-review 子集指标
- content role（experimental / theoretical / mixed / method-like）子集指标
- fallback rate / abstention-like rate

---

## 4. 工作面 B — `NEW-SEM-09`

### 4.1 目标

把 `deepAnalyze.ts` 中对章节角色的识别，从 **heading keyword lookup** 提升为 **section-role semantic labeling**：

- 基于 heading + content 共同判断 section role
- 为 `introduction` / `methodology` / `results` / `discussion` / `conclusions` 提供更稳健的语义识别
- 明确 `other` / `uncertain` 路径，避免强行贴标签

### 4.2 必做要求

1. **LLM-first semantic role labeling** 是硬要求：
   - heading 关键词只能做候选提议 / fallback / diagnostics
   - 不得继续以 `METHODOLOGY_KEYWORDS` / `RESULTS_KEYWORDS` / `DISCUSSION_KEYWORDS` 作为唯一 authority
2. 所有新增的 LLM section-role 判定 **必须** 走 MCP sampling（`ctx.createMessage` 或等价 `ToolHandlerContext` 路径）：
   - 禁止在 MCP server 内嵌 provider SDK/client（OpenAI / Anthropic / Gemini 等）直接调用
   - 需要明确 sampling context 如何从 tool handler 透传到 role labeler
3. 必须显式处理：
   - 标题模糊但内容明确的 section
   - `Results and Discussion` / `Summary and Outlook` / `Model and Formalism` 等混合标题
   - 无标准标题但有明确方法/结论语义的 section
   - 需要读 section 实际内容，而不是只看 heading
   - 根本不应映射到现有五类的 section（必须能输出 `other` / `uncertain`）
4. 对 combined-role sections（如 `Results and Discussion`），必须明确策略：
   - 要么输出稳定的 combined-role internal label，并在映射回现有输出时说明选择规则
   - 要么允许一段内容贡献给多个现有槽位，但规则必须可审计、可测试
5. 不得顺手重写 `deepAnalyze.ts` 中无关的 equation / theorem / include-resolution 逻辑。
6. 结果必须**映射回现有 deepAnalyze 输出结构**，除非有强理由扩展并保持兼容：
   - `introduction`
   - `methodology`
   - `results`
   - `discussion`
   - `conclusions`
7. 若新增 section-role core 模块，优先放在独立小文件，不要把 semantic adjudication 继续塞进 `deepAnalyze.ts`。

### 4.3 完成定义

- [ ] section role 标注不再依赖 heading 关键词作为唯一 authority
- [ ] introduction / methodology / results / discussion / conclusions / other-or-uncertain hard cases 有测试或 eval fixture
- [ ] `deepResearch.ts` / `synthesizeReview.ts` / synthesis consumers 与新语义标签边界清晰
- [ ] 现有 `deepAnalyze` 输出 shape 保持兼容或有明确迁移说明

### 4.4 Eval / 验收要求

必须新增并锁定最小 section-role eval slice（若当前不存在则创建）：

- `tests/eval/evalSem09SectionRoleClassifier.test.ts`（建议新建）
- `tests/eval/fixtures/sem09/` 下的最小 labeled fixture / holdout
- `tests/eval/baselines/` 下的 locked baseline（命名与现有 eval plane 对齐）

至少报告：

- role precision / recall（或 macro-F1）
- ambiguous-heading 子集指标
- heading-misleading / content-clear 子集指标
- abstention / fallback rate

---

## 5. 推荐实施顺序

1. **先做 `NEW-SEM-05`**
2. **再做 `NEW-SEM-09`**
3. **最后统一补齐 eval / holdout / baseline / targeted regressions**

若上下文冲突，优先级为：

1. `NEW-SEM-05`
2. `NEW-SEM-09`

---

## 6. 总验收命令

```bash
pnpm --filter @autoresearch/hep-mcp test:eval
pnpm --filter @autoresearch/hep-mcp test
pnpm --filter @autoresearch/hep-mcp build
```

- `test:eval` 是本批主 gate；若没有 `evalSem05*` / `evalSem09*` 对应 eval 测试与 fixture，则本批不得标记完成。
- 若 `test:eval` script 在目标 package 中不存在，必须先按 `NEW-RT-05` / 现有 eval plane 模式补齐，再实施本批。
- 若新增 shared / schema 层代码并触及其他 package，再补跑对应 package 的 test/build。

---

## 7. Review-Swarm（如执行）

若本批做实现审核，继续使用：

- `Opus`
- `OpenCode(kimi-for-coding/k2p5)`

> **说明**: 这里延续 Batch 11–12 的 SEM lane 实现审核组合，以便同类语义批次的 review 口径保持可比；这是对通用 review-matrix 的有意局部覆盖，不表示全仓库默认组合已变更。

审核问题至少覆盖：

1. `NEW-SEM-05` 是否真正形成 **single authority LLM-first unified classifier**，而不是多个 keyword classifier 的换皮拼装
2. `NEW-SEM-05` 是否把 review / paper / content / critical-questions 的分类漂移真正收敛到一个共享锚点
3. `NEW-SEM-09` 是否真正摆脱 heading keyword authority，并保留 `other` / `uncertain` 路径
4. 本批是否保持 Batch 13–19 lane 顺序，没有顺手启动 `NEW-RT-07` / `NEW-DISC-01` closeout / `NEW-SEM-06b`

---

## 8. 交付后必须同步

1. 更新 `meta/remediation_tracker_v1.json`
2. 更新 `.serena/memories/architecture-decisions.md`
3. 若进度摘要有变化，更新 `AGENTS.md`
4. 记录：
   - 采用了哪些 review amendments
   - 哪些 deferred，以及原因
   - `NEW-SEM-12` 将如何复用 `NEW-SEM-05`

---

## 9. 不要做的事

- 不要把 `NEW-SEM-05` 做成“旧 keyword 目录 + 少量 prompt 包装”的 hybrid 幻觉实现
- 不要继续让 `paperClassifier.ts` / `reviewClassifier.ts` / `criticalQuestions.ts` 分别演化自己的 authority
- 不要把 `NEW-SEM-09` 简化成 heading 关键词表的扩容版
- 不要顺手重写 `deepAnalyze.ts` 的 equation / theorem / LaTeX parsing 子系统
- 不要把 `NEW-RT-07`、`NEW-DISC-01` D4/D5、`NEW-SEM-06b` 拉进本批
- 不要破坏 Batch 14–19 的 lane 语义与依赖顺序
