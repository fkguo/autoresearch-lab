# Prompt: Next Batch Projection-Only Operator/Read-Model Guard

## 0. 背景与目标

本 lane 的目标不是新增 runtime authority，而是把当前已 landed 的 `CP-OBJ-01C/01D/01E` 分层收口为可机检 guard：
`operator/read-model/diagnostics` surfaces 只能传播 derived projection，不得反向持有或重定义 canonical authority。

当前 source-grounded 事实：

- `packages/orchestrator/src/operator-read-model-summary.ts` 已集中 operator vocabulary（runtime summary、assignment approval attention、task projection、ledger status projection）。
- `packages/orchestrator/src/runtime-diagnostics-bridge.ts` 仅从 runtime projection 生成 `runtime_diagnostics_bridge_v1.json`（derived artifact）。
- `packages/orchestrator/src/team-execution-view.ts` / `team-execution-scoping.ts` / `orch-tools/run-read-model.ts` / `orch-tools/fleet-status-diagnostics.ts` 都是 view/projection 层。
- `packages/orchestrator/src/team-unified-runtime.ts` 当前返回 `live_status`/`replay`，但 canonical execution authority 仍应 rooted 在 state families，而不是这些返回 payload。

要交付的是一组实现与测试，使上述边界从“叙述正确”升级为“漂移即 fail-closed”。

## 1. Authority Boundary（必须遵守）

### 1.1 Canonical authority families（不可被 projection surfaces 重新拥有）

1. root project-run authority: `RunState` + `LedgerEvent`
2. delegated execution authority: `TeamExecutionState` + `TeamDelegateAssignment` + `TeamAssignmentSession`（含 team-local approval/checkpoint/event）
3. runtime step-checkpoint authority: `RunManifest`
4. research task/follow-up authority: `ResearchTask` + `ResearchEvent` + `ResearchCheckpoint`

### 1.2 Projection/read-model/diagnostics surfaces（只允许 derived outward）

1. `operator-read-model-summary` vocabulary/interpreter
2. `run-read-model` list/status/approvals views
3. `team-execution-view` live_status/replay payload
4. `runtime-diagnostics-bridge` artifact summary/evidence envelope
5. `fleet-status-diagnostics` attention signals

这些 surfaces 允许：

- 读取 canonical state 并做 deterministic projection
- 输出 `blocked_on` / `requires_action` / `attention_reason` 等 derived context

这些 surfaces 禁止：

- 新增或接管 approval ownership / lifecycle mutation authority
- 新增“第二套 canonical status/task/session truth”
- 借 `live_status` / `replay` / diagnostics artifact 反向成为 persistence authority

## 2. Implementation Scope（本 lane 要做什么）

1. 盘点并收口 `projection-only` invariants 到可测试 contract
2. 给关键 read-model/diagnostics surfaces 增加 anti-drift 断言（类型、mapping、语义）
3. 明确 blocked-on/requires-action 传播策略：只输出 derived context，不输出 ownership mutation
4. 对外文档与注释保持“projection != authority”一致表述（仅触及本 lane 直接相关文件）

## 3. Non-goals（明确不做）

1. 不引入新的 `job` / durable `turn` authority family
2. 不扩大 public `team` payload（`live_status`、`replay`、`assignment_results`）
3. 不把 fleet/remote 直接重写成 transport layer redesign
4. 不重开 `CP-OBJ-01E` task-ref bridge 语义，也不重开 `M-22` lifecycle/workflow authority judgment

## 4. Required Source Surfaces（先读后改）

- `meta/docs/plans/2026-04-07-next-batch-generic-closure-plan.md`
- `meta/docs/plans/2026-04-07-next-batch-generic-command-taxonomy-and-projection-guard.md`
- `packages/orchestrator/src/operator-read-model-summary.ts`
- `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
- `packages/orchestrator/src/team-execution-scoping.ts`
- `packages/orchestrator/src/team-execution-view.ts`
- `packages/orchestrator/src/team-unified-runtime.ts`
- `packages/orchestrator/src/orch-tools/run-read-model.ts`
- `packages/orchestrator/src/orch-tools/fleet-status-diagnostics.ts`
- `meta/REDESIGN_PLAN.md`（`CP-OBJ-01C/01D/01E` 相关叙事）

## 5. Suggested Edit Sequence（建议顺序）

1. 先在 `operator-read-model-summary.ts` 明确“derived status mapping contract”，避免 downstream 各自解释
2. 在 `run-read-model.ts` 与 `team-execution-view.ts` 锁定“projection payload 不承担 authority mutation”
3. 在 `runtime-diagnostics-bridge.ts` 与 `fleet-status-diagnostics.ts` 锁定“diagnostics artifact/signal = derived evidence”
4. 在 `team-unified-runtime.ts` 相邻测试中锁定“不扩大 public payload，不提升 projection 为 authority”
5. 最后补齐/更新测试，确保语义漂移 fail-closed

## 6. Acceptance（最低验收）

至少运行并通过以下命令（可按实现增补）：

1. `git diff --check`
2. `pnpm --filter @autoresearch/orchestrator test -- tests/team-unified-runtime.test.ts tests/team-unified-runtime-sequential.test.ts tests/team-execution-runtime.test.ts`
3. `pnpm --filter @autoresearch/orchestrator test -- tests/package-boundary.test.ts`
4. `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts`
5. 若触及 host contract：`pnpm --filter @autoresearch/hep-mcp test -- tests/contracts/sharedOrchestratorPackageExports.test.ts tests/contracts/orchestratorPackageFreshness.test.ts`

若新增 dedicated projection guard tests，应把它们纳入上述 orchestrator/hep-mcp scoped acceptance。

## 7. Formal Review Packet（必须 widen 到这些面）

formal review packet 不能只看 changed-files diff。至少纳入：

1. `operator-read-model-summary.ts`
2. `run-read-model.ts`
3. `team-execution-view.ts` + `team-execution-scoping.ts`
4. `runtime-diagnostics-bridge.ts`
5. `team-unified-runtime.ts`（及相邻 runtime support/call path）
6. `fleet-status-diagnostics.ts`
7. 对应 tests（orchestrator + host-path contract）
8. `meta/REDESIGN_PLAN.md` 中 `CP-OBJ-01C/01D/01E` 叙事片段

review challenge 点必须显式回答：

1. 有没有任何 projection surface 新增或隐式接管了 approval ownership？
2. 有没有把 diagnostics/read-model artifacts 升格为 canonical state？
3. 有没有扩大 public team payload 或引入新的 authority family？
4. blocked-on/requires-action 是否严格是 derived outward context？

## 8. Self-review Checklist（提交前逐项勾）

1. `projection` 字段是否全部可追溯到 canonical authority source？
2. `status`/`attention` 映射是否 deterministic，且 unmapped path fail-closed/保留前态而非伪造新 authority？
3. `live_status`/`replay`/bridge artifact 是否只增解释信息，不增 mutation ownership？
4. tests 是否覆盖“不能反向成为 authority”的负向路径？
5. docs/注释是否清楚写明“projection-only”，没有把 read-model wording 写成 canonical truth？

## 9. 完成定义

仅当以下条件同时满足，本 lane 才可 closeout：

1. acceptance 全绿
2. formal trio review `blocking_issues = []`
3. formal self-review 0 blocking
4. tracker + redesign 对本 lane 的边界叙事已与代码事实一致
