# Prompt: 2026-03-11 Batch 15 — NEW-SEM-08 Semantic Packet Curation

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
>
> 当前基线：`Batch 3` runtime/root de-HEP 已完成并推送；closeout hash 为 `cd31804`（implementation hash `791b5a8`）。`NEW-05a-shared-boundary`、`NEW-05a-formalism-contract-boundary`、`NEW-05a-hep-semantic-authority-deep-cleanup` 均已完成；不要重开这些 lane。
>
> 当前排期基线：`meta/REDESIGN_PLAN.md` 已明确 `Batch 15 = NEW-SEM-08`，`Batch 16 = NEW-SEM-11 + NEW-SEM-12`。本批只做 `NEW-SEM-08`，保持 Python-side 边界，不要把 TS-side equation/provenance lane 或 `NEW-LOOP-01` runtime substrate 一起拉进来。

## 0. 开工前必须读取

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
   - `NEW-SEM-08` / `NEW-SEM-11` / `NEW-SEM-12` 条目
   - Batch 15 / Batch 16 排期说明
   - “remaining Phase 3 work is mainly compute / packet-curation / provenance / equation lanes” 附近叙事
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `.serena/memories/architecture-decisions.md`
6. `skills/research-team/README.md`
7. `skills/research-team/RUNBOOK.md`
8. `skills/research-team/scripts/bin/build_team_packet.py`
9. `skills/research-team/scripts/bin/build_draft_packet.py`
10. `skills/research-team/scripts/bin/run_team_cycle.sh`
11. `skills/research-team/scripts/validation/run_full_contract_validation.sh`
12. `skills/research-team/tests/test_packet_redaction.py`
13. `skills/research-team/tests/test_idea_bridge.py`
14. `skills/research-writer/README.md`
15. `skills/research-writer/RUNBOOK.md`
16. `skills/research-writer/scripts/bin/research_writer_learn_discussion_logic.py`
17. `skills/research-writer/scripts/bin/distill_discussion_logic.py`
18. `skills/research-writer/scripts/bin/research_writer_draft_sections.py`
19. `skills/research-writer/scripts/dev/run_all_smoke_tests.sh`

## 1. tracker / baseline 对齐

开工前必须先把 `meta/remediation_tracker_v1.json` 中 `NEW-SEM-08` 置为：

- `status: "in_progress"`
- `assignee`: 当前实际执行模型

不得假设本批只是“补文档”或“顺手小修”；它是 `Phase 3 Batch 15` 的正式 closeout 入口，生命周期必须落到 tracker。

## 2. 本批范围

### 2.1 In scope

- `skills/research-team` 的 packet build / review packet curation 面
- `skills/research-writer` 的 learn/distill/draft 相关 packet / excerpt / section-selection 面
- LLM-based relevance / diagnostic section selection
- semantic tags / rationale / uncertainty / fallback 的 deterministic output schema
- 相邻 tests / smoke / validation harness / docs 的最小必要同步

### 2.2 Out of scope

- `NEW-SEM-11` / `NEW-SEM-12`
- TS-side `packages/hep-mcp/**`
- `NEW-LOOP-01`
- root/runtime/provider de-HEP 进一步重写
- 大规模 `research-team` / `research-writer` 结构性重构
- 借本批顺手做 200 LOC/SRP 清债；只有被当前 call-path 直接逼出的最小抽取才允许

## 3. 目标状态

本批完成后，应满足：

1. review/writer packet 不再只依赖 heading order、固定 section 名或粗 keyword bucket 选取重点段落。
2. LLM judgment 可以参与“哪些 section / slice / diagnostic paragraph 真正关键”的选择，但 public output 必须落到 deterministic、可审计、可回放的结构化 schema。
3. 任何 heading / keyword / position prior 只能作为 hint/provenance，不得继续充当 authority。
4. packet / excerpt / tag surface 必须 generic，不得写死 HEP-only taxonomy 作为默认 worldview。
5. failure path 必须明确：模型不可用、解析失败、证据不足、候选冲突时，必须 fallback / abstain / mark_uncertain，而不是假装命中。
6. 质量是最高优先级：若某项语义判断明显应由 LLM adjudication 承担，就不要为了追求表面 deterministic 而降级成较差的规则、keyword bucket 或固定打分表。

## 4. SOTA preflight（必须先做；archive-first）

这是语义选择 / tagging authority 变更，必须先做 SOTA preflight；禁止凭旧 heuristic 直觉开改。

### 4.1 落盘位置

- canonical archive：`~/.autoresearch-lab-dev/sota-preflight/2026-03-11/NEW-SEM-08/preflight.md`
- worktree 指针：`.tmp/new-sem08-sota-preflight.md`
- 同目录建议附：`summary.md`, `manifest.json`

### 4.2 preflight 至少回答

1. 对 scientific review packet / writer packet，当前最稳妥的 section selection 形态是什么：
   - full-section ranking
   - paragraph/span extraction
   - diagnostics-first slice selection
   - hybrid two-stage selection
2. 如何把 LLM relevance judgment 收束成 deterministic artifact，而不是自由文本点评？
3. 哪些 signals 可以保留为 deterministic priors，哪些必须降为 hints，哪些必须交给 LLM adjudication？
4. “missed critical section” 在本仓当前 skill 里如何可评估：用什么 fixture / holdout / smoke contract 来证明改善？
5. 哪些 failure mode 必须 fail-closed：
   - heading 误导
   - appendix / footnote / diagnostics paragraph 被漏选
   - introduction / conclusion 过度泛化但真正关键信息在中段
   - model 输出不可解析或 tags 漂移
6. 哪些输出需要 deterministic 的只是 artifact/schema/replay surface，而不是把高质量 LLM semantic authority 倒退成 rule-based selection？

### 4.3 preflight 结论处理

每条关键 finding 在收尾时都必须标成：

- `adopted`
- `deferred`
- `rejected`

并在 self-review 或 closeout note 里给出最少一张 traceability 表，说明 `finding -> disposition -> code/test/SSOT evidence`。

如果 preflight 结论是当前仓库约束下没有 bounded、可审计、可评估的实现路径，本批必须 `No-Go / Defer`，并把结论写回 checked-in SSOT；禁止硬做一个新的 heuristic authority。

## 5. GitNexus preflight（硬要求）

开工前必须：

1. 先读 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 禁止带 stale index 开工

至少补齐以下证据：

1. `query` / `context` 对齐 `build_team_packet`、`build_draft_packet`、`research_writer_learn_discussion_logic`、`research_writer_draft_sections`
2. 梳理 packet build -> downstream review/draft consumer 的真实调用链
3. 确认现有 tests / smoke / validation harness 如何覆盖这些入口

若 GitNexus 对 shell/Python glue 覆盖不完整，必须在 review packet / self-review 中明确记录 graph blind spots，并用源码 call-path inspection 补证；但这不是跳过 GitNexus preflight 的理由。

正式审核前，如有新增/重命名符号、关键调用链变化、或 index 已不反映工作树，必须再次运行 `npx gitnexus analyze`，并补 `detect_changes` + 至少一个 `context(...)` / `impact(...)` 证据。

## 6. 实现要求

### 6.1 必须做到

1. 为 packet curation 引入显式、结构化、可审计的 semantic selection output。
2. selection output 至少应能表达：
   - candidate source unit（section / paragraph / span / diagnostic slice）
   - selected / rejected / uncertain 状态
   - semantic tags
   - 简短 rationale / provenance
   - fallback / parse_error / unavailable 等 failure state
3. tests / smoke 必须在不依赖 live model 的条件下稳定运行；需要时使用 stub/frozen outputs。
4. downstream packet 文本必须让 reviewer / writer 看见“为什么这段被选中”，而不是只看见一堆 opaque tags。
5. deterministic 的约束面是 output contract、artifact shape、stub/frozen replay 与 fail-closed behavior；不得把本可由 LLM 更好完成的 semantic selection 倒退成低质量 deterministic heuristic。

### 6.2 明确禁止

- 不要把 heading keyword bucket 改个名字继续当 authority
- 不要把 HEP taxonomy 或 closed domain lexicon 塞回 generic packet schema
- 不要为了追求“完全 deterministic”而把 LLM-first semantic adjudication 降级成较差的规则拼接、固定权重打分或闭合枚举分类
- 不要顺手重写整个 `research-team` 或 `research-writer` skill
- 不要引入新的服务、数据库、向量索引或跨仓 runtime
- 不要创建 `utils.py` / `helpers.py` / `common.py` 这类万能文件

### 6.3 推荐落点

优先做当前 lane 内最小完备、可审计、可评估的架构收束，而不是跨 lane 大改架构；不得以质量换范围控制：

- 在 `build_team_packet.py` / `build_draft_packet.py` 附近增加 deterministic packet-selection artifact 或 typed selection block
- 在 `research_writer_learn_discussion_logic.py` / `distill_discussion_logic.py` 中补 semantic packet tags / rationale surface
- 必要时增加极小的 shared helper，但只限当前 selection/tagging 逻辑，且命名必须按职责

## 7. Eval / test-first 要求

在正式实现前，先锁定专项验证面。至少要覆盖：

1. critical section 被旧逻辑漏掉、但新 semantic selection 能抓到的 fixture
2. normal case non-regression：原本合理的 packet 不应退化
3. deterministic replay：同一 frozen/stub output 重跑结果一致
4. parse failure / model unavailable / conflicting candidates 的 fail-closed 行为
5. downstream readability：packet 中的 selected slices / tags / rationale 不会退化成不可用噪声

如现有 tests/smoke 不足，先补专项 fixture/test 再改实现。

## 8. 验收命令

至少执行：

```bash
python3 -m pytest skills/research-team/tests
bash skills/research-team/scripts/dev/run_all_smoke_tests.sh
bash skills/research-team/scripts/validation/run_full_contract_validation.sh
bash skills/research-writer/scripts/dev/run_all_smoke_tests.sh
git diff --check
```

如果新增了 `NEW-SEM-08` 专项测试或 smoke fixture，还必须显式单跑一次对应命令，并在 closeout note 中写清楚它锁定了什么行为。

## 9. formal review / self-review（硬门禁）

本批收尾必须做 formal review 和 self-review。

### 9.1 reviewer 配置

当前 `Gemini` 不可用。已有人类批准 dual-review fallback，因此正式审核使用：

- `Opus`
- `OpenCode(kimi-for-coding/k2p5)`

### 9.2 每个 review artifact / closeout note 必须明确记录

1. `Gemini` 当前不可用
2. 人类已批准该 dual-review fallback
3. 最终正式审核实际使用了该 fallback

### 9.3 审核重点

- 是否真的把 packet curation authority 从 heading/keyword prior 提升到了 auditable semantic selection
- 是否留下了新的 closed taxonomy / domain-locked worldview
- tests / smoke / full-contract validation 是否真正守住新行为
- scope 是否仍严格停留在 `NEW-SEM-08`

## 10. SSOT 同步要求

完成后必须同步：

1. `meta/remediation_tracker_v1.json`
   - 更新 `NEW-SEM-08` 状态、assignee、commit hash、adopted/deferred/rejected dispositions
2. `AGENTS.md`
   - 更新当前进度摘要，说明 `NEW-SEM-08` 的 bounded closeout 结果
3. `meta/REDESIGN_PLAN.md`
   - 若本批实质澄清了 Batch 15/16 边界、packet authority 形态、或 acceptance narrative，则同步 closeout 说明
4. `.serena/memories/architecture-decisions.md`
   - 仅当本批沉淀出新的长期稳定不变量时更新；否则明确记录“无新增稳定不变量”

## 11. 版本控制门禁

- 未经当前对话中的明确授权，不得 `git commit` / `git push`
- 即便已获授权，也只能在 acceptance、formal review、self-review、SSOT sync 全部完成后执行
- push 前必须确认工作树只包含本批交付内容

## 12. 完成汇报中的下一批建议

本批完成汇报必须给出**条件化**下一批建议：

- 默认下一批应是 `Batch 16 = NEW-SEM-11 + NEW-SEM-12`
- 但如果 `NEW-SEM-08` 暴露出会阻塞 equation/provenance lane 的 shared packet/provenance contract 缺口，必须明确说明为什么需要先补一个更小的 follow-up，而不是直接进入 Batch 16

禁止在没有理由的情况下跳去 `NEW-LOOP-01`、root/platform lane，或重开已完成的 de-HEP / semantic cleanup 批次。
