# 2026-04-07 Next Batch Generic Closure Plan

## 目标

当前 command-inventory / `orch_*` exact-spec guard 已落地，而且同日 follow-up 已把 `idea-engine` default-host authority first cut 落到代码与测试上，因此下一批不应该再回到“继续零碎修 legacy shell 文案”的节奏。新的目标是把 generic-first 主线收成两层：

1. **已落地并可继续依赖的 immediate seams**
   - `front_door_authority_map`
   - `idea-engine` default-host authority first cut
2. **当前仍需闭环的 immediate seams**
   - residual Pipeline A support-surface retirement / classification
   - projection-only operator/read-model guard
3. **紧随其后的三条结构 seam（建议批内顺序）**
   - `DelegatedRuntimeHandleV1`
   - `RuntimePermissionProfileV1`
   - `DelegatedRuntimeTransport`

已落地的两条 seam 先把 front-door taxonomy 与 idea host default authority 稳住；剩余两条 immediate seams 继续解决“今天还有哪些 support/projection surface 在抢 authority”；后三条结构 seam 则解决“runtime 内部还缺哪些 typed seam 才能稳态扩大”。

## 深挖后的 SOTA 依据

这轮规划不再停留在 README/摘要层，而是直接参考了 Codex 与 Claude Code 的源码分层：

- `../codex/codex-rs/app-server/src/thread_state.rs`
  - canonical thread/session state 自己保留 durable handle 与 lineage，不让 operator summary 反向成为 authority。
- `../codex/codex-rs/app-server-protocol/src/protocol/thread_history.rs`
  - protocol 层显式区分 canonical history object 与 presentation/projection metadata。
- `../claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`
  - remote session transport 是单独层，不和本地 session authority 混在一起。
- `../claude-code-sourcemap/restored-src/src/remote/SessionsWebSocket.ts`
  - websocket/remote updates 传播的是 session activity，不是新的 control-plane authority。
- `../codex/codex-rs/protocol/src/permissions.rs`
  - permission/profile 是 typed lattice，而不是 scattered booleans。
- `../claude-code-sourcemap/restored-src/src/tools/AgentTool/runAgent.ts`
  - delegate/run-agent surface 显式带 permissions/source/seat context，而不是让 tool wrapper 自己偷定义权限语义。

对 autoresearch 的直接启示是：

- `autoresearch` 继续是唯一 generic mutation front door。
- legacy shell、bridge、web、fleet/status、read-model 都只能是 compatibility 或 projection layer。
- 下一步需要的是 typed authority map / handle / transport / permission seams，而不是继续堆 ad hoc wording guards。

## Immediate Batch: Four Seams

### Seam A: `front_door_authority_map`

目标：

- 把当前已分散落地的三条 exact authority seam 升级成 checked-in typed authority map：
  - `autoresearch` top-level public commands
  - installable `hepar` public shell commands
  - exact `orch_*` MCP tool inventory
- 明确每个 surface 属于 `canonical_public`、`compatibility_public`、`internal_only`
- 让 docs drift guard / help contract / public-shell rejection 尽量从同一份 authority map 派生

为什么是第一条：

- 当前 closeout 已证明“单一跨 TS/Python 大总表”不是正确答案；真正缺的是能表达 **每个 authority surface 自己的 exact truth** 的 typed map。
- 这条 seam 一旦 landed，后续 residual support-surface 收口和 projection-only guard 都不需要反复 fresh census。

### Seam B: residual Pipeline A support-surface retirement / classification

目标：

- 把 `M-22` 剩余面收窄到真正的 provider-local compatibility residue，而不是继续让 `hepar run` / support commands 维持“还能操作，所以像 authority”。
- 明确每个残余 surface 的 `delete` / `repoint` / `keep-internal-only` 去向。

当前最需要切的三个子面：

1. public residual non-computation `run`
2. `doctor` / `bridge` / `literature-gap` contract rebaseline
3. `run-card` / `method-design` 与 package-local action docs 的相邻 authoring/support cleanup

### Seam C: projection-only operator/read-model guard

目标：

- 把 `CP-OBJ-01C/01D/01E` 已经形成的 runtime/read-model 分层，转成更明确的 anti-drift guard。
- 防止 `fleet`、`bridge`、`live_status`、`assignment_results`、diagnostics summary 再次长出 lifecycle/session/task authority。

收口方向：

- 为 projection/read-model surface 增加 authority-completeness / projection-only 断言
- 若需要 blocked-on context，只传播 canonical blocked-on projection，不传播审批 ownership
- 明确 `job` / durable `turn` 仍不是这一批要升格的新 authority family

### Seam D: `idea-engine` default-host authority first cut

目标：

- 先把默认 host authority 指向 TS `idea-engine` / `idea-mcp` 组合，而不是继续让 legacy `idea-core` / Python residue 在默认 public path 上维持模糊 authority。
- 第一刀聚焦 public method inventory 和 host default authority，不追求一次性 retire-all。

当前聚焦文件：

- `packages/idea-mcp/src/server.ts`
- `packages/idea-mcp/src/rpc-client.ts`
- `packages/idea-mcp/src/tool-registry.ts`
- `packages/idea-engine/src/service/rpc-service.ts`
- `packages/idea-engine/src/service/post-search-service.ts`
- `packages/shared/src/tool-names.ts`

2026-04-07 status:

- 已在当前 current-worktree 进一步收口：installable `idea-mcp` public host 现为 TS `idea-engine` only；旧的 `IDEA_MCP_BACKEND` / `IDEA_CORE_PATH` knobs 改为 fail-closed，child-process Python bridge path 已删除，不再保留 compatibility path。
- public tool inventory 现与默认 backend 对齐，只保留 `idea_campaign_init`, `idea_campaign_status`, `idea_search_step`, `idea_eval_run`。
- 当前 deferred methods 需要在后续 asset/contract authority follow-up 中统一重分层，而不是悄悄回流到 installable public inventory：`campaign.topup`、`campaign.pause`、`campaign.resume`、`campaign.complete`，以及旧 eight-tool bridge 里同样已退出当前 public surface 的 `node.get`、`node.list`。
- 当前下一跳已变成 default asset/contract authority follow-up，而不是 compatibility backend hygiene：TS 还在复用部分 Python-side contract/domain-pack assets，`rank.compute` / `node.promote` 也尚未被提升为当前 public MCP inventory。

## Following Structural Batch: Three Deeper Runtime Seams

source-grounded deep dive 已单独落成：`meta/docs/plans/2026-04-07-runtime-structural-seams-deep-dive.md`。该 deep dive 明确建议 structural batch 按 `Handle -> PermissionProfile -> Transport` 落地，而不是先做 transport 再回头补 identity / permission authority。

### `DelegatedRuntimeHandleV1`

- 给 delegated lane 一个 first-class runtime handle，而不是继续把 `session` 当 assignment projection。
- 重点是 canonical handle / lineage，不是扩大 public payload。

### `RuntimePermissionProfileV1`

- 把 tools/fs/network/approval_mode/reviewer/source 收成 typed permission lattice。
- 后续 prompt/runtime/approval 统一从这份 typed profile 编译，不再散落在 wrapper/help/runner 层。

### `DelegatedRuntimeTransport`

- 把 lane coordination / remote worker transport 从 runtime state 与 fleet lease 中拆开。
- transport 负责 delivery/activity；runtime state 继续负责 canonical execution lineage。

## 推荐并行方式

- 主线程优先推进 `Seam A`
  - 这是 `Seam B/C/D` 的 authority baseline
- Sidecar 1：为 `Seam B` 产出 implementation packet，按 `run residue -> diagnostics/bridge truth -> authoring/support cleanup` 三切片拆开
- Sidecar 2：为 `Seam C` 产出 projection-only guard packet，明确哪些 surfaces 只能做 summary/projection
- Sidecar 3：为 `Seam D` 产出 `idea-engine` first-cut authority packet
- 研究侧 lane：继续深挖三条结构 seam 的源码证据，但默认先产计划/ADR，不直接抢实现带宽

## Post-Seam-D Execution Order

当前 `idea-mcp` host seam 已进一步收口为 TS-only，因此下一轮并行队列应直接转向下面 5 条 lane：

1. `Seam C / Slice A1`: 删除 `TeamExecutionState.pending_approvals` 这条 persisted projection authority。
   目标：`approve` intervention 只基于 assignment 自身 canonical approval metadata；`live_status.pending_approvals` 退回现算 view。
   低冲突文件：`packages/orchestrator/src/team-execution-interventions.ts`、`packages/orchestrator/src/team-execution-scoping.ts`、`packages/orchestrator/src/team-execution-types.ts`、相邻 tests。
2. `Seam C / Slice A2`: 让 `fleet enqueue` 脱离 `run-read-model` 存在性判断。
   目标：新增 raw `runExists` / equivalent helper，只基于 current state + raw ledger/artifact presence 判定 run 是否已知，不再把 read-model projection 倒灌成 mutation gate。
   低冲突文件：`packages/orchestrator/src/orch-tools/fleet-queue-tools.ts`、`packages/orchestrator/src/orch-tools/run-read-model.ts`、相邻 fleet tests。
3. `Seam B / Public workflow authority`: 退役 installable public `hepar run --workflow-id paper_reviser`。
   目标：切断 legacy Python public shell 最后一条 workflow authority，而不是继续让 `run` 维持 residual public authority。
   风险：会碰 shell inventory/docs/tests，需与后两条 public-shell lane 串行。
4. `Seam B / Public authoring-spec authority`: 退役 `method-design` 与 `run-card validate|render` 的 public installable authority。
   目标：把 computation authoring/spec validation 从 legacy Python public shell 移走，不再让它们看起来是 generic front door。
   风险：同样会改 shell inventory/docs/tests，建议接在 `paper_reviser` lane 之后。
5. `Seam B / Public utility-support cleanup`: de-publicize `branch`, `smoke-test`, `migrate`, 并重新判定 `approvals show` / `report render` / `logs` / `context` / `propose` / `skill-propose` 的去向。
   目标：优先切掉低价值 public legacy utilities，再决定 remaining operator/support surfaces 是 repoint 还是删除。
   并行方式：`smoke-test` + `migrate` 可先做快刀 lane；`branch` 与 operator/support surfaces 先做 owner/design 侦察后再实现。

## 完成判据

下一批至少应达到：

- checked-in `front_door_authority_map` 或等价 authority fixture 已存在，后续不再依赖聊天记忆判断 command boundary
- `Seam C` 至少完成一个 source-grounded projection-only fix（优先 `pending_approvals` 或 fleet enqueue read-model authority），而不是继续停留在 census/口头结论
- residual Pipeline A public support surfaces 的去向写入持久 SSOT，而不是只留在 census 输出里
- installable public legacy workflow/authoring/spec shell authority 至少再减少一个真实 survivor，而不是只新增“后续会删”的说明
- `idea-engine` host seam 不再需要 compatibility packet；后续只剩 asset/contract authority cleanup，而不是重新争论 host fallback
