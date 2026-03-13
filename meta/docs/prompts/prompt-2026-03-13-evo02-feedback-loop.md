# Prompt: 2026-03-13 EVO-02 Feedback Loop

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本 prompt 对应一个**单独的新实现对话**。目标是在既有 `EVO-01` 最小单用户闭环之上，补齐 `EVO-02` 风格的最小结果回流批次：让 `computation_result_v1` 成为唯一 compute outcome authority，并把结果以 provider-neutral、可审计、可测试的方式 lower 回 `NEW-LOOP-01` substrate 的 idea feedback / reprioritization / prune surface。

## 0. Why This Batch Next

`EVO-01` 已在 `main` 上完成最小闭环：

- `idea / method_spec -> execution_plan_v1 -> computation_manifest_v1`
- `dry_run -> A3 approval packet`
- approval 后真实执行
- canonical `computation_result_v1`
- terminal execution lower 回 `NEW-LOOP-01` substrate

但当前回流仍只停在最小 follow-up：

- success: `compute` completed + pending `finding`
- failure: `compute` blocked + `FeedbackHandoff` + pending `idea`

这说明 compute lane 已闭合，但“结果如何真正成为 idea scoring / pruning / backtrack authority”仍未完成。因此下一批应是 `EVO-02`，而不是提前进入 `EVO-03`、`EVO-13`、`NEW-05a-stage3` 或 `NEW-07`。

## 1. Hard Scope Boundary

### 1.1 In scope

- 以 `computation_result_v1` 为 authority 的 result-ingestion path
- compute result -> idea feedback / reprioritization / prune / backtrack 的 provider-neutral lowering
- `NEW-LOOP-01` substrate 中对应的 typed contract、artifact、handoff、task/runtime wiring
- 针对上述回流链路的 targeted tests / contract tests / integration smoke tests
- 必要的 shared/provider-neutral schema/type/codegen sync

### 1.2 Out of scope

- 重做 `EVO-01`
- writing / review mapping (`EVO-03`)
- `EVO-13`
- `NEW-05a-stage3`
- `NEW-07`
- multi-team runtime / agent registry / A2A
- 把 worker surface、provider 名称、CLI 名称上提为 project-state SSOT
- lane 外大规模重构

### 1.3 Completion Lock

本批完成态应满足：

1. `computation_result_v1` 能被 canonical ingestion path 消费。
2. success / failure / weak-signal 至少三类结果有 deterministic、machine-readable 的 lowering。
3. lowering 结果进入 `NEW-LOOP-01` substrate 的可审计状态，而不是只停留在 narrative string。
4. 不把任何 worker surface 或 HEP provider 提升为项目状态 authority。

## 2. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-13-evo02-feedback-loop.md`
6. `meta/docs/prompts/prompt-2026-03-13-evo01-minimal-single-user-closed-loop.md`
7. `meta/docs/computation-mcp-design.md`
8. `meta/docs/idea-runs-integration-contract.md`
9. `packages/orchestrator/src/computation/result.ts`
10. `packages/orchestrator/src/computation/result-schema.ts`
11. `packages/orchestrator/src/computation/loop-feedback.ts`
12. `packages/orchestrator/src/research-loop/handoff-types.ts`
13. `packages/orchestrator/src/research-loop/runtime.ts`
14. `packages/orchestrator/src/research-loop/workspace-types.ts`
15. `packages/orchestrator/src/research-loop/policy.ts`
16. `packages/orchestrator/tests/compute-loop-execution.test.ts`
17. `packages/orchestrator/tests/compute-loop-feedback.test.ts`
18. `packages/orchestrator/tests/research-loop-types.test.ts`
19. `packages/orchestrator/tests/research-loop-runtime.test.ts`
20. `packages/orchestrator/tests/research-loop-smoke.test.ts`
21. `packages/hep-mcp/tests/contracts/compute-loop-contract.test.ts`
22. 任何当前代码中已经存在、直接承载 result ingestion / feedback lowering authority 的模块与测试

若发现 `REDESIGN_PLAN.md` 中 `EVO-02` 仍引用历史 Python `idea-core/...` 路径：

- 将其视为叙事基线，而不是强制实现路径
- 以当前 live authority surface 为准
- 不得为了迎合旧叙事去复活过时路径

## 3. GitNexus Hard Gate

### 3.1 实施前

1. 读取 `gitnexus://repo/{name}/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 再读一次 context
4. 至少用 GitNexus 对齐以下 surface：
   - `writeComputationResultArtifact`
   - `deriveNextIdeaLoopState` 或等价 feedback lowering authority
   - `FeedbackHandoff`
   - `ResearchLoopRuntime`

### 3.2 审核前

若实现新增/重命名符号、改变关键调用链、或当前 index 已不反映工作树：

1. 再次运行 `npx gitnexus analyze`
2. 使用 `detect_changes`
3. 必要时补 `impact` / `context`

若 GitNexus 对新 helper / 新 callsite 继续漏报：

- 明确记录失败
- 改用 direct source inspection + targeted tests 作为 exact verification
- 不得假装 graph evidence 已成功获取

## 4. 目标架构

### 4.1 `computation_result_v1` 是唯一 outcome authority

- 结果 ingestion 必须以 checked-in canonical `computation_result_v1` 为 authority input
- 不得绕开它直接回读临时 stdout/stderr/worker-specific side effects
- 不得让某个 worker surface 的 payload 成为长期 canonical ontology

### 4.2 feedback lowering 必须 provider-neutral

可表达：

- `refine_idea`
- `downgrade_idea`
- `branch_idea`
- reprioritize / prune / backtrack 等等价、可审计决策

但不得：

- 把 `hep-calc`、`Codex CLI`、`Claude CLI`、`OpenClaw`、`research-team` 等名字写成 project-state authority
- 把 HEP-specific rubric 冒充 shared/core 默认世界观

### 4.3 substrate authority 必须是 machine-readable state，不是 narrative only

至少要让回流结果进入以下之一：

- typed handoff payload
- typed task metadata / decision artifact
- checked-in canonical schema 对应的 artifact

禁止只返回一段“建议 refine idea”的字符串就算完成 `EVO-02`。

### 4.4 keep it minimal

本批目标是最小回流闭环，不是完整 ranking / search / planner overhaul。若需要引入新 contract：

- 只引入当前批次直接需要的最小 stable authority
- 保持 provider-neutral
- 不要为假设性未来需求增加额外抽象层

## 5. Implementation Constraints

- `single-user` 不等于 `single-agent`
- 允许单用户指挥多 worker surface
- 但这些 surface 只能是 replaceable execution surface，不得成为项目状态 SSOT
- 不要把本批扩大成 `EVO-03` / `EVO-13` / `NEW-05a-stage3` / `NEW-07`
- 只有在本 prompt 明确允许且确有必要的情况下才更新 `meta/REDESIGN_PLAN.md`

## 6. Acceptance Commands

至少运行：

```bash
bash meta/scripts/codegen.sh
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/shared test
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/orchestrator test -- tests/research-loop-types.test.ts tests/research-loop-runtime.test.ts tests/research-loop-smoke.test.ts
pnpm --filter @autoresearch/orchestrator test -- tests/compute-loop-execution.test.ts tests/compute-loop-feedback.test.ts
pnpm --filter @autoresearch/orchestrator test -- <any new EVO-02 targeted tests>
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/ideaRunsIntegrationContract.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/compute-loop-contract.test.ts
git diff --check
```

若本批修改引入了新的 contract/eval/integration surface：

- 必须把对应 acceptance command 补入本轮执行记录
- 不得只跑旧测试集合

## 7. Formal Review And Self-Review

实现完成前必须完成：

1. formal review
   - `Opus`
   - `Gemini-3.1-Pro-Preview`
   - `OpenCode(kimi-for-coding/k2p5)`
2. self-review

formal review 与 self-review 都必须显式回答：

- 是否误把 `EVO-02` 扩张成 `EVO-03` / `EVO-13` / `NEW-05a-stage3` / `NEW-07`
- 是否把 worker surface / provider 名称误提升为 authority
- 是否真正形成 machine-readable result-ingestion authority，而不是 narrative-only feedback
- 是否仍把 remaining work 正确留给后续 batch

## 8. Tracker / SSOT Sync

完成后：

- 更新 `meta/remediation_tracker_v1.json`
- 同步 `AGENTS.md` 当前进度摘要
- 若无新增稳定架构不变量，不要为了形式主义更新 `.serena/memories/architecture-decisions.md`
- 若 `REDESIGN_PLAN.md` 只是轻微叙事漂移，不做结构性修订

## 9. Suggested Outcome

理想最小 outcome：

- `EVO-02` closeout，或至少一个边界清晰、可验证的 `EVO-02-A` 子批次 closeout
- compute result 对 idea lane 的 deterministic lowering 不再只是 alpha/smoke
- `EVO-03`、`EVO-13`、`NEW-05a-stage3`、`NEW-07` 继续保持未启动
