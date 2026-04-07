# 2026-04-07 Next Batch Generic Closure Plan

## 目标

当前 command-inventory / `orch_*` exact-spec guard 已落地，因此下一批不应该再回到“继续零碎修 legacy shell 文案”的节奏。新的目标是把 generic-first 主线收成两层：

1. **立即闭环的四条 seam**
   - `front_door_authority_map`
   - residual Pipeline A support-surface retirement / classification
   - projection-only operator/read-model guard
   - `idea-engine` default-host authority first cut
2. **紧随其后的三条结构 seam**
   - `DelegatedRuntimeHandleV1`
   - `DelegatedRuntimeTransport`
   - `RuntimePermissionProfileV1`

前四条解决“今天还有哪些 surface 在抢 authority”；后三条解决“runtime 内部还缺哪些 typed seam 才能稳态扩大”。

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

## Following Structural Batch: Three Deeper Runtime Seams

### `DelegatedRuntimeHandleV1`

- 给 delegated lane 一个 first-class runtime handle，而不是继续把 `session` 当 assignment projection。
- 重点是 canonical handle / lineage，不是扩大 public payload。

### `DelegatedRuntimeTransport`

- 把 lane coordination / remote worker transport 从 runtime state 与 fleet lease 中拆开。
- transport 负责 delivery/activity；runtime state 继续负责 canonical execution lineage。

### `RuntimePermissionProfileV1`

- 把 tools/fs/network/approval_mode/reviewer/source 收成 typed permission lattice。
- 后续 prompt/runtime/approval 统一从这份 typed profile 编译，不再散落在 wrapper/help/runner 层。

## 推荐并行方式

- 主线程优先推进 `Seam A`
  - 这是 `Seam B/C/D` 的 authority baseline
- Sidecar 1：为 `Seam B` 产出 implementation packet，按 `run residue -> diagnostics/bridge truth -> authoring/support cleanup` 三切片拆开
- Sidecar 2：为 `Seam C` 产出 projection-only guard packet，明确哪些 surfaces 只能做 summary/projection
- Sidecar 3：为 `Seam D` 产出 `idea-engine` first-cut authority packet
- 研究侧 lane：继续深挖三条结构 seam 的源码证据，但默认先产计划/ADR，不直接抢实现带宽

## 完成判据

下一批至少应达到：

- checked-in `front_door_authority_map` 或等价 authority fixture 已存在，后续不再依赖聊天记忆判断 command boundary
- residual Pipeline A support surfaces 的去向写入持久 SSOT，而不是只留在 census 输出里
- projection-only guard 成为可机检 contract，而不是 reviewer 口头共识
- `idea-engine` default-host authority first cut 拿到 checked-in plan/prompt，后续实现不必再重做 authority census
