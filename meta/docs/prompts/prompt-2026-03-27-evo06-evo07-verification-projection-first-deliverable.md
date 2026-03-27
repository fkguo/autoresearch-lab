# Prompt: 2026-03-27 `EVO-06` / `EVO-07` — Verification Projection First Deliverable

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `NEW-VER-01` reopen，不是 `NEW-SHELL-01` anti-drift，不是 `EVO-11` distributor/handoff runtime，不是 `EVO-18` signal-detector expansion，也不是 runtime / scheduler / project-state redesign。目标只有一个：从已经 landed 的 typed verification kernel 出发，先把 current verification truth 投影到 bounded REP / reproducibility-facing consumer surfaces，而不是伪造 executed-check runtime 或 report authority。

## 0. Worktree Requirement

本 prompt 不得在当前 planning worktree 实施：

- `/Users/fkg/Coding/Agents/autoresearch-lab-evo06-07-rebaseline-plan`

实现必须放到未来 dedicated implementation lane；不要在这个 governance-only worktree 上写 `packages/**` runtime code，也不要直接在主仓 `main` 上实施。

## 1. Why This Batch Next

截至 2026-03-27，当前 checked-in reality 已经是：

1. `NEW-VER-01` 已完成，并且已经是 live typed verification authority。
2. `packages/orchestrator/src/computation/result.ts::writeComputationResultArtifact()` 已 emit：
   - `verification_subject_computation_result_v1.json`
   - `verification_subject_verdict_computation_result_v1.json`
   - `verification_coverage_v1.json`
3. `packages/orchestrator/src/computation/followup-bridges.ts` 与 `packages/orchestrator/src/computation/followup-bridge-review.ts` 已 pass through `verification_refs` unchanged。
4. `packages/hep-mcp/src/core/writing/evidence.ts::buildRunWritingEvidence()` 已把 bridge-carried `verification_refs` 写到 derived `writing_evidence_meta_v1.json.verification` summary。
5. `verification_check_run_v1` 仍然只有 schema，没有 truthful executed-check producer。
6. `EVO-18` 虽然已完成 first deliverable，但 `calculation_divergence` / `integrity_violation` 这两个 deferred signal 仍缺真实 report / event surfaces，不能被本批假装“顺带解锁”。
7. `EVO-11` 已在 TS `idea-engine` lane 关闭，本批不得回头修改 distributor runtime、handoff contracts、或 strategy-selection public surface。

因此，本批的正确目标不是 rerun pipeline / backend rollout，而是：

1. 先消费 current typed verification artifacts。
2. 先把 truthful `pending` / `blocked` reproducibility state 投影到 bounded REP consumer surfaces。
3. 明确 `EVO-06` integrity / gating semantics 只能是 current verdict / coverage 的 structural read。
4. 在没有 real executed-check producer 之前，不 mint `verification_check_run_v1`，也不 mint real `reproducibility_report_v1`。

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖 bounded consumer-side projection surfaces。未来实现前至少重读并对齐以下 live authority files：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件
6. `meta/schemas/computation_result_v1.schema.json`
7. `meta/schemas/writing_review_bridge_v1.schema.json`
8. `meta/schemas/verification_subject_v1.schema.json`
9. `meta/schemas/verification_subject_verdict_v1.schema.json`
10. `meta/schemas/verification_coverage_v1.schema.json`
11. `meta/schemas/verification_check_run_v1.schema.json`
12. `packages/orchestrator/src/computation/result.ts`
13. `packages/orchestrator/src/computation/followup-bridges.ts`
14. `packages/hep-mcp/src/core/writing/evidence.ts`
15. `packages/shared/src/__tests__/verification-kernel-contracts.test.ts`
16. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
17. `packages/hep-mcp/tests/core/writingEvidence.test.ts`
18. `packages/rep-sdk/src/model/research-outcome.ts`
19. `packages/rep-sdk/src/model/integrity-report.ts`
20. `packages/rep-sdk/src/validation/rdi-gate.ts`
21. `packages/rep-sdk/tests/fixtures.ts`
22. `packages/rep-sdk/tests/rdi-gate.test.ts`
23. `meta/docs/prompts/prompt-2026-03-25-evo18-rep-sdk-event-native-signals-and-selector.md`
24. `meta/docs/prompts/prompt-2026-03-25-evo11-idea-engine-bandit-runtime.md`

实现只允许先扩 bounded consumer-side surfaces，例如：

1. `packages/rep-sdk/src/model/**`
2. `packages/rep-sdk/src/validation/**`
3. `packages/rep-sdk/src/**` 下新的 pure-library verification projection helper surface
4. `packages/rep-sdk/tests/**` 中与 projection / gate / contract drift directly related 的测试

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `packages/orchestrator/src/computation/result.ts` producer semantics rewrite
- `packages/orchestrator/src/computation/followup-bridges.ts` / `followup-bridge-review.ts` pass-through rewrite
- `packages/hep-mcp/src/core/writing/evidence.ts` parser / metadata authority rewrite
- 任何 `verification_check_run_v1` producer
- 任何 executed-rerun pipeline / backend / comparison-engine runtime
- `reproducibility_report_v1` truthful emitter
- `integrity_report_v1` truthful emitter
- `EVO-11` bandit/distributor runtime or public contract changes
- `EVO-18` signal-detector expansion or selector drift
- runtime / scheduler / project-state redesign
- `NEW-VER-01`, `NEW-SHELL-01`, `EVO-11`, `EVO-18` reopen

如果实现过程中发现必须依赖这些 lane，必须停止并回报主协调对话，而不是静默扩批。

## 3. Locked Authority Order

以下 authority order 已锁定，不得在实现中自行改写：

1. canonical truth = `verification_subject_v1` / `verification_subject_verdict_v1` / `verification_coverage_v1`
2. authoritative carriers = `computation_result_v1.verification_refs` and `writing_review_bridge_v1.verification_refs`
3. `writing_evidence_meta_v1.json.verification` = derived host-side summary consumer only
4. `verification_check_run_v1` = schema-only in this slice

本批的 projection 必须直接读取 1-2，不得把 3 反向提升成 authority，也不得虚构 4。

## 4. Locked Slice Decisions

以下决策在本批已经锁定：

1. **Direction = `REP projection first`**
   - 先扩 bounded REP / reproducibility-facing consumer surfaces
   - 不先做 rerun runtime
2. **Truthful status only**
   - 当前只能从 verdict / coverage 得到 `pending` 或 `blocked by execution failure` 一类 truth
   - 没有 executed decisive checks，就不能冒充 `verified`
3. **No report fabrication**
   - 本批不得创建 real `reproducibility_report_v1`
   - 本批不得创建 real `integrity_report_v1`
4. **Producer surfaces stay unchanged**
   - `writeComputationResultArtifact()` 继续是 current producer
   - bridges 继续只 pass through `verification_refs`
   - writing evidence 继续只写 derived metadata summary
5. **`EVO-18` stays closed on its current truth**
   - 不得声称本批已解锁 `calculation_divergence`
   - 不得声称本批已解锁 `integrity_violation`
6. **`EVO-11` stays closed on its current truth**
   - 不得改 `campaign.init` / `search.step` distributor runtime
   - 不得改 handoff / strategy selection public surface
7. **`EVO-06` is companion semantics, not a checker-runtime batch**
   - integrity / gate semantics 只能是对 current verdict / coverage gaps 的 structural read
   - 不得落 novelty / parameter-bias / approximation / INSPIRE-backed checker runtime

## 5. Preferred Implementation Shape

未来 implementation lane 应优先选择 bounded pure-library shape，而不是 side-effectful runtime shape：

1. 一个明确命名的 verification projection helper surface，负责读取 subject / verdict / coverage truth 并产出 consumer-ready projection
2. `ResearchOutcome` / adjacent model semantics only where needed to carry truthful projected reproducibility state
3. `rdi-gate` only where needed to keep fail-closed behavior aligned with projected pending / blocked truth
4. tests proving projection derives only from existing verification artifacts and does not fabricate reports or checks

如果需要新增模型，请用功能性命名，不要引入 `legacy` / `new` / `v2` / placeholder naming。

## 6. Acceptance Lock

最终 acceptance 至少必须包含：

1. `git diff --check`
2. `pnpm --filter @autoresearch/rep-sdk test`
3. `pnpm --filter @autoresearch/rep-sdk build`
4. `rg -n "verification_check_run|reproducibility_report|integrity_report|verification_refs" packages/rep-sdk`
5. 证明当前 `NEW-VER-01` producer surfaces remain unchanged：
   - `packages/orchestrator/src/computation/result.ts`
   - `packages/orchestrator/src/computation/followup-bridges.ts`
   - `packages/hep-mcp/src/core/writing/evidence.ts`
6. 证明 projection truth directly derives from current verification artifacts rather than from a second authority
7. 证明 slice 1 没有新增 `verification_check_run_v1` producer
8. 证明 slice 1 没有造成 `EVO-11` 或 `EVO-18` public-contract drift

如果 acceptance 证明不了这些点，本批就不应 closeout。

## 7. Review Packet Lock

formal review packet 至少必须包含：

1. `meta/schemas/computation_result_v1.schema.json`
2. `meta/schemas/writing_review_bridge_v1.schema.json`
3. `meta/schemas/verification_subject_v1.schema.json`
4. `meta/schemas/verification_subject_verdict_v1.schema.json`
5. `meta/schemas/verification_coverage_v1.schema.json`
6. `meta/schemas/verification_check_run_v1.schema.json`
7. `packages/orchestrator/src/computation/result.ts`
8. `packages/orchestrator/src/computation/followup-bridges.ts`
9. `packages/hep-mcp/src/core/writing/evidence.ts`
10. `packages/shared/src/__tests__/verification-kernel-contracts.test.ts`
11. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
12. `packages/hep-mcp/tests/core/writingEvidence.test.ts`
13. all touched `packages/rep-sdk/**` files

默认 reviewer 仍是：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

formal self-review is also mandatory.

## 8. Completion Boundary

这个 prompt 对应的 future deliverable 只有在以下条件全部满足时才允许 closeout：

1. bounded consumer-side projection 已落地
2. producer / carrier / host-summary surfaces 未发生 drift
3. no fabricated report/check authority
4. trio review 0 blocking
5. self-review 0 blocking
6. tracker / `REDESIGN_PLAN.md` / current code truth 已再次三方对齐

若这些条件不满足，不要把本批误标成 “EVO-06/07 done”；它最多只是 bounded first deliverable。
