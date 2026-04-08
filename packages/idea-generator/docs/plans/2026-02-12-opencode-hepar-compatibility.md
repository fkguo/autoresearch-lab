# OpenCode（anomalyco/opencode）调研与对 hepar / idea-generator 的兼容性建议

> 日期：2026-02-12  
> 目标：评估 `opencode` 作为 **coding agent runtime** 的可借鉴点，并给出对 `hepar`（控制平面）与 `idea-generator`（idea-core + adapter）的兼容方案与改造清单。  
> 原则：研究质量优先、可审计（artifact-first）、不在本 repo 落地 hepar 代码改写（仅记录为后续开发输入）。
> 定位：保留的兼容性调研附录，不是当前 package-level SSOT。

---

## 1. OpenCode 是什么（抽象到可迁移层）

OpenCode 是一个开源的 coding agent 系统，具有明显的“产品级运行时”特征：

- **Client/Server 架构**：提供独立 server（README 明确 client/server），并维护一份 OpenAPI 3.1.1 规范用于外部编排/SDK（仓库内 `packages/docs/openapi.json`）。
- **多会话（multi-session / projects）**：API 支持同一实例为多个 project/worktree 提供多个 session（见 `specs/project.md` 与 OpenAPI 的 `/project/.../session/...` 系列端点）。
- **Agent 作为一等配置对象**：OpenAPI 提供 `/agent` 列表；`Agent` 结构包含 `model(providerID/modelID)`、`prompt`、`temperature/topP`、`permission ruleset` 等（可映射到我们的 Role/Team）。
- **工具/权限分级**：内置 agent 区分“全权限 build”与“只读/需许可 plan”（README），且 API 具备 permission 处理端点（`/project/.../permission/...`）。
- **插件/扩展体系**：仓库存在 `packages/plugin` 与 `packages/extensions`（可作为可插拔能力平面参考）。
- **MCP 支持**：OpenAPI 暴露 `/mcp` 与 connect/auth/ disconnect 端点族（可作为 hepar 接入外部 MCP/tool runtime 的参考）。

对我们最关键的可迁移结论：OpenCode 提供了一个可复用的 **“多角色 + 工具权限 + 多会话隔离 + 可编排 API”** 的工程模板。

### 1.1 Server API 快照（对 Runtime Adapter 最重要的端点族）

基于官方 server 文档，OpenCode 的运行时编排最关键的是：

- **Session lifecycle**：`GET /session`，`POST /session`，`GET /session/{id}`，`POST /session/{id}/init`，`POST /session/{id}/revert`，`POST /session/{id}/summarize`
- **Send work**：`POST /session/{id}/message`（把 role 指令/上下文作为消息注入）
- **Permission handshake（关键）**：`POST /session/{id}/permissions/{permissionID}` 与 `POST /permission/{requestID}/reply`（对运行时发起的 permission request 做 allow/deny/ask 的结构化响应，可选 remember）
- **Question handshake（关键）**：`GET /question` 与 `POST /question/{requestID}/reply|reject`（运行时向编排方请求结构化输入）
- **Observability（关键）**：`GET /global/event`（SSE）用于监听 session 事件、permission request、工具调用摘要等
- **Tool surface（能力平面）**：
  - Shell：`POST /session/{id}/shell`
  - Files：`GET /file`（列表/树）、`GET /file/{path}`（内容）
  - Search：`GET /find`（ripgrep 类）
  - MCP：`GET /mcp` / `POST /mcp` / `DELETE /mcp/{name}`（动态接入 MCP servers）

> 对 hepar 的意义：OpenCode 已经把“多会话 + 工具调用 + permission 请求”拆成了可编排 API。hepar runtime adapter 不需要复刻这些能力，而是要把它们纳入 **gate + ledger + artifacts** 的控制面语义里。

### 1.2 Permission 模型（从 OpenAPI 可证据化抽取）

OpenCode 把“工具调用权限”提升为可编排的一等对象：

- `PermissionRequest`（核心字段）：
  - `id`（permission request id）、`sessionID`
  - `permission`（类别，如 read/edit/bash 等）
  - `patterns[]`（匹配模式列表）
  - `metadata`（补充信息；用于审计与 UI）
  - `always[]`（运行时声明的“总是需要 ask 的子类”，用于硬门禁）
  - `tool.messageID/callID`（把 permission 请求绑定到具体工具调用）
- `PermissionRule`：`{permission, pattern, action}`，其中 `action ∈ {allow, deny, ask}`；规则集合为 `PermissionRuleset`。

> 对 hepar 的映射：  
> - OpenCode 的 `permission + patterns + metadata` 可以直接落到 hepar 的 gate UI/ledger（形成“可审计审批”而不是 prompt 口头约束）。  
> - 我们在 hepar 侧提出的 `WorkOrder.tool_policy` 应优先支持 **pattern-based**（而不是仅 allowlist 名称），才能覆盖 read/write/bash 等细粒度风险面。

证据（OpenCode OpenAPI）：仓库 `packages/docs/openapi.json`（default branch: `dev`）。

### 1.3 事件流与可回放性（SSE）

OpenCode 提供 `GET /global/event` SSE，payload 为 `GlobalEvent={directory, payload}`，其中 `payload` 是一个 `Event` 的 union（包含 message 更新、permission asked/replied、session status/idle、todo 更新等）。

> 对 hepar 的映射：  
> - runtime adapter 应订阅事件流，将“权限请求/工具调用摘要/产物更新/会话终止原因”写入 hepar ledger。  
> - 这能把并行 Team/Role 的执行变成可回放的 timeline，支撑后续的 clean-room 审查与失败复盘。

证据（OpenCode OpenAPI）：`GET /global/event` 与 `components.schemas.Event*`（同上）。

---

## 2. 对 idea-generator 的借鉴点：把“Role/Team”落到可执行运行时

我们在 `docs/plans/2026-02-12-idea-generator-architecture-spec.md` 中引入了 Physicist Community（Team/Role）。
OpenCode 的可借鉴点在于：它给了一个“Role 的工程落点”：

1. **Role = agent definition（模型 + 权限 + 工具集）**  
   - 例如 `Coder` 允许写文件/跑测试；`Referee` 仅允许检索与只读；`Checker` 允许执行但禁写。
2. **Team = 多 session 并行/串行编排**  
   - 并行发散：多个 ideator/referee 互相隔离输出。  
   - 串行收敛：librarian → ideator → formalizer → referee。
3. **WorkOrder/Result artifact 化**  
   - idea-core 产出“该做什么”的结构化任务单；由运行时（hepar/opencode）执行并回传结构化结果；最终进入 IdeaStore/ledger。

> 重要：我们不应把 OpenCode 当成“idea 搜索引擎”；它更适合作为 **工具使用型角色（coder/derivation/checker）** 的运行时，而 idea-core 仍是 SSOT（Operator/SearchPolicy/Distributor/Evaluator）。

---

## 3. 对 hepar 的借鉴点：作为控制平面接入“coding runtime”

hepar 本质是控制平面（run lifecycle、审批门禁、ledger、artifact 管理）。OpenCode 可作为能力平面的一部分（尤其是 coding/compute 侧）。

建议把“接入 OpenCode”设计为 **可插拔 runtime adapter**，而不是替换 hepar：

### 3.1 方案 A（最小集成）：hepar 通过 CLI 调用 opencode

- hepar 在需要 `Coder/Derivation/Checker` 时，调用 `opencode` CLI 运行指定 agent + prompt + 目标目录。
- 优点：实现最简单；本地开发快。
- 风险：权限/审批与 hepar 的 A0/A1 gate 需要对齐（否则会出现“未审批先写代码”的越权）。

### 3.2 方案 B（推荐）：hepar 通过 OpenCode Server API 编排 sessions

- hepar 负责：
  - 创建 session（绑定 campaign/idea_id）
  - 写入输入上下文包（seed + evidence packet + constraints + schema）
  - 监听结果并写 artifacts/ledger
  - 把 OpenCode “权限请求”映射到 hepar 的审批 UI/流程
- 优点：天然支持多会话并行（团队/社区），并且把权限请求结构化化。
- 风险：需要一层 API adapter（但这是可控工程量）。

#### 3.2.1 WorkOrder → OpenCode Session 的最小映射（建议）

把我们在 hepar 侧引入的 `WorkOrder/WorkResult`（见 `2026-02-12-hepar-runtime-adapter-opencode-openclaw.md`）映射到 OpenCode：

- `WorkOrder.work_id` → `session_id`（或 session metadata；保证可追踪）
- `WorkOrder.role_id` → OpenCode `agent`（或 session 的 system prompt + permission preset）
- `WorkOrder.input_artifacts[]` → `POST /session/{id}/message` 的上下文包（artifact URIs + 摘要 + schema refs）
- `WorkOrder.tool_policy` → OpenCode permission ruleset（allow/deny/ask + remember；以 pattern 表达，默认 deny）
- Permission request → hepar gate（A0/A1…）→ `POST /session/{id}/permissions/{permissionID}`
- `WorkResult.outputs[]` → hepar artifacts（hash + uri）并写 ledger；OpenCode 侧仅作为执行日志来源

> 关键纪律：OpenCode 的任何可写/可执行能力都必须在 hepar gate 之下运行；否则 runtime adapter 会变成“旁路执行器”，破坏 evidence-first 的审计闭环。

### 3.3 方案 C（不推荐作为近期目标）：改写 hepar 以复刻 OpenCode runtime

- 代价很大；容易把注意力从“研究质量/证据门禁/可复现产物”转移到“构建通用 coding agent 平台”。

---

## 4. 生态圈兼容性：若要实现上述集成，需要记录的改造清单

### 4.1 对 hepar（控制平面）的改造点（建议写入 hepar repo 的 TODO 文档）

1. **Role/Team 编排原语**：支持“广播组”（并行/串行）与 clean-room 隔离 session。
2. **WorkOrder 协议**：把“要执行的任务”与“结果”都 artifact 化（schema versioned）。
3. **权限对齐**：把外部 runtime 的 permission request 映射到 hepar gate（A0/A1…），避免绕过审批。
4. **预算/熔断共享**：在 hepar 与外部 runtime 间共享 budget envelope（token/$/wallclock/step）。
5. **日志与可回放**：外部 runtime 的关键事件写入 hepar ledger（至少：启动、权限请求、执行摘要、产物 hash）。

### 4.2 对 idea-core（搜索引擎）的改造点

1. **外部执行的接口面**：明确哪些 role 是“tool-using”，需要外部 runtime；并给出 `WorkOrder` schema。
2. **结果合并策略（Editor role）**：把多 role 输出合并为 IdeaNode 更新的确定性规则（避免“靠 prompt 拼接”）。

---

## 5. 下一步（建议）

1. 在 idea-generator 侧把 `Role/Team` 的 **artifact 契约** 固化（v1），并把它们加入 OpenRPC/Schema（见下一轮收敛任务）。
2. 在 hepar 侧单独开一个设计文档：`hepar-runtime-adapter (opencode/openclaw-style)`，把权限、预算、ledger 对齐作为硬门槛。
