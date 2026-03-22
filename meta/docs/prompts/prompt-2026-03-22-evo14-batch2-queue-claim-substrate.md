# EVO-14 Batch 2 — Queue / Claim Substrate

## Scope

只实现 `EVO-14` 的最小 per-project queue / claim substrate：

- 新增 `fleet_queue_v1` checked-in schema authority，落盘到每个项目根的 `.autoresearch/fleet_queue.json`
- 新增 `orch_fleet_enqueue`、`orch_fleet_claim`、`orch_fleet_release`
- 扩展 `orch_fleet_status`，在既有 read-only fleet snapshot 中加入 bounded queue summary
- 所有 mutation 继续严格收束在单个 `project_root`
- host path 仍必须走 `@autoresearch/shared -> @autoresearch/orchestrator -> hep-mcp`

明确禁止：

- TTL / heartbeat expiry / auto-reclaim / steal / takeover
- background scheduler / worker pool / resource budgeting
- global health monitor / reassignment / auto-heal
- 任何 `EVO-15`、Pipeline A retirement sweep、或回切 `EVO-13` team-local runtime 语义
- 任何从 `ledger.jsonl`、`state.json`、`team-execution-state.json`、`live_status`、`replay` 反推 queue truth 的第二 authority

## Required Reads

1. `AGENTS.md`
2. `CLAUDE.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `.serena/memories/architecture-decisions.md`
7. `meta/docs/prompts/prompt-2026-03-22-evo14-batch1-fleet-status-read-model.md`
8. 当前 orchestrator queue/read-model/host contract 源码与相邻 tests

## Authority Map

- Shared seam: `packages/shared/src/tool-names.ts` + generated `fleet-queue-v1` bindings
- Schema authority: `meta/schemas/fleet_queue_v1.schema.json`
- Queue truth authority: `.autoresearch/fleet_queue.json`
- Generic orchestrator tool registry: `packages/orchestrator/src/orch-tools/{schemas,index,fleet-queue-store,fleet-queue-tools,fleet-status}.ts`
- hep-mcp host adapter/risk surface: `packages/hep-mcp/src/{tool-names,tool-risk}.ts`
- Batch-1 read-only fleet aggregation remains `orch_fleet_status`; Batch 2 must extend rather than replace it

## GitNexus Gates

### Before implementation

1. `git status --short --branch`
2. `npx gitnexus analyze` (dirty worktree/new symbols appear later => re-run `npx gitnexus analyze --force`)
3. Re-read `gitnexus://repo/autoresearch-lab/context`
4. Re-run `context/impact` for:
   - `handleToolCall`
   - `handleOrchRunExecuteAgent`
   - `executeTeamRuntimeFromToolParams`
   - `executeUnifiedTeamRuntime`
   - new `handleOrchFleetEnqueue`
   - new `handleOrchFleetClaim`
   - new `handleOrchFleetRelease`
   - queue store / queue summary helpers

### Before review

若新增/重命名符号或关键调用链变化：

1. `npx gitnexus analyze --force`
2. `detect_changes`
3. `impact` / `context` for new fleet queue surface
4. 明确确认 `executeUnifiedTeamRuntime` blast radius 仍只受 regression coverage 触达，而非实现扩张

## Implementation Notes

- `fleet_queue_v1` 只表达 queue truth，不表达 scheduler truth
- `status` 固定为 `queued | claimed | completed | failed | cancelled`
- `claim` 为 non-expiring exclusive claim record；Batch 2 不引入 lease TTL 或 health takeover
- `orch_fleet_enqueue` 只允许 known run；active item conflict 必须显式 fail-closed
- `orch_fleet_claim` 在无 queued item 时必须返回 deterministic non-error response，不得抛异常或回退到别的 authority
- `orch_fleet_release` 只有当前 claimant 能 settle；`requeue` 才会 `attempt_count + 1`
- queue write 继续沿用同文件系统 atomic write；ledger 只追加 audit event，不参与 ownership 计算
- 缺文件、invalid queue JSON、unknown run、duplicate active item、owner mismatch 都必须有显式 diagnostic

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-evo14-batch2-queue-claim-substrate.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `meta/schemas/fleet_queue_v1.schema.json`
- `packages/shared/src/tool-names.ts`
- `packages/shared/src/generated/{fleet-queue-v1,index,research-loop-packet-v1}.ts`
- `meta/generated/python/{fleet_queue_v1,__init__,research_loop_packet_v1}.py`
- `packages/orchestrator/src/orch-tools/{schemas,index,fleet-status,fleet-queue-store,fleet-queue-tools}.ts`
- `packages/orchestrator/tests/{orchFleetTestSupport,orch-fleet-status,orch-fleet-queue,orch-fleet-claim}.test.ts`
- `packages/hep-mcp/src/{tool-names,tool-risk}.ts`
- `packages/hep-mcp/tests/contracts/{orchFleetStatus,orchFleetQueue,sharedOrchestratorPackageExports}.test.ts`
- `packages/hep-mcp/tests/toolContracts.test.ts`

## Acceptance

1. `git diff --check`
2. `bash meta/scripts/codegen.sh`
3. `pnpm --filter @autoresearch/shared build`
4. `pnpm --filter @autoresearch/shared test`
5. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-status.test.ts tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
6. `pnpm --filter @autoresearch/orchestrator build`
7. `node scripts/check-orchestrator-package-freshness.mjs`
8. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetStatus.test.ts tests/contracts/orchFleetQueue.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
9. `pnpm --filter @autoresearch/hep-mcp build`
10. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
11. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`

## Review-Swarm Packet Assumptions

Reviewers must explicitly re-check these assumptions instead of trusting the packet:

1. Queue truth must exist only in `.autoresearch/fleet_queue.json`; ledger/state-derived ownership is forbidden
2. `team-execution-state.json`, `live_status`, and `replay` remain team-local evidence only, not fleet authority
3. Batch 2 must not silently smuggle in TTL expiry, heartbeat takeover, scheduler, resource, or reassignment semantics
4. The shared authority chain remains `shared -> orchestrator -> hep-mcp`
5. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` stay regression-only and do not receive new implementation semantics in this batch

## Self-Review Checklist

1. Post-change GitNexus confirms the new blast radius stays inside fleet queue/read-model/host surfaces
2. Queue ownership still has a single authority and is not reconstructed from ledger/state
3. Missing queue file stays a non-error empty view in `orch_fleet_status`
4. Tool-name seam, risk map, package freshness, and tool-count docs stay synchronized
5. Any acceptance-driven generated-file drift kept in the patch must be source-of-truth regeneration, not speculative manual edits

## Closeout Sync

- `meta/remediation_tracker_v1.json`: keep `EVO-14` as `in_progress`, record Batch 2 closed and Batch 3 still pending
- `AGENTS.md`: only update if phase summary or root governance changes; otherwise explicitly record “no AGENTS content change needed”
- `.serena/memories/architecture-decisions.md`: add the stable invariant that fleet queue authority is per-project-root queue truth plus cross-root read-only aggregation, with no implicit reclaim
- `meta/.review/` remains gitignored

## Version Control Gate

- Default main worktree only; do not create a new worktree unless the human explicitly changes scope
- Do not `git commit` / `git push` without fresh human authorization
- If commit is later authorized, this canonical prompt file must ship with the same implementation commit
