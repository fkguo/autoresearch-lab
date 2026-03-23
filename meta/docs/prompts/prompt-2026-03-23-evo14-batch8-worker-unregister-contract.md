# EVO-14 Batch 8 — Drained Worker Unregister Contract

## Scope

只实现 `EVO-14` 的最小 worker lifecycle 闭环收口：

- 新增唯一显式 worker-unregister mutation surface `orch_fleet_worker_unregister`
- 仅允许对已 drain 完成的 worker 执行显式 unregister
- 继续只通过现有 `orch_fleet_status` 暴露 cross-root read-model visibility
- 继续保留 `orch_fleet_worker_heartbeat` / `orch_fleet_worker_poll` 的既有 upsert / scheduler 语义

明确禁止：

- `EVO-15`
- Pipeline A retirement sweep
- 回切 `EVO-13`
- manual reassignment / auto takeover / auto reassignment / worker stealing
- daemonized scheduling / central tick / hidden sweep
- 第二个 fleet read tool / second fleet authority file / second scheduler surface
- 从 `ledger.jsonl`、`state.json`、`team-execution-state.json`、`live_status`、`replay` 重建 fleet lifecycle truth

## Required Reads

1. `AGENTS.md`
2. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `.serena/memories/architecture-decisions.md`
6. `meta/docs/prompts/prompt-2026-03-22-evo14-batch2-queue-claim-substrate.md`
7. `meta/docs/prompts/prompt-2026-03-22-evo14-batch3-worker-poll-heartbeat-resource-slots.md`
8. `meta/docs/prompts/prompt-2026-03-22-evo14-batch4-manual-stale-claim-adjudication.md`
9. `meta/docs/prompts/prompt-2026-03-22-evo14-batch5-operator-stale-signal-status-audit-contract.md`
10. `meta/docs/prompts/prompt-2026-03-22-evo14-batch6-lease-authority-explicit-expiry-contract.md`
11. `meta/docs/prompts/prompt-2026-03-22-evo14-batch7-worker-claim-acceptance-gate.md`
12. 当前 orchestrator / hep-mcp fleet worker / queue / status 源码与相邻 tests

## Preflight

1. 若当前 worktree 含未提交改动，先执行 `npx gitnexus analyze --force`；否则至少执行 `npx gitnexus analyze`
2. 重新读取 `gitnexus://repo/autoresearch-lab/context`
3. 在开工前再次确认当前 EVO-14 已锁定的不变量：
   - per-project queue authority 只在 `.autoresearch/fleet_queue.json`
   - per-project worker/resource authority 只在 `.autoresearch/fleet_workers.json`
   - lease authority 只在 `.autoresearch/fleet_queue.json` claim records
   - scheduler truth 仍是 transient `orch_fleet_worker_poll` behavior
   - `orch_fleet_status` 仍是唯一 cross-root read-only 入口
   - 不得把 `state.json` / `ledger.jsonl` / `team-execution-state.json` / `live_status` / `replay` 升格为 fleet authority

## Authority Map

- Worker/resource truth authority: `.autoresearch/fleet_workers.json`
- Worker unregister authority: explicit `orch_fleet_worker_unregister` tool call only
- Queue / claim / lease authority: `.autoresearch/fleet_queue.json`
- Scheduler truth authority: transient `orch_fleet_worker_poll` behavior only
- Cross-root read surface authority: `orch_fleet_status`

## Contract Locks

- 新增 shared/orchestrator/host seam：
  - `orch_fleet_worker_unregister`
- 新工具输入 contract 固定为：
  - `project_root`
  - `worker_id`
  - `unregistered_by`
  - `note`
- 新工具必须：
  - unknown worker fail-closed
  - worker registry invalid fail-closed
  - queue registry invalid fail-closed
  - `accepts_claims !== false` fail-closed
  - derived `active_claim_count > 0` fail-closed
  - 只更新 `.autoresearch/fleet_workers.json`
  - 只追加 audit-only ledger event `fleet_worker_unregistered`
  - 不注册 worker，不修改 queue truth，不 release claim，不 claim work
- 缺失 queue 文件时，`active_claim_count` 必须按 `0` 处理，而不是发明第二 authority
- `orch_fleet_worker_heartbeat` 与 `orch_fleet_worker_poll` 必须继续保留既有 upsert semantics，不得变成 hidden unregister/drain mutation path
- later 同名 worker 重新出现时，只允许通过既有 `heartbeat` / `poll` upsert path 自然重注册
- `orch_fleet_status` shape 不得改变；worker 数量变化只通过现有 read model 自然反映

## Affected Files

- `meta/docs/prompts/prompt-2026-03-23-evo14-batch8-worker-unregister-contract.md`
- `meta/remediation_tracker_v1.json`
- `meta/REDESIGN_PLAN.md`
- `.serena/memories/architecture-decisions.md`
- `packages/shared/src/tool-names.ts`
- `packages/orchestrator/src/orch-tools/schemas.ts`
- `packages/orchestrator/src/orch-tools/fleet-tool-specs.ts`
- `packages/orchestrator/src/orch-tools/fleet-worker-unregister.ts`
- `packages/orchestrator/tests/orch-fleet-worker-unregister.test.ts`
- `packages/orchestrator/tests/orch-fleet-worker-heartbeat.test.ts`
- `packages/orchestrator/tests/orch-fleet-worker-poll.test.ts`
- `packages/orchestrator/tests/orch-fleet-status.test.ts`
- `packages/hep-mcp/src/tool-names.ts`
- `packages/hep-mcp/src/tool-risk.ts`
- `packages/hep-mcp/tests/contracts/orchFleetWorkerUnregister.test.ts`
- `packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
- `packages/hep-mcp/tests/toolContracts.test.ts`
- `README.md`
- `docs/README_zh.md`
- `docs/TOOL_CATEGORIES.md`
- `docs/PROJECT_STATUS.md`

## Acceptance

1. `npx gitnexus analyze`
2. reread `gitnexus://repo/autoresearch-lab/context`
3. `git diff --check`
4. `pnpm --filter @autoresearch/shared build`
5. `pnpm --filter @autoresearch/shared test`
6. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/orch-fleet-worker-heartbeat.test.ts tests/orch-fleet-worker-poll.test.ts tests/orch-fleet-worker-claim-acceptance.test.ts tests/orch-fleet-worker-unregister.test.ts tests/orch-fleet-stale-claim-adjudication.test.ts tests/orch-fleet-status.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
7. `pnpm --filter @autoresearch/orchestrator build`
8. `node scripts/check-orchestrator-package-freshness.mjs`
9. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetQueue.test.ts tests/contracts/orchFleetWorkerPoll.test.ts tests/contracts/orchFleetWorkerClaimAcceptance.test.ts tests/contracts/orchFleetWorkerUnregister.test.ts tests/contracts/orchFleetStatus.test.ts tests/contracts/orchFleetStaleClaimAdjudication.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
10. `pnpm --filter @autoresearch/hep-mcp build`
11. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
12. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
13. 因本批新增 symbol 且改动 fleet-worker lifecycle path，review 前必须再次执行 `npx gitnexus analyze --force`
14. review 前必须补齐 `detect_changes` + `impact/context`（至少覆盖 `handleOrchFleetWorkerUnregister`、`handleOrchFleetWorkerPoll`、`handleOrchFleetStatus`、hep-mcp `handleToolCall`）
15. 正式 closeout：`review-swarm` with `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`，然后 source-grounded `self-review`

## Review-Swarm Packet Assumptions

Reviewers must re-check:

1. `.autoresearch/fleet_workers.json` 是否仍是唯一 worker/resource authority
2. `orch_fleet_worker_unregister` 是否真的是唯一 unregister mutation path
3. `orch_fleet_worker_unregister` 是否只在 `accepts_claims=false && active_claim_count=0` 时删除 worker record
4. `orch_fleet_worker_unregister` 是否没有 release / requeue / takeover / claim side effect
5. `orch_fleet_worker_heartbeat` / `orch_fleet_worker_poll` 是否仍只是 preserving/upsert path，而不是 hidden unregister/drain fallback
6. `orch_fleet_status` 是否继续保持唯一 cross-root read surface，且 shape 未变化
7. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` 是否继续只是 regression-only

## Self-Review Checklist

1. unknown worker 是否仍 fail-closed，而没有被顺手注册/忽略
2. invalid queue / invalid worker registry 是否仍 fail-closed，而不是猜测 active claims 为 0
3. unregister 是否只删除 worker registry record，并写 audit-only ledger event
4. queue truth / lease truth / claim ownership 是否完全未被 unregister 改写
5. heartbeat/poll 同名重注册是否仍只经由既有 upsert path
6. 是否没有引入 reassignment、takeover、daemon、second scheduler surface、second fleet authority/read surface
