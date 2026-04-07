# 2026-04-07 Runtime Structural Seams Deep Dive

## 目的

这份 memo 只回答一个问题：围绕 `DelegatedRuntimeHandleV1`、`DelegatedRuntimeTransport`、`RuntimePermissionProfileV1`，下一批真正值得做的结构 seam 是什么，哪些成熟系统里的实现细节不该被照搬进 autoresearch。

结论先行：

1. structural batch 的实际落地顺序应改成 `DelegatedRuntimeHandleV1 -> RuntimePermissionProfileV1 -> DelegatedRuntimeTransport`
2. `handle` 应先把 delegated runtime 的 canonical lineage / artifact refs 收成一个内部 typed seam
3. `permission profile` 应成为 tool/sandbox/approval/source 的 compile authority，而不是继续让 `ToolPermissionView` + host wrapper 分散持有语义
4. `transport` 必须最后落，并且只能负责 delivery/activity/control，不能再长成 runtime/session/fleet authority
5. 非目标保持不变：不引入 transcript-as-SSOT，不提前做 remote/fleet widening，不复制 Claude Code 的 UI permission context，也不复制 Codex 的兼容性包袱

## 当前仓内证据

### 1. handle / lineage 仍然分散在多个对象层

当前 delegated runtime identity 不是一个一等对象，而是散落在多处：

- `packages/orchestrator/src/execution-identity.ts`
  - `buildDelegatedExecutionIdentity(...)` 只负责把 `project_run_id + assignment_id` 组装成 `runtime_run_id`
- `packages/orchestrator/src/team-execution-scoping.ts`
  - `openAssignmentSession(...)` 再把 `session_id`、`runtime_run_id`、`checkpoint_id`、`resume_from`、fork lineage 塞进 `TeamAssignmentSession`
  - `normalizeTeamScopingState(...)` 仍需要为缺失 session 的 assignment 合成 synthetic session
- `packages/orchestrator/src/team-unified-runtime-support.ts`
  - `prepareAssignmentOutcome(...)` 与 `mergeLaunchOutcome(...)` 反复在 assignment / execution / runtime result 之间来回搬运 `runtime_run_id`、`manifest_path`、`resume_from`、`last_completed_step`
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
  - `executeDelegatedAgentRuntime(...)` 自己再根据 `runId` 计算 `manifest_path`、`spans_path` 并写出 diagnostics bridge

source-grounded 结论：

- 现在最缺的不是新的 transcript/history object，而是一个把 `project run -> assignment -> session -> runtime artifacts` 串起来的内部 typed handle
- `TeamAssignmentSession` 是 delegated execution authority 的一部分，但它还混着 projection/repair 语义，不适合直接充当 runtime handle

### 2. transport 还不存在，launch path 直接耦合在 team runtime 里

当前 launch path 是直接内联的：

- `packages/orchestrator/src/team-unified-runtime-support.ts`
  - `executeLaunch(...)` 直接构造 messages / filtered tools / permission view，然后同步调用 `executeDelegatedAgentRuntime(...)`
- `packages/orchestrator/src/team-unified-runtime.ts`
  - `executeUnifiedTeamRuntime(...)` 同时负责 state load/save、bucket scheduling、launch orchestration、live_status/replay projection 返回
- `packages/orchestrator/src/runtime-diagnostics-bridge.ts`
  - diagnostics bridge 只是 derived artifact，不是 transport layer

source-grounded 结论：

- 现在如果直接“做 transport”，很容易把 launch/delivery/control 继续塞进 `team-unified-runtime`，或者把 transport 和 team state/fleet lease 混成一层
- transport seam 必须建立在稳定 handle 之上，否则它只会围着字符串和 projection payload 继续长新胶水

### 3. permission 语义当前拆在三层，tool 只是最窄的一层

当前 runtime permission 相关 authority 主要散在：

- `packages/orchestrator/src/team-execution-types.ts`
  - `TeamPermissionMatrix` / `TeamDelegationPermission` / `TeamMcpToolInheritance`
- `packages/orchestrator/src/team-execution-permissions.ts`
  - `buildDelegatedToolPermissionView(...)` 把 matrix + assignment + inheritance 编译成 delegated tool allowlist
- `packages/orchestrator/src/tool-execution-policy.ts`
  - `ToolPermissionView` 只包含 `scope` / `actor_id` / `authority` / `allowed_tool_names` / `execution_policies`
- `packages/orchestrator/src/mcp-client.ts`
  - `bindToolPermissionView(...)` 在 call-time fail-close blocked tool
- `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`
  - `executeDelegatedAgentRuntime(...)` 继续把 `toolPermissionView` 当作 runtime permission 的主要 carrier

source-grounded 结论：

- 当前实现已经证明 tool visibility / execution policy 可以在 runtime fail-close，但这只是 permission lattice 的最窄切片
- approval scope、sandbox/filesystem/network、reviewer/source provenance 还没有统一 authority，因此未来很容易继续散落到 host wrapper / prompt / runner input

## 外部源码证据

### Codex：canonical state / history / permission profile 都是分层的

#### thread state 与 listener/connection 分层

- `../codex/codex-rs/app-server/src/thread_state.rs`
  - `ThreadState` 同时保留 `current_turn_history` 与 `listener_command_tx`，但 listener connection/subscriber 管理在 `ThreadStateManagerInner` 里单独维护
  - `clear_listener()` 会清理 listener channel 并 reset active-turn history，但不会把 subscriber transport 当作 thread history authority

启示：

- canonical execution lineage 与 transport/subscriber lifecycle 必须分层
- transport 变化不能决定 canonical runtime/session object 的 shape

#### history builder 是 canonical object reducer，不是 projection wrapper

- `../codex/codex-rs/app-server-protocol/src/protocol/thread_history.rs`
  - `ThreadHistoryBuilder` 专门负责把 `EventMsg` / `RolloutItem` 归约成 canonical `Turn`
  - `active_turn_snapshot()` 是 history builder 的能力，不是 transport/session manager 的副产品

启示：

- 如果我们要补 runtime handle，应该先把 lineage/object seam 收好，而不是先引入 transport 或 replay UI object
- 不应该把 `live_status` / `replay` 这类 projection 反向提升成 runtime handle

#### permission profile 用 request/grant/scope 表达，而不是 scattered booleans

- `../codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
  - `RequestPermissionProfile`
  - `AdditionalPermissionProfile`
  - `GrantedPermissionProfile`
  - `PermissionGrantScope = Turn | Session`
- `../codex/codex-rs/protocol/src/permissions.rs`
  - filesystem/network policy 是 typed lattice，不是散在 runner 参数里的 bool

启示：

- `RuntimePermissionProfileV1` 应该从一开始就把“请求/授予/作用域”语义留出明确槽位
- 但我们不需要照搬 Codex 的 forward-compat parser baggage；autoresearch 没有 backward-compat 负担

### Claude Code：remote session / websocket / permission UI 是清晰拆开的

#### remote session authority 不等于 websocket authority

- `../claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`
  - manager 负责 session-level message flow、permission request bookkeeping、cancel/reconnect API
- `../claude-code-sourcemap/restored-src/src/remote/SessionsWebSocket.ts`
  - websocket 只负责 connect/reconnect/ping/control request/response
  - reconnect budget、close code 处理、ping interval 都留在 transport layer

启示：

- `DelegatedRuntimeTransport` 的职责应该类似 “delivery/activity/control”
- `TeamExecutionState` / `TeamAssignmentSession` 不该去承担 reconnect / ping / close-code / delivery-state 语义

#### permission context 非常强，但太 UI-centric，不适合作为 control-plane core

- `../claude-code-sourcemap/restored-src/src/Tool.ts`
  - `ToolPermissionContext` 带 `alwaysAllowRules` / `alwaysDenyRules` / `alwaysAskRules` / `shouldAvoidPermissionPrompts` / `awaitAutomatedChecksBeforeDialog`
- `../claude-code-sourcemap/restored-src/src/tools/AgentTool/runAgent.ts`
  - agent runtime 还会叠加 `allowedTools`、`querySource`、`agentDefinition.source`、plugin-only trust、interactive prompt capability

启示：

- 这些设计非常适合 interactive product shell / UI permission UX
- 但 autoresearch 当前更需要的是 control-plane compile authority，而不是 mutable UI permission store

## 下一批真正值得做的实现模式

## 1. `DelegatedRuntimeHandleV1`

### 推荐模式

把当前零散的 delegated runtime identity / lineage / artifact refs 收成一个内部 typed seam。它应建立在已经 landed 的 `DelegatedExecutionIdentity` 之上，而不是替换掉它。

建议 shape：

```ts
interface DelegatedRuntimeHandleV1 {
  version: 1;
  identity: {
    project_run_id: string;
    assignment_id: string;
    session_id: string;
    runtime_run_id: string;
  };
  lineage: {
    task_id: string;
    checkpoint_id: string | null;
    parent_session_id: string | null;
    forked_from_assignment_id: string | null;
    forked_from_session_id: string | null;
  };
  artifacts: {
    manifest_path: string;
    spans_path: string;
    runtime_diagnostics_bridge_path: string;
  };
}
```

### 第一刀 call-site

- `openAssignmentSession(...)` 产生 canonical handle，而不只是写 `TeamAssignmentSession`
- `prepareAssignmentOutcome(...)` / `executeLaunch(...)` / `mergeLaunchOutcome(...)` 全部接 handle，不再各自重算 path/id
- `executeDelegatedAgentRuntime(...)` 接收 handle 或最少接收 handle-derived refs，而不是只拿裸 `runId`

### 为什么先做它

- 这是 transport 和 permission profile 的共同依赖
- 当前最真实的 drift 就是 identity/path/lineage reconstruction 分散，而不是缺一个新 UI/read-model object

### 不该照搬的点

- 不要把它做成 public `team` payload 字段
- 不要把 `live_status` / `replay` / `background_tasks` 当 handle carrier
- 不要顺手引入 durable `job` / `turn` object family
- 不要把 transcript/history promotion 成 runtime SSOT

## 2. `RuntimePermissionProfileV1`

### 推荐模式

把 runtime permission 提升成 compile authority，让当前 `ToolPermissionView` 退到 compiled runtime view。

建议 shape：

```ts
interface RuntimePermissionProfileV1 {
  version: 1;
  actor: {
    scope: 'agent_session' | 'delegated_assignment';
    actor_id: string | null;
    source: 'team_permission_matrix' | 'host_runtime' | 'internal';
  };
  tools: {
    allowed_tool_names: string[];
    execution_policies: Record<string, ToolExecutionPolicy>;
    inheritance_mode: 'runtime_tools' | 'team_permission_matrix' | 'inherit_from_assignment';
    inherit_from_assignment_id?: string;
  };
  sandbox: {
    filesystem: null | { mode: 'inherit_host' | 'restricted'; read_roots?: string[]; write_roots?: string[] };
    network: null | { mode: 'inherit_host' | 'restricted' | 'enabled' };
  };
  approvals: {
    mode: 'inherit_gate' | 'request_explicit';
    grant_scope: 'assignment' | 'session';
    reviewer: string | null;
    assignment_approval_id?: string | null;
    assignment_approval_packet_path?: string | null;
    assignment_approval_requested_at?: string | null;
  };
}
```

### 第一刀 compile targets

- `RuntimePermissionProfileV1 -> ToolPermissionView`
- `RuntimePermissionProfileV1 -> visible tools + tool execution policy`
- `RuntimePermissionProfileV1 -> approval metadata / scope`
- sandbox/network 字段第一刀可以先只 carry，不必立刻全量执行，但 authority 不能再散在 wrapper 层

### 为什么排在 transport 之前

- 现在 `compileDelegatedRuntimePermissionProfile(...)` / `buildDirectRuntimePermissionProfile(...)` 分别为 delegated 与 direct path 生产同一类 permission compile source，再由 `RuntimePermissionProfileV1 -> ToolPermissionView` 喂给 protocol `REQUIRED_TOOLS`、visible-tool filtering 与 call-time deny seam，已经证明 permission seam 是真实主轴
- 如果 transport 先做，而 permission 仍分散在 matrix/view/wrapper，transport 只会固化现有碎片化语义

### 不该照搬的点

- 不要复制 Claude Code 的 mutable `ToolPermissionContext`
  - `alwaysAllowRules` / `alwaysDenyRules` / `alwaysAskRules`
  - `shouldAvoidPermissionPrompts`
  - `awaitAutomatedChecksBeforeDialog`
- 不要复制 Codex 为兼容旧配置保留的 parser/unknown-token 复杂度
- 不要把 profile 做成 prompt-only 文本约定；它必须是 typed compile source

## 3. `DelegatedRuntimeTransport`

### 推荐模式

transport 最小化，只负责 delegated runtime 的 delivery/activity/control。

第一刀不做 websocket/SSE/queue/fleet redesign，只做一个 local-first transport seam：

```ts
interface DelegatedRuntimeTransport {
  launch(params: {
    handle: DelegatedRuntimeHandleV1;
    permission_profile: RuntimePermissionProfileV1;
    input: ExecuteDelegatedAgentRuntimeInput;
  }): Promise<DelegatedRuntimeTransportTerminalV1>;
  interrupt?(handle: DelegatedRuntimeHandleV1): Promise<void>;
}

interface DelegatedRuntimeTransportTerminalV1 {
  delivery_status: 'completed' | 'transport_error';
  last_activity_at: string;
  runtime_result: ExecuteDelegatedAgentRuntimeResult | null;
  transport_error?: McpToolError;
}
```

### 第一刀实现方式

- 先落一个 `InProcessDelegatedRuntimeTransport`
- 内部只是包装当前 `executeDelegatedAgentRuntime(...)`
- `team-unified-runtime-support.ts` 不再直接知道 launch 细节，只消费 terminal result / transport error

### 为什么它要最后做

- transport 没有 stable handle/profile 作为载荷时，只会继续围着 string ids、raw tool lists、ad hoc approval inputs 打补丁
- 现在外部源码给出的共同模式也都是“先有 canonical state/permission，再有 transport”

### 不该照搬的点

- 不要先做 `RemoteSessionManager` / websocket reconnection clone
- 不要把 fleet lease / worker heartbeat / scheduler 语义并入 transport
- 不要让 transport 成为 session authority、runtime replay authority、或 approval authority

## 明确不该照搬的模式

1. 不照搬 transcript-centric authority
   - Codex 的 `ThreadHistoryBuilder` 很强，但它服务的是成熟 thread history contract。autoresearch 当前批次仍然不该把 durable `turn` / transcript 提升为新 authority family。
2. 不照搬 remote-viewer/session UX
   - Claude Code 的 remote session / websocket / permission dialog 设计是 product shell 导向，不是 control-plane core 的优先级。
3. 不照搬兼容性 parser baggage
   - Codex 的 `Unknown` special path / older-runtime compatibility 是发布产品需要；autoresearch 当前没有这个负担。
4. 不照搬 mutable permission rule store
   - `alwaysAllowRules` / plugin-only trust / interactive prompt affordance 这些属于 UI/session product 层，不该成为 orchestrator generic authority。

## 推荐 lane 切法

### Lane C1: handle spec + call-path first cut

- 目标：把 `DelegatedRuntimeHandleV1` 落成 types + call-path wiring
- 主要文件：
  - `packages/orchestrator/src/execution-identity.ts`
  - `packages/orchestrator/src/team-execution-scoping.ts`
  - `packages/orchestrator/src/team-unified-runtime-support.ts`
  - `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`

### Lane C2: permission profile compile authority

- 目标：引入 `RuntimePermissionProfileV1`，让 `ToolPermissionView` 成为 compiled view
- 主要文件：
  - `packages/orchestrator/src/team-execution-permissions.ts`
  - `packages/orchestrator/src/tool-execution-policy.ts`
  - `packages/orchestrator/src/mcp-client.ts`
  - `packages/orchestrator/src/research-loop/delegated-agent-runtime.ts`

### Lane C3: in-process transport seam

- 目标：只落 local-first `DelegatedRuntimeTransport`
- 主要文件：
  - `packages/orchestrator/src/team-unified-runtime-support.ts`
  - `packages/orchestrator/src/team-unified-runtime.ts`
  - `packages/orchestrator/src/team-execution-runtime.ts`

## 收口结论

lane C 真正值得做的不是“把 runtime 再包装一层名字”，而是：

- 先把 delegated runtime 的 identity/lineage/artifact carrier 收成 handle
- 再把 runtime permission 提升成 compile authority
- 最后才给 launch/delivery/control 一个 transport seam

只要顺序反过来，或者把 Claude/Codex 的 product-shell 细节直接抄进来，autoresearch 很容易重新长出第二套 runtime authority。
