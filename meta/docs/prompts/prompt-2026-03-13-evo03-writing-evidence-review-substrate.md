# Prompt: 2026-03-13 EVO-03 Writing Evidence + Review-Revise Substrate

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个**单独的新实现对话**。目标是在既有 `EVO-01` / `EVO-02` 单用户 compute loop 已经把 `computation_result_v1`、`feedback_lowering`、`workspace_feedback` 锁成 canonical authority 之后，补齐 `EVO-03` 的最小 bridge：把这些 provider-neutral result surfaces 映射到现有 writing evidence 与 review-revise substrate，而**不**提前启动 `EVO-13` team runtime。
>
> 建议在首次激活本 prompt 前，先用默认 reviewer trio `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)` 对 prompt 文本本身做一次轻量文档审阅，确认 scope、authority placement、以及 `EVO-13` 边界没有漂移。

## 0. Why This Batch Next

`EVO-01` 已完成最小单用户闭环：

- approved execution 会产出 canonical `computation_result_v1`
- terminal execution 会 deterministic lower 回 `NEW-LOOP-01` substrate

`EVO-02` 已进一步完成：

- `computation_result_v1` 成为唯一 canonical result-ingestion authority
- `feedback_lowering` 明确表达 `capture_finding` / `branch_idea` / `downgrade_idea`
- `workspace_feedback` / `next_actions` 已能把 compute outcome lower 回 idea lane

> **前置一致性说明**: 当前 tracker 的 `EVO-03.depends_on` 仍未显式列出 `EVO-02`，但本 prompt 把 `EVO-02` 产出的 canonical surfaces 视为 de facto prerequisite。若实施开始时 tracker 仍未补齐，必须在本批 closeout 或前置 prompt 同步中把这一依赖差异写明，而不是把 `EVO-02` 当成可选前提。

但当前主干仍缺一条明确桥接：

- compute result 还没有 canonical 地进入 writing evidence pool
- compute result 还没有 canonical 地进入 review / revise substrate
- 当前本地已有的 `referee-review` / `paper-reviser` 等 skills 可作为 first-example worker surfaces，但与 compute result / workspace state 之间还没有 typed、machine-readable、single-user-safe bridge

因此下一批应是一个**bounded `EVO-03` prompt**，而不是提前进入：

- `EVO-13`
- `NEW-05a-stage3`
- `NEW-07`
- `EVO-14`
- community / multi-team lane

## 1. Hard Scope Boundary

### 1.1 In scope

- 以 `computation_result_v1`、`feedback_lowering`、`workspace_feedback` 为唯一 authority input 的 result-to-writing bridge
- compute result -> writing evidence build / refresh / ingest 的 provider-neutral mapping
- compute result -> `WritingHandoff` / `ReviewHandoff` / equivalent typed task-handoff surface 的最小 substrate wiring
- 复用现有 `revision_plan` / `reviewer_report` artifact types、revision contract、以及当前本地 skill bridge / staging surfaces；`paper-reviser` / `referee-review` 只作为 first examples，不是闭合枚举或唯一执行路径
- 针对上述链路的 targeted tests / contract tests / integration smoke tests
- 必要的 shared/provider-neutral schema 或 codegen sync

### 1.2 Explicitly out of scope

- 启动 `EVO-13`
- `TeamExecutionState`
- delegation graph / A2A / agent lifecycle / team checkpoint / health / cascade stop
- `research-team` 统一 runtime 化
- 重新打开 `NEW-LOOP-01` substrate 主体设计
- 重开 `EVO-02` 已收口的 `decision_kind` / `target_task_kind` routing authority
- 重写 `buildRunWritingEvidence` 的整条 semantic retrieval 栈
- 复活已被审计降级的旧 MCP review tools（如 `submit_review` / `revision_plan_packet` / `submit_revision_plan`）作为新 authority
- lane 外大规模写作管线重构

### 1.3 Completion Lock

本批完成态至少应满足：

1. `computation_result_v1` 能 deterministic 地导出 writing-side machine-readable bridge，而不是只给 narrative hint。
2. success / finding path 至少能进入 writing evidence substrate，并形成 `writing` follow-up。
3. 只有在存在 draft / revision context 时，result 才能 deterministic 地进入 review / revise substrate；禁止无上下文时硬造 review loop。
4. 当前本地的 `referee-review` / `paper-reviser` 继续只是 replaceable execution surface；具体用哪个 skill / worker 必须保持为开放选择，不被误写成 runtime SSOT。
5. 本批没有把 team coordination state、agent assignment、multi-agent checkpoint、session runtime 偷带进来。
6. deterministic bridge 只负责 state transition、contract lowering、artifact wiring；高质量 writing / review / revision 内容仍应交给 runtime LLM / agent，而不是由 deterministic template 直接产出最终正文。
7. 必须新增至少一条 contract test，验证 `computation_result_v1.produced_artifact_refs` 与 provenance pointer 会无损进入 writing/review bridge payload 或 seed artifact。

## 2. Why This Is Still Not Team Runtime

本 prompt **必须**显式回链：

- `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`

并在实施时反复核对以下结论：

1. `EVO-13` memo 明确要求：`NEW-LOOP-01` 负责项目级 substrate，`EVO-13` 才负责 team execution layer。
2. 本批只是在**现有单项目 substrate 内**补一条 result -> writing/review bridge，没有引入：
   - team roles
   - delegation policy
   - A2A runtime
   - team-local lifecycle / health / timeout / cascade stop
   - second project-state SSOT
3. 本批允许桥接当前本地已有的 `paper-reviser` / `referee-review` 等 skills，但这些只是 first-example worker surfaces；具体由哪个 skill / worker 承担执行，应由 runtime LLM / agent 在 typed contract、approval gate 与 artifact boundary 内判断；它们不是 `TeamExecutionState`。
4. 如果实现开始出现 agent assignment、parallel worker orchestration、delegate restore、session replay/control-plane view，那已经越界到了 `EVO-13`。

一句话：

> 本批是在 `NEW-LOOP-01` 单用户 substrate 上补 result-to-writing/review handoff，不是在做单项目多 agent team runtime。

## 3. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-13-evo03-writing-evidence-review-substrate.md`
6. `meta/docs/prompts/prompt-2026-03-13-evo01-minimal-single-user-closed-loop.md`
7. `meta/docs/prompts/prompt-2026-03-13-evo02-feedback-loop.md`
8. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
9. `meta/docs/computation-mcp-design.md`
10. `meta/docs/pipeline-connectivity-audit.md`
11. `meta/docs/user-stories-ux-gaps.md`
12. `meta/docs/hep-mcp-audit-report.md`
13. `packages/orchestrator/src/computation/result.ts`
14. `packages/orchestrator/src/computation/feedback-lowering.ts`
15. `packages/orchestrator/src/computation/feedback-state.ts`
16. `packages/orchestrator/src/research-loop/handoff-types.ts`
17. `packages/orchestrator/src/research-loop/runtime.ts`
18. `packages/hep-mcp/src/core/writing/evidence.ts`
19. `packages/hep-mcp/src/core/contracts/revisionPlan.ts`
20. `packages/hep-mcp/src/tools/registry/projectSchemas.ts`
21. `packages/orchestrator/tests/compute-loop-execution.test.ts`
22. `packages/orchestrator/tests/compute-loop-feedback.test.ts`
23. `packages/orchestrator/tests/research-loop-smoke.test.ts`
24. `packages/hep-mcp/tests/core/writingEvidence.test.ts`
25. `packages/hep-mcp/tests/contracts/compute-loop-contract.test.ts`
26. `packages/hep-mcp/tests/contracts/dispatcherRunIdGuidance.test.ts`
27. `packages/hep-mcp/tests/contracts/skillBridgeJobEnvelope.test.ts`
28. `skills/paper-reviser/SKILL.md`
29. `skills/referee-review/SKILL.md`

若 tracker 里 `EVO-03.depends_on` 仍未显式包含 `EVO-02`：

- 将其视为当前 SSOT 漂移，而不是实现自由度
- 本批实现前必须承认 `EVO-02` 是实际前提
- closeout 时若仍有必要，必须把该依赖差异同步到 tracker note 或后续 prompt/closeout 记录

若 `REDESIGN_PLAN.md` 中 `EVO-03` 仍保留历史 `hep-research-mcp/src/tools/writing/evidence_mapper.ts` / `review-cycle.ts` 叙事：

- 将其视为设计意图，而不是强制实现路径
- 以当前 live authority surfaces 为准
- 不得为了迎合旧叙事去复活已被审计降级的旧 review tool surface

## 4. GitNexus Hard Gate

### 4.1 实施前

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. analyze 后重新读取 context；若 resource 短暂仍显示 stale，但 CLI 已明确成功更新，则把 CLI 输出纳入审查证据
4. 至少用 GitNexus 或 direct source inspection 对齐以下 surface：
   - `writeComputationResultArtifact`
   - `deriveFeedbackLowering`
   - `deriveNextIdeaLoopState`
   - `buildRunWritingEvidence`
   - `ResearchLoopRuntime`
   - `packages/orchestrator/src/research-loop/handoff-types.ts` 中 writing/review handoff seam

### 4.2 审核前

若新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 运行 `detect_changes`
3. 必要时补 `impact` / `context`

若 GitNexus 继续漏报 type alias / helper / new callsite：

- 必须明确记录失败
- 改用 direct source inspection + targeted tests 作为 exact verification
- 不得伪装成“graph evidence 已完整获取”

## 5. Current Live Authority Surfaces

### 5.1 Compute outcome authority

当前 live authority 已经是：

- `meta/schemas/computation_result_v1.schema.json`
- `packages/orchestrator/src/computation/result.ts`
- `packages/orchestrator/src/computation/feedback-lowering.ts`
- `packages/orchestrator/src/computation/feedback-state.ts`

因此本批必须消费：

- `produced_artifact_refs`
- `summary`
- `feedback_lowering`
- `workspace_feedback`
- `next_actions`

而不是重新去读 raw stdout/stderr 或 provider-local side effects 当 canonical input。

### 5.2 Writing evidence authority

当前 live writing evidence builder 是：

- `packages/hep-mcp/src/core/writing/evidence.ts::buildRunWritingEvidence`

它已经能构建：

- `latex_evidence_catalog.jsonl`
- `latex_evidence_embeddings.jsonl`
- `latex_evidence_enrichment.jsonl`
- `writing_evidence_meta_v1.json`
- `writing_evidence_source_status.json`

本批应桥接到这个现有 surface，而不是重写一套新的 writing evidence subsystem。

### 5.3 Review-revise substrate authority

当前 live review/revise substrate 由以下 surface 组成：

- `packages/hep-mcp/src/core/contracts/revisionPlan.ts`
- `packages/hep-mcp/src/tools/registry/projectSchemas.ts` 中 `revision_plan` / `reviewer_report` staged content types
- `skills/referee-review/SKILL.md`（当前本地 first-example reviewer worker）
- `skills/paper-reviser/SKILL.md`（当前本地 first-example reviser worker）

本批必须复用前两项 contract / staging surface，并把后两项视为当前本地可用的 first-example worker implementations；旧 `submit_review` / `submit_revision_plan` MCP tool 叙事只能作为历史参考。

这些 skill 文档属于 execution-surface reference，不是 authority contract 本体。

### 5.4 Handoff seam authority

当前 substrate seam 已存在：

- `packages/orchestrator/src/research-loop/handoff-types.ts`

其中 `WritingHandoff` / `ReviewHandoff` 已是正确的 project-substrate seam；本批应优先把 compute result 映射到这些 seam，而不是发明第二套 review runtime object model。

## 6. Target Architecture

### 6.1 `computation_result_v1` remains the only result authority

- result -> writing/review mapping 必须从 checked-in canonical `computation_result_v1` 出发
- `feedback_lowering` / `workspace_feedback` 是当前已收敛的 machine-readable lower layer
- 不得重新引入 provider-local outcome ontology

### 6.2 Do not fake LaTeX evidence authority

`pipeline-connectivity-audit` 已明确指出：

- `EvidenceCatalogItemV1` 是 LaTeX-specific
- required `paper_id` / `LatexLocatorV1` 不能用 synthetic fake value 糊过去

因此本批若要把 compute result 接入 writing evidence，必须：

- 通过已有 compute evidence / produced artifacts / typed bridge artifact 去接入
- 或扩展一个最小、provider-neutral、可审计的 mapping artifact / bridge contract
- 该最小 bridge artifact 可包含 `run_id`、`computation_result_v1` provenance pointer / URI、`produced_artifact_refs`、可选 `finding_node_ids`、以及 `evidence_type` / `bridge_kind` 等 provider-neutral discriminator，但不得要求 LaTeX-only 必填字段
- 若 compute result 产出的是 JSON / CSV / table / figure 等结构化数据，必须把它们作为 external data evidence via provenance pointer 处理，而不是伪装成 LaTeX-localized evidence

但绝不能：

- 伪造 `paper_id`
- 伪造 `LatexLocatorV1`
- 把 computation result 硬塞进 LaTeX-only schema

### 6.3 Deterministic-first writing bridge

至少要求：

1. `capture_finding` success path:
   - 保留 `EVO-02` 既有的 `finding` follow-up，不得把它替换为新的 writing-only route
   - `EVO-03` bridge 必须作为与 `finding` 并行的 bounded secondary bridge（例如 writing handoff、writing seed artifact、或 evidence refresh seed），而不是回写 `EVO-02` 主 routing authority
   - 该 secondary bridge 可以在 `deriveNextIdeaLoopState` 保留原 `finding` follow-up 之后附加，或作为同一 runtime snapshot 前的额外 post-lowering step；关键是不得改写 `EVO-02` 主 lowering route
   - 生成 writing-side machine-readable follow-up
   - 结果 artifact refs 能进入 writing evidence build / rebuild surface
   - substrate 中出现 `writing` task 或 `WritingHandoff`

2. `branch_idea` / `downgrade_idea` path:
   - 默认仍以 idea lane 为主
   - 只有在存在明确 draft / review / revision context 时，才允许派生 review-side follow-up

3. `review` / `revision` path:
   - 若 compute result 直接影响已存在草稿 / claim / review issue，必须生成 typed review/revise bridge，而不是只留下 narrative TODO
   - 这里的 bridge 指 `ReviewHandoff`、`review_issue`、`revision_plan` seed、`reviewer_report` seed 或等价 machine-readable artifact；它不等于立即触发实际 reviewer / reviser 执行

### 6.4 Deterministic only for routing, not for prose quality

- deterministic logic 负责：
  - result classification
  - state transition
  - handoff emission
  - artifact selection / wiring
  - `revision_plan` / `reviewer_report` / staged packet 的 machine-readable seed
- runtime LLM / agent 负责：
  - writing text generation
  - revision prose / tracked edits
  - reviewer reasoning / critique synthesis
  - 把 compute evidence 转写为高质量 paper-facing narrative
- 不得为了“可重复”而把最终写作内容降级成低质量 deterministic string templating
- 若 deterministic path 与 LLM-generated content 同时存在，前者应充当 guardrail / seed / validation surface，而不是替代后者

### 6.5 Draft-aware review bridge

review-revise 映射必须是 draft-aware：

- 有 target draft / revision context 时，可生成 `ReviewHandoff`、`review_issue`、`revision_plan` seed 或等价 typed bridge
- `packages/orchestrator/src/research-loop/handoff-types.ts` 当前 `WritingHandoff.draft_node_id` 为必填；因此 `capture_finding` 路径下只有在确有 draft context 时才可直接发 `WritingHandoff`
- `capture_finding` 路径下当前已存在的 `finding:{runId}` 节点可为 `WritingHandoff.finding_node_ids` 提供来源；但 `WritingHandoff.draft_node_id` 不能凭空伪造；没有 draft 时应退回 `writing` task、writing seed artifact、或 evidence refresh seed
- 没有 draft context 时，不得无依据地自动生成 reviewer loop
- 具体调用哪个 reviewer / reviser worker，仍由单用户控制面或 runtime LLM / agent 在 contract boundary 内判断；`referee-review` / `paper-reviser` 只是当前本地 first examples

### 6.6 Execution surface selection must stay open

- authority 应固定在 typed contracts / staged artifact types / handoff payloads，而不是 skill 名称
- implementation 可以桥接当前本地 `paper-reviser` / `referee-review`，因为它们已经存在且与本批直接相关
- implementation 应通过 execution-surface abstraction / skill bridge 调用这些 workers，而不是把 skill 名称硬编码进 substrate state 或 authority contract
- 但不得把它们编码为 closed enum、唯一 tool name、或唯一 execution path
- 对“哪个 skill/worker 最适合当前 review / revise task”的判断，默认由 runtime LLM / agent 在 typed contract、approval gate、artifact/provenance boundary 内决定

### 6.7 Keep the loop single-user and minimal

允许：

- 在同一 workspace 内补 `writing` / `review` follow-up
- 复用已有 skill bridge/staging content
- 为未来更完整 `EVO-03` closeout 预留最小 typed seam

不允许：

- 实现 `TeamExecutionState`
- 实现 role assignment
- 实现 multi-agent worker orchestration
- 引入 team checkpoint / replay control plane

## 7. Implementation Constraints

- `single-user` 指单一人类 owner / 单项目控制面，不等于 `single-agent`
- 本批允许单用户继续调用当前本地已有的 `paper-reviser` / `referee-review` 等 execution surface
- 这些 execution surface 只能是 replaceable workers，不得成为 project-state SSOT
- 不得把 skill 名称写成硬编码闭合枚举；固定下来的应是 contract / artifact / handoff 语义，而不是具体 worker 选择
- 若需要新 contract，优先 provider-neutral、最小、可审计
- 不得顺手把本批扩大成 `EVO-13`、`NEW-06` 大重构、`SEM-06` retrieval reopen、或写作 skill 全面重构
- 只有确实发生设计层边界变化时才更新 `meta/REDESIGN_PLAN.md`

## 8. Acceptance Commands

至少运行：

```bash
bash meta/scripts/codegen.sh
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/orchestrator test
pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-types.test.ts tests/research-loop-runtime.test.ts tests/research-loop-smoke.test.ts
pnpm --filter @autoresearch/orchestrator test -- tests/compute-loop-execution.test.ts tests/compute-loop-feedback.test.ts
pnpm --filter @autoresearch/orchestrator test -- <any new EVO-03 targeted tests>
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp test -- tests/core/writingEvidence.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/compute-loop-contract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/dispatcherRunIdGuidance.test.ts tests/contracts/skillBridgeJobEnvelope.test.ts
git diff --check
```

若本批触及：

- `skills/paper-reviser/`：补跑 `bash skills/paper-reviser/scripts/dev/run_smoke_tests.sh`
- `skills/referee-review/`：补跑其 deterministic CLI / schema 验证
- idea/run bridge surface：补跑 `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/ideaRunsIntegrationContract.test.ts`
- 新 schema / staging content / skill bridge envelope：补跑相邻 contract tests，并把命令加入本轮执行记录

## 9. Formal Review And Self-Review

若此文件将作为正式 implementation prompt 激活，建议先对 prompt 文本本身执行一轮轻量 reviewer-trio 审阅；实现完成后仍必须执行下面的正式代码审阅与自审。

实现完成前必须完成：

1. formal review
   - `Opus`
   - `Gemini-3.1-Pro-Preview`
   - `OpenCode(kimi-for-coding/k2p5)`
2. self-review

formal review 与 self-review 都必须显式回答：

- 是否误把 `EVO-03` 扩张成 `EVO-13`
- 是否引入了第二套 project-state / review-state SSOT
- 是否错误伪造了 `paper_id` / `LatexLocatorV1` 来接 computation result
- 是否复活了已被审计降级的旧 review MCP tools，而不是复用 open worker-selection + staging substrate
- 是否真正形成了 machine-readable writing/review bridge，而不是 narrative-only next steps
- 是否守住了 draft-aware 边界：没有 draft context 时不硬造 review loop

## 10. Tracker / SSOT Sync

完成后：

- 更新 `meta/remediation_tracker_v1.json`
- 若 `EVO-03.depends_on` 仍未显式包含 `EVO-02`，closeout 时必须把 `EVO-02` 加入 `depends_on`，而不只是留 note
- 同步 `AGENTS.md` 当前进度摘要
- 若无新增稳定架构不变量，不要为了形式主义更新 `.serena/memories/architecture-decisions.md`
- 若仅是实现 closeout、不改变 phase / lane / dependency 叙事，不更新 `meta/REDESIGN_PLAN.md`
- 若产生 adopted / deferred / declined amendments，按 checklist 记录到持久 SSOT

## 11. Suggested Outcome

理想最小 outcome：

- `EVO-03` 直接 closeout；或
- 若 full auto review loop 仍会把范围拉进 lane 外，则明确收束成 `EVO-03-A`：
  - `computation_result_v1` -> writing evidence bridge
  - `computation_result_v1` -> review/revise substrate bridge
  - no `EVO-13`
  - no second runtime

完成汇报必须明确回答：

- 为什么这批已经满足 `EVO-03` 或 `EVO-03-A` 的 bounded目标
- 为什么下一批不该是 `EVO-13`
- 为什么 `paper-reviser` / `referee-review` 仍只是当前本地 first-example execution surface，而不是被硬编码的唯一 worker，更不是 team runtime
