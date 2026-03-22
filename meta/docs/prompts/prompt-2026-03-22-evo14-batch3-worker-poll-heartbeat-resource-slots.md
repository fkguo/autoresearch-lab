# EVO-14 Batch 3 — Worker-Poll Scheduler, Heartbeat Health, Resource Slots

## Scope

只实现 `EVO-14` 的最小 scheduler / worker / resource semantics：

- 新增 `fleet_workers_v1` checked-in schema authority，落盘到每个项目根的 `.autoresearch/fleet_workers.json`
- 新增 `orch_fleet_worker_poll` 作为 Batch 3 的唯一 scheduler surface
- 新增 `orch_fleet_worker_heartbeat` 作为 worker liveness refresh surface
- 扩展 `orch_fleet_status`，在既有 cross-root read-only fleet snapshot 中加入 worker/health/resource summary
- 所有 mutation 继续严格收束在单个 `project_root`
- host path 仍必须走 `@autoresearch/shared -> @autoresearch/orchestrator -> hep-mcp`

明确禁止：

- `orch_fleet_schedule_tick`、background daemon、central tick scheduler
- TTL expiry、auto reclaim、steal / takeover、auto reassignment、auto-heal
- cross-root mutation
- 任何把 `state.json`、`ledger.jsonl`、`team-execution-state.json`、`live_status`、`replay` 升格为 queue / worker / scheduler authority 的做法
- 任何 `EVO-15`、Pipeline A retirement sweep、或回切 `EVO-13` team-local runtime 语义

## Required Reads

1. `AGENTS.md`
2. `CLAUDE.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `.serena/memories/architecture-decisions.md`
7. `meta/docs/prompts/prompt-2026-03-22-evo14-batch1-fleet-status-read-model.md`
8. `meta/docs/prompts/prompt-2026-03-22-evo14-batch2-queue-claim-substrate.md`
9. 当前 orchestrator fleet queue / status / host contract 源码与相邻 tests

## Authority Map

- Shared seam: `packages/shared/src/tool-names.ts` + generated `fleet-workers-v1` bindings
- Schema authority: `meta/schemas/fleet_workers_v1.schema.json`
- Queue truth authority: `.autoresearch/fleet_queue.json`
- Worker/resource truth authority: `.autoresearch/fleet_workers.json`
- Scheduler truth: transient `worker poll` algorithm over queue truth + worker registry truth; Batch 3 不新增持久 `scheduler_state.json`
- Generic orchestrator tool registry: `packages/orchestrator/src/orch-tools/{schemas.ts,index.ts,fleet-worker-store.ts,fleet-worker-tools.ts,fleet-status.ts}`
- Existing queue substrate authority remains `packages/orchestrator/src/orch-tools/fleet-queue-tools.ts`
- hep-mcp host adapter/risk surface: `packages/hep-mcp/src/{tool-names.ts,tool-risk.ts}`
- Batch-1/2 `orch_fleet_status` remains the only cross-root surface and stays read-only

## GitNexus Gates

### Before implementation

1. `git status --short --branch`
2. `npx gitnexus analyze` (dirty worktree / new symbols / helper callsites => re-run `npx gitnexus analyze --force`)
3. Re-read `gitnexus://repo/autoresearch-lab/context`
4. Re-run `context/impact` for:
   - `handleToolCall`
   - `handleOrchRunExecuteAgent`
   - `executeTeamRuntimeFromToolParams`
   - `executeUnifiedTeamRuntime`
   - new `handleOrchFleetWorkerPoll`
   - new `handleOrchFleetWorkerHeartbeat`
   - worker store / worker summary helpers

### Before review

若新增/重命名符号或关键调用链变化：

1. `npx gitnexus analyze --force`
2. `detect_changes`
3. `impact` / `context` for new worker surfaces plus `handleToolCall`
4. 明确确认 `executeUnifiedTeamRuntime` blast radius 仍只受 regression coverage 触达，而非实现扩张

### After commit

默认不因为“刚 commit 完”机械刷新 GitNexus。只有在 commit 后立刻还要依赖 GitNexus 做下一步判断，或该 commit 刚引入关键新符号 / 调用链时，才补一次 post-commit refresh。

## Implementation Notes

- `fleet_workers_v1` 只表达 worker/resource truth，不表达 queue ownership、active claim authority、claim disposition 或 scheduler decision
- `orch_fleet_worker_poll` 是唯一 scheduler surface；它采用 worker pull 模式，并复用既有 deterministic queue ordering
- `orch_fleet_worker_heartbeat` 只刷新 worker liveness，不领取任务，不修改 queue ownership
- active claim count 必须继续只从 `.autoresearch/fleet_queue.json` 现算；不得把该值持久化进 `.autoresearch/fleet_workers.json`
- heartbeat/staleness 只用于 read-model health 和 fail-closed diagnostic；Batch 3 不允许 heartbeat 自动释放、自动接管、自动迁移 queue claim
- 缺失 queue 文件时，`orch_fleet_worker_poll` 必须返回 deterministic non-error `NO_QUEUED_ITEM`
- worker 已满槽位时，`orch_fleet_worker_poll` 必须返回 deterministic non-error `AT_CAPACITY`
- invalid worker registry JSON/schema、invalid queue JSON/schema、unknown run host path drift、或 owner/authority mismatch 都必须显式 fail-closed
- `orch_fleet_claim` / `orch_fleet_release` 保持 Batch 2 低层 substrate；Batch 3 在其之上增加 worker-poll 调度面，而不是平行再做第二套 central scheduler authority

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-evo14-batch3-worker-poll-heartbeat-resource-slots.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `meta/schemas/fleet_workers_v1.schema.json`
- `packages/shared/src/tool-names.ts`
- `packages/shared/src/generated/{fleet-workers-v1.ts,index.ts}`
- `meta/generated/python/{fleet_workers_v1.py,__init__.py}`
- `packages/orchestrator/src/orch-tools/{schemas.ts,index.ts,fleet-tool-specs.ts,fleet-status.ts,fleet-queue-tools.ts,fleet-worker-store.ts,fleet-worker-tools.ts}`
- `packages/orchestrator/tests/{orchFleetTestSupport.ts,orch-fleet-status.test.ts,orch-fleet-worker-poll.test.ts,orch-fleet-worker-heartbeat.test.ts}`
- `packages/hep-mcp/src/{tool-names.ts,tool-risk.ts}`
- `packages/hep-mcp/tests/contracts/{orchFleetStatus.test.ts,orchFleetWorkerPoll.test.ts,sharedOrchestratorPackageExports.test.ts}`
- `packages/hep-mcp/tests/toolContracts.test.ts`

Acceptance-driven regeneration/doc sync may also change:

- `README.md`
- `docs/README_zh.md`
- `docs/TOOL_CATEGORIES.md`
- `docs/PROJECT_STATUS.md`

## Acceptance

1. `git diff --check`
2. `bash meta/scripts/codegen.sh`
3. `pnpm --filter @autoresearch/shared build`
4. `pnpm --filter @autoresearch/shared test`
5. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-status.test.ts tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/orch-fleet-worker-poll.test.ts tests/orch-fleet-worker-heartbeat.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
6. `pnpm --filter @autoresearch/orchestrator build`
7. `node scripts/check-orchestrator-package-freshness.mjs`
8. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetStatus.test.ts tests/contracts/orchFleetQueue.test.ts tests/contracts/orchFleetWorkerPoll.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
9. `pnpm --filter @autoresearch/hep-mcp build`
10. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
11. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`

## Review-Swarm Packet Assumptions

Reviewers must explicitly re-check these assumptions instead of trusting the packet:

1. Queue truth must stay only in `.autoresearch/fleet_queue.json`; `fleet_workers.json` must not become a second ownership authority
2. Worker/resource truth may live in `.autoresearch/fleet_workers.json`, but active claim count and scheduler disposition must still be derived from queue truth rather than persisted twice
3. Scheduler truth must remain transient worker-poll behavior; no `scheduler_state.json`, central tick, daemon, or auto takeover may appear
4. Heartbeat/staleness must remain health/read-model semantics only; no implicit reclaim/reassignment should happen
5. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` stay regression-only and do not receive new implementation semantics in this batch
6. The shared authority chain remains `shared -> orchestrator -> hep-mcp`

## Self-Review Checklist

1. Post-change GitNexus confirms the new blast radius stays inside fleet worker/queue/status/host surfaces
2. Queue truth, worker truth, and scheduler truth remain distinct and singular rather than leaking into two persisted authorities
3. `orch_fleet_status` remains read-only and cross-root only; all mutation surfaces remain single-project-root
4. No speculative fallback, auto takeover, TTL reclaim, or second scheduler path was introduced
5. Tool-name seam, risk map, package freshness, and tool-count docs stay synchronized
6. Any acceptance-driven generated/doc drift kept in the patch is source-of-truth regeneration only

## SOTA Archive

- Archive dir: `/Users/fkg/.autoresearch-lab-dev/sota-preflight/2026-03-22/evo14-batch3-worker-poll-heartbeat-resource-slots/`
- Worktree pointer: `.tmp/evo14-batch3-sota-preflight.md`

## Closeout Sync

- `meta/remediation_tracker_v1.json`: keep `EVO-14` as `in_progress`, record Batch 3 closed and subsequent scheduler/takeover work still pending only if a concrete later slice remains
- `AGENTS.md`: only update if phase summary or root governance changes; otherwise explicitly record “no AGENTS content change needed”
- `.serena/memories/architecture-decisions.md`: add the stable invariant that queue truth and worker/resource truth are separate per-project authorities, while scheduler truth remains transient worker-poll behavior and heartbeat is non-takeover health only
- `meta/REDESIGN_PLAN.md`: update only if implementation disproves the current EVO-13 / EVO-14 / EVO-15 lane boundary
- `meta/.review/` remains gitignored

## Version Control Gate

- Default main worktree only; do not create a new worktree unless the human explicitly changes scope
- Do not `git commit` / `git push` without fresh human authorization
- If commit is later authorized, this canonical prompt file must ship with the same implementation commit
