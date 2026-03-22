# EVO-14 Batch 7 — Worker Claim Acceptance Gate

## Scope

只实现 `EVO-14` 的最小 worker lifecycle gate 收口：

- 为 per-project worker registry 增加显式 `accepts_claims: boolean`
- 新增唯一显式 mutation surface `orch_fleet_worker_set_claim_acceptance`
- 让现有 `orch_fleet_worker_poll` 在 heartbeat / lease renew / same-project expired-lease sweep 之后尊重该 gate
- 继续只通过现有 `orch_fleet_status` 暴露 cross-root read-model visibility

明确禁止：

- `EVO-15`
- Pipeline A retirement sweep
- 回切 `EVO-13`
- auto takeover / auto reassignment / worker stealing
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
11. 当前 orchestrator / hep-mcp fleet worker / queue / status 源码与相邻 tests

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
- Claim-acceptance authority: `.autoresearch/fleet_workers.json` 中 `workers[].accepts_claims`
- Queue / claim / lease authority: `.autoresearch/fleet_queue.json`
- Scheduler truth authority: transient `orch_fleet_worker_poll` behavior only
- Cross-root read surface authority: `orch_fleet_status`
- Claim-acceptance mutation authority: explicit `orch_fleet_worker_set_claim_acceptance` tool call only

## Contract Locks

- `fleet_workers_v1` 每个 worker 必须带 required `accepts_claims: boolean`
- 新增 shared/orchestrator/host seam：
  - `orch_fleet_worker_set_claim_acceptance`
- 新工具输入 contract 固定为：
  - `project_root`
  - `worker_id`
  - `accepts_claims`
  - `updated_by`
  - `note`
- 新工具必须：
  - unknown worker fail-closed
  - 只更新 `.autoresearch/fleet_workers.json`
  - 只追加 audit-only ledger event
  - 不注册 worker，不修改 queue truth，不 release claim，不 claim work
- `orch_fleet_worker_heartbeat` 与 `orch_fleet_worker_poll` 必须保留已存在的 `accepts_claims`，不得成为隐藏 mutation path
- `orch_fleet_worker_poll` 必须仍然：
  - heartbeat 当前 worker
  - renew 该 worker 已拥有且未过期的 leases
  - 执行相同 same-project expired-lease sweep
  - 然后若 `accepts_claims = false`，返回 deterministic non-error `WORKER_NOT_ACCEPTING_CLAIMS`
  - 且不 claim 新 queued item
- 停止接受新 claim 不得自动 release / takeover / reassign 现有 claim
- `orch_fleet_status` 仍是唯一 cross-root read surface，只能增加：
  - worker `accepts_claims`
  - worker summary / aggregate summary 中的 acceptance counts

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-evo14-batch7-worker-claim-acceptance-gate.md`
- `meta/remediation_tracker_v1.json`
- `meta/REDESIGN_PLAN.md`
- `.serena/memories/architecture-decisions.md`
- `meta/schemas/fleet_workers_v1.schema.json`
- `meta/generated/python/fleet_workers_v1.py`
- `packages/shared/src/generated/fleet-workers-v1.ts`
- `packages/shared/src/tool-names.ts`
- `packages/orchestrator/src/orch-tools/schemas.ts`
- `packages/orchestrator/src/orch-tools/fleet-worker-store.ts`
- `packages/orchestrator/src/orch-tools/fleet-worker-tools.ts`
- `packages/orchestrator/src/orch-tools/fleet-status.ts`
- `packages/orchestrator/src/orch-tools/fleet-tool-specs.ts`
- `packages/orchestrator/src/orch-tools/fleet-worker-claim-acceptance.ts`
- `packages/orchestrator/tests/orch-fleet-worker-heartbeat.test.ts`
- `packages/orchestrator/tests/orch-fleet-worker-poll.test.ts`
- `packages/orchestrator/tests/orch-fleet-status.test.ts`
- `packages/orchestrator/tests/orch-fleet-worker-claim-acceptance.test.ts`
- `packages/hep-mcp/src/tool-names.ts`
- `packages/hep-mcp/src/tool-risk.ts`
- `packages/hep-mcp/tests/contracts/orchFleetWorkerPoll.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetStatus.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetWorkerClaimAcceptance.test.ts`
- `packages/hep-mcp/tests/toolContracts.test.ts`
- `README.md`
- `docs/README_zh.md`
- `docs/TOOL_CATEGORIES.md`
- `docs/PROJECT_STATUS.md`

## Acceptance

1. `npx gitnexus analyze`
2. reread `gitnexus://repo/autoresearch-lab/context`
3. `git diff --check`
4. `bash meta/scripts/codegen.sh`
5. `pnpm --filter @autoresearch/shared build`
6. `pnpm --filter @autoresearch/shared test`
7. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/orch-fleet-worker-poll.test.ts tests/orch-fleet-worker-heartbeat.test.ts tests/orch-fleet-worker-claim-acceptance.test.ts tests/orch-fleet-stale-claim-adjudication.test.ts tests/orch-fleet-status.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
8. `pnpm --filter @autoresearch/orchestrator build`
9. `node scripts/check-orchestrator-package-freshness.mjs`
10. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetQueue.test.ts tests/contracts/orchFleetWorkerPoll.test.ts tests/contracts/orchFleetWorkerClaimAcceptance.test.ts tests/contracts/orchFleetStatus.test.ts tests/contracts/orchFleetStaleClaimAdjudication.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
11. `pnpm --filter @autoresearch/hep-mcp build`
12. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
13. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
14. 因本批新增 symbol 且改动 fleet-worker call path，review 前必须再次执行 `npx gitnexus analyze --force`
15. review 前必须补齐 `detect_changes` + `impact/context`（至少覆盖 `handleOrchFleetWorkerPoll`、`handleOrchFleetWorkerSetClaimAcceptance`、`handleOrchFleetStatus`、hep-mcp `handleToolCall`）
16. 正式 closeout：`review-swarm` with `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`，然后 source-grounded `self-review`

## Review-Swarm Packet Assumptions

Reviewers must re-check:

1. `accepts_claims` 是否仍只活在 `.autoresearch/fleet_workers.json`
2. `orch_fleet_worker_set_claim_acceptance` 是否真的是唯一 claim-acceptance mutation path
3. `orch_fleet_worker_heartbeat` / `orch_fleet_worker_poll` 是否保持 preserving-only，而没有覆盖该 gate
4. `orch_fleet_worker_poll` 是否只在 renew/sweep 之后 short-circuit 为 `WORKER_NOT_ACCEPTING_CLAIMS`，且没有偷带 takeover / reassignment
5. `orch_fleet_status` 是否仍是唯一 cross-root read surface
6. `ledger.jsonl`、`state.json`、`team-execution-state.json`、`live_status`、`replay` 是否仍未被提升为 fleet lifecycle authority
7. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` 是否继续只是 regression-only

## Self-Review Checklist

1. `accepts_claims` 是否只存在于 worker registry authority，而非从 heartbeat age / queue / lease 派生
2. unknown worker 是否仍 fail-closed，而没有被新工具顺手注册
3. `worker_poll` 是否仍先 heartbeat + renew + same-project expiry sweep，再 gate 新 claim
4. 停止接受新 claim 是否没有影响已有 lease/claim ownership
5. status / summary exposure 是否仍是 read-only derived output，而非第二 authority
6. 是否没有引入 takeover、reassignment、daemon、second scheduler surface、second fleet read surface
