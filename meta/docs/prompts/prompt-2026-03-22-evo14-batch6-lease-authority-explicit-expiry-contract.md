# EVO-14 Batch 6 — Lease Authority & Explicit Expiry Contract

## Scope

只实现 `EVO-14` 的最小 lease / expiry contract 收口：

- 把 lease authority 固定到 `.autoresearch/fleet_queue.json` 的 queue claim 自身
- 为 queue claim 增加 explicit expiry contract：
  - `lease_duration_seconds`
  - `lease_expires_at`
- 只在现有 `orch_fleet_worker_poll` 主路径内实现 bounded auto-expiry / auto-release
- 补齐对应 audit / status / fail-closed contract

明确禁止：

- `EVO-15`
- Pipeline A retirement sweep
- 回切 `EVO-13`
- auto takeover / auto reassignment / worker stealing
- daemonized scheduling / central tick / hidden sweep
- 第二个 fleet read tool
- 第二份 fleet authority 文件
- 基于 `ledger.jsonl`、`state.json`、`team-execution-state.json`、`live_status`、`replay` 的 authority reconstruction

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
10. 当前 orchestrator / hep-mcp fleet queue / worker / status 源码与相邻 tests

## Preflight

1. 若当前 worktree 含未提交改动，先执行 `npx gitnexus analyze --force`；否则至少执行 `npx gitnexus analyze`
2. 重新读取 `gitnexus://repo/autoresearch-lab/context`
3. 在开工前再次确认当前 EVO-14 已锁定的不变量：
   - per-project queue authority 只在 `.autoresearch/fleet_queue.json`
   - per-project worker/resource authority 只在 `.autoresearch/fleet_workers.json`
   - scheduler truth 仍是 transient `orch_fleet_worker_poll` behavior
   - intervention truth 仍是显式 tool call + queue mutation + ledger audit
   - `orch_fleet_status` 仍是唯一 cross-root read-only 入口
   - 不得把 `state.json` / `ledger.jsonl` / `team-execution-state.json` / `live_status` / `replay` 升格为 fleet authority

## Authority Map

- Queue truth authority: `.autoresearch/fleet_queue.json`
- Lease authority: `.autoresearch/fleet_queue.json` 中 `items[].claim`
- Worker/resource truth authority: `.autoresearch/fleet_workers.json`
- Scheduler truth authority: transient `orch_fleet_worker_poll` behavior only
- Intervention truth authority: explicit `orch_fleet_adjudicate_stale_claim` tool call + resulting queue mutation + audit ledger event
- Cross-root read surface authority: `orch_fleet_status`

## Contract Locks

- `fleet_queue_v1` claim 必须扩展为显式 lease authority：
  - `lease_duration_seconds`
  - `lease_expires_at`
- `orch_fleet_claim` 与 `orch_fleet_worker_poll` 允许可选输入 `lease_duration_seconds`，缺省解析为 `60`
- 一旦 claim 已存在，renewal 必须使用 claim 中已持久化的 `lease_duration_seconds`
- expiry 只依据 queue claim 自身的 `lease_expires_at` 与当前时间比较得出
- missing worker / stale heartbeat / missing heartbeat 继续只是 Batch 5 diagnostics；不能独立让 claim 过期
- worker registry invalid 时，`orch_fleet_worker_poll` 必须 fail-closed 且不做 auto-release
- auto-release 只能发生在现有 `orch_fleet_worker_poll` 内的 same-project pre-claim sweep
- `orch_fleet_worker_heartbeat` 仍只维护 worker registry，绝不修改 queue truth
- auto-release 语义固定为 `requeue`：
  - 清除 claim metadata
  - `attempt_count += 1`
  - 保持 priority / ordering 字段不变
- `orch_fleet_status` 仍是唯一 cross-root read-only 入口，只能补充 lease read-only fields / counters
- Batch 5 `attention_reasons` taxonomy 保持不变

## Audit Contract

- 新增 `fleet_claim_auto_released` ledger event，details 至少包含：
  - `queue_item_id`
  - `prior_claim_id`
  - `prior_owner_id`
  - `prior_lease_expires_at`
  - `lease_duration_seconds`
  - `disposition: "requeue"`
  - `reason: "LEASE_EXPIRED"`
  - `triggered_by: "worker_poll"`
  - `trigger_worker_id`
- 现有 `fleet_claimed` details 必须补齐：
  - `lease_duration_seconds`
  - `lease_expires_at`
- 现有 manual release / adjudication audit payloads 在清除 claim 时必须带上 prior lease fields

## Status Contract

- claimed item 新增只读字段：
  - `lease_expires_at`
  - `lease_remaining_seconds`
  - `lease_expired`
- 每个 project queue summary 新增：
  - `expired_claim_count`
- aggregate summary 也新增：
  - `expired_claim_count`
- 不新增新的 fleet read tool，不把 read model 反向用作 mutation authority

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-evo14-batch6-lease-authority-explicit-expiry-contract.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `meta/schemas/fleet_queue_v1.schema.json`
- `packages/shared/src/generated/fleet-queue-v1.ts`
- `packages/shared/src/generated/index.ts`
- `meta/generated/python/fleet_queue_v1.py`
- `meta/generated/python/__init__.py`
- `packages/orchestrator/src/orch-tools/schemas.ts`
- `packages/orchestrator/src/orch-tools/fleet-queue-store.ts`
- `packages/orchestrator/src/orch-tools/fleet-queue-tools.ts`
- `packages/orchestrator/src/orch-tools/fleet-worker-tools.ts`
- `packages/orchestrator/src/orch-tools/fleet-status.ts`
- `packages/orchestrator/src/orch-tools/fleet-status-diagnostics.ts`
- `packages/orchestrator/src/orch-tools/fleet-tool-specs.ts`
- `packages/orchestrator/src/orch-tools/fleet-lease.ts`
- `packages/orchestrator/tests/orchFleetTestSupport.ts`
- `packages/orchestrator/tests/orch-fleet-claim.test.ts`
- `packages/orchestrator/tests/orch-fleet-worker-poll.test.ts`
- `packages/orchestrator/tests/orch-fleet-status.test.ts`
- `packages/orchestrator/tests/orch-fleet-stale-claim-adjudication.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetQueue.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetWorkerPoll.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetStatus.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetStaleClaimAdjudication.test.ts`

## Acceptance

1. `npx gitnexus analyze`
2. reread `gitnexus://repo/autoresearch-lab/context`
3. `git diff --check`
4. `bash meta/scripts/codegen.sh`
5. `pnpm --filter @autoresearch/shared build`
6. `pnpm --filter @autoresearch/shared test`
7. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/orch-fleet-worker-poll.test.ts tests/orch-fleet-worker-heartbeat.test.ts tests/orch-fleet-stale-claim-adjudication.test.ts tests/orch-fleet-status.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
8. `pnpm --filter @autoresearch/orchestrator build`
9. `node scripts/check-orchestrator-package-freshness.mjs`
10. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetQueue.test.ts tests/contracts/orchFleetWorkerPoll.test.ts tests/contracts/orchFleetStatus.test.ts tests/contracts/orchFleetStaleClaimAdjudication.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
11. `pnpm --filter @autoresearch/hep-mcp build`
12. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
13. 因本批新增 lease helper 且改动关键调用链，review 前必须再次执行 `npx gitnexus analyze --force`
14. review 前必须补齐 `detect_changes` + `impact/context`（至少覆盖 `handleOrchFleetClaim`、`handleOrchFleetRelease`、`handleOrchFleetAdjudicateStaleClaim`、`handleOrchFleetWorkerPoll`、`handleOrchFleetStatus`、hep-mcp `handleToolCall`）
15. 正式 closeout：`review-swarm` with `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`，然后 source-grounded `self-review`

## Review-Swarm Packet Assumptions

Reviewers must re-check:

1. lease authority 是否仍唯一落在 `.autoresearch/fleet_queue.json` claim 内
2. expiry 是否只由显式 `lease_expires_at` 决定，而非 worker stale/missing 推导
3. auto-release 是否仍只经由既有 `orch_fleet_worker_poll` 主路径触发
4. `orch_fleet_worker_heartbeat` 是否保持 queue-non-mutating
5. `orch_fleet_status` 是否仍是唯一 cross-root read-only surface
6. `ledger.jsonl`、`state.json`、`team-execution-state.json`、`live_status`、`replay` 是否仍未被提升为 fleet authority
7. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` 是否继续只是 regression-only

## Self-Review Checklist

1. Queue claim 现在是否是 lease 的唯一 canonical authority
2. renewal 是否只用持久化 claim duration，而没有重新套默认值或误用 heartbeat timeout
3. auto-release 是否只发生在 same-project worker poll sweep，且固定为 `requeue`
4. invalid worker registry 是否仍 fail-closed no-op，而非静默 sweep / fallback
5. status / audit 是否补齐 lease 字段但没有变成新的 mutation authority
6. 是否没有引入 daemon、takeover、reassignment、第二 read tool、第二 authority file
