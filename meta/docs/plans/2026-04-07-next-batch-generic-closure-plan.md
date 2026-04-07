# 2026-04-07 Next Batch Generic Closure Plan

## 目标

在 `M-22A` / `M-22B` 收口之后，下一批不应回到“继续随手清理 hepar”式的散点修补，而应围绕三个 generic-first 目标推进：

1. 把 command / surface authority 盘成可机检的 inventory，避免 legacy/internal surfaces 靠文案暗示漂移。
2. 把 residual Pipeline A support surface 收窄成真正的 provider-local compatibility residue，并给出 delete / repoint / keep-internal-only 的明确去向。
3. 把 bridge / fleet / diagnostics / read-model 继续锁成 projection-only seams，避免第二套 lifecycle/session/control-plane authority 从 operator surface 长出来。

## SOTA 依据

本批规划不是凭印象拍脑袋，而是参考了两套成熟 agent runtime 的实际源码分层：

- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
  - 把 thread/session/approval/permissions 暴露成 typed protocol，而不是 UI/bridge 约定。
- `../codex/codex-rs/protocol/src/approvals.rs`
  - approval request 带显式 decision set、permission/profile、network context、scope，而不是 ad hoc bool gate。
- `../codex/codex-rs/mcp-server/src/exec_approval.rs`
  - approval 通过异步 elicitation 回灌到 canonical thread，而不是让 MCP bridge 自己拥有执行 authority。
- `../codex/codex-rs/exec-server/src/server/registry.rs`
  - 进程执行与文件系统 RPC 独立成 exec server，control-plane 只调协议。
- `../claude-code-sourcemap/restored-src/src/services/tools/toolOrchestration.ts`
  - tool orchestration 先按 concurrency-safe / mutating 分区，避免把所有工具调用混成一层。
- `../claude-code-sourcemap/restored-src/src/utils/permissions/permissions.ts`
  - permission engine 单独分层，source / reason / persistence 明确，不让 UI 或 tool wrapper 偷偷定义权限语义。
- `../claude-code-sourcemap/restored-src/src/utils/sessionState.ts`
  - session 只有 `idle | running | requires_action` 这类 canonical state，而 pending-action 详情作为 projection metadata 对外传播。
- `../claude-code-sourcemap/restored-src/src/bridge/sessionRunner.ts`
  - bridge 只转发 session 活动和 permission request，不直接拥有 session authority。

对 autoresearch 的直接启示：

- `autoresearch` 应继续是唯一 generic mutation front door。
- `hepar` / web / bridge / fleet / read-model 只能是 compatibility shell 或 projection layer。
- 需要一个显式 command inventory / state-surface inventory，而不只是文案漂移测试。

## Lane A: Command Inventory + Authority Taxonomy Gate

### 目标

建立一份 checked-in、可机检的 command/surface inventory，明确每个 entrypoint 属于哪一类：

- canonical public
- compatibility public
- internal-only maintainer/eval/regression

### 为什么现在做

当前 anti-drift 主要锁 wording：

- `scripts/check-shell-boundary-anti-drift.mjs`
- `scripts/lib/front-door-boundary-authority.mjs`
- `packages/hep-autoresearch/tests/test_public_cli_surface.py`

它们能防 public drift，但还没有一份“全命令 authority map”。这会让 `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` 里仍然存在的 internal-only commands (`start` / `checkpoint` / `request-approval` / `reject` / `doctor` / `bridge` / `literature-gap`) 只能靠人脑记忆判断边界。

### 建议产物

- 一个 checked-in inventory 文件，覆盖至少：
  - `autoresearch` CLI commands
  - installable `hepar` public shell commands
  - `hep_autoresearch.orchestrator_cli` internal-only commands
  - provider-local MCP / bridge helper surfaces（若会被 docs/help/operator 触及）
- 一个同步测试，验证：
  - inventory <-> help text
  - inventory <-> public CLI rejection tests
  - inventory <-> front-door wording fixture

### 非目标

- 不在这个 lane 里直接 repoint/delete 大量 Python logic
- 不把 package-local support surfaces 一次性全删掉

## Lane B: Residual Pipeline A Support-Surface Closure

### 目标

对 `M-22` 剩余面做 source-grounded 分类和收口，重点是：

- residual non-computation `run` workflows
- `doctor`
- `bridge`
- `literature-gap` internal full-parser path
- internal-only `start` / `checkpoint` / `request-approval` / `reject`

### 为什么现在做

`M-22A` 已把 generic lifecycle authority 收回 `autoresearch`，但 `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` 仍保留大量 support/internal parser 逻辑。下一步真正要回答的不是“hepar 还剩什么”，而是：

- 哪些必须 delete
- 哪些必须 repoint 到 TS
- 哪些可以 bounded keep，但必须显式 internal-only

### 建议顺序

1. 先用 Lane A 的 inventory 定边界
2. 再把 `doctor` / `bridge` / residual non-computation `run` 做分组 closeout
3. 最后处理 internal-only lifecycle-adjacent residue（如 `reject` parity 去向）

### 非目标

- 不重开 generic lifecycle authority
- 不把 HEP provider-local functionality 误上提为 generic orchestrator scope

## Lane C: Projection-Only Control-Plane Guardrails

### 目标

把现有 runtime / fleet / diagnostics / bridge / read-model 的“只能当 projection”的约束，转成更明确的 checked-in guardrails。

### 当前依据

- `packages/orchestrator/src/team-execution-bridge.ts`
- `packages/orchestrator/src/team-execution-scoping.ts`
- `packages/orchestrator/src/team-unified-runtime-support.ts`
- `packages/orchestrator/src/orch-tools/fleet-status-diagnostics.ts`
- `meta/REDESIGN_PLAN.md` 中已 landed 的 `CP-OBJ-01C/01D/01E` 叙事

### 具体机会

- 给 projection/read-model surfaces 增加更明确的 “authority completeness / projection-only” anti-drift assertions
- 防止 `fleet`, `bridge`, `live_status`, `assignment_results`, diagnostics summary 重新承载 lifecycle/session/task authority
- 评估是否需要一个更 generic 的 “blocked action / requires action” projection seam，让 operator surfaces 传播 canonical blocked-on context，但不拥有审批状态本身

### 非目标

- 不在这一批把 `job` / durable `turn` 引入为新 authority family
- 不重写 public team payload
- 不引入新的 shell/UI/front-end authority

## 建议并行方式

- 主线程优先推进 Lane A
  - 它是 Lane B/C 的边界基线
- Sidecar 1 推 Lane B 的 source-grounded surface census + cut proposal
- Sidecar 2 推 Lane C 的 guardrail/projection audit + prompt/spec 草案

## 完成判据

下一批至少要达到：

- 有一份 checked-in inventory / plan / prompt 能让后续 lane 不再反复重新 census
- residual support surfaces 的去向（delete / repoint / keep internal-only）写入持久 SSOT
- projection-only 约束不再只存在于 chat 解释或 reviewer 口头意见里
