# Prompt: 2026-03-21 `EVO-13` Batch 6 — Live Host Recovery Parity + Team-Local Health Boundary

> 适用范围：**仅**用于一个新的 bounded implementation 对话。
> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本批不是 `EVO-14` 预实现，也不是回切 `M-22 / NEW-02 / NEW-03 / NEW-04 / trace-jsonl` 的 infra/governance lane。目标只有一个：在 `EVO-13 Batch 1-5` 之后，补齐 live shared host path 上仍未直接锁定的 **multi-assignment crash/kill recovery parity**，并把当前 team-local `health / control-plane` 边界收束成一个**真实、可审计、fail-closed** 的实现/测试/文档合同。

## 0. Worktree Requirement

本批默认**直接在主仓 `main` worktree 实施**，不要新建 worktree。

当前 canonical 路径：

- `/Users/fkg/Coding/Agents/autoresearch-lab`

额外硬门禁：

1. 不要新建 worktree。
2. 不要 `commit` / `push`，除非人类在当前任务中再次明确授权。
3. 若实现过程中证明本批与 `EVO-14` 或相邻治理 lane 不可分离，必须停止并重新定边界，而不是静默扩批。

## 1. Why This Batch Next

截至 `EVO-13 Batch 5` closeout，当前 live runtime 已经成立的事实是：

1. live shared authority path 已经是 `handleToolCall -> orch_run_execute_agent -> executeTeamRuntimeFromToolParams -> executeUnifiedTeamRuntime`
2. `supervised_delegate` 的 host-path checkpoint/re-entry proof 已存在
3. `sequential` 的 host-path multi-assignment order + recovery proof 已存在
4. `parallel` 的 recovery 语义目前已有 orchestrator-core 级测试，但仍缺少 live host-path 级 crash/kill recovery contract proof
5. `stage_gated` 的 live host-path 目前锁了成功路径与 control-plane view，但仍缺少 live host-path 级 checkpoint/re-entry proof
6. 当前 team-local health surface 实际可见的是 `timeout_at`、`last_heartbeat_at`、`timed_out`、`needs_recovery`、`cancelled`、`cascade_stopped` 与 replay/live-status view；**没有**显式 `stalled` / `unhealthy` taxonomy，也没有 cross-run/fleet monitor

因此，Batch 6 的正确目标不是再开一个新执行策略，也不是滑向 `EVO-14`，而是把剩余 team-local 热路径缺口收口：

1. 为 `parallel` / `stage_gated` 在 live shared host path 上补齐 crash/kill recovery parity
2. 明确并锁定当前 **team-local** `health / control-plane` 边界，避免“字段存在”被误读成“语义已闭合”

相邻 lane 当前都不该先启动：

- 不是 `EVO-14`：本批只处理单项目 team-local runtime；不做 cross-run scheduler、fleet health、resource pool
- 不是新的 `health daemon` / background heartbeat 平台：若需要那类能力，应先证明它仍是 team-local 且不引入第二套 runtime authority；否则留给后续明确设计，而不是本批硬塞
- 不是 `trace-jsonl` / `M-22` 系列治理 lane：这些都不是当前 live team-runtime host path 的最短补口

## 2. Hard Scope Boundary

### 2.1 In scope

本批只允许覆盖：

1. `parallel` multi-assignment 在 `orch_run_execute_agent` shared host path 下的 crash/kill re-entry proof
2. `stage_gated` multi-assignment 在 `orch_run_execute_agent` shared host path 下的 crash/kill re-entry proof
3. 与上述 proof 直接相关的 runtime 修复：仅限 `TeamExecutionState` / checkpoint / restore / replay / live-status / host bridge
4. 当前 team-local `health / control-plane` 边界的合同收口：
   - timeout / heartbeat metadata / replay/live-status 的真实语义补强
   - 若现有 surface 暗示了并不存在的 `stalled` / `project-wide` / fleet behavior，必须 fail-closed 收紧
5. 与上述实现直接相关的 orchestrator tests、hep-mcp contract tests、以及本批 prompt/tracker closeout 文档

### 2.2 Explicitly out of scope

以下内容一律禁止顺手吸收：

- `EVO-14`
- cross-run scheduler
- fleet health / global agent pool / resource manager
- background heartbeat daemon / external watchdog service
- 新的 project-wide intervention 语义
- Python `TeamRoleOrchestrator` 重写、迁移或 retirement
- `trace-jsonl` / `M-22 / NEW-02 / NEW-03 / NEW-04`
- 第二套 project-state SSOT

若发现这些 lane 才能真正解决问题，必须停止并记录为 packet assumption breach，而不是继续把它们吸进 `EVO-13 Batch 6`。

## 3. Required Reads Before Coding

至少按顺序读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch6-live-host-recovery-health-boundary.md`
6. `meta/docs/prompts/prompt-2026-03-21-evo13-batch5-sequential-multi-assignment-parity.md`
7. `meta/docs/prompts/prompt-2026-03-21-evo13-batch4-src-dist-anti-drift-cleanup.md`
8. `meta/docs/prompts/prompt-2026-03-21-evo13-batch3-task-interventions-approval-bridge.md`
9. `meta/docs/prompts/prompt-2026-03-21-evo13-batch2-parallel-fanout-lifecycle.md`
10. `meta/docs/prompts/prompt-2026-03-21-evo13-batch1-team-runtime.md`
11. `meta/docs/2026-03-07-evo13-single-project-multi-agent-runtime-memo.md`
12. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`
13. `.serena/memories/architecture-decisions.md`

然后继续读取以下直接相关源码与测试：

14. `packages/orchestrator/src/team-unified-runtime.ts`
15. `packages/orchestrator/src/team-unified-runtime-support.ts`
16. `packages/orchestrator/src/team-unified-runtime-sequential.ts`
17. `packages/orchestrator/src/team-execution-runtime.ts`
18. `packages/orchestrator/src/team-execution-bridge.ts`
19. `packages/orchestrator/src/team-execution-assignment-state.ts`
20. `packages/orchestrator/src/team-execution-interventions.ts`
21. `packages/orchestrator/src/team-execution-tool-bridge.ts`
22. `packages/orchestrator/src/team-execution-view.ts`
23. `packages/orchestrator/src/team-execution-storage.ts`
24. `packages/orchestrator/src/orch-tools/agent-runtime.ts`
25. `packages/orchestrator/src/orch-tools/team-schemas.ts`
26. `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
27. `packages/orchestrator/src/agent-runner.ts`
28. `packages/orchestrator/src/agent-runner-ops.ts`
29. `packages/orchestrator/src/run-manifest.ts`
30. `packages/orchestrator/tests/team-unified-runtime.test.ts`
31. `packages/orchestrator/tests/team-execution-runtime.test.ts`
32. `packages/orchestrator/tests/team-execution-state.test.ts`
33. `packages/orchestrator/tests/research-loop-delegated-agent-runtime.test.ts`
34. `packages/hep-mcp/src/tools/dispatcher.ts`
35. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
36. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
37. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.base.test.ts`
38. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team.test.ts`
39. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-view.test.ts`
40. `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-sequential.test.ts`

禁止只看单个 diff 或单个测试就动手。

## 4. GitNexus Hard Gate

### 4.1 实施前

1. 读取 `gitnexus://repo/autoresearch-lab/context`
2. 若 index stale，先运行 `npx gitnexus analyze`
3. 若当前 main worktree dirty，默认运行 `npx gitnexus analyze --force`
4. 在改代码前，至少对以下符号做 `impact` / `context`：
   - `handleToolCall` (`packages/hep-mcp/src/tools/dispatcher.ts`)
   - `handleOrchRunExecuteAgent`
   - `executeTeamRuntimeFromToolParams`
   - `executeUnifiedTeamRuntime`
   - `applyTeamIntervention`
   - `executeDelegatedAgentRuntime`

### 4.2 审核前

本批预期会新增 host-path contract tests，并可能改变 team-runtime recovery/control-plane 语义，因此正式审核前默认必须：

```bash
npx gitnexus analyze --force
```

然后至少：

1. 运行 `detect_changes`
2. 必要时补 `impact` / `context`
3. 把 host entrypoint、runtime bridge、recovery helpers、以及新增 tests 纳入 review packet

## 5. Current Reality To Fix

当前源码树里，仍有两个 Batch 6 级缺口：

1. live host path 的 recovery parity 还不完整：
   - `supervised_delegate` 和 `sequential` 已有 host-path re-entry proof
   - `parallel` 的 recoverable-vs-terminal 语义只在 orchestrator-core 测试里锁定
   - `stage_gated` 的 live host path 只锁了成功路径与 replay/view，不足以证明 checkpoint/re-entry completeness
2. team-local health/control-plane 边界仍容易被误读：
   - live view 暴露 `timeout_at` / `last_heartbeat_at`
   - state/event 里有 `timed_out` / `needs_recovery`
   - 但当前没有显式 `stalled` / `unhealthy` status 或 event contract

本批真正要补上的，是：

1. `parallel` / `stage_gated` 在 shared host path 下的 kill/re-entry truth
2. “已完成 assignment 不重跑、可恢复 assignment 才继续、timeout/cancel/cascade_stop 不被误重启”的 team-local completeness
3. 当前 health/control-plane surface 的 honest contract：真实实现什么就锁什么；没实现的必须 fail closed，而不是继续保留模糊暗示

## 6. Preferred Implementation Shape

### 6.1 Add host-path proofs before widening runtime

优先新增**新测试文件**，不要继续膨胀现有 200+ 行 contract 文件。推荐新增：

- `packages/orchestrator/tests/team-unified-runtime-parallel-recovery.test.ts`
- `packages/orchestrator/tests/team-unified-runtime-stage-gated-recovery.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts`
- `packages/hep-mcp/tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts`

若现有实现已经满足语义，应优先用这些 tests 把语义锁死，而不是顺手改 runtime 结构。

### 6.2 Health boundary must be real or narrower

本批允许两种结果，二选一，但都必须 source-grounded：

1. **真实补强**：为当前已有的 timeout / heartbeat / recovery surface 增加结构化 event/view/test 证据，使其成为 honest team-local control-plane contract
2. **明确收紧**：若某些 `stalled` / health 暗示并无真实实现，则收紧 schema/view/docs/tests，避免继续把 pseudo-health 当成已闭合语义

无论哪种结果，都不允许：

- 发明 fleet-level health
- 增加跨 run watchdog
- 用 background daemon 偷渡 `EVO-14`

### 6.3 Keep control-plane derived

`live_status` / `replay` 仍必须只是 derived view：

- 只能消费 `TeamExecutionState`、checkpoint bindings、event log
- 不得新增第二套 canonical state 文件
- 不得把 transcript/session/log 反向升级为 team/project SSOT

## 7. Review Packet Boundary

formal review packet 至少应包含：

1. 所有变更过的 orchestrator runtime/recovery/control-plane 文件
2. 新增的 orchestrator recovery tests
3. `packages/hep-mcp/src/tools/dispatcher.ts`
4. `packages/hep-mcp/src/tools/orchestrator/tools.ts`
5. `packages/hep-mcp/src/tools/registry/projectExtensions.ts`
6. 新增的 host-path contract tests
7. 与 `executeManifest` delegated launch 相邻的现有 contract tests（只作为 consumer evidence）

默认排除：

- `EVO-14` 文件面
- Python orchestrator 大范围 surface
- 无关 infra/governance lane

## 8. Mandatory Tests And Acceptance

最终 acceptance command set：

```bash
git diff --check
pnpm --filter @autoresearch/orchestrator test -- tests/team-execution-state.test.ts tests/team-execution-runtime.test.ts tests/team-unified-runtime.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts tests/research-loop-delegated-agent-runtime.test.ts tests/compute-loop-writing-review-bridge.test.ts
pnpm --filter @autoresearch/orchestrator build
node scripts/check-orchestrator-package-freshness.mjs
pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchestratorPackageFreshness.test.ts tests/contracts/orchRunExecuteAgent.base.test.ts tests/contracts/orchRunExecuteAgent.team.test.ts tests/contracts/orchRunExecuteAgent.team-view.test.ts tests/contracts/orchRunExecuteAgent.team-sequential.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/executeManifestDelegatedLaunchContract.test.ts tests/contracts/executeManifestInvalidDelegatedLaunchContract.test.ts
pnpm --filter @autoresearch/hep-mcp build
pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check
npm run accept:new-rt-04
```

最低必须新增并证明：

1. host-path `parallel` recovery：completed terminal, recoverable resumes, timed_out not relaunched
2. host-path `stage_gated` recovery：blocked stage / restored checkpoint / resumed stage ordering all stay deterministic
3. health/control-plane surface 不再暗示未实现的 stalled/fleet semantics

## 9. Formal Review-Swarm And Self-Review

### 9.1 Formal review-swarm

必须使用固定 reviewer trio：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(zhipuai-coding-plan/glm-5)`

reviewers 必须显式检查：

1. live host path 是否真正锁住了 `parallel` / `stage_gated` recovery，而不是只在 core tests 里成立
2. `handleToolCall -> orch_run_execute_agent -> executeTeamRuntimeFromToolParams -> executeUnifiedTeamRuntime` 是否仍是唯一 shared path
3. 是否错误吸入了 `EVO-14` / fleet behavior / background watchdog
4. 当前 team-local health/control-plane surface 是否 honest，是否仍有 pseudo-health residue
5. packet 对 out-of-scope / blocker / debt 的分类是否成立

### 9.2 Self-review

外部 review-swarm 收敛后，必须再做正式 self-review，至少覆盖：

1. multi-assignment recovery completeness on the live host path
2. team-local health/control-plane boundary是否真实、可审计、fail-closed
3. shared package boundary / stale-`dist` anti-drift 是否仍被 acceptance 守住
4. adopted / deferred / declined amendments 是否记录完整

## 10. Post-Closeout Sync

完成态至少同步：

1. `meta/remediation_tracker_v1.json`
2. `AGENTS.md`
3. 本文件 `meta/docs/prompts/prompt-2026-03-21-evo13-batch6-live-host-recovery-health-boundary.md`

默认**不**更新 `meta/REDESIGN_PLAN.md`，除非实现实际推翻了当前 `EVO-13` / `EVO-14` 边界。

若本批没有新的稳定架构不变量，完成汇报中必须明确写：

`无新增稳定不变量`
