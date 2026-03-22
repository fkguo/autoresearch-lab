# EVO-14 Batch 5 — Operator Stale-Signal Status/Audit Contract

## Scope

只实现 `EVO-14` 的最小 operator-facing stale-signal read-model closeout：

- 保持 `orch_fleet_status` 为唯一 cross-root read-only fleet 入口
- 在 `orch_fleet_status` 返回中新增纯派生的 claimed-item stale-signal diagnostics：
  - `claim_age_seconds`
  - `last_heartbeat_at`
  - `last_heartbeat_age_seconds`
  - `owner_worker_health`
  - `attention_required`
  - `attention_reasons[]`
- 在每个 project 的 queue summary 中新增纯派生 counters：
  - `attention_claim_count`
  - `claimed_without_worker_count`
  - `claimed_with_stale_worker_count`
- 继续只依赖 `.autoresearch/fleet_queue.json` 与 `.autoresearch/fleet_workers.json` 的现有 authority 进行派生

明确禁止：

- TTL / lease expiry / auto release
- auto takeover / auto reassignment / daemonized scheduling
- 新增 fleet read tool、scheduler file、status file、intervention file、或任何第二份 derived authority
- 从 `ledger.jsonl`、`state.json`、`team-execution-state.json`、`live_status`、`replay` 重建 fleet truth
- 修改 `orch_fleet_enqueue` / `claim` / `release` / `worker_poll` / `worker_heartbeat` / `adjudicate_stale_claim` 的 mutation semantics
- 任何 `EVO-15`、Pipeline A retirement sweep、或回切 `EVO-13`

## Required Reads

1. `AGENTS.md`
2. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `.serena/memories/architecture-decisions.md`
6. `meta/docs/prompts/prompt-2026-03-22-evo14-batch1-fleet-status-read-model.md`
7. `meta/docs/prompts/prompt-2026-03-22-evo14-batch2-queue-claim-substrate.md`
8. `meta/docs/prompts/prompt-2026-03-22-evo14-batch3-worker-poll-heartbeat-resource-slots.md`
9. `meta/docs/prompts/prompt-2026-03-22-evo14-batch4-manual-stale-claim-adjudication.md`
10. 当前 orchestrator fleet status / queue / worker 源码与相邻 tests

## Authority Map

- Cross-root read surface authority: `orch_fleet_status`
- Queue truth authority: `.autoresearch/fleet_queue.json`
- Worker/resource truth authority: `.autoresearch/fleet_workers.json`
- Scheduler truth authority: transient `orch_fleet_worker_poll` behavior only
- Intervention truth authority: explicit `orch_fleet_adjudicate_stale_claim` tool call + resulting queue mutation + audit ledger event
- New stale-signal fields are derived read-model output only; they are not persisted authority

## Implementation Notes

- `attention_reasons[]` 只允许使用：
  - `OWNER_WORKER_MISSING`
  - `OWNER_WORKER_STALE`
  - `CLAIM_WITHOUT_OWNER`
  - `QUEUE_OR_WORKER_REGISTRY_INVALID`
- claimed item 关联 healthy worker 时，只返回 age/health fields，不打 attention flag
- worker registry invalid 但 queue valid 时，claimed item 必须显示 `QUEUE_OR_WORKER_REGISTRY_INVALID`，且不触发任何 mutation
- 如果 queue invalid，则保持既有 fail-closed read-model error；不要用其他文件做 fallback reconstruction
- 不新增 checked-in persistent schema authority，也不做 codegen

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-evo14-batch5-operator-stale-signal-status-audit-contract.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `packages/orchestrator/src/orch-tools/fleet-status.ts`
- `packages/orchestrator/src/orch-tools/fleet-status-diagnostics.ts`
- `packages/orchestrator/src/orch-tools/fleet-queue-store.ts`
- `packages/orchestrator/tests/orch-fleet-status.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetStatus.test.ts`

## Acceptance

1. `git diff --check`
2. `pnpm --filter @autoresearch/shared build`
3. `pnpm --filter @autoresearch/shared test`
4. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-status.test.ts tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/orch-fleet-worker-poll.test.ts tests/orch-fleet-worker-heartbeat.test.ts tests/orch-fleet-stale-claim-adjudication.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
5. `pnpm --filter @autoresearch/orchestrator build`
6. `node scripts/check-orchestrator-package-freshness.mjs`
7. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetStatus.test.ts tests/contracts/orchFleetQueue.test.ts tests/contracts/orchFleetWorkerPoll.test.ts tests/contracts/orchFleetStaleClaimAdjudication.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
8. `pnpm --filter @autoresearch/hep-mcp build`

## Review-Swarm Packet Assumptions

Reviewers must re-check:

1. Queue truth remains only `.autoresearch/fleet_queue.json`
2. Worker/resource truth remains only `.autoresearch/fleet_workers.json`
3. Scheduler truth remains transient worker-poll behavior only
4. New stale-signal fields are derived read-model output only and do not become persisted authority
5. No TTL/lease, auto takeover, daemon, or second fleet read surface was introduced
6. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` remain regression-only

## Self-Review Checklist

1. Claimed-item diagnostics derive only from queue + worker authority already present in Batch 2/3
2. No mutation surface changed behavior
3. Invalid queue/worker registry still fails closed as read-model diagnostics instead of fallback reconstruction
4. Manual stale adjudication path still returns to the existing worker-poll path with no new scheduler semantics
5. Shared -> orchestrator -> hep-mcp host path still exposes a single `orch_fleet_status` surface
