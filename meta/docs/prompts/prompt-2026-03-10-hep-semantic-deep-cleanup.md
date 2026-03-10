# Prompt: 2026-03-10 Program — HEP Semantic Authority Deep Cleanup

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 这是一个 **program prompt**，不是“一次对话里做完 A-F” 的 mega prompt。  
> 目标：趁重构窗口，把 `idea-core` / `hep-mcp` / shared boundary 周边仍在生效的 HEP semantic authority 做深度清理，明确哪些要删除、哪些要重写、哪些只有在 provider-neutral rewrite 后才允许提升到 generic/shared 层。

## 0. 会话切分硬规则

- 不要把 A-F 全塞进一个超长线程。
- 默认一批一个对话。
- 不必机械到“永远一批一个对话”。
- 只有当相邻批次同时满足以下条件时，才允许合并到同一对话：
  - 共享同一 boundary；
  - 共享同一 acceptance commands；
  - 共享同一 review surface；
  - 预计修改文件高度重叠；
  - 合并后不会削弱 reviewer 对 scope boundary 的判断。
- 若任一条件不满足，必须开新对话。
- 已知允许合并的典型例外：`Batch A` 与 residual `batch2` scope；若两者最终共享同一 `idea-core` boundary、同一 acceptance surface、同一 reviewer surface，可在一个新对话里合并收口。

## 1. 开工前必读

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md`
5. `meta/docs/2026-03-10-formalism-boundary-sota-memo.md`
6. `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`
7. `meta/docs/prompts/prompt-2026-03-09-batch2-idea-core-domain-boundary.md`
8. `meta/docs/prompts/prompt-2026-03-09-batch3-runtime-root-dehep.md`

## 2. 全局目标状态

- generic/core 不再持有 HEP-specific semantic authority。
- `hep-mcp` 不再用不完整 keyword/enum/lexicon/rubric 充当 public truth authority。
- 仍有价值的内容，只能以以下两种形式留下：
  - provider-local fail-open prior
  - provider-neutral typed contract / eval / provenance substrate
- `batch3` 不再早于 semantic-authority cleanup 执行。

## 3. 全局设计约束

- 真正的问题不是出现 domain terms，而是让闭合集合充当 authority。
- 不要因为某个概念“generic 也会有”就把当前 HEP-specific 实现直接上提。
- 凡是打算删除、保留、上提的语义模块，都必须先追踪到：
  - registry / public output
  - downstream consumers
  - tests / eval fixtures / baseline
  - docs / tracker / prompt 叙事
- deterministic logic 只可作为：
  - prefilter
  - metadata prior
  - post-guard
  - schema / unit / numeric invariant
- deterministic logic 不得继续扮演 meaning-level final authority。
- 对任何计划上提到 generic/shared 的内容，必须证明：
  - 命名已 provider-neutral
  - contract 不含 HEP worldview
  - 至少有 clear evidence 说明它是稳定不变量，而不是当前 provider 的偶然实现

## 4. Review Policy

- 默认仍遵循仓库 formal review discipline。
- 本 program 已获人类 owner 明确批准：若 `Gemini` 本地不可用，则使用 `Opus + Kimi K2.5` 双模型审核作为收敛判定。
- 必须在**每一批**的 review artifact / closeout note 中明确记录：
  - Gemini 不可用的事实
  - 人类批准 dual-review fallback 的事实
- 禁止静默改成其他 reviewer 组合。

## 5. 批次拆分

### Batch A — Idea-Core Bootstrap / Toy / Compute-Rubric Cleanup

**目标**：清除 `idea-core` generic/core 中仍在生效的 HEP bootstrap worldview 与 closed compute rubric authority。

**In scope**

- `packages/idea-core/src/idea_core/engine/hep_builtin_domain_packs.json`
- `packages/idea-core/src/idea_core/engine/hep_domain_pack.py`
- `packages/idea-core/src/idea_core/engine/domain_pack.py`
- `packages/idea-core/src/idea_core/engine/hep_constraint_policy.py`
- 相邻 tests / docs / snapshots

**必须达成**

- 不再 shipped `hep.bootstrap`
- 不再存在 `bootstrap_default`
- 不再存在 `toy_laptop` / `HEP_COMPUTE_RUBRIC_RULES` 这类 closed HEP rubric authority 驱动 generic path
- 若保留任何 feasibility logic，必须改成 capability-first / task-first / non-authoritative seam

**明确禁止**

- 不要把 HEP rubric 改名成 generic 名字继续留在 core
- 不要把 HEP bootstrap pack 换成另一个 placeholder built-in worldview
- 不要顺手创建新的 heavy planner stack

**验收命令**

- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_domain_pack_m30.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_formalism_registry_m31.py -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests/engine/test_compute_plan_rubric_m36.py -q`
- `rg -n 'hep\\.bootstrap|bootstrap_default|HEP_COMPUTE_RUBRIC_RULES|toy_laptop' packages/idea-core/src/idea_core/engine && exit 1 || true`
- `PYTHONPYCACHEPREFIX=/tmp/pycache make -C packages/idea-core validate`
- `PYTHONPYCACHEPREFIX=/tmp/pycache make -C packages/idea-core test`
- `git diff --check`

### Batch B — Review / Paper / Critical / Assumption Authority Cleanup

**目标**：把 review/paper/question/assumption 相关模块从 closed keyword authority 改造成真正的 semantic runtime 或显式 diagnostics-only fallback。

**In scope**

- `packages/hep-mcp/src/tools/research/reviewClassifier.ts`
- `packages/hep-mcp/src/tools/research/paperClassifier.ts`
- `packages/hep-mcp/src/tools/research/criticalQuestions.ts`
- `packages/hep-mcp/src/tools/research/assumptionTracker.ts`
- `packages/hep-mcp/src/tools/research/criticalResearch.ts`
- `packages/hep-mcp/src/tools/research/criticalAnalysis.ts`
- `packages/hep-mcp/src/tools/registry/inspireSearch.ts`
- 相邻 tests / eval / docs

**必须达成**

- keyword buckets 不再直接决定 `review_type`、`authority_score`、`is_authoritative_source`、`paper_type`、`reliability_score`
- fixed `QUESTION_TEMPLATES` 不再作为 final paper semantics authority
- assumption extraction / categorization 不再依赖 closed categories 直接输出 truth-like result
- 若 fallback 仍保留，必须显式记录 fallback provenance，并有 `uncertain` / `abstained` / `unavailable` path

**明确禁止**

- 不要把原有 enum/keyword list 搬到 shared 当 generic paper/review taxonomy
- 不要只改字段名
- 不要用“更大的 keyword list”冒充 semantic rewrite

**验收要求**

- 必须新增或更新 eval / holdout / regression，覆盖 hard cases
- `pnpm --filter @autoresearch/hep-mcp test:eval`
- `pnpm --filter @autoresearch/hep-mcp test`
- `pnpm --filter @autoresearch/hep-mcp build`
- `git diff --check`

### Batch C — Theoretical Conflict Authority Cleanup

**目标**：移除 closed subdomain debate lexicon 对 theoretical conflict 的 final authority。

**In scope**

- `packages/hep-mcp/src/tools/research/theoreticalConflict/lexicon.ts`
- `packages/hep-mcp/src/tools/research/theoreticalConflicts.ts`
- 相邻 tests / eval / docs

**必须达成**

- `AXIS_POSITION_LEXICON` / `MUTUAL_EXCLUSION_RULES` 不再决定 final conflict relation
- 如果保留 lexicon，只能作为 retrieval/debug prior，不能直接当 final authority
- final outputs 必须保留 `not_comparable` / `uncertain` / `abstained` / fallback semantics

**明确禁止**

- 不要把一组新的 HEP labels 替换进同一结构
- 不要把当前 exotic-hadron taxonomy 改名为 generic “debate ontology”

**验收要求**

- 相关 unit tests / eval / build 全绿
- 必须加入至少一个 hard case，证明不再被 closed taxonomy 卡死

### Batch D — Synthesis / Grouping / Challenge / Survey / DeepAnalyze Cleanup

**目标**：清除 collection grouping、challenge extraction、survey/deepAnalyze 中仍然充当 semantic authority 的 closed lexicon / title-keyword logic。

**In scope**

- `packages/hep-mcp/src/tools/research/analyzePapers.ts`
- `packages/hep-mcp/src/tools/research/survey.ts`
- `packages/hep-mcp/src/tools/research/deepAnalyze.ts`
- `packages/hep-mcp/src/tools/research/synthesis/collectionSemanticLexicon.ts`
- `packages/hep-mcp/src/tools/research/synthesis/collectionSemanticGrouping.ts`
- `packages/hep-mcp/src/tools/research/synthesis/grouping.ts`
- `packages/hep-mcp/src/tools/research/synthesis/challengeLexicon.ts`
- `packages/hep-mcp/src/tools/research/synthesis/challengeExtraction.ts`
- `packages/hep-mcp/src/tools/research/synthesis/narrative.ts`
- 相邻 tests / eval / docs

**必须达成**

- 小型 topic/method/challenge alias lists 不再扮演 final authority
- `deepAnalyze.ts` 的 heading-keyword lookup 若保留，必须明确是 utility-only path，不得再表述为 semantic understanding
- topic/method/challenge 输出若保留，必须支持 explicit uncertain/fallback semantics

**明确禁止**

- 不要把现有 HEP grouping labels 直接上提到 generic/shared
- 不要只在 tracker/plan 里改说法而不改代码

**验收要求**

- `pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalSem10TopicMethodGrouping.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalSem13ChallengeExtractor.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test`
- `pnpm --filter @autoresearch/hep-mcp build`
- `git diff --check`

### Batch E — Generic Uplift of Surviving Semantic Contracts

**目标**：只把真正 provider-neutral 的 typed seam 提升到更高层；把具体 HEP logic 留在 carrier 层或直接删除。

**In scope**

- `packages/shared/` 或其他明确的 generic package
- 与 surviving semantics 对应的 typed contracts、provenance contracts、eval harness helpers
- 相邻 provider adapters / tests / docs

**只有在以下前提全部满足时才允许上提**

- 命名 provider-neutral
- contract 不含 HEP worldview / aliases / tool-specific authority
- 至少已有一个明确的非 HEP-neutral 论证，说明这是稳定不变量
- 上提后不会把 `hep-mcp` 当前偶然实现冻结成长期 generic API

**明确禁止**

- 不要把 `criticalQuestions` / grouping / challenge 的当前实现整体搬到 shared
- 不要因为“以后别的领域也会用到”就提前过度工程

**验收要求**

- `pnpm --filter @autoresearch/shared test`
- `pnpm --filter @autoresearch/shared build`
- 相邻 provider tests/build 全绿
- `git diff --check`

### Batch F — Downstream Recovery: Batch2 Closeout Then Batch3

**目标**：在 A-E 清理后，恢复被旧顺序误导的 downstream closeout。

**顺序**

1. 重新判断 `prompt-2026-03-09-batch2-idea-core-domain-boundary.md` 是否已被 Batch A 实质吸收；若仍有 residual scope，再做 bounded residual closeout
2. 仅在 semantic-authority cleanup 已完成后，执行 `prompt-2026-03-09-batch3-runtime-root-dehep.md`

**明确禁止**

- 不要在 A-E 之前启动 batch3
- 不要为了赶进度把 batch2 residual closeout 和 batch3 粘成一团

## 6. 每批收尾硬要求

- 更新 `meta/remediation_tracker_v1.json`
- 更新 `AGENTS.md`
- 如改变长期边界叙事，更新 `meta/REDESIGN_PLAN.md`
- formal review 需重点检查：
  - 是否真的删掉/降级了 authority，而不是换皮
  - 是否错误地把 HEP-specific 实现提升成 generic
  - 是否遗留 silent fallback 降质路径
- `self-review` 必须明确写出：
  - 当前哪些是 core/shared mandatory invariant
  - 哪些只是 provider-local fail-open prior
  - 哪些被删除而不是被“换名字保留”

## 7. 成功标准

- semantic authority 不再由封闭 keyword/enum/lexicon/rubric 主导
- generic/shared 层只承载稳定 typed seams，不承载 HEP worldview
- `batch2` / `batch3` 的顺序恢复正确
- 后续实现 prompt 不再误导执行者把多个边界混在一个长线程里
