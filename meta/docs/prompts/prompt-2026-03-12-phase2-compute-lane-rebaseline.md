# Prompt: 2026-03-12 Phase 2 Compute-Lane Rebaseline / Retro-Closeout

> 适用范围：**仅**用于一个新的 bounded implementation / reality-audit 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `NEW-COMP-02` 实现批，也不是全仓 rebaseline。它的目标是先把 **compute critical path 上已落地但 SSOT 仍漂移的 false-pending 项** 校准到可信状态，使后续 `NEW-COMP-02` / `EVO-01` 级别规划不再建立在错误的 tracker 基线上。

## 0. Why This Batch Next

截至 2026-03-12，repo 内已经出现一组影响“整体项目级规划”的 compute-lane reality drift：

- `UX-02` 在 `meta/remediation_tracker_v1.json` 仍是 `pending`，但 `meta/REDESIGN_PLAN.md`、`meta/schemas/computation_manifest_v1.schema.json`、`research_workflow_v1` entry-point 扩展，以及 downstream tests 都显示其已实质落地。
- `NEW-COMP-01` 在 tracker 仍是 `pending`，但 `meta/docs/computation-mcp-design.md` 已存在，旧 prompt 也明确把它当成已完成前置。
- `NEW-RT-04` 在 tracker 仍是 `pending`，但 `packages/orchestrator/src/run-manifest.ts`、`RunManifestManager`、checkpoint/resume tests 已存在。
- `NEW-CONN-04` 在 tracker 仍是 `pending`，但 `packages/hep-mcp/src/tools/create-from-idea.ts`、`hep_run_create_from_idea`、`outline_seed_v1.json` contract tests、`idea-runs` integration contract 已存在。

这类 false-pending 直接污染了：

- `Phase 2 / Phase 3` 完成度统计；
- `NEW-COMP-02` 的真实前置判断；
- `EVO-01/02/03` 的 compute-path readiness 判断；
- 人类对“下一批该做什么”的可信决策。

因此，**下一批优先级最高的工作不是新功能扩张，而是一个有边界的 compute-lane SSOT rebaseline / retro-closeout**。

## 1. Hard Scope Boundary

本批 **只允许**覆盖以下四项的 reality-audit / retro-closeout：

1. `UX-02`
2. `NEW-COMP-01`
3. `NEW-RT-04`
4. `NEW-CONN-04`

允许的动作只有两类：

- 证明这些项已经基本完成，并补最小 acceptance gap / tests / SSOT sync；
- 如果发现某一项并未真正完成，只允许收敛到一个更小的 follow-up prompt 或把该项保持 `blocked/in_progress`，**不得**借机扩成新的实现 lane。

### 明确禁止

不要启动、顺手吸收、或部分实现以下 lane：

- `NEW-COMP-02`
- `EVO-01` / `EVO-02` / `EVO-03`
- `EVO-13`
- `NEW-05a-stage3`
- generic migration
- research-loop lane
- `NEW-IDEA-01` / `NEW-R15-impl` 之外的再重做
- 全仓 tracker 大扫除

如果发现 repo 里还有别的 stale item，**只记录为 out-of-scope evidence**；不要在本批顺手修。

## 2. 开工前必须读取

按顺序至少读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-12-phase2-compute-lane-rebaseline.md`

然后继续读取以下直接相关资料（同样 mandatory，不是可选补充）：

### 设计 / 合同 / 旧 prompt

6. `meta/docs/computation-mcp-design.md`
7. `meta/docs/idea-runs-integration-contract.md`
8. `meta/docs/pipeline-connectivity-audit.md`
9. `meta/docs/prompts/prompt-phase2-impl-batch7.md`
10. `meta/docs/prompts/prompt-phase2-impl-batch8.md`
11. `meta/docs/prompts/prompt-phase2-impl-batch9.md`
12. `meta/docs/prompts/prompt-phase2-impl-batch10.md`
13. `meta/docs/prompts/prompt-phase3-impl-batch1.md`

### 目标代码 / 测试

14. `meta/schemas/computation_manifest_v1.schema.json`
15. `packages/hep-mcp/src/tools/ingest-skill-artifacts.ts`
16. `packages/hep-mcp/src/tools/create-from-idea.ts`
17. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
18. `packages/orchestrator/src/run-manifest.ts`
19. `packages/orchestrator/src/state-manager.ts`
20. `packages/hep-mcp/tests/core/ingestSkillArtifacts.test.ts`
21. `packages/hep-mcp/tests/core/createFromIdea.test.ts`
22. `packages/hep-mcp/tests/contracts/ideaRunsIntegrationContract.test.ts`
23. `packages/hep-mcp/tests/core/researchWorkflowSchema.test.ts`
24. `packages/orchestrator/tests/run-manifest.test.ts`
25. `packages/orchestrator/tests/orchestrator.test.ts` 中 checkpoint / resume 相关段落

## 3. GitNexus Hard Gate

先做 GitNexus freshness check：

1. 读 `gitnexus://repo/{name}/context`
2. 若 stale，运行 `npx gitnexus analyze`
3. 再读一次 context
4. 在动手前，用 GitNexus 明确以下 surface：
   - `RunManifestManager`
   - `createFromIdea` / `hep_run_create_from_idea`
   - `ingestSkillArtifacts` / `hep_run_ingest_skill_artifacts`
   - `researchWorkflowSchema` tests 或相关 consumers

审核前如 index 不反映工作树，再次 refresh，并尝试 `detect_changes` / `impact` / `context`。

若 GitNexus MCP 再次出现 `Transport closed`，必须：

- 明确记录失败；
- 改用 direct source inspection + targeted tests；
- 不得假装 post-change graph evidence 已成功获取。

## 4. 执行模式

### 4.1 现实优先，不重做历史实现

默认假设这四项中至少一部分已经完成。先做 reality-audit：

- 核对 tracker 状态 vs live code/test/docs
- 追溯 acceptance claim 是否有真实代码/测试/contract 支撑
- 只有在发现真实 gap 时才补最小代码或测试

### 4.2 文档 / 合同 preflight

仅在发现 **真实 drift** 时才做 targeted official-doc / contract preflight，并遵循 archive-first：

- canonical archive: `~/.autoresearch-lab-dev/sota-preflight/2026-03-12/PHASE2-COMPUTE-LANE-REBASELINE/`
- worktree pointer: `.tmp/phase2-compute-lane-rebaseline-sota-preflight.md`

若只需 repo-local contract 对齐、不需要外部官方文档，则必须明确写“未触发外部 official-doc lookup”。

## 5. Item-by-Item Audit Intent

### 5.1 `UX-02`

目标不是重做 computation contract，而是确认：

- `computation_manifest_v1.schema.json` 是否已经构成 live contract
- downstream consumers / tests 是否足以支撑“已完成”判定
- tracker 仍为 `pending` 是否只是 SSOT drift

### 5.2 `NEW-COMP-01`

目标不是实现 compute runtime，而是确认：

- `meta/docs/computation-mcp-design.md` 是否满足 Phase 2 设计交付物
- `hep_run_ingest_skill_artifacts` tool spec 是否已成为 single SSOT
- `NEW-COMP-02` 是否可以把它当成真实已完成前置

### 5.3 `NEW-RT-04`

目标不是重写 orchestrator runtime，而是确认：

- `run-manifest.ts` / checkpoint / resume surface 是否已交付 durable execution MVP
- tests 是否锁住了 crash recovery / checkpoint persistence / resume semantics
- tracker pending 是否只是 closeout 漂移

### 5.4 `NEW-CONN-04`

目标不是重做 idea-mcp 或 workflow schema，而是确认：

- `hep_run_create_from_idea` 是否已构成 live Idea→Run bridge
- `outline_seed_v1.json` contract 是否同时被 `meta/docs/idea-runs-integration-contract.md` 与 `packages/hep-mcp/tests/contracts/ideaRunsIntegrationContract.test.ts` 锁住，并与 `from_idea` workflow variant 保持一致
- 若只缺最小 acceptance/test/SSOT 补丁，则只补这些，不扩成新 lane

## 6. Acceptance Commands

至少跑以下 gates；如补了相邻 shared/schema surface，再补相邻 package build/test：

```bash
pnpm --filter @autoresearch/shared build
pnpm --filter @autoresearch/orchestrator build
pnpm --filter @autoresearch/orchestrator test -- tests/run-manifest.test.ts
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp test -- tests/core/ingestSkillArtifacts.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/core/createFromIdea.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/ideaRunsIntegrationContract.test.ts
test -f packages/hep-mcp/tests/core/researchWorkflowSchema.test.ts
pnpm --filter @autoresearch/hep-mcp test -- tests/core/researchWorkflowSchema.test.ts
git diff --check
```

若 `NEW-RT-04` 的 reality-audit 触碰到 `state-manager.ts` 或 checkpoint command 语义，再补：

```bash
pnpm --filter @autoresearch/orchestrator test -- tests/orchestrator.test.ts
```

## 7. Formal Review / Self-Review

本批默认必须完成正式 review 和 self-review：

- formal reviewers: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)`
- 若其中任一 reviewer 不可用，必须记录失败原因，并由人类明确确认 fallback reviewer
- review packet 必须检查：
  - 代码本身，而不是只看 diff 摘要
  - four-item reality-audit 证据链
  - tests / fixtures / contracts
  - scope discipline
  - 是否错误地把“已有实现”误写成“未完成”

self-review 必须明确记录：

- adopted amendments
- deferred amendments
- declined/closed amendments
- GitNexus 是否成功提供 post-change 证据

## 8. 必须同步的 SSOT

完成后至少同步：

1. `meta/remediation_tracker_v1.json`
   - 不只更新 `status`；还要核对 `completed_at`、`depends_on`、`note` 是否与 reality-audit 结论一致
2. `AGENTS.md` 当前进度摘要

按需同步：

3. `meta/REDESIGN_PLAN.md`
   - 仅当 closeout 叙事、phase counts、或依赖关系需要纠偏时更新
4. `.serena/memories/architecture-decisions.md`
   - 仅当本批提炼出新的长期稳定不变量时更新；否则明确写“不更新 memory”

## 9. 完成态定义

只有以下条件全部满足，本批才可标 `done`：

- acceptance commands 通过
- formal review 收敛且 `0 blocking`
- self-review `0 blocking`
- tracker / `AGENTS.md` 已同步
- 若有 drift-induced preflight，其 archive-first 落盘已完成
- 对于仍未完成的条目，已经明确收敛为更小的 follow-up prompt，而不是模糊地继续挂 `pending`

## 10. Do Not Do

- 不要把本批升级成 `NEW-COMP-02` 的真实实现
- 不要顺手做 `EVO-01/02/03`
- 不要把 `NEW-05a-stage3`、`EVO-13` 或 generic migration 拉进来
- 不要做“全仓全部 pending 项” rebaseline
- 不要因为看到历史 prompt 说“已完成”就跳过源码 / 测试验证
- 不要因为 tracker 说 `pending` 就默认重做实现

## 11. 期望结果

理想结果是：

- `UX-02` / `NEW-COMP-01` / `NEW-RT-04` / `NEW-CONN-04` 中的 false-pending 被收敛为可信 closeout；
- Phase 2 / 3 的 compute critical path 重新可信；
- 下一条真正的实现 prompt 可以直接聚焦 `NEW-COMP-02`，而不是继续被 SSOT drift 污染。
