# EVO-14 Batch 4 — Manual Stale-Claim Adjudication

## Scope

只实现 `EVO-14` 的最小人工 stale-claim intervention contract：

- 新增 `orch_fleet_adjudicate_stale_claim` 作为唯一显式人工 stale-claim 裁决 surface
- 该工具只处理当前 `status = claimed` 的 queue item，并要求精确 claim identity 校验
- 所有 mutation 继续严格收束在单个 `project_root`
- queue truth 仍只来自 `.autoresearch/fleet_queue.json`
- 裁决完成后仍回到既有 `orch_fleet_worker_poll` 主路径，不新增第二条 scheduler path
- host path 仍必须走 `@autoresearch/shared -> @autoresearch/orchestrator -> hep-mcp`

明确禁止：

- TTL / lease expiry / heartbeat auto release / auto reclaim
- auto takeover / auto reassignment / auto-heal
- central tick / daemon / `scheduler_state.json`
- 任何把 `fleet_workers.json` 或 derived health 升格为 adjudication gate authority 的做法
- 任何新的 cross-root mutation surface
- 任何把 `state.json`、`ledger.jsonl`、`team-execution-state.json`、`live_status`、`replay` 升格为 fleet authority 的做法
- 任何 `EVO-15`、Pipeline A retirement sweep、或回切 `EVO-13`

## Required Reads

1. `AGENTS.md`
2. `CLAUDE.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `.serena/memories/architecture-decisions.md`
7. `meta/docs/prompts/prompt-2026-03-22-evo14-batch1-fleet-status-read-model.md`
8. `meta/docs/prompts/prompt-2026-03-22-evo14-batch2-queue-claim-substrate.md`
9. `meta/docs/prompts/prompt-2026-03-22-evo14-batch3-worker-poll-heartbeat-resource-slots.md`
10. 当前 orchestrator queue / worker / status / host contract 源码与相邻 tests

## Authority Map

- Shared seam: `packages/shared/src/tool-names.ts`
- Queue truth authority: `.autoresearch/fleet_queue.json`
- Worker/resource truth authority: `.autoresearch/fleet_workers.json`
- Scheduler truth authority: transient `orch_fleet_worker_poll` behavior only
- Intervention truth authority: explicit `orch_fleet_adjudicate_stale_claim` tool call + resulting queue mutation + audit ledger event
- Generic orchestrator tool registry: `packages/orchestrator/src/orch-tools/{schemas.ts,fleet-queue-tools.ts,fleet-tool-specs.ts,index.ts}`
- Existing read-only cross-root surface remains `orch_fleet_status`
- hep-mcp host adapter/risk surface: `packages/hep-mcp/src/{tool-names.ts,tool-risk.ts}`

## GitNexus Gates

### Before implementation

1. `git status --short --branch`
2. `npx gitnexus analyze` (dirty worktree / new symbols => re-run `npx gitnexus analyze --force`)
3. Re-read `gitnexus://repo/autoresearch-lab/context`
4. Re-run `context/impact` for:
   - `handleToolCall`
   - `handleOrchFleetStatus`
   - `handleOrchFleetWorkerPoll`
   - `handleOrchRunExecuteAgent`
   - new `handleOrchFleetAdjudicateStaleClaim`

### Before review

若新增/重命名符号或关键调用链变化：

1. `npx gitnexus analyze --force`
2. `detect_changes`
3. `impact` / `context` for new stale-claim adjudication surface plus `handleToolCall`
4. 明确确认 `executeUnifiedTeamRuntime` 仍仅由 regression coverage 触达，而非实现扩张

## Implementation Notes

- `orch_fleet_adjudicate_stale_claim` 只接受：
  - `queue_item_id`
  - `expected_claim_id`
  - `expected_owner_id`
  - `adjudicated_by`
  - `disposition = requeue | completed | failed | cancelled`
  - required non-empty `note`
- queue schema本批不改；intervention truth 不落成第二份持久 authority
- queue item 必须仍是 `claimed`，且当前 `claim_id` / `owner_id` 必须与 operator 提供的 expected 值完全一致，否则 fail-closed
- `requeue` 复用 Batch 2 语义：`status -> queued`，清 claim，`attempt_count + 1`
- terminal disposition 复用 Batch 2 settle 语义：清 claim，`attempt_count` 不变
- 审计必须追加 `fleet_claim_adjudicated` ledger event；ledger 仍只做 audit，不回流为 queue authority
- 不得根据 worker heartbeat/staleness 自动触发 adjudication；operator 是否认为 claim stale 是外部 judgment，不是新的 persisted authority

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-evo14-batch4-manual-stale-claim-adjudication.md`
- `meta/remediation_tracker_v1.json`
- `.serena/memories/architecture-decisions.md`
- `packages/shared/src/tool-names.ts`
- `packages/orchestrator/src/orch-tools/{schemas.ts,fleet-queue-tools.ts,fleet-tool-specs.ts,index.ts}`
- `packages/orchestrator/tests/{orchFleetTestSupport.ts,orch-fleet-stale-claim-adjudication.test.ts,orch-fleet-claim.test.ts,orch-fleet-queue.test.ts}`
- `packages/hep-mcp/src/{tool-names.ts,tool-risk.ts}`
- `packages/hep-mcp/tests/contracts/{orchFleetStaleClaimAdjudication.test.ts,orchFleetQueue.test.ts}`
- `packages/hep-mcp/tests/toolContracts.test.ts`

Acceptance-driven doc sync may also change:

- `README.md`
- `docs/README_zh.md`
- `docs/TOOL_CATEGORIES.md`
- `docs/PROJECT_STATUS.md`

## Acceptance

1. `git diff --check`
2. `pnpm --filter @autoresearch/shared build`
3. `pnpm --filter @autoresearch/shared test`
4. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-queue.test.ts tests/orch-fleet-claim.test.ts tests/orch-fleet-stale-claim-adjudication.test.ts tests/orch-fleet-worker-poll.test.ts tests/orch-fleet-worker-heartbeat.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
5. `pnpm --filter @autoresearch/orchestrator build`
6. `node scripts/check-orchestrator-package-freshness.mjs`
7. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetStaleClaimAdjudication.test.ts tests/contracts/orchFleetQueue.test.ts tests/contracts/orchFleetWorkerPoll.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
8. `pnpm --filter @autoresearch/hep-mcp build`
9. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
10. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`

## Review-Swarm Packet Assumptions

Reviewers must explicitly re-check these assumptions instead of trusting the packet:

1. Queue truth stays only in `.autoresearch/fleet_queue.json`
2. Worker/resource truth stays only in `.autoresearch/fleet_workers.json`
3. Scheduler truth stays only in transient `orch_fleet_worker_poll` behavior
4. Batch 4 does not smuggle in TTL, heartbeat takeover, auto reassignment, or central scheduler semantics
5. Intervention truth does not become a second persisted authority file
6. `orch_fleet_status` remains the only cross-root read-only fleet surface
7. `handleOrchRunExecuteAgent` / `executeUnifiedTeamRuntime` remain regression-only

## Self-Review Checklist

1. Post-change GitNexus confirms the blast radius stays bounded to fleet queue/tool/host surfaces
2. No automatic stale detection or automatic takeover logic was introduced
3. The new tool requires exact claim identity match and fails closed on stale reads
4. Queue mutation remains the only state change; ledger remains audit-only
5. Tool-name seam, risk map, package freshness, and tool-count docs stay synchronized

## SOTA Archive

- No separate SOTA archive required for this bounded contract slice; it is a direct continuation of the already-established EVO-14 authority partition.

## Closeout Sync

- `meta/remediation_tracker_v1.json`: keep `EVO-14` as `in_progress`, record Batch 4 as manual stale-claim adjudication and keep TTL/takeover/daemon deferred
- `AGENTS.md`: only update if phase summary or root governance changes; otherwise explicitly record “no AGENTS content change needed”
- `.serena/memories/architecture-decisions.md`: add the stable invariant that stale-claim intervention is explicit manual adjudication only and returns to the existing worker-poll path without auto takeover
- `meta/REDESIGN_PLAN.md`: update only if implementation disproves current EVO-14 batch ordering or lane boundaries
- `meta/.review/` remains gitignored

## Version Control Gate

- Default main worktree only; do not create a new worktree unless the human explicitly changes scope
- Do not `git commit` / `git push` without fresh human authorization
- If commit is later authorized, this canonical prompt file must ship with the same implementation commit
