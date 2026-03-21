# Prompt: 2026-03-21 `EVO-13` Batch 5 — Sequential Multi-Assignment Parity

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `EVO-14` 预实现，也不是回切 `M-22 / NEW-02 / NEW-03 / NEW-04 / trace-jsonl` 的 infra/governance lane。目标只有一个：把 `coordination_policy = sequential` 从当前“generic serial bucket fallback”收束成一个**真实、显式、可审计的多 assignment team-local runtime path**，并通过 live shared host path 补齐源码、测试、acceptance 与 review evidence。

## 0. Worktree Requirement

本批默认**直接在主仓 `main` worktree 实施**，不要新建 worktree。

当前 canonical 路径：

- `/Users/fkg/Coding/Agents/autoresearch-lab`

额外硬门禁：

1. 不要新建 worktree。
2. 不要 `commit` / `push`，除非人类在当前任务中再次明确授权。
3. 若实现过程中证明本批与相邻 lane 不可分离，必须停止并重新定边界，而不是静默吸收 lane 外工作。

## 1. Why This Batch Next

截至 2026-03-21，`EVO-13 Batch 1-4` 已建立以下事实：

1. live shared authority path 已经是 `handleToolCall -> orch_run_execute_agent -> executeTeamRuntimeFromToolParams -> executeUnifiedTeamRuntime`。
2. `EVO-13 Batch 4` 已收口 `src/dist` anti-drift blocker，因此不应再让 stale package output 阻塞后续 runtime slice。
3. `EVO-14` 仍是 downstream 的 cross-run / fleet-level lane，不应反向吞入 `EVO-13` 的 team-local runtime closeout。
4. `M-22 / NEW-02 / NEW-03 / NEW-04 / trace-jsonl` 仍是 separate infra/governance debt，而不是当前 live team-runtime hot path 的下一个 blocker。

在当前源码上，真正还没被 first-class 锁定的是：

1. `TeamCoordinationPolicy` 已公开暴露 `sequential`；
2. TS runtime 已有真实多 assignment 证据的是 `parallel` 与 `stage_gated`；
3. `sequential` 仍主要落在 generic serial bucket fallback，没有独立 helper、独立 tests、也没有经由 live host path 的专门 contract proof。

因此，Batch 5 应先做 `sequential multi-assignment parity`，而不是跳去相邻 lane。

## 2. Archive-First SOTA Preflight

本批默认**执行新的 archive-first preflight**，但范围严格限定在与 Batch 5 直接相关的问题。

### 2.1 Canonical archive path

- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch5-sequential-multi-assignment-parity/preflight.md`
- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch5-sequential-multi-assignment-parity/summary.md`
- `~/.autoresearch-lab-dev/sota-preflight/2026-03-21/evo13-batch5-sequential-multi-assignment-parity/manifest.json`

### 2.2 Worktree pointer

- `/Users/fkg/Coding/Agents/autoresearch-lab/.tmp/evo13-batch5-sota-preflight.md`

### 2.3 Preflight questions

只回答以下问题，不要发散成完整 agent-framework survey：

1. team-local `sequential` runtime 应如何被显式建模，而不是继续隐藏在 generic serial fallback 中；
2. “assignment N finish + merge/save before assignment N+1 launch” 应如何用当前 runtime substrate 锁定；
3. sequential resume/re-entry 应如何保证已完成 assignment 保持 terminal、只恢复可恢复 assignment；
4. 如何保持 team-local durability / replay / control-plane 语义，而不滑向 `EVO-14` scheduler / fleet behavior。

## 3. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `.serena/memories/architecture-decisions.md`
6. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch5-sequential-multi-assignment-parity.md`
7. `meta/docs/prompts/prompt-2026-03-21-evo13-batch4-src-dist-anti-drift-cleanup.md`
8. `meta/docs/prompts/prompt-2026-03-21-evo13-batch3-task-interventions-approval-bridge.md`
9. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
10. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`

然后继续读取以下直接相关源码与测试：

11. `packages/orchestrator/src/team-unified-runtime.ts`
12. `packages/orchestrator/src/team-unified-runtime-types.ts`
13. `packages/orchestrator/src/team-unified-runtime-support.ts`
14. `packages/orchestrator/src/team-execution-types.ts`
15. `packages/orchestrator/src/team-execution-runtime.ts`
16. `packages/orchestrator/src/team-execution-bridge.ts`
17. `packages/orchestrator/src/team-execution-tool-bridge.ts`
18. `packages/orchestrator/src/team-execution-assignment-state.ts`
19. `packages/orchestrator/src/team-execution-interventions.ts`
20. `packages/orchestrator/src/team-execution-storage.ts`
21. `packages/orchestrator/src/team-execution-view.ts`
22. `packages/orchestrator/tests/team-execution-runtime.test.ts`
23. `packages/orchestrator/tests/team-unified-runtime.test.ts`
24. `packages/orchestrator/tests/team-execution-state.test.ts`
25. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
26. `packages/orchestrator/tests/compute-loop-writing-review-bridge.test.ts`
27. `packages/hep-mcp/src/tools/dispatcher.ts`
28. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
29. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
30. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
31. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
32. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
33. `packages/hep-mcp/tests/contracts/executeManifestDelegatedLaunchContract.test.ts`
34. `packages/hep-mcp/tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts`

只作 comparison evidence、不得修改的 parity reference：

35. `packages/idea-core/src/idea_core/hepar/orchestrator.py`
36. `packages/idea-core/tests/hepar/test_team_orchestrator_m44.py`

## 4. GitNexus Hard Gate

### 4.1 实施前

第一步必须在干净的主 worktree 执行：

```bash
npx gitnexus analyze
```

然后：

1. 重新读取 `gitnexus://repo/autoresearch-lab/context`
2. 至少对以下符号重新做 `context` / `impact` 对齐：
   - `executeUnifiedTeamRuntime`
   - `applyTeamIntervention`
   - `handleToolCall`
   - `executeTeamRuntimeFromToolParams`

### 4.2 审核前

本批预期会新增 helper / tests，并改变 `sequential` 的关键执行语义，因此正式审核前默认必须：

```bash
npx gitnexus analyze --force
```

然后至少：

1. 运行 `detect_changes`
2. 必要时补 `impact` / `context`
3. 把 `executeUnifiedTeamRuntime`、host-path entrypoints、以及新 sequential tests 纳入 review packet

## 5. Hard Scope Boundary

### 5.1 In scope

本批只允许覆盖：

1. `coordination_policy = sequential` 的显式多 assignment team-local runtime path
2. “assignment N finish and merge/save before assignment N+1 launch”的确定性语义
3. sequential multi-assignment resume / restore / replay coverage
4. live shared host path `orch_run_execute_agent` 的 sequential proof
5. 与上述实现直接相关的 orchestrator / hep-mcp tests
6. 本批 closeout 所需的 prompt / tracker / `AGENTS.md` 同步

### 5.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `EVO-14`
- fleet health / cross-run scheduler / global agent pool
- `trace-jsonl`
- `M-22 / NEW-02 / NEW-03 / NEW-04`
- Pipeline A lifecycle cleanup
- `computation/feedback-followups.ts` 或 `execute_manifest` auto-launch 扩张
- Python orchestrator 重写、迁移或 retirement
- 第二套 project-state SSOT

## 6. Preferred Implementation Shape

### 6.1 Make `sequential` first-class, not fallback

本批实现应明确把 `sequential` 做成一个 first-class path，而不是继续依赖 generic serial fallback。

优先实现形状：

1. 在 `packages/orchestrator/src/` 新增一个小型 sequential-focused helper module；
2. 让 `executeUnifiedTeamRuntime()` 对 `sequential` 走显式分支；
3. 保留 `parallel` 与 `stage_gated` 的现有 authority shape；
4. 不要继续把 `supervised_delegate` 与 `sequential` 混成同一语义桶。

### 6.2 Keep `supervised_delegate` narrow

`supervised_delegate` 仍是**单 assignment / default bridge mode**。

本批必须证明：

1. `sequential` 获得了真实多 assignment 语义；
2. `supervised_delegate` 没有被偷偷扩成 generic sequential alias；
3. `executeTeamRuntimeFromToolParams` 与 `orch_run_execute_agent` 的返回 shape 不发生变化。

### 6.3 No stage blocking leakage

`blocked_stage` 与 `stage_blocked` 事件仍然只属于 `stage_gated`。

本批必须避免：

1. 为 `sequential` 发明新的 stage-blocking 语义；
2. 因为 sequential failure 就伪造 `stage_blocked`；
3. 把 sequential closeout 扩成新的 stage scheduler。

## 7. Review Packet Boundary

formal review packet 至少应包含：

1. 变更过的 orchestrator runtime files
2. 新增的 sequential orchestrator tests
3. `packages/hep-mcp/src/tools/dispatcher.ts`
4. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
5. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
6. 触及的 `orch_run_execute_agent` contract tests
7. Python parity reference 文件（只读 comparison evidence）

默认排除：

- 无关 infra/governance lane
- `EVO-14` 相关文件
- 旧 Python pipeline 大范围 surface

若 acceptance 暴露这些 lane 的直接 regression，必须停止并重新定 scope，而不是把 review packet 无边界扩大。

## 8. Mandatory Tests And Acceptance

新增测试优先采用**新文件**，不要继续膨胀：

- `packages/orchestrator/tests/team-unified-runtime.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`

最低应新增覆盖：

1. real multi-assignment `sequential` execution order
2. later assignments do not launch before earlier results are merged/saved
3. sequential resume/re-entry keeps completed assignments terminal and relaunches only recoverable ones
4. sequential failure semantics do not fake `stage_blocked`
5. `supervised_delegate` remains the single-assignment/default bridge mode
6. live host-path `orch_run_execute_agent` with `team.assignments[]` + `coordination_policy = sequential`
7. sequential live-status / replay view through the shared host path

最终 acceptance command set：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator test -- tests/agent-runner.test.ts tests/research-loop-runtime.test.ts tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/compute-loop-writing-review-bridge.test.ts <new sequential orchestrator test file(s)>
pnpm --filter @autoresearch/orchestrator build
node scripts/check-orchestrator-package-freshness.mjs
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/executeManifestDelegatedLaunchContract.test.ts tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts <new sequential host-path contract test file(s)>
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check
npm run accept:new-rt-04
```

## 9. Formal Review-Swarm And Self-Review

review-swarm 仍是 mandatory gate。reviewers 必须显式检查：

1. `sequential` 是否已成为真实多 assignment path，而不再只是 fallback
2. `supervised_delegate` 是否仍保持 single-assignment / default bridge 语义
3. host 是否仍通过 `@autoresearch/orchestrator` 消费 shared authority，而不是 source-path bypass
4. 是否有 `EVO-14` / fleet behavior / project-wide control-plane leakage
5. packet 对 out-of-scope / blocker / debt 的分类是否成立

外部 review-swarm 收敛后，self-review 仍必须再确认：

1. sequential save/merge-before-next-launch 真的有代码与测试证据
2. sequential resume/re-entry 没有重复完成过的 work
3. `blocked_stage` 仍只属于 `stage_gated`
4. acceptance 与 post-change GitNexus 证据一致

## 10. Post-Closeout Sync

closeout note 必须明确写清：

1. Batch 5 为什么仍是 `EVO-13` 的当前最佳下一批
2. `sequential` 现在通过哪条 live host path 被 source-grounded 证明
3. `supervised_delegate` 与 `sequential` 的边界是什么
4. 是否需要更新 `.serena/memories/architecture-decisions.md`；若无需更新，必须明确写：`无新增稳定不变量`
5. 是否需要更新 `meta/REDESIGN_PLAN.md`；若无需更新，必须明确写：无设计层变更，不更新 `REDESIGN_PLAN`
6. 若实现暴露出新的 legacy hazard 且未当场修复，必须登记到持久 SSOT；若没有，必须明确写：无新增待登记 legacy hazard

### 10.1 Expected no-change surfaces

若实现按预期分离成功，本批默认**不**应修改：

1. `meta/REDESIGN_PLAN.md`
2. Python parity reference 源码
3. 对外 schema / tool input shape
4. approval surface / intervention scope taxonomy / project-state authority

如其中任一必须变化，先暂停并重新定边界。
