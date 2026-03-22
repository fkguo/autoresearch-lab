# EVO-14 Batch 1 — TS-first Fleet Visibility Read Model

## Scope

只实现 `EVO-14` 的最小 cross-run / fleet-level visibility slice：

- 新增只读 tool `orch_fleet_status`
- 输入为显式 `project_roots`
- 聚合现有 run-level truth：`.autoresearch/state.json`、`.autoresearch/ledger.jsonl`、`artifacts/runs/<run_id>/approvals/**`
- host path 仍必须走 `@autoresearch/shared -> @autoresearch/orchestrator -> hep-mcp`

明确禁止：

- queue / claim / lease / persistent fleet registry
- background scheduler / worker / resource budgeting
- global agent-pool health / reassignment
- 任何 EVO-15 / EVO-16 / community lane / domain-pack lane 工作
- 任何 `executeUnifiedTeamRuntime` / `executeTeamRuntimeFromToolParams` / `handleOrchRunExecuteAgent` team-local 语义变更

## Required Reads

1. `AGENTS.md`
2. `CLAUDE.md`
3. `meta/remediation_tracker_v1.json`
4. `meta/REDESIGN_PLAN.md`
5. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
6. `.serena/memories/architecture-decisions.md`
7. `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`
8. 当前 orchestrator / orch-tools / host contract 源码与相邻 tests

## Authority Map

- Shared seam: `packages/shared/src/tool-names.ts`
- Generic orchestrator tool registry: `packages/orchestrator/src/orch-tools/index.ts`
- hep-mcp host adapter/dispatcher: `packages/hep-mcp/src/tools/orchestrator/tools.ts`, `packages/hep-mcp/src/tools/registry/projectExtensions.ts`, `packages/hep-mcp/src/tools/dispatcher.ts`
- Team-local EVO-13 runtime authority stays in `packages/orchestrator/src/{orch-tools/agent-runtime,team-execution-bridge,team-unified-runtime}.ts`

## GitNexus Gates

### Before implementation

1. `git status --short --branch`
2. `npx gitnexus analyze --force`
3. Re-read `gitnexus://repo/autoresearch-lab/context`
4. Re-run `context/impact` for:
   - `handleToolCall`
   - `handleOrchRunExecuteAgent`
   - `executeTeamRuntimeFromToolParams`
   - `executeUnifiedTeamRuntime`
   - new `handleOrchFleetStatus`
   - new read-model helper surface

### Before review

若新增/重命名符号或关键调用链变化：

1. `npx gitnexus analyze --force`
2. `detect_changes`
3. `impact` / `context` for new fleet surface
4. 明确确认 `executeUnifiedTeamRuntime` blast radius 未被实现 diff 扩张

## Implementation Notes

- 新增 `orch_fleet_status` Zod schema，兼容 legacy filter alias `complete -> completed`
- 新增 read-model helper，并让既有 `orch_run_list` / `orch_run_approvals_list` 复用该 helper
- fleet tool 的 per-project failure 必须落在该 project 的 `errors[]`，不能让整个 tool fail
- Batch 1 不读取 `team-execution-state.json`
- Batch 1 不引入新的 checked-in queue/health JSON schema authority

## Affected Files

- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`
- `meta/docs/prompts/prompt-2026-03-22-evo14-batch1-fleet-status-read-model.md`
- `packages/shared/src/tool-names.ts`
- `packages/orchestrator/src/orch-tools/{schemas,index,create-status-list,approval,run-read-model,fleet-status}.ts`
- `packages/hep-mcp/src/{tool-names,tool-risk}.ts`
- `packages/orchestrator/tests/orch-fleet-status.test.ts`
- `packages/hep-mcp/tests/contracts/orchFleetStatus.test.ts`
- `packages/hep-mcp/tests/contracts/sharedOrchestratorPackageExports.test.ts`
- `packages/hep-mcp/tests/toolContracts.test.ts`

## Acceptance

1. `git diff --check`
2. `pnpm --filter @autoresearch/shared build`
3. `pnpm --filter @autoresearch/orchestrator test -- tests/orch-fleet-status.test.ts tests/agent-runner.test.ts tests/team-unified-runtime-parallel-recovery.test.ts tests/team-unified-runtime-stage-gated-recovery.test.ts`
4. `pnpm --filter @autoresearch/orchestrator build`
5. `node scripts/check-orchestrator-package-freshness.mjs`
6. `pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/orchFleetStatus.test.ts tests/contracts/orchRunApprove.test.ts tests/contracts/orchRunExecuteAgent.team-parallel-recovery.test.ts tests/contracts/orchRunExecuteAgent.team-stage-gated-recovery.test.ts tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts tests/toolContracts.test.ts`
7. `pnpm --filter @autoresearch/hep-mcp build`
8. `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`

## Review-Swarm Packet Assumptions

Reviewers must explicitly re-check these assumptions instead of trusting the packet:

1. Batch 1 is visibility-only; queue/scheduler/global health are still out of scope
2. `executeUnifiedTeamRuntime` and other EVO-13 core files should have no implementation diff
3. Fleet snapshot only reuses run-level truth; it must not treat team-local `live_status` / `replay` as fleet authority
4. The shared authority chain remains `shared -> orchestrator -> hep-mcp`

## Self-Review Checklist

1. Post-change GitNexus confirms the new blast radius stays in fleet read-model / host surfaces
2. `executeUnifiedTeamRuntime` / `handleOrchRunExecuteAgent` stay regression-only, not implementation targets
3. Tool-name seam, host risk, and package freshness gates stay synchronized
4. `REDESIGN_PLAN` removes stale Python scheduler / hepar authority wording for EVO-14

## Closeout Sync

- `meta/remediation_tracker_v1.json`: keep `EVO-14` as `in_progress`, record Batch 1 closed and Batch 2/3 still pending
- `AGENTS.md`: only update if phase summary or root governance changes; otherwise explicitly record “no AGENTS content change needed”
- `.serena/memories/architecture-decisions.md`: add a stable invariant only if Batch 1 lands as explicit-project-roots visibility-first EVO-14
- `meta/.review/` remains gitignored

## Version Control Gate

- Default main worktree only; do not create a new worktree unless the human explicitly changes scope
- Do not `git commit` / `git push` without fresh human authorization
- If commit is later authorized, this canonical prompt file must ship with the same implementation commit
