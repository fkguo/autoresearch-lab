# Autoresearch 生态圈重构方案 (Redesign Plan)

> **版本**: 1.8.0-draft (R10: Scope Audit 三模型收敛 + Pipeline 连通性双模型 R4 收敛 + CLI-First Dual-Mode 架构确立)
> **日期**: 2026-02-25
> **基线**: v1.7.0-draft + `meta/docs/scope-audit-converged.md` (三模型收敛) + `meta/docs/scope-audit-dual-mode-converged.md` (CLI-First 收敛) + `meta/docs/pipeline-connectivity-audit.md` (双模型 R4 收敛)
> **重构项总数**: 135 项 (119 前序 + 15 新增 + 1 cut)
> **编排**: Claude Opus 4.6
>
> **v1.8.0 Changelog**:
> - Scope audit 三模型收敛结论落地: H-01 简化, H-04/H-15a 冻结, H-17/M-22 deferred, NEW-R09 cut
> - Pipeline 连通性审计 (双模型 R4 收敛): 新增 NEW-CONN-01~05 (5 孤岛修复)
> - CLI-First Dual-Mode 架构确立 (Layer 0-3)
> - 新增 15 项: NEW-CONN-01~05, NEW-IDEA-01, NEW-COMP-01/02, NEW-WF-01, NEW-SKILL-01, NEW-RT-01~05
> - 修改 13 项: H-01, H-04, H-15a, H-17, M-22, NEW-R09, NEW-05a, UX-02, UX-04, EVO-01/02/03, NEW-COMP-01
> - 质量优先成本哲学写入全局约束 (不设硬性 max_cost_usd / max_llm_tokens)
> - ComputationEvidenceCatalogItemV1 并行 schema 确立 (不修改 EvidenceCatalogItemV1)
> - Pipeline A/B 统一时间线: Phase 2 MCP → Phase 2B hint → Phase 3 实现 → Phase 4 退役

## 路径约定

> 本文档使用**逻辑组件名**作为路径前缀，非当前磁盘目录名。NEW-05 monorepo 迁移后路径自然统一。
>
> | 本文档路径前缀 | 当前磁盘位置 | monorepo 迁移后 |
> |---|---|---|
> | `hep-research-mcp/src/...` | `hep-research-mcp-main/packages/hep-research-mcp/src/...` | `packages/hep-research-mcp/src/...` |
> | `hep-research-mcp/packages/shared/src/...` | `hep-research-mcp-main/packages/shared/src/...` | `packages/shared/src/...` |
> | `hep-autoresearch/src/...` | `hep-autoresearch/src/...` (不变) | `packages/hep-autoresearch/src/...` |
> | `idea-core/src/...` | `idea-core/src/...` (不变) | `packages/idea-core/src/...` |
> | `idea-generator/schemas/...` | `idea-generator/schemas/...` (不变) | `packages/idea-generator/schemas/...` |
> | `autoresearch-meta/...` | `autoresearch-meta/...` (不变) | `meta/...` |
>
> hep-research-mcp 内部 pnpm workspace 的子包（shared, pdg-mcp, zotero-mcp）迁移后提升为顶层 `packages/` 平级目录。

## 全局约束

> **无向后兼容负担**: 生态圈尚未正式发布，无外部用户。所有变更可直接 breaking change，**不需要**:
> - 旧 API / 工具名保留或 deprecation shim
> - 数据格式迁移脚本（直接采用新 schema，旧数据可丢弃重建）
> - 运行时版本协商或兼容性矩阵维护
> - 字段设为 optional "以兼容旧数据"——如果语义上应该 required，就直接 required
> - **临时 stopgap / Python 退役路径保留缓冲期** — 一旦 TS 替代方案实现并通过验收，Python 侧对应功能必须**立即删除**，不留缓冲期，避免遗忘导致死代码累积
>
> 各项设计应追求最终形态的简洁性，而非增量兼容性。

> **质量优先**: 科学研究以质量为最高标准。不设硬性成本限额 (`max_cost_usd` / `max_llm_tokens` 等)。Budget tracking 仅作为 observability（记录消耗），不作为 runtime constraint。质量门禁 (Approval Gates A1-A5) 是 pipeline 推进的控制机制。不需要 `RunBudget` 接口。

## 依赖拓扑总览

```
Phase 0 (止血)          ← 无外部依赖，可立即并行执行 ✅ ALL DONE
  │
  ├─ NEW-05 Monorepo 迁移 ✅
  ├─ NEW-05a Stage 1-2 编排层 TS ✅ (Stage 3 idea-engine → Phase 2-3)
  ├─ C-01~C-04, H-08, H-14a, H-20 ✅
  ├─ NEW-R02a, NEW-R03a, NEW-R13, NEW-R15-spec, NEW-R16 ✅
  │
Phase 1 (统一抽象)      ← 依赖 Phase 0 基础设施
  │
  ├─ H-01  McpError += retryable + retry_after_ms (简化版)
  ├─ H-02  最小可观测性 (trace_id)
  ├─ H-03  RunState v1 统一枚举 ✅ (929f693)
  ├─ H-04  Gate Registry ✅ (929f693, 冻结)
  ├─ H-13  上下文截断
  ├─ H-15a EcosystemID 规范 ✅ (929f693, 冻结不扩展)
  ├─ H-16a 工具名常量化 ✅
  ├─ H-18  ArtifactRef V1 ✅ (929f693)
  ├─ H-19  失败分类 + 重试策略 ← P1 最优先 (Scope Audit 3/3)
  ├─ H-11a MCP 工具风险分级 ✅ (P1/P2 done)
  ├─ NEW-01 跨语言类型代码生成 ✅ (design_complete → done)
  ├─ NEW-CONN-01 Discovery next_actions hints (~100 LOC)
  ├─ M-01, M-14a, M-18, M-19
  ├─ NEW-R02, NEW-R03b, NEW-R04
  ├─ UX-01, UX-05, UX-06
  ├─ H-17 (deferred → Phase 2)
  ├─ M-22 (deferred → Phase 3)
  └─ NEW-R09 (CUT)
      │
Phase 2A (运行时可靠性):
  ├─ NEW-RT-01 TS AgentRunner (Anthropic SDK + lane queue + approval gate)
  ├─ NEW-RT-02 MCP StdioClient reconnect
  ├─ NEW-RT-03 OTel-aligned Span tracing
  │
Phase 2B (Pipeline 连通 + 深度集成):
  ├─ H-05, H-07, H-09, H-10, H-11b, H-12, H-15b, H-16b, H-17, H-21
  ├─ M-02, M-05, M-06, M-20, M-21, M-23, trace-jsonl
  ├─ NEW-02, NEW-03, NEW-04
  ├─ NEW-CONN-02 Review feedback next_actions (~60 LOC)
  ├─ NEW-CONN-03 Computation evidence ingestion (~250 LOC)
  ├─ NEW-CONN-04 Idea → Run creation (~150 LOC)
  ├─ NEW-IDEA-01 idea-core MCP 桥接 (~400-800 LOC)
  ├─ NEW-05a Stage 3 idea-engine TS 增量重写开始
  ├─ NEW-WF-01 Workflow schema 设计 (~100 LOC)
  ├─ NEW-COMP-01 W_compute MCP 安全设计 (~200 LOC)
  ├─ NEW-RT-04 Durable execution (~200 LOC)
  ├─ UX-02 Computation contract (升级)
  ├─ UX-07, RT-02, RT-03, NEW-VIZ-01
  ├─ NEW-R05~R08, NEW-R10, NEW-R14, NEW-R15-impl
  │
Phase 3 (扩展性 + 计算连通):
  ├─ NEW-05a Stage 3 续: idea-engine TS 重写完成
  ├─ NEW-COMP-02 W_compute MCP 实现 (~500 LOC)
  ├─ NEW-CONN-05 Cross-validation → Pipeline feedback (~100 LOC)
  ├─ NEW-SKILL-01 lean4-verify skill (~200 LOC)
  ├─ NEW-RT-05 Eval framework (~500 LOC)
  ├─ M-22 GateSpec 通用抽象 (deferred from P1)
  ├─ M-03/M-04/M-07~M-10/M-12/M-13/M-15~M-17, L-08
  ├─ NEW-06, NEW-R11, NEW-R12
  ├─ UX-03, UX-04 (workflow schema)
  ├─ RT-01, RT-04
  │
Phase 4 (长期演进):
  ├─ L-01~L-07, NEW-07 (A2A)
  │
Phase 5 (社区化与端到端闭环):
  ├─ idea-core Python 退役 + hep-autoresearch 退役 (Pipeline A 退役)
  ├─ EVO-01~03 idea→compute→writing 循环 (依赖: UX-02, UX-04, NEW-R15-impl, NEW-COMP-01, NEW-IDEA-01)
  ├─ EVO-04~EVO-21
  │
Pipeline A/B 统一时间线:
  Pipeline A = hep-autoresearch (Python CLI, hepar) — 现有编排器
  Pipeline B = orchestrator (TS MCP) — 新编排器 (NEW-05a/NEW-R15)
  Phase 2:   NEW-IDEA-01 + NEW-COMP-01 → Pipeline A 能力暴露为 MCP (供 Pipeline B 消费)
  Phase 2B:  NEW-CONN-01~04 → 所有阶段通过 hint-only next_actions 连通
  Phase 3:   NEW-COMP-02 (完整 W_compute MCP), NEW-CONN-05 (交叉检验)
  Phase 4+:  Pipeline A (hepar CLI) 退役, Pipeline B 成为唯一编排器

NEW-R01 God-file 拆分 (跟踪伞) — 跨 Phase 1-3, 子项: NEW-R10/R11 (NEW-R09 cut)
```

---

## Phase 0: 止血 (P0) — 立即执行

> **目标**: 消除安全漏洞与治理绕过，建立审计基线
> **并行度**: 13 项，NEW-05 建议最先执行（后续 CI 门禁受益于 monorepo 结构；NEW-05a 依赖 NEW-05; NEW-R13 与 NEW-05 同步执行），其余可并行
> **预计工作量**: 每项 0.5-2 天

### NEW-05: Monorepo 迁移 (结构前置)

**现状**: 7 个组件分散在 `autoresearch-lab` GitHub org 的独立 repo 中。跨组件 CI 门禁（SYNC-05/06, REL-01, C-04）需要 cross-repo triggers，配置复杂且脆弱。
**动机**: 修复方案中 ~15 条规则涉及跨组件验证，monorepo 下变为单 repo 内 CI job，大幅降低实施难度。

**目标结构**:
```
autoresearch/                    # private monorepo (personal GitHub)
├── packages/
│   ├── hep-research-mcp/       # TS MCP server (~130K lines)
│   ├── orchestrator/           # TS 新编排器 (NEW-05a, 从零构建)
│   ├── idea-engine/            # TS idea 引擎 (NEW-05a 阶段 3, idea-core 重写)
│   ├── agent-arxiv/            # TS Agent-arXiv 服务 (EVO-15, 从零构建)
│   ├── shared/                 # TS 共享类型 + 工具
│   ├── hep-autoresearch/       # Python orchestrator (~29K, 渐进退役)
│   ├── idea-core/              # Python → TS 迁移 (~11K, 阶段 2)
│   ├── idea-generator/         # JSON Schema SSOT (~370 验证脚本 → TS)
│   ├── skills/                 # 技能脚本 (Bash + Python + wolframscript)
│   └── skills-market/          # Python marketplace
├── meta/                       # 原 autoresearch-meta
│   ├── schemas/                # JSON Schema SSOT
│   ├── scripts/                # codegen, lint, CI
│   └── docs/
├── pnpm-workspace.yaml         # TS packages 统一管理
├── Makefile                    # 顶层 orchestration (codegen, lint, test)
├── AGENTS.md
└── .github/workflows/          # 单一 CI 配置
```

**运行时产出目录**: 三方收敛设计 (详见 AGENTS.md §运行时产出目录结构)。全局 `~/.autoresearch/` (data/cache/state 分层) + 项目本地 `<project_dir>/` (runs/, evidence/, paper/, .autoresearch/tmp/)。monorepo 迁移时需确保:
- 全局目录路径解析模块 (`packages/shared/src/paths.ts`) 支持 `AUTORESEARCH_HOME` 环境变量覆盖
- 项目本地 `.autoresearch/tmp/` 保证原子 rename (同文件系统)
- `project.toml` 作为项目清单文件的 schema 定义在 `meta/schemas/`

**迁移步骤**:
1. 创建 private monorepo，`git subtree add` 各组件（保留 commit history）
2. 调整各组件内部 import 路径（相对路径不变，CI 路径统一）
3. 创建顶层 `Makefile`：`codegen`, `codegen-check`, `lint`, `test`, `smoke`, `release-check`
4. 创建 `.github/workflows/ci.yml`：单一 CI 配置覆盖所有跨组件门禁
5. org repos 保留为 read-only archive（或 public mirror）

**验收检查点**:
- [ ] 所有组件代码在 monorepo 中，各自测试套件通过
- [ ] `make codegen-check` 在 monorepo 根目录可执行
- [ ] `.github/workflows/ci.yml` 覆盖 SYNC-05/06, C-04, REL-01 门禁
- [ ] org repos 标记为 archived

### NEW-05a: 编排层与 idea 引擎增量迁移至 TypeScript

> **Re-scoped (v1.8.0)**: Stage 1-2 (orchestrator TS) 已完成 (929f693)。Stage 3 (idea-engine TS 重写) 独立追踪为 not_started，Phase 2-3 增量迁移。
> **勘误**: 原文引用 `state-machine.ts` 不存在，实际文件为 `state-manager.ts`。

**Stage 1-2**: done (929f693) — TS orchestrator 状态管理 parity (read/write/enforcement/sentinel/plan-validation), 145 tests, tsc clean.

**Stage 3 (Phase 2-3, not_started)**: idea-core → idea-engine TS 增量重写。
- **Phase 2 先行**: NEW-IDEA-01 (idea-core MCP 桥接) 立即连通 pipeline，不被 TS 重写阻塞
- **增量迁移顺序**: (1) store/idempotency → (2) campaign/budget → (3) operator families 逐个迁移 → (4) domain pack → data-driven manifest → (5) HEPAR orchestration
- **回退/对照**: MCP 桥接作为回退
- **Golden trace**: `idea-core/demo/m2_12_replay.py` 确保行为一致性
- **Phase 4+**: idea-core Python 退役（与 hep-autoresearch 同步）

**迁移理由**:
1. 所有主流 Agent 编排平台 (OpenCode, OpenClaw, Claude Code, Cursor) 均选择 TypeScript——Node.js 事件循环天然适合并发 Agent session 管理
2. MCP SDK 为 TypeScript-first，生态圈最大组件 hep-research-mcp 已是 130K LOC TypeScript
3. 统一语言后可消除 NEW-01 (跨语言代码生成) 的大部分需求
4. 长期愿景 (Agent-arXiv) 需管理数十个并发 Agent session，TypeScript 优势显著

**迁移策略 (增量，非大爆炸重写)**:

| 阶段 | 内容 | 风险 |
|---|---|---|
| 阶段 1 (NEW-05 同步) | 在 monorepo 中创建 `packages/orchestrator/` (TS)，实现最小状态管理 + MCP client | 低——新代码，不影响现有 |
| 阶段 2 (Phase 1-2) | 新编排器逐步接管 hep-autoresearch 的功能 (state machine, approval gates, ledger) | 中——功能迁移需验证等价 |
| 阶段 3 (Phase 2-3) | idea-core 迁移至 TS `packages/idea-engine/`：搜索引擎、operator 系统、domain pack、评估、HEPAR 编排 | 中——~6,800 行迁移，依赖 ajv/proper-lockfile/json-canonicalize |
| 阶段 4 (Phase 3) | idea-generator 验证脚本迁移至 TS (JSON Schema 文件本身语言无关，保持不动) | 低——仅 370 行脚本 |
| 阶段 5 (Phase 4-5) | EVO-13/14/15 直接在 TS 编排器上实现；hep-autoresearch + Python idea-core 退役 | 低——此时 TS 组件已成熟 |

**修改文件**:

| 文件 | 变更 |
|---|---|
| `packages/orchestrator/` | (新 TS package) 最小编排骨架: StateManager, LedgerWriter, McpClient, ApprovalGate |
| `packages/orchestrator/src/mcp-client.ts` | TypeScript MCP stdio client (替代 Python 版 mcp_stdio_client.py) |
| `packages/orchestrator/src/state-machine.ts` | 工作流状态机 (W1→W2→W3→W_compute) |
| `packages/idea-engine/` | (新 TS package，阶段 3) idea-core 的 TS 重写: 搜索引擎、operator 接口、domain pack、评估维度、HEPAR 编排 |
| `packages/idea-engine/src/operators.ts` | SearchOperator 接口 + HEP operator 实现 (anomaly abduction, symmetry, limit explorer) |
| `packages/idea-engine/src/store.ts` | 文件级 JSON 存储 + proper-lockfile 并发控制 |
| `packages/idea-engine/src/rpc-server.ts` | JSON-RPC 2.0 stdio server (与 Python 版协议兼容，平滑切换) |
| `pnpm-workspace.yaml` | 新增 orchestrator + idea-engine packages |

**验收检查点**:
- [ ] TS 编排器可启动 MCP server 并调用工具
- [ ] TS 编排器可管理 state.json + ledger.jsonl (与 Python 版格式兼容)
- [ ] Python orchestrator_cli 和 TS orchestrator 可对同一 run 目录交替操作 (状态兼容)
- [ ] TS idea-engine JSON-RPC 接口与 Python idea-core 协议兼容 (相同 method/params/response)
- [ ] TS idea-engine 通过 Python idea-core 的全部测试用例 (协议等价验证)
- [ ] idea-generator JSON Schema 文件不变，TS 验证脚本输出与 Python 版一致

**依赖**: NEW-05 (monorepo 结构就绪)

### C-01: 审批 watchdog 执行闭环

**现状**: `timeout_at`/`on_timeout` 仅写入展示，状态机无强制检查
**共识度**: 4/4

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | 新增 `check_approval_timeout()` 方法：比较 `pending_approval.timeout_at` 与 `utc_now_iso()`，超时时执行 `on_timeout` 策略 (block/reject/escalate) 并写入 ledger 事件 |
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | 在 `status`/`run`/`approve` 入口统一调用 `check_approval_timeout()` 和 `check_approval_budget()`；在 checkpoint 循环中加入超时+预算检查 |
| `hep-autoresearch/schemas/approval_policy.schema.json` | 添加 `on_timeout` 枚举约束: `["block", "reject", "escalate"]`，默认 `"block"`；添加 `max_approvals: int` 字段 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | 新增 `check_approval_budget()` 方法：统计当前 run 已授予审批次数，超过 `max_approvals` 时拒绝并写入 `approval_budget_exhausted` ledger 事件 |

**验收检查点**:
- [ ] 单元测试：设置 `timeout_at` 为过去时间 → 调用 `check_approval_timeout()` → 状态迁移为 `on_timeout` 指定行为
- [ ] 集成测试：`hepar approve` 在超时后返回错误并记录 ledger 事件
- [ ] Ledger 事件包含 `event_type: "approval_timeout"`, `approval_id`, `policy_action`
- [ ] 单元测试：审批次数达到 `max_approvals` → `check_approval_budget()` 拒绝并记录 `approval_budget_exhausted`
- [ ] 集成测试：预算耗尽后 `hepar approve` 返回 `BUDGET_EXHAUSTED` 错误

### C-02: Shell 执行隔离 (P0 分级)

**现状**: `ShellAdapter` 直接在宿主机执行命令，无路径/命令限制
**共识度**: 2/4

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/adapters/shell.py` | 新增 `_validate_command(argv)`: 命令黑名单 (`rm -rf /`, `curl \| sh`, `chmod 777` 等)；新增 `_validate_paths(outputs)`: 路径白名单 (仅允许 `repo_root/` 及 `HEP_DATA_DIR` 下写入) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/adapters/sandbox.py` | (新文件) `ResourceLimiter`: `ulimit` 封装 (CPU 时间、内存、文件大小上限) |

**验收检查点**:
- [ ] 测试：`argv` 含 `/etc/passwd` → 拦截返回 `UNSAFE_FS`
- [ ] 测试：`argv` 含 `rm -rf /` → 拦截返回 `BLOCKED_COMMAND`
- [ ] 测试：输出路径超出白名单 → 拦截

### C-03: 工具清单基线自动生成

**现状**: 审计文档手填工具数 (68) 与实测 (71/83) 不符
**共识度**: 1/4 (但 P0 优先级获双模型共识)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/scripts/generate_tool_catalog.ts` | (新文件) 调用 `getTools('standard')` 和 `getTools('full')` → 输出 `tool_catalog.standard.json` / `tool_catalog.full.json`，含 commit hash + 生成时间戳 |
| `hep-research-mcp/package.json` | 新增 `"catalog": "tsx scripts/generate_tool_catalog.ts"` script |
| CI 配置 | `pnpm catalog` → 比对 committed catalog → 漂移时 CI 失败 |

**验收检查点**:
- [ ] `pnpm catalog` 生成的 JSON 与 `listTools()` 运行时输出工具名集合完全一致
- [ ] CI 中 catalog 文件与 HEAD 不一致时构建失败

### C-04: 合约快照同步 CI 门禁

**现状**: `make sync-contracts` 手动操作，无 CI 检查
**共识度**: 4/4

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `idea-core/scripts/check_contract_drift.sh` | (新文件) 计算 `idea-generator/schemas/` 全部文件 SHA256 → 比对 `idea-core/contracts/idea-generator-snapshot/CONTRACT_SOURCE.json` 中记录的 hash |
| `idea-core/Makefile` | 新增 `check-drift` target |
| `.github/workflows/` 或 pre-commit hook | idea-generator 变更触发 idea-core `make check-drift` |

**验收检查点**:
- [ ] 修改 idea-generator 任一 schema → CI 自动检测漂移并失败
- [ ] `make sync-contracts && make check-drift` 通过

### H-08: 输入净化层

**现状**: `claim_text` 直接注入 INSPIRE `fulltext:"..."` 查询
**共识度**: 1/4

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `idea-core/src/idea_core/engine/retrieval.py` | 新增 `_sanitize_for_query(text: str) -> str`: 转义双引号、剔除控制字符 |
| `hep-research-mcp/src/shared/sanitize.ts` | (新文件) `sanitizePath()`, `sanitizeFilename()`, `sanitizeQueryString()` 共享工具 |

**验收检查点**:
- [ ] `claim_text = 'test" OR fulltext:"evil'` → 查询中引号被转义
- [ ] 路径含 `../` → 被拒绝

### H-14a: McpStdioClient 保留原始 error_code

**现状**: `call_tool_json()` 返回 `McpToolCallResult(ok, is_error, raw_text, json)`，丢弃 `McpError.code`
**共识度**: Codex 验证确认

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | `McpToolCallResult` 新增 `error_code: str | None` 字段；解析 MCP error response 时提取 `content[0].text` 中的结构化错误码 |

**验收检查点**:
- [ ] MCP 返回 `RATE_LIMIT` 错误 → `result.error_code == "RATE_LIMIT"`
- [ ] MCP 返回 `INVALID_PARAMS` → `result.error_code == "INVALID_PARAMS"`

### H-20: 配置加载一致性

**现状**: hep-research-mcp 不加载 `.env`，hep-autoresearch 加载 `.env`
**共识度**: Gemini 独立发现

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/index.ts` | 入口处尝试加载 CWD `.env`（使用 `dotenv`，`override: false`） |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | env 白名单新增 `HEP_TOOL_MODE`, `PDG_DB_PATH`, `PDG_ARTIFACT_TTL_HOURS` |

**验收检查点**:
- [ ] `.env` 中设置 `HEP_TOOL_MODE=full` → MCP server 启动后暴露 83 工具
- [ ] 通过 hep-autoresearch 启动 MCP → 同样暴露 83 工具

### Phase 0 验收总检查点

- [ ] 全部 13 项修复通过各自单元/集成测试 (原 9 项 + NEW-R02a/R03a/R13/R15-spec)
- [ ] `hepar doctor` 无新增警告
- [ ] 无安全回归（路径穿越、命令注入测试套件通过）
- [ ] CODE-01 CI gate 脚本 (`check_loc.py`, `check_entry_files.py`) 实现并通过 golden tests
- [ ] 35 个 P0 静默异常已审计 (修复/补日志/标记 CONTRACT-EXEMPT)
- [ ] NEW-R15 架构规格文档完成 (工具面、边界规则、威胁模型)

### NEW-R02a: CODE-01 CI gate 脚本实现 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` — 经 Gemini R4 + Codex R23 双模型审核通过

**现状**: `ECOSYSTEM_DEV_CONTRACT.md` 规定了 CODE-01 的 CI 检查脚本 (`check_loc.py`, `check_entry_files.py`)，但在 pinned commits 中这些脚本不存在。CODE-01 的 `as any` 和静默异常检查也缺少 CI 实现。
**动机**: 没有 CI 脚本，NEW-R01 (god-file splitting)、NEW-R02 (`as any` prevention)、NEW-R03 (swallow prevention) 均无法通过 CI 强制执行。这是基础设施前置条件。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/scripts/check_loc.py` | (新文件) CODE-01.1 LOC 检查: diff-scoped 文件列表 + `grep -cvE` 启发式 + CONTRACT-EXEMPT 过滤 + sunset 日期强制 |
| `autoresearch-meta/scripts/check_entry_files.py` | (新文件) CODE-01.2 禁止文件名检查: 匹配 `utils/helpers/common/service/misc` |
| `autoresearch-meta/tests/code-health/` | (新目录) golden tests: 违规 fixture + 合规 fixture + 断言 |
| `Makefile` / CI 配置 | 入口命令 `make code-health-check`; 所有 PR 必检 |

**验收检查点**:
- [ ] `check_loc.py` 对 >200 eLOC 的非豁免文件返回失败
- [ ] `check_entry_files.py` 检测禁止文件名
- [ ] golden tests 覆盖所有 CODE-01 子规则 (1/2/4/5)
- [ ] diff-scoped: 仅检查 PR 变更文件

### NEW-R03a: Python 静默异常 P0 审计 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §3 — 35 个 `except Exception: pass` 站点

**现状**: 35 个 `except Exception: pass` 站点 (详见分析文档 Appendix B) 构成 CODE-01.5 fail-closed 风险。108 个半静默/捕获返回处理器需要审计。
**动机**: 静默吞噬异常导致难以调试的失败; CODE-01.5 规定这些必须修复。

**修改文件**: 35 个站点逐一审计，按分类处理:
- **surface**: 替换为 `logger.error()` + 重新抛出原始异常（Python 侧不引入 AutoresearchError，见 H-01 简化决策）
- **suppress**: 确认为有意抑制 → 添加 `# CONTRACT-EXEMPT: CODE-01.5 {reason}` 注释

**验收检查点**:
- [ ] 35 个 P0 站点 100% 审计完成
- [ ] 每个站点标记为 surface 或 suppress，带理由
- [ ] suppress 站点有 CONTRACT-EXEMPT 注释

### NEW-R15-spec: 编排器 MCP 工具架构规格 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §13 — NEW-R15 Phase 0 交付物

**现状**: NEW-05a 计划构建 TS 编排器，但未定义 MCP 工具面 (哪些 run lifecycle 操作暴露为 MCP 工具、哪些保留在 agent 层)。
**动机**: 架构规格是设计约束文档，不是代码交付; 必须在编排器开发前完成，避免 run-infra vs strategy 边界模糊。

**交付**: 架构规格文档 (`docs/orchestrator-mcp-tools-spec.md`)，包含:
1. `orch_run_*` 工具面定义 (create/status/approve/reject/export/pause/resume)
2. Run-infra vs strategy orchestration 边界规则
3. 威胁模型 (agent self-approval, state corruption, namespace collision)
4. H-11a `destructive` + `_confirm` + `approval_id` + `approval_packet_sha256` 审批门禁设计
5. `orch://runs/<run_id>` URI scheme + 与 `hep://` 的关系

**验收检查点**:
- [ ] 规格文档完成并经团队评审
- [ ] 工具面与 NEW-05a 设计对齐
- [ ] 命名空间策略 (`orch_run_*` vs `hep_run_*`) 明确记录

---

## Phase 1: 统一抽象层 (P1) — 下次迭代

> **目标**: 建立跨组件共享抽象，为 Phase 2 深度集成奠基；建立人类用户的核心交互文档
> **前置**: Phase 0 全部完成
> **并行度**: 大部分可并行，H-01 → H-19 有依赖
> **内序门禁 (R4)**: NEW-01 codegen 工具链必须先行就绪并 CI 绿灯，方可合并 H-01/H-03/H-04/H-15a/H-18 等消费生成类型的实现 PR

### 共享抽象定义位置 — JSON Schema 唯一 SSOT

> **原则**: 所有跨语言共享类型以 `autoresearch-meta/schemas/` 下的 JSON Schema (Draft 2020-12) 为唯一真相源。TS 和 Python 实现均从 schema 生成，禁止手写镜像。
>
> **代码生成工具链**:
> - TS: `json-schema-to-typescript` → `hep-research-mcp/packages/shared/src/generated/`
> - Python: `datamodel-code-generator` → `hep-autoresearch/src/hep_autoresearch/generated/`
> - CI 门禁: `make codegen && git diff --exit-code */generated/` — 生成文件与 committed 不一致时阻断

| 抽象 | SSOT 位置 | TS 消费 | Python 消费 |
|---|---|---|---|
| ~~`AutoresearchErrorEnvelope`~~ | ~~已取消~~ — H-01 简化: 直接扩展 `McpError` += `retryable` + `retry_after_ms`，不新建独立 schema | — | — |
| `RunState v1` | `autoresearch-meta/schemas/run_state_v1.schema.json` | 生成 enum | 生成 enum |
| `GateSpec v1` | `autoresearch-meta/schemas/gate_spec_v1.schema.json` | 生成接口 | 生成 dataclass |
| `EcosystemID` | `autoresearch-meta/schemas/ecosystem_id_v1.schema.json` | 生成接口 | 生成 dataclass |
| `ArtifactRef v1` | `autoresearch-meta/schemas/artifact_ref_v1.schema.json` | 生成接口 (替代 Zod 手写) | 生成 dataclass |
| `ApprovalPacket v1` | `autoresearch-meta/schemas/approval_packet_v1.schema.json` | (不消费) | 生成 dataclass |
| Artifact 命名规范 | `autoresearch-meta/ECOSYSTEM_DEV_CONTRACT.md` §Artifact | lint 脚本检查 | lint 脚本检查 |

### H-01: McpError 扩展 (retryable + retry_after_ms)

> **Scope Audit 收敛 (3/3)**: 不创建独立 `AutoresearchErrorEnvelope`。在现有 `McpError` (`packages/shared/src/errors.ts`) 中添加 `retryable` + `retry_after_ms` 两个字段即可。~20 LOC。

**依赖**: H-14a (Phase 0, done)
**关联**: H-02, H-19

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `packages/shared/src/errors.ts` | `McpError` 类增加 `retryable: boolean` + `retryAfterMs?: number`；构造函数根据 `ErrorCode` 自动推断 (`RATE_LIMIT`/`UPSTREAM_ERROR` → `retryable=true`) |

**retryable 映射**:
```
RATE_LIMIT      → retryable=true, retryAfterMs=data?.retryAfter
UPSTREAM_ERROR  → retryable=true
INVALID_PARAMS  → retryable=false
NOT_FOUND       → retryable=false
INTERNAL_ERROR  → retryable=false
UNSAFE_FS       → retryable=false
```

**不做**:
- 不创建 `AutoresearchErrorEnvelope` 独立类型
- 不新建 `errors/` 子目录
- 不在 Python 侧创建 adapter 层（Python 退役路径）

**验收检查点**:
- [ ] `McpError` 含 `retryable` + `retryAfterMs` 字段
- [ ] `new McpError('RATE_LIMIT', ...)` → `retryable === true`
- [ ] `new McpError('INVALID_PARAMS', ...)` → `retryable === false`

### H-02: 最小可观测性 (trace_id)

**依赖**: H-01 (McpError.retryable — trace_id 在 dispatcher 层注入)
**关联**: H-19

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/shared/src/tracing.ts` | (新文件) `generateTraceId(): string` (UUID v4)；`extractTraceId(params): string` 从 MCP 参数中提取或生成 |
| `hep-research-mcp/src/tools/dispatcher.ts` | 每次 tool call 注入 `trace_id` 到 handler context；错误响应包含 `trace_id` |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | `call_tool_json()` 自动注入 `_trace_id` 参数；从响应中提取并记录 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | ledger 事件增加 `trace_id` 字段 |

**验收检查点**:
- [ ] 任意 MCP tool call 的错误响应含 `trace_id`
- [ ] hep-autoresearch ledger 事件含 `trace_id`，可与 MCP 日志关联
- [ ] `trace_id` 格式为 UUID v4

### H-03: 统一 RunState v1

**依赖**: 无（可与 H-01 并行）

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/schemas/run_state_v1.schema.json` | (新文件) 定义 canonical enum: `pending`, `running`, `paused`, `awaiting_approval`, `completed`, `failed`, `needs_recovery` + 映射表 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | `run_status` 使用 `RunState` 枚举；移除 `idle` (映射为 `pending`) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/adapters/shell.py` | `NOT_STARTED`/`RUNNING`/`DONE`/`FAILED` 映射到 `RunState` |

**映射表**:
```
orchestrator: idle → pending, running → running, awaiting_approval → awaiting_approval
              completed → completed, failed → failed, needs_recovery → needs_recovery
adapter:      NOT_STARTED → pending, RUNNING → running, DONE → completed, FAILED → failed
idea-core:    running → running, paused → paused, exhausted → failed
              early_stopped → completed, completed → completed
plan steps:   pending → pending, in_progress → running, completed → completed
              blocked → awaiting_approval, failed → failed, skipped → completed
branches:     candidate → pending, active → running, abandoned → completed
              failed → failed, completed → completed
```

**验收检查点**:
- [ ] `run_state_v1.schema.json` 通过 JSON Schema Draft 2020-12 验证
- [ ] 所有组件状态可通过映射表转换为 `RunState v1`
- [ ] `hepar status` 输出使用统一枚举

### H-04: Gate Registry + 静态校验 ✅ (已实现)

> **状态**: done (929f693)。**Scope Audit (2/3 建议简化, Codex 保留意见)**: 当前实现 ~120 LOC，含 GateType/GateScope/FailBehavior 枚举、GateSpec 接口、GATE_REGISTRY 数组、GATE_BY_NAME Map、getGateSpec 查找函数。Codex 指出已有非 approval gates (quality/budget)，2/3 多数建议简化到 ~30 LOC。评估结论: 已实现版本工作正常且已测试，冻结优先于重写。不扩展。

**实现位置**: `packages/shared/src/gate-registry.ts`

### H-13: 上下文风暴截断机制

**依赖**: 无

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/tools/dispatcher.ts` | tool result 超过 `MAX_RESULT_SIZE` (默认 100KB) 时自动溢出到 artifact + 返回 `{truncated: true, artifact_uri: "hep://...", summary: "..."}` |
| `hep-research-mcp/packages/shared/src/constants.ts` | 新增 `MAX_TOOL_RESULT_BYTES = 100_000` |

**验收检查点**:
- [ ] 返回 200KB JSON 的工具 → 自动截断 + artifact URI
- [ ] 截断响应含 `summary` 字段

### H-15a: EcosystemID 规范 ✅ (已实现，冻结不扩展)

> **状态**: done (929f693)。**Scope Audit 收敛 (3/3)**: 已实现 branded type + prefix registry。冻结不扩展。不添加新前缀。不在其他模块强制 `EcosystemId` branded type。

**实现位置**: `packages/shared/src/ecosystem-id.ts`
**冻结原因**: 对无外部用户系统，branded type 投入产出比低。已实现、已测试、沉没成本。保留但不扩展。

### H-16a: 工具名常量化 + 长度约束 + 运行时握手

**依赖**: C-03 (tool catalog)
**关联**: H-17, NEW-R13 (包重命名, Phase 0 已定执行)

**已知问题**: MCP 工具名经 `mcp__{server}__{tool}` 前缀拼接后超出部分 API 网关限制 (如 `mcp__hep-research__hep_run_writing_create_section_write_packet_v1` 触发 400 错误)。需在工具命名时强制长度约束。

**子项 (深度重构分析追加)**: `hep_run_*` 写作流水线工具命名明确化 — 当前 `hep_run_create`/`hep_run_status` 等工具名未明确反映其属于 writing pipeline (而非通用 run lifecycle)。在 H-16a 常量化 + 重命名工作中应一并评估是否将这些工具重命名为更明确的前缀 (如 `hep_writing_run_*` 或 `hep_wrun_*`)，需平衡命名清晰度与长度约束 (≤40 chars)。此项与 NEW-R15 的 `orch_run_*` 命名空间策略相关 — 确保 orchestrator runs 和 writing runs 的命名不混淆。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/scripts/generate_tool_catalog.ts` | 额外输出 `tool_names.py`：Python 常量文件 `TOOL_HEP_HEALTH = "hep_health"` 等 |
| `hep-research-mcp/scripts/generate_tool_catalog.ts` | 新增 lint: 工具名长度 ≤40 字符 (拼接 `mcp__hep-research__` 前缀后 ≤64)；超长工具名必须缩写 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_tools.py` | (生成文件) 替代硬编码字符串 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | `call_tool_json()` 使用常量而非裸字符串 |

**验收检查点**:
- [ ] `mcp_tools.py` 由 CI 自动生成，手动修改被 `.gitignore` 或 CI 检查拒绝
- [ ] 工具名变更时 CI 自动检测并失败
- [ ] 所有工具名拼接 MCP 前缀后 ≤64 字符，CI lint 强制

### H-17: 运行时兼容性握手 (deferred → Phase 2)

> **Scope Audit 收敛 (3/3)**: CI 检查已覆盖。运行时握手在多版本并存时才有价值。Defer to Phase 2。

**依赖**: C-03 (tool catalog hash)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/tools/health.ts` | `hep_health` 返回增加 `tool_catalog_hash: string` (SHA256 of sorted tool names) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | 启动时执行 `initialize → hep_health → tools/list` 握手；比对 `tool_catalog_hash` 与本地期望值 |

**验收检查点**:
- [ ] MCP server 升级后 hash 变化 → hep-autoresearch 启动时警告
- [ ] CI 固定 hash 并在漂移时失败

### H-18: ArtifactRef V1

**依赖**: H-15a (EcosystemID)

> **R7 注记 (Track B 设计审查)**: `kind` 枚举需扩展以支持 Track B artifact 类型: `gene` (Gene 定义), `capsule` (Capsule 内容/patch), `trace_event` (trace 事件引用), `skill_proposal` (技能提案)。这些值在 EVO-19/EVO-12a 实现时添加。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/shared/src/types/artifact-ref.ts` | 从 codegen 生成的 `ArtifactRefV1` 接口导入（替代手写 Zod schema）；手写 Zod runtime validator 包装生成类型 |
| `hep-research-mcp/src/tools/dispatcher.ts` | 所有返回 artifact URI 的工具同时返回 `ArtifactRefV1` |

**验收检查点**:
- [ ] 所有跨组件 artifact 指针输出包含 `ArtifactRefV1`
- [ ] 消费者可通过 `sha256` + `size_bytes` 验证完整性

### H-19: 失败分类 + 重试/退避策略

**依赖**: H-01 (McpError.retryable)

> **Scope Audit 对齐 (v1.8.0)**: 运行时基础设施只建在 TS 侧。H-19 的 **主实现** 在 TS orchestrator (`packages/orchestrator/`)，供 NEW-RT-01/02 依赖。Python 侧为 **临时 stopgap**（Pipeline A 退役前维持基本重试能力）。**一旦 TS 实现就绪并通过验收，Python 侧 retry.py + mcp_stdio_client.py 中的重试逻辑必须立即删除，不设缓冲期**（开发阶段无外部用户，无向后兼容负担）。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `packages/orchestrator/src/retry.ts` | (新文件, **主实现**) `RetryPolicy { maxRetries, baseDelayMs, maxDelayMs, jitter }` + `retryWithBackoff(fn, policy)` 工具函数；根据 `McpError.retryable` 决定是否重试。NEW-RT-01/02 的直接依赖。 |
| `packages/shared/src/retry-policy.ts` | (新文件) `RetryPolicy` 类型定义 (共享，供 orchestrator + 未来 AgentRunner 使用) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/retry.py` | (临时 stopgap) Python 侧简化重试装饰器；随 Pipeline A 退役移除 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | `call_tool_json()` 集成基本 `RetryPolicy`（临时 stopgap） |

**验收检查点**:
- [ ] TS `retryWithBackoff()` 通过单元测试 (主实现)
- [ ] `RATE_LIMIT` 错误 → 按 `retry_after_ms` 等待后重试
- [ ] `INVALID_PARAMS` 错误 → 不重试，立即返回
- [ ] 重试次数超限 → 抛出最终错误含全部重试记录
- [ ] NEW-RT-02 可直接 import TS retry 模块

### M-01: Artifact 命名规范

**依赖**: 无

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/scripts/lint_artifact_names.py` | (新文件) 正则检查: `^[a-z]+_[a-z_]+(_\d{3})?_v\d+\.(json|tex|jsonl)$` |
| `hep-research-mcp/src/writing/` 各文件 | 统一 artifact 文件名为 `<category>_<name>[_<index>]_v<N>.{json|tex}` |

**验收检查点**:
- [ ] CI lint 检查新 artifact 名称符合规范
- [ ] 现有 artifact 名称全部符合或有迁移别名
- [ ] **ART-01 .md 例外 (R4)**: `packet_short.md` / `packet.md` 为人类审批产物，在 lint 脚本中显式豁免（GATE-05 管辖，不受 ART-01 JSON/tex/jsonl 正则约束）

### M-18: 配置管理统一

**依赖**: H-20 (Phase 0)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/docs/ecosystem_config_v1.md` | (新文件) 配置键注册表：键名、默认值、优先级链 (env > .env > config file > default) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | 启动时输出 config echo 摘要（已设置的配置键 + 来源） |

**验收检查点**:
- [ ] `hepar doctor` 输出当前生效配置及来源
- [ ] 配置但未传播的键触发警告

### M-19: 跨组件 CI 集成测试

**依赖**: H-17 (握手), H-16a (工具名常量)
**严重度**: High (R2 升级: Medium→High，跨组件 CI 是 fail-open 规则的安全网)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/tests/integration/test_smoke.sh` | (新文件) CI 中启动 hep-research-mcp (standard + full) → 运行 hep-autoresearch `doctor` + `bridge` 冒烟测试 |
| CI 配置 | 新增 integration test job |

**验收检查点**:
- [ ] CI 在 `standard` 和 `full` 模式下冒烟测试通过
- [ ] 错误信封解析 golden test 通过

### M-22: GateSpec 通用抽象 (原 §7.8 M-14) — deferred → Phase 3

> **Scope Audit 收敛 (3/3)**: Defer to Phase 3。Phase 1 H-04 已提供足够的 gate registry。通用 GateSpec 抽象在多类型 gate (approval/quality/convergence) 需要统一策略时才有价值。

**依赖**: H-04 (Gate Registry)
**关联**: C-01 (审批超时)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/schemas/gate_spec_v1.schema.json` | `GateSpec { gate_id, gate_type: "approval"|"quality"|"convergence", scope, policy, fail_behavior: "fail-open"|"fail-closed", audit_required: bool }` |

**验收检查点**:
- [ ] 所有组件的 gate 可映射到 `GateSpec v1`
- [ ] `fail_behavior` 默认为 `fail-closed`

### H-11a: MCP 工具风险分级 (从 Phase 2 提前)

**依赖**: C-02 (Shell 隔离)
**关联**: H-11b (Phase 2 高级组合策略)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/tools/registry.ts` | `ToolSpec` 新增 `risk_level: 'read'|'write'|'destructive'` 字段 |
| `hep-research-mcp/src/tools/dispatcher.ts` | `destructive` 工具调用前检查 `_confirm: true` 参数；无确认时返回提示而非执行 |

**验收检查点**:
- [ ] `hep_export_project` (destructive) 无 `_confirm` → 返回确认提示
- [ ] `inspire_search` (read) → 直接执行
- [ ] 所有工具在 registry 中标注 `risk_level`
- [ ] **SEC-03 sunset (R4)**: Phase 2 完成后，存量未标注工具从 fail-open 升级为 fail-closed；H-11a 完成即为 sunset 触发条件

### M-14a: 日志脱敏层 (redaction prerequisite)

**依赖**: 无
**关联**: Phase 2 JSONL 日志扩展（M-14a 为前置条件）

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/redaction.py` | (新文件) `redact(text: str) -> str`: 正则替换 API key (`sk-...`), Bearer token, 用户路径 (`/Users/<name>/`) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/logging_config.py` | 所有日志输出经过 `redact()` 层 |
| `hep-research-mcp/packages/shared/src/redaction.ts` | (新文件) TS 镜像 `redact()` 函数 |

**验收检查点**:
- [ ] 设置含 `sk-abc123...` 的环境 → 日志输出中 API key 被替换为 `sk-***`
- [ ] `/Users/fkg/` 路径被替换为 `/Users/<redacted>/`
- [ ] CI 测试：grep 日志无 secrets 模式泄露

### NEW-01: 跨语言类型代码生成基础设施 (R3 从 Phase 2 提前)

**严重度**: High (R3 升级: NEW→High，SSOT + SYNC-06 的前置条件)
**依赖**: 无硬依赖（schema 文件可增量添加；工具链本身不依赖 Phase 1 抽象定义）

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/scripts/codegen.sh` | (新文件) 统一入口：调用 `json-schema-to-typescript` 生成 TS 接口 → `datamodel-code-generator` 生成 Python dataclass；输出到各组件 `generated/` 目录 |
| `autoresearch-meta/Makefile` | 新增 `codegen` target；新增 `codegen-check` target（生成 + `git diff --exit-code`） |
| `hep-research-mcp/packages/shared/src/generated/` | (生成目录) TS 接口文件，替代手写 Zod 定义中的跨组件类型 |
| `hep-autoresearch/src/hep_autoresearch/generated/` | (生成目录) Python dataclass 文件，替代手写镜像 |
| CI 配置 | `make codegen-check` 作为 CI 门禁 |

**验收检查点**:
- [ ] `make codegen` 从 `autoresearch-meta/schemas/*.schema.json` 生成 TS + Python 代码
- [ ] 生成的 TS 接口可在 hep-research-mcp 中直接 import 并通过编译
- [ ] 生成的 Python dataclass 可在 hep-autoresearch 中直接 import 并通过 mypy
- [ ] CI 中 `make codegen-check` 检测到 schema 变更未重新生成时阻断

> **NEW-R05 修正 (深度重构分析)**: Python 代码生成目标从 `dataclasses` 修正为 `Pydantic v2 BaseModel` (同一工具 `datamodel-code-generator`，flag `--output-model-type pydantic_v2.BaseModel`)。Pydantic v2 提供运行时验证对等性（与 TS 侧的 Zod runtime validation 对称）。此修正作为 NEW-R05a 独立子项管理，可在不影响 Phase 1 主路径的情况下时间框定评估 `pydantic-core` Rust wheel 构建风险。

### NEW-R02: TS `as any` CI 门禁 (diff-scoped) ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §2

**依赖**: NEW-R02a (CI gate 脚本必须先就绪)

**现状**: hep-research-mcp `src/` 中有 254 个 `as any` cast。相邻逃逸: `as unknown as`=23, `: any`=101, `eslint-disable`=7。
**策略**: 两个独立工作流:
- (a) **CI 门禁** (Phase 1): diff-scoped grep 启发式阻止新增 `as any` + `.catch(() => {})`
- (b) **遗留清理** (Phase 2/H-16b): 系统性按目录减少现有 254 casts，跟踪在 `TYPE_SAFETY_BURNDOWN.md`

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| CI 配置 | 新增 diff-scoped `as any` 检查 (基于 NEW-R02a 的 `check_loc.py` CODE-01.4 实现) |

**验收检查点**:
- [ ] 新 PR 中新增 `as any` → CI 失败
- [ ] 存量 `as any` 不触发 CI (diff-scoped)
- [ ] `.catch(() => {})` 同等检测

### NEW-R03b: Python 异常处理规范化 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §3 Phase (b)
> **H-01 简化影响**: 不创建 `AutoresearchError` 独立类型。Python 侧为退役路径，采用标准 Python 异常层次 + 域特定异常类（如 `CalcError`, `EvidenceError`）替代宽泛 catch。

**依赖**: H-01 (McpError 扩展，提供错误码映射参考)

**现状**: 281 个广泛异常处理器需要规范化。Phase (a) P0 审计已完成后，此项为系统性迁移。
**策略**: 按子模块逐步迁移 `except Exception:` 为具体的域特定异常 catch（Python 退役路径，不引入 McpError）。

**验收检查点**:
- [ ] 所有 `except Exception:` 替换为具体域异常或有 CONTRACT-EXEMPT 标记
- [ ] 错误码与 H-01 McpError 错误码映射表对齐（供 MCP 边界转换参考）

### NEW-R04: Zotero 工具整合 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §5

**依赖**: 无

**现状**: `zotero-mcp/src/zotero/tools.ts` (2510 LOC) 和 `vnext/zotero/tools.ts` (2339 LOC) 实现了相同的 6 个函数，但签名和辅助函数有差异。约 ~2300 LOC 可通过整合去重。
**策略**: `zotero-mcp` 为 canonical provider (per NEW-R04); `hep-mcp` 保留 thin adapter 层聚合 `zotero-mcp` 工具。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `packages/zotero-mcp/src/zotero/tools.ts` | Canonical 实现: 统一签名，消除冗余辅助函数 |
| `packages/hep-research-mcp/src/vnext/zotero/tools.ts` | 改为 thin adapter: import from `zotero-mcp`, 不重复实现 |

**验收检查点**:
- [ ] `vnext/zotero/tools.ts` 不包含独立的业务逻辑实现
- [ ] Zotero 工具功能无回归 (现有测试通过)
- [ ] 去重 ≥2000 LOC

### NEW-R09: `orchestrator_cli.py` 拆分 — CUT ★深度重构

> **Scope Audit 收敛 (3/3)**: CUT。hep-autoresearch 整体退役（TS orchestrator 替代），不单独拆分 Python 代码。

**状态**: cut
**原因**: hep-autoresearch → TS orchestrator 迁移路径下，拆分 Python god-file 无投入产出价值。

### UX-01: 研究笔记与机器 Contract 分离 ★UX

> **新增 (2026-02-22)**: User Story 分析发现 Draft_Derivation.md 同时承担人类笔记和机器 contract 两个角色，格式受 REPRO_CAPSULE / tier tags / headline 格式主导，人类阅读体验差。

**现状**: Draft_Derivation.md 被 research-team、context_pack.py、w3_revision.py 多方引用，既是人类编辑的研究笔记入口，又是机器 gate 检查器的输入。

**变更**:

| 文件 | 变更 |
|---|---|
| research-team `assets/derivation_notes_template.md` | 拆分为 `research_notebook_template.md` (人类入口) + `derivation_contract_template.md` (机器 contract) |
| `hep-autoresearch/src/.../context_pack.py` | 新增 `research_notebook.md` 为 required 上下文文件；`Draft_Derivation.md` 改为 auto-generated |
| `hep-autoresearch/src/.../w3_revision.py` | 从 `Draft_Derivation.md` (machine contract) 提取 headlines，不从 notebook |
| (新) `hep-autoresearch/src/.../contract_extractor.py` | 从 notebook + artifacts 自动生成/更新 Draft_Derivation.md (REPRO_CAPSULE, headlines, tier tags) |

**research_notebook.md 设计**:
- 自由 LaTeX 公式 (不受 Markdown 数学卫生规则限制)
- 嵌入图表: `![](artifacts/runs/<TAG>/figure.png)` 相对路径引用
- 嵌入数值结果: 表格直接写在 notebook 中
- 嵌入交叉验证: 从 EVO-06 integrity_report 提取摘要
- 引用计算代码: "见 `computation/mathematica/one_loop_amplitude.wl`"

**依赖**: 无 (可独立执行)

**验收**:
- [ ] research_notebook.md 可被标准 Markdown 编辑器 (Typora/Obsidian/VS Code) 正常渲染
- [ ] Draft_Derivation.md 由 contract_extractor 自动生成，人类不需直接编辑
- [ ] research-team convergence gate 检查 notebook 内容一致性
- [ ] w3_revision.py 从 contract (非 notebook) 提取 headlines

### UX-05: 延迟脚手架 + 统一初始化入口 ★UX

> **新增 (2026-02-22)**: hepar init 和 research-team scaffold 存在重复 (~15 个文件)；默认全量脚手架创建 ~20+ 文件，多数初期用不到。

**现状**:
- `hepar init` (project_scaffold.py) 创建 CHARTER, MAP, PLAN, PREWORK, Draft_Derivation, AGENTS, docs/*, kb 结构
- `research-team scaffold` 创建同一批 + prompts/, team config, INNOVATION_LOG 等
- 两者独立运行，模板内容略有不同

**变更**:

| 文件 | 变更 |
|---|---|
| `hep-autoresearch/src/.../project_scaffold.py` | 改为调用 research-team scaffold (--minimal mode)，只创建核心 5 文件: CHARTER, PLAN, research_notebook.md, AGENTS, .mcp.json |
| `research-team scripts/bin/scaffold_research_workflow.sh` | 默认改为 `--minimal`；按需生成: prompts/ (team cycle 首次运行时), knowledge_base/ (KB 首次使用时), computation/ (计算首次执行时) |
| 去除重复: `research-team` 不再独立生成 CHARTER/MAP/PLAN 模板 | 统一由 project_scaffold.py 提供 |

**依赖**: UX-01 (notebook 分离)

**验收**:
- [ ] `hepar init` 产出 ≤8 个文件 (核心 5 + docs/ 3)
- [ ] 首次 `run_team_cycle.sh` 自动补充 prompts/ + team config
- [ ] 首次 KB 操作自动补充 knowledge_base/ 结构
- [ ] `--full` 选项保留完整脚手架能力

### UX-06: 研究会话入口协议 ★UX

> **新增 (2026-02-22)**: 人类用户通过 Agent 交互时缺少标准入口——不知道从哪里开始，不知道当前所处阶段。

**变更**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/protocols/session_protocol_v1.md` | 定义 Agent 行为规范: 用户首次输入研究意图时，展示流程概览 + 当前阶段 + 推荐操作 |
| `skills/hepar/SKILL.md` | 更新: 引用 session_protocol，定义 Agent 如何引导用户进入正确的工作流阶段 |

**阶段枚举**: 选题(idea) → 文献(literature) → 推导+计算(derivation) → 写作(writing) → 审稿修订(revision)

**不是代码实现**——是 Agent 行为规范文档，类似 AGENTS.md 但面向用户交互层。

**依赖**: 无

**验收**:
- [ ] session_protocol_v1.md 定义了完整的阶段枚举和 Agent 行为规则
- [ ] 用户输入 "我想研究 X" 时 Agent 能识别阶段并给出明确指引

### NEW-CONN-01: Discovery next_actions hints (Pipeline 连通性)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 3 (Literature Discovery 无 next_actions)
> **Phase**: 1 (Pipeline 连通性子项，~100 LOC)

**依赖**: H-16a (done)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `packages/hep-mcp/src/vnext/tools/inspire-search.ts` | 返回 JSON 添加 hint-only `next_actions` (papers.length > 0 时建议 `inspire_deep_research`, cap 10 recids) |
| `packages/hep-mcp/src/vnext/tools/inspire-research-navigator.ts` | 同上 |
| `packages/hep-mcp/src/vnext/tools/inspire-deep-research.ts` | mode=analyze 时建议 synthesize/write |
| `packages/hep-mcp/src/vnext/tools/zotero-import.ts` | import 后建议 `inspire_deep_research` |

**约束**:
- 遵循现有 `{ tool, args, reason }` 惯例 (221+ 次使用, 33 个文件)
- 确定性规则，不依赖 LLM
- Hint-only，不自动执行
- 使用 `TOOL_NAMES.*` 常量

**验收检查点**:
- [ ] `inspire_search` 返回含论文时，`next_actions` 非空
- [ ] `next_actions` 中 recids 上限 10
- [ ] `inspire_deep_research(mode=analyze)` → next_actions 建议 synthesize

### Phase 1 验收总检查点

- [ ] 全部共享抽象 schema 通过 JSON Schema Draft 2020-12 验证
- [ ] `make codegen-check` CI 门禁通过（JSON Schema → TS/Python 代码生成一致性）
- [ ] `McpError` 错误码映射表覆盖所有已知错误码（含 `retryable` + `retry_after_ms` 语义）
- [ ] `RunState v1` 映射表覆盖所有组件状态
- [ ] `hepar doctor` + `hepar bridge` 冒烟测试通过
- [ ] Zotero 工具整合完成 (NEW-R04)
- [ ] diff-scoped `as any` CI 门禁就绪 (NEW-R02)
- [ ] research_notebook.md 可渲染 + Draft_Derivation.md 自动生成 (UX-01)
- [ ] 脚手架默认 minimal，按需扩展 (UX-05)
- [ ] session_protocol_v1 定义完成 (UX-06)
- [ ] 无 Phase 0 回归

---

## Phase 2: 深度集成 (P2) — 可观测性与鲁棒性

> **目标**: 基于 Phase 1 抽象实现深度集成、原子性保证、全链路追踪
> **前置**: Phase 1 全部完成
> **并行度**: 大部分可并行

### H-05: 跨平台文件锁 + 启动时 reconcile

**依赖**: H-01 (McpError), H-03 (RunState)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/locking.py` | (新文件) 统一锁抽象：`AdvisoryLock(path, owner, ttl)` 基于 `filelock` 库（跨平台）；锁文件含 `{owner_pid, acquired_at, ttl_seconds}` 元数据 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | 替换 `fcntl.flock` 为 `AdvisoryLock`；启动时检测过期锁并自动 reconcile |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | ledger `event_id` 改为单调递增序列号 |

**验收检查点**:
- [ ] macOS + Linux 上锁行为一致
- [ ] 进程崩溃后重启 → 自动检测过期锁并恢复
- [ ] ledger `event_id` 严格单调递增

### H-07: 原子文件写入

**依赖**: 无
**关联**: AGENTS.md §运行时产出目录结构 设计原则 #4 (原子写入保证)

**关键约束**: `rename()` 仅在同文件系统内原子。项目本地写入必须使用 `<project_dir>/.autoresearch/tmp/` 作为临时目录；全局写入使用 `~/.autoresearch/cache/tmp/`。禁止跨文件系统 rename。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/shared/src/fs-utils.ts` | (新文件) `atomicWriteFile(path, data)`: write `.tmp` → `fsync` → `rename`；tmp 目录自动选择同文件系统路径 |
| `hep-research-mcp/src/writing/` 各 artifact 写入点 | 替换 `writeFile` 为 `atomicWriteFile` |
| `hep-research-mcp/src/export/` 各导出点 | 同上 |

**验收检查点**:
- [ ] 进程 `kill -9` 后无截断/损坏 artifact
- [ ] `.tmp` 文件在正常完成后不残留
- [ ] tmp 文件与目标文件在同一文件系统 (通过 `stat` 验证 `st_dev` 一致)

### H-09: 幂等性 CAS

**依赖**: H-01 (McpError)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `idea-core/src/idea_core/engine/service.py` | `_record_or_replay` + `_store_idempotency` 合并为原子操作：使用 `filelock` 保护 + 修订计数器 |

**验收检查点**:
- [ ] 并发提交相同 `idempotency_key` → 仅一个成功，另一个返回已有结果
- [ ] 进程崩溃在副作用提交后 → 幂等性记录已保存

### H-10: Ledger 事件类型枚举

**依赖**: H-03 (RunState)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/ledger.py` | 定义 `EventType` 枚举: `workflow_start`, `workflow_end`, `phase_start`, `phase_end`, `approval_request`, `approval_granted`, `approval_denied`, `approval_timeout`, `state_transition`, `error`, `checkpoint` |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | `append_ledger()` 验证 `event_type` 属于枚举；非枚举值拒绝写入 |

**验收检查点**:
- [ ] 非枚举 `event_type` 写入时抛出 `ValueError`
- [ ] 现有 ledger 事件全部可映射到枚举值

### H-11b: MCP 权限组合策略

**依赖**: H-11a (Phase 1 风险分级), H-04 (Gate Registry)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/tools/dispatcher.ts` | 高级权限组合策略：`destructive` + `write` 工具链调用需 gate 审批；capability composition policy 文档化 |

**验收检查点**:
- [ ] 多工具链含 `destructive` 工具 → 需 gate 审批
- [ ] 单 `read` 工具链 → 直接执行

### H-12: 不可信内容沙箱

**依赖**: C-02 (Shell 隔离)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/shared/src/fs-utils.ts` | `safeExtract(archive, dest)`: Zip Slip 防护 + 解压大小限制 (默认 500MB) + 文件数限制 (默认 10000) |
| `hep-research-mcp/src/research/preprocess/` | PDF/LaTeX 解析增加资源配额 (内存/时间) |

**验收检查点**:
- [ ] Zip Slip 测试用例 (`../../../etc/passwd`) → 拦截
- [ ] 解压炸弹 (1GB 压缩为 1KB) → 拦截

### H-15b: Artifact 版本化统一

**依赖**: H-18 (ArtifactRef), M-01 (命名规范)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/writing/` 各文件 | 所有 artifact 同时使用文件名 `_v{N}` 后缀 + JSON 内 `schema_version` 字段双标记 |
| `hep-autoresearch/schemas/` | run_card, state 等 schema 统一 `schema_version` 字段位置（顶层第一个字段） |

**验收检查点**:
- [ ] 所有 artifact 可通过统一规则解析版本（文件名 + 内字段）
- [ ] lint 脚本检查双标记一致性

### H-16b: 跨组件契约测试 CI

**依赖**: H-16a (工具名常量), H-17 (握手)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/tests/contract/test_tool_subset.py` | 验证 hep-autoresearch 调用的 MCP 工具集合 ⊂ hep-research-mcp 注册表 |
| CI 配置 | 新增 contract test job：启动 MCP server → 比对工具名集合 |

**验收检查点**:
- [ ] hep-autoresearch 引用不存在的工具名 → CI 失败
- [ ] 新增 MCP 工具 → 不影响现有契约测试

### H-21: 数据存储位置统一

**依赖**: H-20 (配置加载)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | 默认配置 `HEP_DATA_DIR` 为 `~/.hep-research-mcp`（与 ECOSYSTEM_DEV_CONTRACT CFG-01 对齐）；可通过 env 覆盖 |
| 文档 | 说明 `HEP_DATA_DIR=.` 的项目相对模式 |

**验收检查点**:
- [ ] 移动项目目录后 `hepar status` 仍能找到所有 artifact
- [ ] `HEP_DATA_DIR` 环境变量覆盖默认值

### M-02: 遗留工具名迁移

**依赖**: H-16a (工具名常量)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | 移除 `inspire_field_survey` 调用，统一为 `inspire_research_navigator` |
| `hep-research-mcp/src/tools/registry.ts` | 可选：添加 deprecated alias 映射 + 警告日志 |

**验收检查点**:
- [ ] 代码中无遗留工具名引用
- [ ] 别名调用触发 deprecation 警告

### M-05: Token 计数标准化

**依赖**: 无

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/writing/tokenBudget.ts` | 新增 `tokenizer_model` 参数（默认 `claude-opus-4-6`）；文档化 token 估算公式与校准流程 |
| `hep-research-mcp/src/writing/tokenGate.ts` | 同上 |

**验收检查点**:
- [ ] token budget/gate 工具接受 `tokenizer_model` 参数
- [ ] 不同模型的 token 估算差异在文档中说明

### M-06: SQLite WAL + 连接池

**依赖**: 无

> **R7 scope expansion (Track B 设计审查)**: 原始范围仅覆盖 PDG 数据库。EVO-20 (Memory Graph)、EVO-19 (Gene Library)、EVO-21 (Strategy Stats) 均需 SQLite WAL 支持。扩展为通用 SQLite 工具模块。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/pdg-mcp/src/db.ts` | 连接时设置 `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=5000` |
| `packages/shared/src/db/sqlite-utils.ts` | (R7 新增) 通用 SQLite 工具: WAL 模式配置、busy_timeout、连接生命周期 (open/close/checkpoint)、schema 初始化 (CREATE TABLE IF NOT EXISTS)。消费者: PDG-MCP, Memory Graph (EVO-20), Gene Library (EVO-19), Strategy Stats (EVO-21) |

**验收检查点**:
- [ ] 并发读写不触发 `database is locked`
- [ ] WAL 模式在连接后验证
- [ ] (R7) 通用 SQLite 工具模块可被 Memory Graph / Gene Library / Strategy Stats 消费

### M-20: 迁移注册表

**依赖**: H-15b (版本化统一), **H-21 (数据位置统一 — 涉及文件路径的迁移条目必须在 H-21 合并后执行)**

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/schemas/migration_registry_v1.json` | (新文件) 每个持久化 schema 的迁移链：`{schema_id, versions: [{from, to, migration_fn}]}` |
| `hep-autoresearch/src/hep_autoresearch/toolkit/migrate.py` | (新文件) `workspace migrate` 命令：检测旧版 artifact → 应用迁移链 |

**验收检查点**:
- [ ] N-1 版本 fixture 可通过 `workspace migrate` 升级
- [ ] 迁移后 artifact 通过当前版本 schema 验证

### M-21: 载荷大小/背压契约

**依赖**: H-13 (截断机制)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/ECOSYSTEM_DEV_CONTRACT.md` §Artifact | 定义 stdio tool result 最大大小 (100KB)；超限溢出到 artifact + `read_artifact_chunk` |

**验收检查点**:
- [ ] 超限 tool result 自动溢出
- [ ] 客户端/服务端统一强制大小限制

### M-23: 发布产物对齐

**依赖**: H-16a (工具名常量生成)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `Makefile` (根目录) | 新增 `release` target：`pnpm build` → `generate_tool_catalog` → `generate_tool_names.py` → 统一版本号 |

**验收检查点**:
- [ ] `make release` 一键构建 TS + 生成 Python 绑定
- [ ] 版本号在 `package.json` 和 `pyproject.toml` 中一致

### 全链路 trace_id + 结构化 JSONL 日志

**依赖**: H-02 (trace_id), H-01 (McpError), **M-14a (日志脱敏层，前置条件)**

> **R7 注记 (Track B 设计审查)**: EVO-12a (技能自生成) 需要以下 trace event types 具有结构化 `data` schema: `file_edit` (file_path, diff, edit_type), `fix_applied` (file_path, fix_type, signal_context), `tool_call` (tool_name, params, result_status), `skill_invoked` (skill_id, trigger, result)。这些 event types 应在 trace-jsonl 的 event schema 规范中定义。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/logging_config.py` | (新文件) 结构化 JSONL 输出：`{ts, level, component, trace_id, event, data}` + 保留人类可读 CLI 输出 |
| `hep-research-mcp/src/tools/dispatcher.ts` | tool 调用日志输出 JSONL 格式到 stderr |

**验收检查点**:
- [ ] 所有组件日志可被统一聚合工具 (`jq`) 解析
- [ ] `trace_id` 贯穿 MCP → orchestrator → ledger

### NEW-02: 审批产物三件套 + CLI 可读性重做

**依赖**: H-04 (Gate Registry), M-22 (GateSpec), NEW-01 (ApprovalPacket schema codegen)
**改造对象**: `orchestrator_cli.py` 中 `_approval_packet_skeleton()` + `_request_approval()`

**现状**: `_request_approval` 生成单一 `packet.md`（全量 Markdown），人类审阅时信息密度过高，无结构化机器消费格式。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/schemas/approval_packet_v1.schema.json` | (新文件) 结构化 schema：`{ purpose, gate_id, run_id, approval_id, plan: [], risks: [], budgets: { max_network_calls, max_runtime_minutes, max_cpu_hours, max_gpu_hours, max_disk_gb }, outputs: [], rollback, commands: [], checklist: [] }` |
| `hep-autoresearch/src/hep_autoresearch/toolkit/approval_packet.py` | (新文件) `ApprovalPacketRenderer`：从 state + policy 构建 `ApprovalPacket` dataclass (由 codegen 生成)，输出三份产物 |
| `hep-autoresearch/src/hep_autoresearch/templates/packet_short.md.jinja2` | (新文件) 短版模板：TL;DR、Gate、run-id、执行命令、修改/运行摘要、预算表、accept/reject checklist、回滚步骤、预期输出路径。目标 ≤1 页 |
| `hep-autoresearch/src/hep_autoresearch/templates/packet_full.md.jinja2` | (新文件) 全量模板：保留现有 `_approval_packet_skeleton` 全部字段 + gate resolution trace，重排为可扫描格式 |
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | `_request_approval()` 改为写入三份产物到 `approvals/<approval_id>/`：`packet_short.md`, `packet.md`, `approval_packet_v1.json` |

**产物结构**:
```
artifacts/runs/<run_id>/approvals/<approval_id>/
├── packet_short.md   # ≤1 页，终端默认展示
├── packet.md         # 全量细节，仅落盘
└── approval_packet_v1.json  # 结构化，符合 approval_packet_v1.schema.json (ART-01/ART-02 compliant)
```

**验收检查点**:
- [ ] `_request_approval()` 生成三份产物且 `approval_packet_v1.json` 通过 schema 验证
- [ ] `packet_short.md` 渲染后 ~60 行软上限（超限时附加 overflow 指针到 full packet）
- [ ] `packet.md` 包含现有 `_approval_packet_skeleton` 全部信息（无回归）
- [ ] `approval_packet_v1.json` 含 `purpose`, `plan[]`, `risks[]`, `budgets{}`, `outputs[]`, `rollback`, `commands[]`

### NEW-03: 审批 CLI 查看命令

**依赖**: NEW-02 (三件套产物)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | 新增子命令 `approvals show --run-id <RID> --gate <A?> --format short|full|json`；默认 `short`，终端打印 `packet_short.md`；`full` 打印 `packet.md`；`json` 输出 `approval_packet_v1.json` 到 stdout |

**验收检查点**:
- [ ] `hepar approvals show --run-id <RID> --gate A3` 默认打印 short 版本
- [ ] `--format json` 输出可被 `jq` 解析
- [ ] 无匹配审批时返回清晰错误信息

### NEW-04: 自包含人类报告生成

**依赖**: NEW-02 (审批产物), H-18 (ArtifactRef)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/report_renderer.py` | (新文件) `ReportRenderer`：从指定 run 的 `analysis.json` / `headline_numbers` / 关键 CSV/PNG 生成单文件报告；支持 Markdown 和 LaTeX 输出 |
| `hep-autoresearch/src/hep_autoresearch/templates/report.md.jinja2` | (新文件) 报告模板：摘要 → 各 run 结果（含表格/图引用）→ 审计指针（artifact URI + SHA256） |
| `hep-autoresearch/src/hep_autoresearch/templates/report.tex.jinja2` | (新文件) LaTeX 报告模板 |
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | 新增子命令 `report render --run-ids <RID,...> --out <md\|tex> [--output-path <path>]` |

**验收检查点**:
- [ ] `hepar report render --run-ids run_abc --out md` 生成自包含 Markdown 报告
- [ ] 报告含各 run 的关键数值、表格、图引用（PNG 内联为 base64 或相对路径）
- [ ] 报告含审计指针：每个引用的 artifact 附 URI + SHA256
- [ ] `--out tex` 生成可编译的 LaTeX 文件

### UX-02: 结构化计算代码目录 + Computation Contract ★UX

> **新增 (2026-02-22)**: research-team 的计算规划 (Draft_Derivation §6 Mapping to Computation) 与 hep-calc 的执行输入 (job.yml) 之间缺少标准化衔接；计算产出的代码文件散落在 artifacts 各 run 目录中，缺少统一的可复现结构。
> **Scope Audit 升级 (2/3)**: 从目录布局升级为**计算契约 (Computation Contract)**: 可编译为 run-cards / skill jobs，含 acceptance checks + expected outputs。
> **Pipeline 连通性审计追加**: 计算产出写入 `computation_evidence_catalog_v1.jsonl`（`ComputationEvidenceCatalogItemV1`，并行 schema，见 NEW-CONN-03），**不**写入 `EvidenceCatalogItemV1`（后者要求 `paper_id` + `LatexLocatorV1`，与计算产出语义不兼容）。如需在 writing pipeline 中消费计算证据，由 NEW-CONN-03 提供显式的有损转换步骤。

**变更**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/schemas/computation_manifest_v1.schema.json` | 计算清单 schema: steps[], environment, dependencies — 作为 research-team 计算规划与 hep-calc 执行之间的标准接口 |
| research-team 输出规范 | Section 6 (Mapping to Computation) 输出 `computation/manifest.json` 而非自由文本描述 |
| hep-calc skill | 新增: 可消费 `computation/manifest.json` 批量执行 (补充现有 job.yml 路径) |

**目录结构**:
```
computation/
├── manifest.json              ← 代码清单 + 运行顺序 + 依赖 + 工具要求
├── mathematica/               ← Wolfram Language 脚本 (.wl)
├── python/                    ← Python 脚本 (SymPy, pySecDec 等)
├── julia/                     ← Julia 脚本 (LoopTools.jl 等)
└── configs/                   ← 参数配置文件 (.json/.yaml)
```

**依赖**: UX-01 (notebook 引用计算代码)

> **渐进式集成**: Phase 2 交付 manifest.json MVP (由 research-team Member 或人类手动编写)。Phase 5 EVO-01 `package_selector` 完成后可自动生成 manifest，届时 UX-02 manifest schema 作为 EVO-01 的输出接口。

**验收**:
- [ ] `computation_manifest_v1.schema.json` 定义完成
- [ ] research-team Member 输出可运行代码至 `computation/`
- [ ] hep-calc 可消费 manifest.json 执行完整计算管线
- [ ] manifest.json 包含环境要求 + 运行顺序 + 预期输出

### UX-07: 审批上下文丰富化 ★UX

> **新增 (2026-02-22)**: 当前审批 packet 是模板填充的空壳 (`"(fill)"` 占位)，人类无法基于现有内容做出有效判断。尤其 A0 (idea) 和 A5 (最终结论) 两个最关键的 gate，审批者缺少物理判断所需的上下文。

**现状**: `approval_packet.py` 生成骨架 Markdown (purpose/plan/risks/budgets/outputs/rollback)，但各字段内容依赖编排器填充，实际多为占位文本。人类必须手动打开 packet 文件，信息密集无层次。

**变更**:

| 文件 | 变更 |
|---|---|
| `hep-autoresearch/src/.../approval_packet.py` | 重构: 每个 gate 类别 (A0-A5) 定义对应的 context assembler，自动聚合该阶段的关键信息 |
| `autoresearch-meta/schemas/approval_packet_v2.schema.json` | 扩展 NEW-02 的 v1 schema: 增加 `context_summary`, `key_results`, `integrity_flags`, `recommendation` 字段 |
| hepar CLI | `hepar approvals show` 默认打印 packet_short 到终端 (不再仅显示 metadata) |

**各 Gate 自动聚合内容**:

| Gate | 自动聚合的上下文 | 来源 |
|---|---|---|
| **A0 (idea)** | IdeaCard 摘要 (thesis + hypotheses + compute_plan 难度评估) + 文献覆盖度 + 可行性评分 | idea-core eval.run 结果 |
| **A1 (文献)** | 检索策略说明 + 命中文献数 + 覆盖度热力图 + 遗漏风险提示 | inspire_search 结果 + KB 缺口分析 |
| **A2 (代码)** | 变更文件列表 + diff 统计 + 测试覆盖状态 | git diff |
| **A3 (计算)** | 参数选择的物理理由 (从 notebook 提取) + 计算预算 + 预期精度 + 已知极限比对预告 | research_notebook §4-5 + manifest.json |
| **A4 (论文)** | 修改摘要 + 新增/删除段落 + 引用变更 + evidence 覆盖率 | writing pipeline coverage_report |
| **A5 (结论)** | 核心结果数值表 + 交叉验证摘要 + notebook 结果节摘要 | research_notebook 结果节 |

> **渐进式增强 (Phase 5)**: A2 的 blast_radius (EVO-19) 和 A5 的 integrity_report 全文 + 已知极限比对 + 文献一致/偏离分析 (EVO-06) 将在对应 EVO 项完成后自动接入 context assembler。Phase 2 交付仅依赖 Phase 2 内可用数据。

**packet_short.md 模板** (~60 行软上限，终端友好; 超限时自动附加 overflow 指针):
```markdown
# [A3] 计算执行审批 — run_abc / A3-0001

## 一句话摘要
计算 h→γγ SMEFT one-loop correction，50 个 Wilson 系数配置扫描。

## 关键数值 (从 notebook 自动提取)
| 指标 | 值 | 来源 |
|---|---|---|
| 预期精度 | < 0.1% | manifest.json |
| 计算预算 | 2 GPU-hours | budgets |
| 参数空间 | C_HB, C_HW, C_HWB ∈ [-2, 2] | configs/scan.json |

## 物理理由 (从 notebook §4 自动提取)
参数范围基于 LHC Run 2 约束 (arXiv:2103.XXXXX)，覆盖 2σ 区间。

## 风险
- GPU OOM 可能: batch_size > 16 时
- 已知极限验证: SM 极限 (C_i → 0) 将自动比对 PDG 值

## 诚信检查预告
A5 时将执行: Ward 恒等式 + 规范不变性 + SM 极限比对

## 操作
- 批准: `hepar approve A3-0001`
- 拒绝: `hepar reject A3-0001 --reason "..."`
- 完整 packet: `hepar approvals show --run-id run_abc --gate A3 --format full`
```

**依赖**: NEW-02 (三件套基础设施), NEW-03 (CLI 查看命令), UX-01 (notebook 可提取摘要)

**验收**:
- [ ] 每个 gate (A0-A4) 的 packet_short 包含该阶段特定的上下文摘要
- [ ] A5 packet_short 包含 notebook 结果节摘要 + 关键数值表 (integrity_report 占位，待 EVO-06 接入)
- [ ] `hepar approvals show` 默认打印 packet_short 到终端
- [ ] packet_short ~60 行软上限，超限时附加 `overflow: hepar approvals show --format full` 指针
- [ ] 人类审阅者无需打开其他文件即可对 packet_short 做出判断

### RT-02: 工具访问增强 + 溯源 Clean-Room ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §2 (R4 READY)

**依赖**: 无新依赖 (与 RT-03 同期交付)

**现状**: research-team 成员工具访问受限 (单轮 JSON proxy, max 8 files)，clean-room 依赖复杂的物理 MCP 实例隔离。

**变更**:

| 文件 | 变更 |
|---|---|
| `run_team_cycle.sh` | 新增 `--member-X-tool-access {restricted\|full}`；生成随机化 workspace 路径 |
| `run_member_review.py` | full 模式启用 MCP 工具 + provenance 收集 |
| `scripts/lib/provenance.py` | (新) provenance schema (claim_id/step_id/tool_call_ids 三级关联)、提取、验证 |
| `scripts/gates/check_clean_room.py` | 重写: workspace 隔离检查 + provenance 交叉验证 + hard-fail 门禁 |
| `scripts/lib/audit_interceptor.py` | MCP tool_use 调用记录 (tc_id + workspace) + 跨 workspace 访问检测 |
| `scripts/lib/workspace_isolator.py` | (新) 随机化 workspace + 路径泄漏防护 + shell 安全约束 |

**关键设计**: 三层 clean-room — (1) 工作区隔离 (随机路径+路径遍历阻断), (2) 溯源交叉验证, (3) hard-fail 门禁 (CONTAMINATION_DETECTED/critical PROVENANCE_MISMATCH → 不可降级)。

**验收**:
- [ ] full 模式: 成员可使用原生 MCP 工具 + provenance 自动记录
- [ ] 工作区隔离: 随机化路径 + shell cwd 锁定 + 路径遍历阻断
- [ ] clean-room gate: CONTAMINATION_DETECTED → hard-fail; critical PROVENANCE_MISMATCH → hard-fail
- [ ] audit log: tc_id/tool_name/args_hash/result_hash/workspace/timestamp
- [ ] provenance.tool_call_ids 与 audit log 精确匹配验证

### RT-03: 统一 Runner 抽象 + API 可配置性 ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §3 (R4 READY)

**依赖**: 无新依赖

**现状**: research-team 成员模型硬编码 (Claude/Gemini/Codex)，无法接入自托管或第三方 LLM provider。

**变更**:

| 文件 | 变更 |
|---|---|
| `run_team_cycle.sh` | 新增 `--member-X-runner`, `--member-X-api-base-url`, `--member-X-api-key-env`, `--member-X-api-provider` |
| `scripts/runners/run_{claude,gemini,codex}.sh` | 增加 `--api-base-url` / `--api-key-env` 支持 |
| `scripts/runners/run_openai_compat.sh` | (新) 通用 OpenAI-compatible runner |

**安全约束**: `--api-key <value>` 明文传参被禁止 (CLI 直接报错拒绝)。

**验收**:
- [ ] `--member-X-runner` 自定义 runner 脚本可替换内置 runner
- [ ] `--api-key-env` 传环境变量名，API key 不出现在进程列表/日志/artifact
- [ ] `run_openai_compat.sh` 可调用 DeepSeek/Qwen/vLLM 端点

### NEW-VIZ-01: Graph Visualization Layer — 通用 schema + 5 domain adapters ★infra

> **设计文档**: `docs/graph-visualization-layer.md` (9 轮双模型审查收敛: Codex READY + Gemini READY)

**依赖**: 无前置依赖 (通用基础设施)

**现状**: `render_claim_graph.py` (~458 LOC) 直接将 Claim DAG 渲染为 Graphviz DOT/PNG/SVG。五个子系统 (Claim DAG, Memory Graph, Literature graph, Idea map, Progress graph) 各自生成类型化有向图，缺少统一可视化层。

**变更**:

| 文件 | 变更 |
|---|---|
| `packages/shared/src/graph/universal-schema.ts` | UniversalNode/UniversalEdge 通用接口 + graph builder |
| `packages/shared/src/graph/adapters/` | 5 个 domain adapter: claim, memory, literature, idea, progress |
| `packages/shared/src/graph/renderers/` | Graphviz DOT + JSON export + HTML (vis.js/D3) |

**验收**:
- [ ] UniversalNode/UniversalEdge schema 支持任意 domain metadata
- [ ] 5 个 adapter 各自产出 universal graph 并可渲染为 DOT/SVG
- [ ] 现有 `render_claim_graph.py` 功能被 claim adapter 覆盖

### NEW-RT-01: TS AgentRunner (Phase 2 early)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #2 (Agent Loop)
> **CLI-First 架构**: Phase 1-2 CLI agents 作为 agent loop; AgentRunner 为 Phase 3+ 自建 agent loop 准备

**依赖**: NEW-R15-impl
**估计**: ~250 LOC

**内容**: Anthropic SDK `messages.create` + tool dispatch + lane queue (per-run 串行化，借鉴 OpenClaw) + max_turns + approval gate injection。

**不做**: 不引入外部 agent framework (Mastra/LangGraph/Pi)。SDK 管 model interaction，自建管 domain state。

**验收**:
- [ ] AgentRunner 可驱动 MCP 工具调用循环
- [ ] per-run 工具调用串行化 (lane queue)
- [ ] approval gate 注入: 遇到 gate 时暂停等待批准

### NEW-RT-02: MCP StdioClient Reconnect (Phase 2 early)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #1 (Retry + Reconnect)

**依赖**: H-19
**估计**: ~100 LOC

**内容**: 检测 MCP stdio 子进程断连 (exit/crash/timeout) + 自动重启 + session 恢复。

**验收**:
- [ ] MCP server 进程崩溃后自动重启
- [ ] 重启后 session 恢复，pending 请求重试

### NEW-RT-03: OTel-aligned Span Tracing (Phase 2 mid)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #3 (Structured Tracing)

**依赖**: H-02
**估计**: ~150 LOC

**内容**: 手写 Span interface (参考 OTel 语义约定，不安装 SDK) + JSONL writer + dispatcher 集成。

**不做**: 不安装 `@opentelemetry/api` 或完整 OTel SDK/Collector。

**验收**:
- [ ] 每个 tool call 产出 Span (trace_id, span_id, parent_span_id, name, duration_ms, status)
- [ ] Span 写入 JSONL 文件，可用 jq 查询

### NEW-RT-04: Durable Execution (Phase 2 late)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #4 (Durable Execution)

**依赖**: NEW-RT-01
**估计**: ~200 LOC

**内容**: RunManifest `last_completed_step` + `resume_from` + checkpoint at step boundaries。

**验收**:
- [ ] AgentRunner 崩溃后可从 `last_completed_step` 恢复
- [ ] `resume_from` 跳过已完成步骤

### NEW-CONN-02: Review Feedback next_actions (Phase 2)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — 评审反馈孤岛

**依赖**: 无
**估计**: ~60 LOC

**内容**: `submitReview` 在 `follow_up_evidence_queries.length > 0` 时添加 `next_actions` (建议 `inspire_search` + `hep_run_build_writing_evidence`, max 5 queries, max 200 chars each)；在 `recommended_resume_from` 存在时建议具体 writing 工具。Hint-only。

**验收**:
- [ ] 有 evidence queries 的 review → next_actions 非空
- [ ] next_actions 遵循 `{ tool, args, reason }` 惯例

### NEW-CONN-03: Computation Evidence Ingestion (Phase 2)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 2 (W_compute + hep-calc CLI-only)
> **关键 schema 决策**: `EvidenceCatalogItemV1` 是 LaTeX 特有的 (required `paper_id` + `LatexLocatorV1`)。计算结果**不能**存入此格式。创建并行的 `ComputationEvidenceCatalogItemV1` schema。

**依赖**: NEW-COMP-01, NEW-01
**估计**: ~250 LOC

**内容**:
1. 定义 `ComputationEvidenceCatalogItemV1` JSON Schema (SSOT in `meta/schemas/`, codegen via NEW-01): `source_type: "computation"`, `ComputationLocatorV1` (artifact_uri + json_pointer + artifact_sha256), domain-specific 字段 (value, uncertainty, unit)
2. 实现 `hep_run_ingest_skill_artifacts` MCP 工具 (per NEW-COMP-01 spec): 读取 skill SSOT artifacts via ArtifactRef URI, 写入 `computation_evidence_catalog_v1.jsonl`
3. 扩展 `buildRunEvidenceIndexV1` 合并计算 evidence 到 BM25 index (~30 LOC)

**不做**: 不修改 `EvidenceCatalogItemV1`。LaTeX-only 消费者按 `paper_id` 过滤，自然跳过计算 evidence。

**验收**:
- [ ] `ComputationEvidenceCatalogItemV1` JSON Schema 定义完成
- [ ] `hep_run_ingest_skill_artifacts` 可读取 skill artifacts 并写入 evidence catalog
- [ ] BM25 index 合并两类 evidence

### NEW-CONN-04: Idea → Run Creation (Phase 2B)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 1 (idea-core Python 孤岛)

**依赖**: NEW-IDEA-01
**估计**: ~150 LOC

**内容**: `hep_run_create_from_idea` 接收 IdeaHandoffC2 URI, 创建 project + run, stage thesis/claims 为 outline seed, 返回 hint-only `next_actions` (inspire_search + build_evidence + ingest_skill_artifacts)。纯 staging，无网络调用。

**验收**:
- [ ] 从 IdeaHandoffC2 URI 创建 run
- [ ] outline seed 包含 thesis/claims
- [ ] next_actions 建议后续 pipeline 步骤

### NEW-IDEA-01: idea-core MCP 桥接 (`@autoresearch/idea-mcp`) (Phase 2)

> **来源**: Dual-Mode 架构收敛 — idea-core 孤岛连通
> **性质**: 过渡方案 (桥接)，终态是 idea-engine TS 重写 (NEW-05a Stage 3)

**依赖**: H-01, H-02, H-03, H-16a
**估计**: ~400-800 LOC

**内容**: MCP 工具暴露 idea-core Python API: `campaign.*`, `search.step`, `eval.run`。通过 JSON-RPC 调用现有 idea-core Python 进程。

**验收**:
- [ ] MCP 工具可创建 campaign 并执行 search step
- [ ] idea-core 评估结果可通过 MCP 返回
- [ ] 错误通过 McpError (retryable) 传播

### NEW-COMP-01: W_compute MCP 工具表面设计 (Phase 2 late)

> **来源**: Dual-Mode 架构收敛 — 安全先行
> **追加 (Pipeline 连通性审计)**: 包含 `hep_run_ingest_skill_artifacts` 工具规格作为交付物 (single SSOT)

**依赖**: C-02, NEW-R15-impl
**估计**: ~200 LOC (设计文档)

**内容**: W_compute MCP 工具表面安全模型设计: C-02 containment (命令/输出验证) + A3 default gating (计算执行需人类批准) + allowlist。交付物包含 `hep_run_ingest_skill_artifacts` 工具规格。

**验收**:
- [ ] 安全模型设计文档通过双模型审核
- [ ] `hep_run_ingest_skill_artifacts` 工具规格定义完成
- [ ] 工具表面与 C-02 containment 对齐

### NEW-WF-01: Research Workflow Schema (Phase 2)

> **来源**: Dual-Mode 架构收敛 — Must-Design-Now #1
> **扩展 (Pipeline 连通性审计)**: schema 定义 entry point variants

**依赖**: UX-04
**估计**: ~100 LOC (schema)

**内容**: `research_workflow_v1.schema.json` — 声明式研究工作流图 + 统一状态模型 + hash-in-ledger + 模板系统。Entry point variants: `from_literature`, `from_idea`, `from_computation`, `from_existing_paper`。初始引用 NEW-CONN-01~03，NEW-CONN-04 就绪后追加。

**验收**:
- [ ] schema 定义完成，含 nodes/edges/gates/entry_points
- [ ] 至少 3 个模板: review, original_research, reproduction
- [ ] entry point variants 覆盖 4 种起点

### Phase 2 验收总检查点

- [ ] 进程崩溃恢复测试通过（原子写入 + 锁恢复 + 幂等性）
- [ ] 全链路 trace_id 可从 MCP tool call 追踪到 ledger 事件
- [ ] 跨组件契约测试 CI 通过
- [ ] 审批三件套产物生成正确（packet_short.md ≤1页, packet.md 全量, approval_packet_v1.json 通过 schema）
- [ ] `hepar approvals show` + `hepar report render` 命令可用
- [ ] 证据抽象层 schema 定义完成 (NEW-R05)
- [ ] hep-autoresearch 测试覆盖门禁 CI 就绪 (NEW-R07)
- [ ] NEW-R15 编排器 MCP 工具实现 (`orch_run_*` + `orch_policy_query`) 可用
- [ ] `computation_manifest_v1.schema.json` 定义完成 (UX-02)
- [ ] 审批 packet_short 包含各 gate 特定上下文，人类可直接判断 (UX-07)
- [ ] research-team 工具访问: full 模式 MCP 工具 + 溯源 clean-room + hard-fail 门禁 (RT-02)
- [ ] research-team runner 抽象: 自定义 runner + API 可配置 + key 脱敏 (RT-03)
- [ ] Graph Visualization Layer: UniversalNode/Edge schema + 5 domain adapters 可渲染 (NEW-VIZ-01)
- [ ] 无 Phase 0/1 回归

### NEW-R05: 证据抽象层 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §6

**依赖**: NEW-01 (codegen pipeline), H-18 (ArtifactRef V1)

**现状**: 8 个证据相关文件使用不一致的类型定义。证据 schema 应统一到 `autoresearch-meta/schemas/` 作为 SSOT，通过 codegen 生成 TS/Python 类型。
**与 H-18 边界**: `ArtifactRefV1` 通过 `$ref` 组合引用 (JSON Schema `$ref`)，不在证据 schema 中重复 `sha256`/`size_bytes` 字段。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/schemas/evidence_*.schema.json` | (新文件) 证据类型 SSOT schema |
| `packages/hep-research-mcp/src/vnext/writing/` | 替换手写类型为 codegen 生成的类型 |

**验收检查点**:
- [ ] 证据 schema 通过 JSON Schema Draft 2020-12 验证
- [ ] codegen 生成的 TS/Python 类型替代手写定义
- [ ] `ArtifactRefV1` 通过 `$ref` 组合，无字段重复

### NEW-R05a: Pydantic v2 代码生成目标评估 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §6 — 独立时间框定子项

**依赖**: NEW-01 (codegen pipeline)

**评估内容**: 将 `datamodel-code-generator` 的 Python 输出从 `dataclasses` 切换为 `Pydantic v2 BaseModel` (`--output-model-type pydantic_v2.BaseModel`)。需评估 `pydantic-core` Rust wheel 构建/安装风险。
**决策门禁**: 时间框定评估; 如果 Rust wheel 在目标平台 (macOS arm64, Linux x86_64) 构建无问题，采纳; 否则保留 dataclasses。

### NEW-R06: 分析类型 Schema 整合 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §7

**依赖**: NEW-01 (codegen pipeline)

**现状**: 7 个版本化类型文件 (`analysis-results1.ts` ~ `analysis-results4.ts` 等) → 应整合为单一 canonical schema。

**验收检查点**:
- [ ] 单一 `analysis_results_v1.schema.json` SSOT
- [ ] codegen 生成替代手写版本化文件

### NEW-R07: hep-autoresearch 测试覆盖门禁 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §4

**依赖**: 无

**现状**: 46 个源文件，16 个测试文件 (35% 密度)。多个关键模块 (如 `w3_paper_reviser_evidence.py` 788 LOC) 无测试。
**策略**: CI 门禁: 每个 `hep-autoresearch/src/` 源文件必须有对应测试文件，新增源文件无测试 → CI 失败。

**验收检查点**:
- [ ] CI 检查源文件/测试文件一一对应
- [ ] 新增源文件无测试 → CI 失败
- [ ] 存量豁免清单有时间框定

### NEW-R08: Skills LOC 预算 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §8

**依赖**: NEW-R02a (CODE-01 CI gate)

**现状**: 6 个技能脚本超出 CODE-01.1 200 eLOC 限制 (最大: `build_team_packet.py` 1130 LOC)。
**策略**: 应用 CODE-01.1 到 `skills/*/scripts/`。中间态允许 ≤500 eLOC + CONTRACT-EXEMPT。

**验收检查点**:
- [ ] 6 个脚本拆分至 ≤200 eLOC (或有 CONTRACT-EXEMPT + sunset)
- [ ] CI gate 覆盖 skills 目录

### NEW-R10: `service.py` 拆分 (条件性) ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §9, NEW-R01 子项

**依赖**: 无硬依赖
**决策门禁**: Phase 3 启动时评估 — 如果 idea-engine TS 迁移已启动，此项可取消。

**现状**: `idea-core/src/idea_core/engine/service.py` 3165 LOC → 目标拆分为 ~8 个模块。必须重命名 (CODE-01.2 banned filename `service` → `coordinator`)。
**目标模块**: `engine/{coordinator,graph,ranking,search,formalism,evaluation}.py` 等。

**验收检查点**:
- [ ] `service.py` 重命名为 `coordinator.py`
- [ ] 拆分后模块 ≤200 eLOC
- [ ] 若决策门禁判定取消，标记 `cancelled:decision-gate`

### NEW-R14: hep-mcp 内部包拆分 (P2 late) ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §12

**依赖**: NEW-05 (monorepo)
**时序约束**: 在 H-16a + NEW-06 稳定后执行，避免冲突

**现状**: hep-research-mcp 98.6K LOC → 拆分为 3 个额外 packages:
- `@autoresearch/latex-parser` (~12.2K LOC)
- `@autoresearch/writing` (~34.7K LOC)
- `@autoresearch/corpora` (~6K LOC)
核心 `hep-mcp` 从 98.6K → 45.7K (54% reduction)。

**依赖方向约束**: `writing` depends on `corpora`; `corpora` 为纯数据/配置包，无上游依赖 (禁止循环)。

**验收检查点**:
- [ ] `madge --circular` 无循环依赖
- [ ] 各子包独立构建通过
- [ ] 总 LOC 不变 (纯拆分，无功能变更)

### NEW-R15-impl: 编排器 MCP 工具实现 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §13 — NEW-R15 Phase 2 交付物

**依赖**: H-03 (RunState), H-02 (trace_id), H-01 (McpError), H-05 (跨平台文件锁), H-07 (原子文件写入), H-11a (风险分级), H-16a (工具名常量化), H-20 (配置加载), H-21 (数据存储位置), NEW-02 (审批产物)

**交付**: 实现 NEW-R15-spec 中定义的 `orch_run_*` MCP 工具:
- `orch_run_create` (幂等, idempotency_key)
- `orch_run_status` (read-only)
- `orch_run_list` (read-only, filter/pagination)
- `orch_run_approve` (`destructive`, `_confirm` + `approval_id` + `approval_packet_sha256`)
- `orch_run_reject` (`destructive`, 不可逆)
- `orch_run_export` (条件性 `destructive`)
- `orch_run_pause` / `orch_run_resume`
- `orch_run_approvals_list` (read-only)
- `orch_policy_query` (read-only, **新增 UX 扩展**: Agent 可在运行时查询 "此操作是否需要审批?" → 返回 policy 规则 + 历史先例)

**URI scheme**: `orch://runs/<run_id>` (与 `hep://` 的关系见 NEW-R15-spec)

**验收检查点**:
- [ ] 所有 `orch_run_*` 工具通过 contract tests
- [ ] `orch_run_approve` 的 `approval_id` + `approval_packet_sha256` 双重验证工作
- [ ] 命名空间无冲突 (`orch_run_*` vs `hep_run_*`)
- [ ] `hepar approve/status/run` CLI 可通过 `orch_run_*` MCP 工具操作

---

## Phase 3: 扩展性与治理 (P3)

> **目标**: Schema 扩展性、凭据管理、网络治理、技能隔离
> **前置**: Phase 2 全部完成
> **并行度**: 全部可并行

### 批量修复清单

| ID | 缺陷 | 修改位置 | 修改内容 | 验收标准 |
|---|---|---|---|---|
| M-03 | 隐式 A0 审批分支 | `hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal.py` | 移除 `A0` 引用或正式纳入 `gates.py` 枚举 | 代码中无未注册审批类别 |
| M-04 | Zod→MCP schema 信息损失 | `hep-research-mcp/tests/schema-fidelity/` | 对 10 个关键工具添加 schema fidelity 测试（Zod → JSON Schema 往返等价） | CI 中 fidelity 测试通过 |
| M-07 | Schema 模式过严 | `idea-generator/schemas/` | 核心字段严格 + `x-*` 隔离命名空间 + `additionalProperties` 策略文档化 | `x-` 前缀扩展字段不触发验证失败 |
| M-08 | 幂等性密钥冲突消息 | `idea-core/src/idea_core/engine/service.py` | `-32002` 错误 `reason` 区分 `idempotency_replay` vs `idempotency_conflict` | 客户端可区分重试 vs 冲突 |
| M-09 | skills-market/manifest 冗余 | `autoresearch-meta/scripts/validate_manifest.py` | 增强交叉验证：manifest 版本 == market 版本 == 实际版本 | CI 交叉验证通过 |
| M-10 | 版本兼容矩阵 | `autoresearch-meta/docs/compatibility_matrix.md` | SemVer 规范 + 弃用周期 (2 minor versions) + 迁移指南模板 | 文档存在且 CI 检查版本范围 |
| M-12 | 凭据管理 | `hep-autoresearch/src/hep_autoresearch/toolkit/secrets.py` | secrets 从 env 读取 + 扩展 M-14a redaction 覆盖范围（自定义 secret 模式注册） | 自定义 secret 模式注册 + `grep` 日志不含 API key 模式 |
| M-13 | MCP 逻辑模块化 | `hep-research-mcp/src/tools/registry.ts` | 工具分组标签 (`group: 'data'|'writing'|'system'`) + `listTools` 支持 `group` 过滤。**NEW-R11 范围扩展**: `registry.ts` (2975 LOC) 按领域拆分为 `tools/registry/{inspire,zotero,pdg,writing,project}.ts` + `tools/registry/shared.ts` — 见 NEW-R11 详述 | `listTools({group:'writing'})` 仅返回写作工具; `registry.ts` 拆分后每个文件 ≤500 LOC |
| M-15 | 技能依赖隔离 | `skills-market/install_skill.py` | 评估 venv 隔离方案；hep-calc 等有脚本的技能使用独立 venv | 技能安装不污染全局 Python 环境 |
| M-16 | 环境可复现 | `hep-research-mcp/package.json` + `hep-autoresearch/pyproject.toml` | 依赖锁定 (`pnpm-lock.yaml` + `uv.lock`)；二进制工具版本固定 | `pnpm install --frozen-lockfile` 通过 |
| M-17 | 网络出口治理 | `hep-research-mcp/packages/shared/src/network.ts` | 外联域名白名单 (`inspirehep.net`, `arxiv.org`, `127.0.0.1`) + 请求速率限制 | 非白名单域名请求被拒绝 |
| L-08 | MCP 进度/取消 UX | `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | 可选附加 progress token + 回调；长时间步骤展示进度 | 长时间操作有进度输出 |

### NEW-06: MCP 写作流水线工具整合 (审计 §7.7.5)

**现状**: 写作流水线暴露 ~20 个工具，其中大量 `create_*_packet` + `submit_*` 配对本质上是"准备数据→提交结果"的两步操作。`refinement_orchestrator` 等编排逻辑也作为独立工具暴露，增加了人类用户和 agent 的认知负担。
**动机**: 降低工具数量 (目标: 83→~65 full mode)，简化 agent 编排，提升研究质量和用户体验。

**整合策略**:

| 当前工具对 | 整合方案 | 理由 |
|---|---|---|
| `create_*_packet` + `submit_*` (evidence, section, outline, judge 等) | 合并为单步 `*_execute` 工具，内部编排 create→submit | agent 无需管理中间 packet 状态 |
| `refinement_orchestrator_v1` | 内化为 agent 编排逻辑，不暴露为 MCP 工具 | 编排决策属于 agent 层，非 server 层 |
| `create_section_candidates` + `submit_section_candidates` + `create_section_judge` + `submit_section_judge` | 合并为 `section_generate_and_select` | 减少 4→1 工具 |

**修改文件**:

| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/tools/writing/` | 新增合并工具，旧工具标记 `@deprecated` 但保留一个 minor version |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_tools.py` | 更新生成的工具常量 |
| `tool_catalog.{standard,full}.json` | 重新生成，工具数下降 |

**验收检查点**:
- [ ] full mode 工具数 ≤70
- [ ] 旧工具标记 deprecated，新工具功能等价
- [ ] 写作流水线端到端测试通过（使用新合并工具）

### UX-03: 论文版本追踪 + 输出路径统一 ★UX

> **新增 (2026-02-22)**: 当前论文修订无 v1/v2/v3 版本追踪；research-writer 和 hep_export_paper_scaffold 产出同结构但独立运行。

**变更**:

| 文件 | 变更 |
|---|---|
| `hep-research-mcp/src/vnext/export/exportPaperScaffold.ts` | 新增 `version` 参数: 输出到 `paper/v{N}/` 而非 `paper/`；自动生成 `changes_v{N-1}_to_v{N}.diff` |
| research-writer `consume_paper_manifest.sh` | 完成 MCP 工具对接: 调用 `hep_export_paper_scaffold` 而非独立 LaTeX 生成 |
| `autoresearch-meta/schemas/paper_manifest_v2.schema.json` | 扩展: 增加 `version`, `parent_version`, `review_ref` 字段 |

**论文目录结构**:
```
paper/
├── v1/                        ← 初稿
│   ├── main.tex, sections/, figures/
│   └── paper_manifest.json
├── v2/                        ← 修订稿
│   ├── main.tex, sections/, figures/
│   ├── changes_v1_to_v2.diff
│   ├── tracked_changes.tex
│   └── paper_manifest.json    ← parent_version: "v1"
├── review/
│   ├── review_v1.json         ← referee-review 对 v1 意见
│   └── response_to_v1.tex     ← 逐条回复
└── latest -> v2/              ← symlink
```

**依赖**: NEW-06 (写作管线整合)

**验收**:
- [ ] `hep_export_paper_scaffold --version 2` 输出到 `paper/v2/`
- [ ] `changes_v1_to_v2.diff` 自动生成
- [ ] research-writer 通过 MCP 工具生成论文 (不再独立 LaTeX 生成)
- [ ] paper_manifest_v2.schema.json 包含 version + parent_version

### UX-04: 结构化工具编排 Recipe + Workflow Schema ★UX

> **新增 (2026-02-22)**: Agent 依赖自然语言 skill (SKILL.md) 理解工具调用顺序，不同 Agent 理解可能不一致。同期合并 inspire_search + hep_inspire_search_export。
> **Scope Audit 扩展 (2/3)**: 从静态 recipe 扩展为**可执行 workflow schema**: 含计算节点、`orch_run_*` gate 操作。Recipe 是 workflow schema 的具体实例化。详见 NEW-WF-01。

**依赖**: NEW-06 (工具整合完成后定义 recipe), H-16a (工具名常量化), NEW-R15-impl (recipes 需要 orch_run_* 存在)

**变更**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/schemas/workflow_recipe_v1.schema.json` | Recipe schema: steps[], gates[], tool references |
| `autoresearch-meta/recipes/` | 标准 recipe 定义: `literature_to_evidence.json`, `derivation_cycle.json`, `writing_pipeline.json`, `review_cycle.json` |
| hep-research-mcp tools | 合并 `inspire_search` + `hep_inspire_search_export` → `inspire_search` (保留名，增加 `export_mode` 可选参数) |

**Recipe 示例** (`literature_to_evidence.json`):
```json
{
  "id": "literature_to_evidence",
  "steps": [
    {"tool": "inspire_search", "params_template": {"query": "{user_query}"}},
    {"tool": "zotero_add", "depends_on": ["inspire_search"]},
    {"tool": "hep_project_build_evidence", "depends_on": ["zotero_add"]},
    {"gate": "A1", "on_reject": "stop"}
  ]
}
```

**依赖**: NEW-06 (工具整合完成后定义 recipe), H-16a (工具名常量化)

**验收**:
- [ ] `workflow_recipe_v1.schema.json` 定义完成
- [ ] 至少 4 个标准 recipe 定义 (literature, derivation, writing, review)
- [ ] inspire_search + hep_inspire_search_export 合并为一个工具
- [ ] Agent 可加载 recipe JSON 执行标准工作流

### RT-01: 可配置工作流模式 (`--workflow-mode`) ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §1 (R4 READY)

**依赖**: UX-06 (session protocol), NEW-06 (MCP 工具整合), RT-02 (clean-room gate)

**现状**: research-team 仅支持 peer-review 对称模式。

**变更**:

| 文件 | 变更 |
|---|---|
| `run_team_cycle.sh` | 新增 `--workflow-mode peer\|leader\|asymmetric` |
| `assets/system_verifier.txt` | (新) 验证角色 system prompt (CONFIRMED/CHALLENGED/UNVERIFIABLE) |
| `assets/system_verifier_independent.txt` | (新) asymmetric 独立推导角色 |
| `scripts/gates/check_team_convergence.py` | leader 增量门禁 + asymmetric critical_step convergence |
| `scripts/bin/build_team_packet.py` | 按步骤构建 packet；asymmetric 隐藏 leader 结果 |
| `scripts/bin/claim_extractor.py` | (新) 从 step result 提取核心 Claims + 方程/数据 |

**关键设计**:
- **leader**: 增量验证 (outline → step-by-step → integration)，early stop (连续 2 CHALLENGED)
- **asymmetric**: critical_steps[] 独立推导 + convergence check，其余步骤逐步验证
- **peer**: 不变

**验收**:
- [ ] `--workflow-mode peer` 行为与当前完全一致 (回归测试)
- [ ] `--workflow-mode leader` 增量验证完整流程 + CHALLENGED 修复重试 (--max-step-retries 默认 3)
- [ ] `--workflow-mode asymmetric` + critical_steps[] 独立推导 + convergence check
- [ ] convergence gate 正确区分三种模式的通过条件

### RT-04: Innovation ↔ idea-generator 桥接 ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §4 (R4 READY)

**依赖**: idea-core Phase 2 (BFTS + Elo), NEW-R12 (idea-runs 集成契约)

**现状**: research-team novelty sprint 与 idea-generator campaign 无数据桥接，可能重复探索已评估方向。

**变更**:

| 文件 | 变更 |
|---|---|
| `run_team_cycle.sh` | 新增 `--idea-source <path\|idea-core://...>` |
| `assets/system_member.txt` | 注入已评估 idea landscape |
| INNOVATION_LOG.md | 新增 `## External Seeds` section; lead schema 对齐 `idea_card_v1` |

**验收**:
- [ ] `--idea-source` 注入时 system prompt 包含已评估 idea 列表
- [ ] breakthrough lead schema 与 `idea_card_v1` 可相互转换
- [ ] `idea-core campaign seed --from-innovation-log` 可提取 active leads

### NEW-CONN-05: Cross-validation → Pipeline Feedback (Phase 3, deferred)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 4 (Cross-validation LaTeX-only 输入)

**依赖**: NEW-CONN-03
**估计**: ~100 LOC

**内容**: `hep_run_build_measurements` 和 `hep_project_compare_measurements` 在发现 tension 时返回 `next_actions` 到 review/revision。扩展 measurements 消费计算 evidence。

**验收**:
- [ ] tension 发现时 next_actions 非空
- [ ] measurements 可消费计算 evidence (ComputationEvidenceCatalogItemV1)

### NEW-COMP-02: W_compute MCP 实现 (Phase 3)

> **来源**: Dual-Mode 架构收敛

**依赖**: NEW-COMP-01, C-02
**估计**: ~500 LOC

**内容**: `compute_run_card_v2` / `compute_status` / `compute_resolve_gate` MCP 工具实现，含 C-02 containment + A3 gating 安全防护。

**验收**:
- [ ] 可通过 MCP 提交计算任务并查询状态
- [ ] A3 gating: 计算执行需人类批准
- [ ] C-02 containment: 命令/输出路径验证

### NEW-SKILL-01: lean4-verify Skill (Phase 3)

> **来源**: Dual-Mode 架构收敛 — Lean4 形式化验证

**依赖**: 无
**估计**: ~200 LOC

**内容**: `SKILL.md` + `run_lean4.sh` + `status.json`。Lean4 作为无状态验证节点: `lake build` 作为 subprocess，输入 `.lean` 定理文件，输出 PASS/FAIL + proved theorems list。

**验收**:
- [ ] `run_lean4.sh --project <path>` 可执行 Lean4 验证
- [ ] `status.json` 包含 PASS/FAIL + proved theorems

### NEW-RT-05: Eval Framework (Phase 3)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #6 (Eval)

**依赖**: NEW-RT-01, NEW-RT-03
**估计**: ~500 LOC

**内容**: Agent-level 端到端评估框架，扩展现有 `tests/eval/`。

**验收**:
- [ ] 可定义评估场景并自动运行
- [ ] 评估结果可追踪到 Span

### Phase 3 验收总检查点

- [ ] 全部 19 项修复通过各自测试 (原 13 + NEW-R11/R12 + UX-03/UX-04)
- [ ] Schema 扩展性测试通过（`x-*` 字段不破坏验证）
- [ ] 日志无 secrets 泄露
- [ ] ERR-01/SYNC-03/ART-03 CI 验证从 grep 升级为 AST-based lint（TS: ESLint custom rule; Python: ast 模块）
- [ ] `registry.ts` 按领域拆分完成 (NEW-R11)
- [ ] `idea-runs` 集成契约定义完成 (NEW-R12)
- [ ] 论文版本追踪 + paper_manifest_v2 就绪 (UX-03)
- [ ] 至少 4 个标准 workflow recipe 定义 (UX-04)
- [ ] inspire 工具合并完成 (UX-04)
- [ ] research-team 三模式工作流: peer/leader/asymmetric + 增量验证 + convergence gate (RT-01)
- [ ] research-team ↔ idea-generator 桥接: --idea-source + 反向种子 (RT-04)
- [ ] 无 Phase 0/1/2 回归

### NEW-R11: `registry.ts` 领域拆分 (M-13 范围扩展) ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §9, NEW-R01 子项

**依赖**: M-13 (MCP 模块化)

**现状**: `registry.ts` 2975 LOC, 包含所有领域的工具注册。M-13 规划了分组标签但未规划文件级拆分。
**目标**: 拆分为 `tools/registry/{inspire,zotero,pdg,writing,project}.ts` + `tools/registry/shared.ts`。

**验收检查点**:
- [ ] 6 个文件，每个 ≤500 LOC
- [ ] 注册顺序与现有一致 (避免运行时行为变化)
- [ ] `index.ts` re-export 规则: 仅从 `shared.ts` re-export，领域文件不互相导入

### NEW-R12: `idea-runs` 集成契约 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §11

**依赖**: EVO-05 (Domain Pack, 概念依赖)

**交付**: Phase 3 前置交付物 (不推迟到 Phase 5):
1. `idea-runs` 集成契约文档: schema 验证规则、artifact 命名合规检查、交叉引用格式
2. 契约测试: CI 验证 idea-core 产出的 run artifacts 符合 `M-01` + `H-15b` 规范

**验收检查点**:
- [ ] 集成契约文档存在
- [ ] CI 契约测试通过

### NEW-R13: 包重命名 `hep-research-mcp` → `hep-mcp` ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §10
> **决策**: 已定执行 (2026-02-21)。与 NEW-05 monorepo 迁移同步执行，为最低迁移成本窗口。

**依赖**: NEW-05 (monorepo 迁移)
**关系**: 与 H-16a **互补** — H-16a 解决工具名长度, NEW-R13 解决 FQ 前缀长度; `hep-mcp` 已是事实上的逻辑域名 (ERR-01 domain, ID-02 component)

**影响范围**: ~206 个跨生态系统引用 (prompts/skills/配置文件/文档)。monorepo 迁移时路径已全部变更，同步重命名的增量成本最低。

**迁移策略**:
1. monorepo 中 `packages/hep-research-mcp/` → `packages/hep-mcp/`
2. npm scope: `@autoresearch/hep-research-mcp` → `@autoresearch/hep-mcp`
3. MCP server name: `hep-research` → `hep-mcp` (FQ 前缀 `mcp__hep-mcp__`)
4. 别名层: 保留 `hep-research` server name alias ≥1 minor version
5. 配置/文档/skills 中引用批量替换

**验收检查点**:
- [ ] `packages/hep-mcp/` 存在且测试通过
- [ ] FQ 工具名使用 `mcp__hep-mcp__` 前缀
- [ ] 旧名称 `hep-research` alias 可用 (过渡期)
- [ ] 全生态系统 grep `hep-research-mcp` 仅返回 alias/migration 相关代码

---

## Phase 4: 长期演进 (P4)

> **目标**: 文档完善、低优先级缺陷清理、发布级冻结产物
> **前置**: Phase 3 全部完成

### 批量修复清单

| ID | 缺陷 | 修改内容 | 验收标准 |
|---|---|---|---|
| L-01 | URI scheme 缺少集中文档 | `autoresearch-meta/docs/uri_registry.md`: `hep://`, `pdg://` 全部 URI 模式注册表 | 文档存在且覆盖所有已知 URI |
| L-02 | 3 个孤儿技能未打包 | review-swarm, deep-learning-lab, md-toc-latex-unescape → 打包或标记 `internal-only` | manifest 中无未声明技能 |
| L-03 | SKILL.md frontmatter 不一致 | 统一 frontmatter template: `name`, `description`, 可选 `metadata` | lint 检查所有 SKILL.md frontmatter |
| L-04 | Checkpoint 过期竞争条件 | 与 H-05 合并：使用 `AdvisoryLock` TTL 机制 | 时钟偏移 ±30s 内不误判 |
| L-05 | Gate vs Approval 语义混淆 | run_card schema: `gates` → `required_approvals` 重命名 + 迁移 | 新 run_card 使用 `required_approvals` |
| L-06 | 适配器注册表有限 | 按需扩展：`PythonAdapter`, `DockerAdapter` 接口定义 | 适配器注册表支持插件式扩展 |
| L-07 | 缺乏性能基准 | `autoresearch-meta/docs/slo.md`: 关键操作 SLO 定义 | SLO 文档存在 |
| NEW-07 | 多 Agent 编排缺乏抽象层 | 见下方详述 | A2A Agent Card 注册 + 跨 Agent 调用可通过集成测试 |

### NEW-07: 多 Agent 编排抽象 + A2A 适配层

**现状**: hepar 通过硬编码的 MCP stdio 连接各组件，无动态 Agent 发现、无 Agent-to-Agent 通信协议、无统一的 Agent 能力描述。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/schemas/agent_card_v1.schema.json` | Agent Card schema (对齐 A2A 规范): name, capabilities, input/output contracts, cost tier |
| `hep-autoresearch/src/hep_autoresearch/toolkit/agent_registry.py` | Agent 注册表: 从 `agent_cards/` 目录加载 Agent Card，支持能力查询 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/a2a_adapter.py` | A2A 协议适配层: Agent Card 发布/发现，JSON-RPC over HTTP(S)，默认禁用 + loopback 绑定 |
| `autoresearch-meta/schemas/agent_message_v1.schema.json` | Agent 间消息信封 schema (复用 ERR-01 字段 + trace_id) |

**验收检查点**:

- [ ] Agent Card schema 通过 JSON Schema 验证
- [ ] 所有现有组件 (hep-research-mcp, idea-core) 有对应 Agent Card
- [ ] Agent 注册表可按能力查询 Agent
- [ ] 集成测试: hepar 通过注册表发现并调用 Agent
- [ ] A2A 适配层默认禁用 (需显式配置启用)
- [ ] A2A 启用时默认绑定 loopback (127.0.0.1)，非 loopback 需显式白名单
- [ ] A2A 启用时强制 auth (token 或 mTLS)
- [ ] A2A 错误响应使用 ERR-01 信封 + trace_id
- [ ] A2A AgentMessage schema 验证失败时 fail-closed

**依赖**: L-06 (适配器注册表扩展)

### 发布级接口冻结产物

| 产物 | 内容 | 生成方式 |
|---|---|---|
| `tool_catalog.{standard,full}.json` | 工具名 + 参数 schema + 版本 | `pnpm catalog` (C-03) |
| `error_code_registry.json` | 全部错误码 + retryable + 映射 | 从 H-01 McpError 扩展导出 |
| `run_state_v1.json` | 状态枚举 + 映射表 | 从 H-03 schema 导出 |
| `gate_registry.json` | Gate 枚举 + GateSpec | 从 H-04/M-22 导出 |
| `artifact_naming_rules.json` | 命名正则 + 示例 | 从 M-01 lint 脚本导出 |

### 测试策略文档化

| 层级 | 覆盖范围 | 目标 |
|---|---|---|
| 单元测试 | 各组件内部逻辑 | 80% 行覆盖率 |
| 契约测试 | 跨组件接口 (M-19, H-16b) | 100% 工具名 + 错误码覆盖 |
| 集成测试 | 端到端工作流 (M-19) | W1-W4 冒烟测试通过 |
| 回归基线 | N-1 版本 fixture (M-20) | 迁移测试通过 |

### Phase 4 验收总检查点

- [ ] 全部 7 个 Low 缺陷修复或标记为 won't-fix
- [ ] NEW-07 Agent Card + 注册表 + A2A 适配层就绪
- [ ] 发布级冻结产物全部生成且 CI 验证
- [ ] 测试策略文档存在且 CI 覆盖率达标
- [ ] 无 Phase 0/1/2/3 回归

---

## Phase 5: 社区化与端到端闭环 (P5)

> **目标**: 实现 idea→理论计算→论文端到端自动闭环，建立多 Agent 研究社区基础设施
> **前置**: Phase 4 全部完成 + idea-core Phase 2 (BFTS + Elo) 就绪
> **路径说明**: 本 Phase 中 `idea-core/src/idea_core/` 路径在执行时已迁移为 `packages/idea-engine/src/` (TypeScript)，Python 路径仅为逻辑对应参考。

### EVO-01: idea→理论计算自动执行闭环

> **依赖追加 (v1.8.0)**: UX-02 (computation contract), UX-04 (workflow schema), NEW-R15-impl (orch_run_*), NEW-COMP-01 (compute MCP 安全设计)

**现状**: idea-core 输出 IdeaCard (自然语言)，C2 method_design 生成方法规格，但无法自动翻译为可执行的计算任务。hep-calc 可驱动 FeynCalc/FeynArts/FormCalc，但需要人类编写调用代码。

**计算类型覆盖**:

| 计算类型 | 工具链 | 优先级 |
|---|---|---|
| 费曼图/振幅生成 | FeynArts / QGraf / QGRAF→FORM 管线 | 自动化流水线入口 |
| 解析推导 (符号计算) | Wolfram Language (FeynCalc/FormCalc/FeynRules/Package-X) → wolframscript | 首选已有 HEP 程序包 |
| 解析推导 (Python 生态) | SymPy + 领域扩展 | 仅当 Wolfram 包不覆盖特定类时 |
| 数值计算 | LoopTools (Fortran/C++) → Julia/Fortran/C++ 绑定 | 优先选择性能最优的语言 |
| 积分约化 | FIRE / LiteRed / Kira (IBP 约化) | 调用已有程序包 |
| 解析主积分 | HyperInt / PolyLogTools / HPL | 调用已有程序包 |
| 多圈数值积分 | pySecDec / FIESTA | 调用已有程序包 |
| 算法设计 | 自定义代码 | 仅当已有程序包不能满足需求时 |

**原则**: 优先搜索并调用领域内已有成熟程序包；仅在程序包不能满足具体需求时才编写自定义代码。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/handoff/package_selector.py` | 根据 idea 类型自动选择计算程序包 + 搜索领域内已有工具 |
| `idea-core/src/idea_core/handoff/run_card_compiler.py` | IdeaCard + method_spec → hep-calc run_card 编译器 (参数化调用模板) |
| `skills/hep-calc/` | 扩展: 接受 run_card 自动执行，搜索并调用已有程序包，支持 wolframscript + SymPy + 高性能数值后端 |

**验收**: run_card 编译器生成的调用代码可被 hep-calc 直接执行，驱动已有程序包完成计算。

### EVO-02: 计算结果→idea 反馈循环

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/feedback/result_ingester.py` | 消费 hep-calc 计算结果 artifact，更新 IdeaCard 评分 (如 NLO 修正太小→降低 impact) |
| `idea-core/src/idea_core/search/tree_pruner.py` | 基于计算结果的树搜索剪枝策略 |

**验收**: 计算结果自动回流到 idea-core，触发评分更新和树搜索剪枝。

### EVO-03: 结果→writing evidence 自动映射 + 审稿修订循环

> **依赖追加 (v1.8.0)**: NEW-IDEA-01 (idea→writing evidence 需要 idea MCP)

**修改内容**:

| 文件 | 变更 |
|---|---|
| `hep-research-mcp/src/tools/writing/evidence_mapper.ts` | hep-calc 结果 artifact → writing evidence 自动转换 (消费 ArtifactRefV1, 验证 sha256/size_bytes) |
| (新) `packages/orchestrator/src/review-cycle.ts` | **UX 扩展**: 审稿→修订自动循环编排: referee-review → evidence 补充 → paper-reviser → 版本递增 → 再审稿，max_rounds 可配 |

**审稿循环协议** (UX 扩展, 2026-02-22):
1. `referee-review` → `review.json` (VERDICT + evidence_requests)
2. 如有 evidence_requests → 自动执行证据补充 (inspire_search + hep_project_build_evidence)
3. `paper-reviser` → `paper/v{N+1}/` (consume review.json, 产出 tracked_changes)
4. `referee-review` → `review_v{N+1}.json`
5. VERDICT = READY → 完成; NOT_READY 且 N < max_rounds → 回到 3; N ≥ max_rounds → 人类介入

**依赖**: UX-03 (论文版本追踪), UX-04 (review_cycle recipe)

**验收**:
- [ ] 计算结果自动出现在 writing pipeline 的 evidence 池中，映射产物通过 ART-05 完整性校验
- [ ] 审稿→修订循环可自动执行至 READY 或 max_rounds
- [ ] 每轮修订产出 `paper/v{N}/` + `changes_v{N-1}_to_v{N}.diff`

### EVO-04: Agent 注册表 + A2A Agent Card

> **EvoMap/GEP 分析更新 (2026-02-20)**: 采用 REP 信封格式 (`rep-a2a`)，借鉴 GEP `hello` 消息的能力广告机制。依赖线性化: NEW-07 → EVO-17 → EVO-04。详见 `docs/2026-02-20-evomap-gep-analysis.md` §4.2, §7.1。

**修改内容**: 基于 NEW-07 的 Agent Card 基础设施 + EVO-17 REP 信封，扩展为跨实例发现：

| 文件 | 变更 |
|---|---|
| `packages/a2a/src/discovery.ts` | A2A Agent Card 发布 + 远程发现，使用 REP `hello` 消息格式 (借鉴 GEP 能力广告机制) |
| `autoresearch-meta/schemas/agent_registry_v1.schema.json` | 注册中心 schema |

**依赖**: EVO-17 (REP 信封可用后再接入注册表)

**验收**: 远程 Agent 可通过 REP A2A 协议被发现和调用；`hello` 消息含能力广告。

### EVO-05: Domain Pack 打包/分发标准

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/plugins/pack_spec.py` | Domain Pack 打包规范 (manifest + schema + prompts) |
| `autoresearch-meta/schemas/domain_pack_manifest_v1.schema.json` | Pack manifest schema |

**验收**: HEP domain pack 可独立打包/安装/升级。

### EVO-06: 理论物理研究诚信强制框架

> **详细设计 (2026-02-21)**: `docs/track-a-evo06-integrity-framework-design.md` (Track A 详设文档)

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/integrity/param_bias_checker.py` | 参数选择偏见检测：标记异常的重整化标度/方案选择 |
| `idea-core/src/idea_core/integrity/approx_validator.py` | 近似有效性验证：检查近似适用范围是否已声明 |
| `idea-core/src/idea_core/integrity/novelty_verifier.py` | 已知结果检测：通过 LiteratureService 交叉检验文献 (HEP 默认适配 INSPIRE) 防止冒充新颖 |
| `idea-core/src/idea_core/integrity/cross_check.py` | 计算交叉验证：已知极限、Ward 恒等式、规范不变性检查 |
| `autoresearch-meta/schemas/integrity_report_v1.schema.json` | 诚信报告 schema (SSOT)，含每项标记的 evidence 指针 |

**失败行为**: 诚信检查默认为**建议性** (advisory)，生成 `integrity_report_v1.json` 附加到 IdeaCard。仅在结论/发表边界 (A5 gate) 时升级为 fail-closed：integrity report 中有 blocking 标记时阻断 A5 审批。探索性计算阶段不阻断。

**验收**: 每个 idea 的计算结果附带诚信报告，标记参数偏见/近似越界/已知结果重复。A5 审批时检查 integrity_report 无 blocking 项。

### EVO-07: 可复现性验证管线

> **详细设计 (2026-02-21)**: `docs/track-a-evo07-reproducibility-design.md` (Track A 详设文档)

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/rep-sdk/src/reproducibility/pipeline.ts` | 独立重跑管线: RerunSpec → 工具链路由 → 标准化输出 → 比较引擎 → DeviationReport |
| `packages/rep-sdk/src/reproducibility/comparison-engine.ts` | 比较引擎: 逐量比较 + 容差检查 + 偏差来源分类 |
| `packages/rep-sdk/src/reproducibility/mathematica-backend.ts` | Mathematica 后端: FeynCalc/FeynArts/FormCalc |
| `packages/rep-sdk/src/reproducibility/julia-backend.ts` | Julia 后端: LoopTools.jl |
| `autoresearch-meta/schemas/reproducibility_report_v1.schema.json` | ✅ 已创建: DeviationReport schema (SSOT) |

**四维独立性**: 不同程序包、不同方法、不同精度、不同规范。独立管线 + thin adapter 架构。

**验收**: 关键计算可用独立方法重跑并验证结果一致性。A5 gate 要求 `overall_agreement: "agree"`。

### EVO-08: 跨实例 idea 同步协议

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/sync/` | idea 导出/导入 + 冲突解决 + 溯源保持 |
| `autoresearch-meta/schemas/idea_sync_envelope_v1.schema.json` | 同步信封 schema |

**验收**: 两个 idea-core 实例可双向同步 idea，溯源图完整。

### EVO-09: 失败库生成时查询集成

> **EvoMap/GEP 分析更新 (2026-02-20)**: 移植 Evolver `signals.js` 的信号去重 + 停滞检测逻辑 (repair_loop_detected)，避免重复修复。详见 `docs/2026-02-20-evomap-gep-analysis.md` §6.1, §7.1。

**现状**: `failure_library_index_v1` / `failure_library_query_v1` / `failure_library_hits_v1` 三个 schema 已完备，负结果记录 (`failed_approach_v1`) 已设计。但 idea-core 的 `search.step` 在生成候选 idea 时**不查询**失败库，导致 operator 可能重复探索已知死路。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/engine/service.py` | `search.step` 在调用 operator 前查询 failure_library_index，将匹配的 failure_hits 注入 OperatorContext |
| `idea-core/src/idea_core/engine/operators.py` | OperatorContext 新增 `failure_avoidance: list[FailureHit]`；operator prompt 中显式排除已知失败方向 |
| `idea-core/src/idea_core/engine/failure_library.py` | (新文件) `FailureLibraryIndex`: 从 `failed_approach_v1.jsonl` 构建内存索引；支持 tag/failure_mode/text 匹配；**移植 Evolver `signals.js` 信号去重逻辑** (按 signal fingerprint 去重，避免重复触发相同修复) |

**依赖**: EVO-01 (计算执行闭环产生失败记录)，failure_library schemas (已存在)

**验收**: operator 生成新 idea 前自动查询失败库；已知失败方向的重复率下降 ≥50% (对比无失败库基线)。

### EVO-10: 进化提案自动闭环

> **EvoMap/GEP 分析更新 (2026-02-20)**: 采用 Evolver 五阶段架构 (signal→select→mutate→validate→solidify)，资产模型用 REP。移植停滞检测 (`consecutiveEmptyCycles` + `repair_loop_detected`)。详见 `docs/2026-02-20-evomap-gep-analysis.md` §4.2, §6.1。

**现状**: `evolution_proposal.py` 是一次性手动调用（扫描源 run → 生成提案），无周期触发、无提案去重、A0 级提案（read/analyze/plan）仍需人工审批。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/evolution_trigger.py` | (新文件) Run 完成事件监听器：消费 ledger `run_completed` 事件，自动调用 `evolution_proposal_one()`；**采用 Evolver 五阶段架构**: signal extraction → strategy selection → mutation → validation → solidify |
| `hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal.py` | 新增提案去重：生成前查询已有 `analysis.json` 产物，按 (failure_class, target_file, action_type) 三元组去重；**移植 Evolver 停滞检测**: `consecutiveEmptyCycles` + `repair_loop_detected` 逻辑 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/evolution_proposal.py` | A0 提案自动执行路径：`requires_approval == "A0"` 的 triage 类提案直接标记已处理，不进入审批队列 |

**依赖**: trace-jsonl (ledger 事件格式统一)

**验收**:
- Run 完成后 ≤30s 自动触发进化提案生成
- 同一 (failure_class, target_file, action_type) 不重复生成提案
- A0 triage 提案自动处理，A2+ 提案仍进入审批队列

### EVO-11: Bandit 分发策略运行时接入

> **EvoMap/GEP 分析更新 (2026-02-20)**: Evolver `selector.js` 仅提供加权评分管道参考 (用于 RDI 排名分数计算子模块)，**不等同于 bandit 算法**。EVO-11 需自研 exploration/exploitation 更新、reward 反馈、regret 控制。详见 `docs/2026-02-20-evomap-gep-analysis.md` §7.1。
> **GEP 扩展 (2026-02-21)**: EVO-21 将 GEP `personality.js` 策略进化能力引入 Track B，与 EVO-11 的 bandit 框架互补 — EVO-11 选择策略，EVO-21 进化策略参数。

**现状**: `bandit-distributor-alternatives.md` 设计文档详尽 (UCB-V, Thompson Sampling, EXP3, cost-aware 变体)，`distributor_policy_config_v1` / `distributor_state_snapshot_v1` / `distributor_event_v1` 三个 schema 已就绪。但零行生产代码将策略决策连接到 operator/backend 选择。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/engine/distributor.py` | (新文件) `BanditDistributor`: 实现 UCB-V baseline + Thompson Sampling 可选策略；消费 `distributor_policy_config_v1`，输出 `distributor_event_v1`。**注意**: 此为独立 bandit 实现，Evolver `selector.js` 仅用于 RDI 排名分数子模块 (§EVO-17) |
| `idea-core/src/idea_core/engine/distributor_state.py` | (新文件) 臂统计持久化 (n, Q, σ, w, t_last)；定期快照为 `distributor_state_snapshot_v1` |
| `idea-core/src/idea_core/engine/service.py` | `search.step` 调用 `BanditDistributor.select_arm()` 选择 operator/backend，执行后调用 `update_reward()` 闭环 |

**依赖**: EVO-01 (计算执行闭环提供 reward 信号), EVO-09 (失败库提供负面 reward)

**验收**:
- Bandit 策略可通过 `distributor_policy_config_v1` 热切换 (UCB-V ↔ Thompson)
- 每次 arm selection + reward update 写入 `distributor_event_v1.jsonl` 审计日志
- 臂统计定期快照，重启后可恢复
- 对比 softmax_ema baseline，regret 下降可度量

### EVO-12: 技能生命周期自动化

> **EvoMap/GEP 分析更新 (2026-02-20)**: 参考 Evolver `skills_monitor.js` + GDI 退役逻辑，健康度评分维度改为 RDI。详见 `docs/2026-02-20-evomap-gep-analysis.md` §2.1, §7.1。

**现状**: `skill_proposal.py` 生成技能脚手架 → 人工审核 → `install_skill.py` 手动安装。无使用频率跟踪、无自动退役、无从提案到安装的半自动路径。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/skill_lifecycle.py` | (新文件) 技能生命周期管理器: 使用频率统计 (从 ledger)、健康度评分 (success_rate × frequency)、退役建议 (30 天零使用 → 标记 deprecated)；**参考 Evolver `skills_monitor.js` 的 GDI 退役逻辑** |
| `skills-market/scripts/install_skill.py` | 新增 `--auto-safe` 模式: 仅安装满足安全条件的技能 (deterministic=true, network=false, frequency≥N, human_pre_approved=true)，跳过 A2 但保留审计日志 |
| `autoresearch-meta/schemas/skill_health_report_v1.schema.json` | 技能健康报告 schema: usage_count, success_rate, last_used, health_score, recommendation (keep/deprecate/retire) |

**依赖**: M-15 (技能依赖隔离)

**验收**:
- 每轮 run 结束后生成技能健康报告
- `--auto-safe` 安装路径有完整审计日志
- 30 天零使用技能自动标记 deprecated

### EVO-13: 统一编排引擎 (HEPAR + Orchestrator 合并)

**现状**: 生态圈存在两套互补但独立的编排器:
- **HEPAR TeamRoleOrchestrator** (idea-core): ThreadPoolExecutor 并行多角色执行，但无持久化状态恢复
- **Orchestrator CLI** (hep-autoresearch): 完善的状态机 + ledger + 崩溃恢复，但仅串行执行

两者未合并，导致无法实现"持久化的并行多 agent 执行"。

**实现语言**: TypeScript (在 `packages/orchestrator/` 中构建，依赖 NEW-05a 增量迁移基础)。采纳 OpenCode Session 持久化 + OpenClaw Sub-Agent 嵌套 + oh-my-opencode Atlas 验证协议等设计模式 (详见 `autoresearch-meta/docs/2026-02-19-opencode-openclaw-design-adoption.md` §3)。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/orchestrator/src/unified-engine.ts` | 统一编排引擎: 并行执行 (Node.js worker_threads/Promise.all + coordination_policy) + 持久化 (SQLite/JSONL + crash recovery) |
| `packages/orchestrator/src/team-execution-state.ts` | `TeamExecutionState` checkpoint/restore: 每个 WorkOrder 完成后写 checkpoint |
| `packages/orchestrator/src/delegation-protocol.ts` | 6-Section 委派协议: TASK/EXPECTED_OUTCOME/REQUIRED_TOOLS/MUST_DO/MUST_NOT_DO/CONTEXT |
| `packages/orchestrator/src/notepad.ts` | 跨任务知识积累: learnings/decisions/issues/problems (Atlas Notepad 模式) |
| `packages/orchestrator/src/failure-recovery.ts` | 3 次连续失败回退协议: STOP→REVERT→DOCUMENT→CONSULT |
| `autoresearch-meta/schemas/team_execution_state_v1.schema.json` | 团队执行状态 schema: plan_id, coordination_policy, role_states[], checkpoint_ts |

**依赖**: NEW-05a (TS 编排器骨架), NEW-07 (Agent 注册表 + A2A 适配层)

**验收**:
- 并行 team 执行中 kill 进程后可从 checkpoint 恢复，已完成角色不重跑
- `stage_gated` 策略: 阶段内并行 + 阶段间门禁 + 持久化均正常
- 与现有 Orchestrator CLI 状态机兼容 (W1-W4 阶段可嵌入并行子任务)

### EVO-14: 跨 Run 并行调度 + Agent 生命周期

**现状**: Orchestrator CLI 一次只处理一个 run。无跨 run 资源调度、无 agent 健康监控、无动态扩缩。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/run_scheduler.py` | (新文件) Run 调度器: FIFO + 优先级队列，资源感知 (CPU/GPU/token budget)，最大并行 run 数可配置 |
| `hep-autoresearch/src/hep_autoresearch/toolkit/agent_lifecycle.py` | (新文件) Agent 生命周期管理: 心跳 (30s 间隔)、超时检测 (3 次心跳失败 → 标记 unhealthy)、优雅关闭 (SIGTERM → 完成当前 WorkOrder → 退出) |
| `autoresearch-meta/schemas/run_schedule_v1.schema.json` | 调度队列 schema: run_id, priority, resource_requirements, status, scheduled_at |
| `autoresearch-meta/schemas/agent_health_v1.schema.json` | Agent 健康状态 schema: agent_id, last_heartbeat, status (healthy/unhealthy/terminated), current_work_order |

**依赖**: EVO-13 (统一编排引擎)

**验收**:
- 2 个 run 可并行执行，资源不冲突
- Agent 心跳超时后调度器自动将其 WorkOrder 重新分配
- `hepar status` 展示所有活跃 run + agent 健康状态

### EVO-15: Agent-arXiv — 多 Agent 自主研究社区基础设施

**愿景**: 建立类似 arXiv 的内部研究结果库，支撑多 Agent 自主选题→研究→发布→引用的迭代循环。以 hep-th arXiv 文献池为起点，观察 Agent 社区的自主进化程度。详见 `hep-autoresearch/docs/VISION.zh.md` §长期愿景。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/agent-arxiv/src/paper-store.ts` | (新 TS package) Agent 论文存储: 结构化研究产物 (title, abstract, evidence_uris, derivation_trace, integrity_report)，append-only，内容寻址 (sha256) |
| `packages/agent-arxiv/src/search-index.ts` | 混合搜索索引: BM25 关键词 + 向量语义 (embeddings)，支持 MMR 多样性重排序 + 时间衰减 (半衰期可配) |
| `packages/agent-arxiv/src/citation-graph.ts` | 引用网络: Agent 论文间引用关系追踪，连通性/深度/循环引用率度量 |
| `packages/agent-arxiv/src/topic-selector.ts` | 自主选题引擎: 基于文献池 gap 分析 + idea-core island 机制，Agent 自动识别有价值的研究方向 |
| `packages/agent-arxiv/src/peer-review.ts` | Agent 同行评审: Agent 间 A2A 评审请求 → 结构化审稿意见 → 发布门禁 (integrity_report 无 blocking 项方可发布) |
| `packages/agent-arxiv/src/evolution-dashboard.ts` | 进化观测: 知识覆盖率、原创贡献计数、引用网络健康度、失败学习率、计算效率 |
| `autoresearch-meta/schemas/agent_paper_v1.schema.json` | Agent 论文 schema (SSOT): title, authors (agent_ids), abstract, body_sections[], evidence_uris[], integrity_report_ref, citation_refs[], published_at |
| `autoresearch-meta/schemas/agent_arxiv_query_v1.schema.json` | 搜索查询 schema: keywords, semantic_query, filters (date_range, agent_id, topic), sort_by |

**设计约束**:
1. **Evidence-first 不可妥协**: Agent 论文必须通过与人类论文相同的证据门禁
2. **EVO-06 诚信框架为 fail-closed**: 无 integrity_report 或有 blocking 项 → 拒绝发布
3. **人类可审计**: 所有 Agent 研究过程有完整 trace，人类可随时审查
4. **固定预算**: Agent 社区在配置的 token/compute 预算内运行
5. **可关停**: 人类可随时冻结整个社区

**依赖**: EVO-04 (Agent 注册表 + A2A), EVO-06 (诚信框架), EVO-13 (统一编排引擎), EVO-14 (跨 Run 并行调度)

**验收**:
- Agent-arXiv 可存储、搜索、引用 Agent 产出的研究结果
- 2+ Agent 可并行独立研究不同课题并发布结果
- 已发布结果可被其他 Agent 引用为 evidence
- 进化仪表板可展示知识覆盖率和原创贡献指标
- 人类可一键冻结社区并审查所有已发布论文

### EVO-16: Agent 研究社区自主运行实验

**现状**: EVO-15 提供基础设施，本项提供"实验框架"——从种子文献出发启动 Agent 社区自主研究循环。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/agent-arxiv/src/community-runner.ts` | 社区运行器: 初始化文献池 (INSPIRE 批量导入) → 启动 N 个 Agent → 分配选题 → 监控进度 → 收集结果 |
| `packages/agent-arxiv/src/experiment-config.ts` | 实验配置: seed_papers (INSPIRE query), num_agents, budget_per_agent, max_rounds, evaluation_metrics |
| `packages/agent-arxiv/src/round-evaluator.ts` | 轮次评估: 每轮结束后计算知识覆盖扩展率、原创贡献率、重复失败率、计算效率 |

**依赖**: EVO-15 (Agent-arXiv 基础设施)

**验收**:
- 从可配置规模的 hep-th 种子论文池出发 (建议 ≥100 篇覆盖一个子领域，如 "bootstrap method")，3+ Agent 完成至少 1 轮自主研究循环
- 每轮产出的"论文"通过 EVO-06 诚信检查
- 进化指标可量化、可对比 (对照基线: 随机选题 vs 智能选题)

### EVO-17: REP SDK — 独立发布的研究进化协议 (Track A)

> **新增 (2026-02-20)**: 来自 EvoMap/GEP 分析的双轨方案。详见 `docs/2026-02-20-evomap-gep-analysis.md` §5, §7.3。
> **详细设计 (2026-02-21)**: `docs/track-a-evo17-rep-sdk-design.md` (Track A 详设文档, ~2000 行)
> **设计对标**: `@modelcontextprotocol/sdk` — REP SDK 作为独立 npm 包发布，零 Autoresearch 内部依赖，任何 AI 研究平台可集成。

**背景**: MCP 解决了"有哪些工具可用"，REP 解决"为什么这个研究策略有效、如何进化"。如同 MCP 成为 LLM 生态的标准接口层，REP 旨在成为 AI 科学研究的标准进化层。

**包结构** (对标 `@modelcontextprotocol/sdk`):

```
@autoresearch/rep-sdk                    # npm package, MIT, zero internal deps
├── /                  # core types: ResearchStrategy, ResearchOutcome, ResearchEvent, IntegrityReport
├── /client            # REP client: fetch strategies, consume outcomes, report results
├── /server            # REP server: publish strategies, validate outcomes, manage RDI gate
├── /transport         # FileTransport (JSONL) + future HTTP transport
├── /validation        # RDI fail-closed gate + JSON Schema validation
└── /experimental      # experimental features (personality evolution, memory graph)
```

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/rep-sdk/package.json` | 独立 npm 包，零内部依赖 (PLUG-01)，dual ESM/CJS，子路径导出 |
| `packages/rep-sdk/src/types.ts` | 核心类型: ResearchStrategy, ResearchOutcome, ResearchEvent, IntegrityReport |
| `packages/rep-sdk/src/envelope.ts` | REP 信封构建 (移植 Evolver `a2aProtocol.js`，protocol `rep-a2a`)，SHA-256 内容寻址 |
| `packages/rep-sdk/src/client/index.ts` | REP client: fetch/report/revoke |
| `packages/rep-sdk/src/server/index.ts` | REP server: hello/publish/review |
| `packages/rep-sdk/src/transport/file.ts` | FileTransport 本地 JSONL (日志轮转, atomic write) |
| `packages/rep-sdk/src/validation/rdi-gate.ts` | RDI fail-closed gate + ranking score |
| `autoresearch-meta/schemas/research_strategy_v1.schema.json` | ✅ 已创建: ResearchStrategy JSON Schema (SSOT) |
| `autoresearch-meta/schemas/research_outcome_v1.schema.json` | ✅ 已创建: ResearchOutcome JSON Schema (SSOT) |
| `autoresearch-meta/schemas/research_event_v1.schema.json` | ✅ 已创建: ResearchEvent JSON Schema (SSOT, 16 种事件类型) |
| `autoresearch-meta/schemas/rep_envelope_v1.schema.json` | ✅ 已创建: REP 信封 wire protocol schema (6 种消息类型) |

**RDI (Research Desirability Index) 双层结构**:
- **Fail-closed gate**: 物理正确性 + 可复现性 + 诚信检查必须全部通过，否则禁止 publish/reuse
- **排名分数** (仅用于已通过 gate 的资产排序): 新颖性 40% + 方法通用性 20% + 学术重要性 20% + 本地引用影响 20% (4 维 RDI，详见 `schemas/research_outcome_v1.schema.json`)

**依赖**: H-18 (ArtifactRef V1 — 内容寻址基础), NEW-07 (A2A 适配层 — 传输层基础)

**验收**:
- `@autoresearch/rep-sdk` 可独立 `npm install` + `import`，无 Autoresearch 内部依赖 (PLUG-01)
- REP 信封可构建、序列化、验证
- SHA-256 内容寻址与 H-18 ArtifactRef 统一
- FileTransport 可读写本地 JSONL
- RDI fail-closed gate 拒绝未通过科学验证的资产
- 子路径导出 (root/client/server/transport/validation) 均可独立 import

### EVO-18: REP 信号引擎 (Track A — 研究进化)

> **新增 (2026-02-20)**: 来自 EvoMap/GEP 分析。详见 `docs/2026-02-20-evomap-gep-analysis.md` §5.2, §7.3。
> **详细设计 (2026-02-21)**: `docs/track-a-evo18-signal-engine-design.md` (Track A 详设文档, ~1943 行)

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/rep-sdk/src/signals.ts` | Research signal 提取引擎 (移植 Evolver `signals.js` 去重 + 停滞检测框架)，信号类型: `gap_detected`, `calculation_divergence`, `known_result_match`, `integrity_violation`, `method_plateau`, `parameter_sensitivity`, `cross_check_opportunity`, `stagnation` (详见 `schemas/research_signal_v1.schema.json`) |
| `packages/rep-sdk/src/selector.ts` | 策略选择器 (移植 Evolver `selector.js` 评分管道框架)，权重用 RDI；策略预设: explore/deepen/verify/consolidate |

**依赖**: EVO-17 (REP 信封), EVO-06 (诚信框架提供 integrity_violation 信号)

**验收**:
- 8 种 research signal (含 stagnation) 可从 ResearchEvent 流中提取
- 信号去重 + 停滞检测 (consecutiveEmptyCycles, stagnation signal) 正常工作
- 策略选择器可根据信号匹配最佳 ResearchStrategy
- Memory Graph 读写操作正确执行

### EVO-19: GEP/Evolver Track B 集成 (Track B — 工具进化)

> **新增 (2026-02-20)**: 来自 EvoMap/GEP 分析的双轨方案。详见 `docs/2026-02-20-evomap-gep-analysis.md` §3.3, §4.2, §7.3。

**背景**: Track B 将 GEP/Evolver 直接用于 Autoresearch 代码库 (MCP server ~130K TS、orchestrator、skills) 的自我修复和优化。GEP 的 Gene/Capsule 模型天然适用于软件工程进化。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/evolver-bridge/src/config.ts` | Evolver 本地配置: FileTransport (不使用 EvoMap Hub)、本地 Gene 库路径、验证命令 (vitest/tsc) |
| `packages/evolver-bridge/src/gate-guard.ts` | Contract 规则守卫: 确保 Evolver 的 Gene 修复不绕过 GATE/SEC 规则 |
| `packages/evolver-bridge/src/gene-library.ts` | (新增) Gene 库持久化: 按 (trigger_signal, target_scope) 索引的可复用修复策略库；新 Capsule 通过验证后自动泛化为 Gene |
| `packages/evolver-bridge/src/solidify.ts` | (新增) 移植 Evolver `solidify.js` 的 blast_radius 计算: 每个 Capsule 标注影响文件/模块范围，用于 CI 风险分级 |

**设计约束**:
1. **仅 FileTransport**: 不连接 EvoMap Hub，所有 Gene/Capsule 本地存储
2. **Contract 守卫**: Evolver 生成的修复必须通过 GATE/SEC 规则检查
3. **MIT 归属**: 移植 Evolver 核心逻辑时保留 MIT 归属声明
4. **Gene Library 复利**: 成功验证的 Capsule 自动泛化为 Gene（提取 trigger 模式 + 修复模板），后续遇到相同信号时优先匹配已有 Gene

**依赖**: NEW-05 (monorepo 迁移), EVO-04 (Agent 注册表)

**验收**:
- Evolver 可检测 MCP 工具错误信号并生成修复 Capsule
- 修复 Capsule 通过 vitest + tsc 验证
- Gate guard 拦截违反 Contract 规则的修复
- Gene 库可持久化、可查询，重复问题匹配已有 Gene 的命中率 ≥50%
- Capsule 标注 blast_radius，CI 可据此决定 review 范围

### EVO-12a: 技能自生成 (Skill Genesis from Agent Traces) ★GEP 扩展

> **新增 (2026-02-21)**: 填补 EVO-12 (技能生命周期) 与 EVO-19 (工具进化) 之间的空白。

**背景**: EVO-12 管理已有技能的生命周期，EVO-19 修复已有代码。但两者都不覆盖**从 agent 工作模式中自动提取新技能**的能力。实际中 agent 经常对同类问题执行重复修正（如 markdown 数学环境 LaTeX 转义修复、行首 `=` 导致渲染失败的预防），这些修正模式应自动泛化为可复用技能。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/orchestrator/src/skill-genesis.ts` | 技能自生成引擎: 从 trace/ledger 中检测重复修正模式 (同类 edit pattern ≥ N 次) → 模式泛化 → 技能定义草稿生成 |
| `packages/orchestrator/src/skill-genesis-detector.ts` | 模式检测器: 按 (file_type, edit_pattern, context) 聚合 trace 事件；移植 EVO-19 Gene Library 的信号索引机制 |
| `autoresearch-meta/schemas/skill_proposal_v2.schema.json` | 技能提案 v2 schema: 增加 `origin: "manual" \| "agent_trace"` + `evidence_traces: ArtifactRef[]` + `generalization_confidence: float` |

**两种进化路径**:
1. **新技能创建**: 检测到全新模式 → 生成 skill definition → GATE 审批 → 注册
2. **现有技能扩展**: 检测到现有技能未覆盖的边缘场景 → 生成 scope extension PR → 审批后合并

**依赖**: EVO-12 (技能生命周期基础), trace-jsonl (全链路追踪提供模式检测数据源), EVO-19 (Gene Library 信号索引机制)

**验收**:
- Agent 对同类问题执行 ≥3 次相同修正后，自动生成技能提案
- 技能提案包含 evidence traces (具体修正实例 ArtifactRef)
- 审批后技能可通过 `--auto-safe` 路径自动安装
- 现有技能的 scope extension 提案包含新旧覆盖范围对比

### EVO-20: 跨周期记忆图谱 (Cross-Cycle Memory Graph) ★GEP 扩展

> **新增 (2026-02-21)**: 移植 GEP `memoryGraph.js` (~28K LOC) 的跨周期知识积累能力。为 Track A + Track B 共享基础设施。

**背景**: 当前进化相关项 (EVO-09/10/19) 都在**单次运行**内工作。GEP 的 Memory Graph 跨越多个进化周期，追踪信号频率、修复成功率、知识依赖关系。缺少这个层，修复/研究知识无法**复利积累**。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/shared/src/memory-graph.ts` | 跨周期记忆图谱: 节点 = (signal \| gene \| capsule \| research_outcome)，边 = (triggered_by \| resolved_by \| depends_on \| supersedes)；移植 Evolver `memoryGraph.js` 的频率追踪 + 衰减算法 |
| `packages/shared/src/memory-graph-store.ts` | SQLite 持久化: 信号频率表、Gene 命中率表、知识拓扑图；支持 TTL 衰减 (长期未命中的节点降权) |

**服务的消费者**:
- **Track B (EVO-19)**: Gene 选择时查询历史信号频率 → 优先匹配高频信号的 Gene
- **Track A (EVO-18)**: 研究信号引擎查询跨 run 的 gap/divergence 模式持久性
- **EVO-09**: 失败库查询增强 — 不仅查当前 run 的失败，还查历史信号图谱
- **EVO-12a**: 技能自生成的模式检测 — 信号频率 ≥ N 触发技能提案

**依赖**: H-18 (ArtifactRef V1 — 节点 payload 引用), M-06 (SQLite WAL)

> **R7 修正 (Track B 设计审查)**: 原依赖 EVO-17 (REP SDK) 实际为 H-18 (ArtifactRef V1)。EVO-17 是 EVO-20 的消费者 (Track A 通过 EVO-18 使用 Memory Graph)，而非前置条件。修正以避免 Phase 5 循环依赖。

**验收**:
- 信号频率跨 run 持久化，可查询 "最近 30 天最频繁的 5 个信号"
- Gene 命中率统计正确，高命中率 Gene 在选择器中加权
- TTL 衰减正常工作: 90 天未命中的节点权重降至 0.1×

### EVO-21: 主动进化 — 机会检测 + 创新突变 ★GEP 扩展

> **新增 (2026-02-21)**: 当前 EVO-19 仅覆盖 GEP 三种突变类型中的 repair。补全 optimize + innovate，并移植 GEP `personality.js` 的策略进化能力。

**背景**: GEP 定义三种突变类型:
- **Repair**: 检测错误 → 修复 (当前 EVO-19 覆盖)
- **Optimize**: 检测性能/质量机会 → 优化 (未覆盖)
- **Innovate**: 检测架构改进机会 → 创新重构 (未覆盖)

仅做 repair 是被动的。Optimize 和 innovate 让系统能主动改进自身。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `packages/evolver-bridge/src/signals-extended.ts` | 扩展信号类型: `performance_regression` (benchmark 退化)、`code_smell_detected` (重复代码/过长文件/死代码)、`dependency_update_available`、`test_coverage_gap`、`api_usage_pattern_shift` |
| `packages/evolver-bridge/src/mutation-types.ts` | 三种突变策略: `repair` (修复错误, 现有)、`optimize` (性能/质量优化, 新增)、`innovate` (架构改进, 新增)；每种策略有不同的验证标准和风险等级 |
| `packages/evolver-bridge/src/strategy-evolution.ts` | 移植 GEP `personality.js` 策略进化: 突变类型分配比例 (repair/optimize/innovate) 随历史成功率自适应调整；小步突变 + 自然选择统计 |

**风险分级**:
| 突变类型 | 验证要求 | GATE 级别 |
|---|---|---|
| repair | vitest + tsc 通过 | auto-safe (无人工) |
| optimize | 上述 + benchmark 不退化 | A0 (自动审批) |
| innovate | 上述 + blast_radius ≤ 3 files | A2 (人工审批) |

**依赖**: EVO-19 (Track B 基础设施), EVO-20 (Memory Graph 提供历史数据), EVO-11 (策略选择框架)

**验收**:
- Optimize 突变: 检测到 ≥3 处相同 code smell → 生成优化 Capsule → benchmark 验证
- Innovate 突变: 检测到架构改进机会 → 生成重构 Capsule → blast_radius 验证 → 人工审批
- 策略进化: repair/optimize/innovate 分配比例可从 ledger 历史数据自适应调整
- 连续 3 次 innovate 失败 → 自动回退到 repair-only 模式

### Phase 5 验收总检查点

- [ ] EVO-01~03: idea→计算→结果→论文端到端无人工干预
- [ ] EVO-04~05: 远程 Agent 发现 + Domain Pack 独立安装
- [ ] EVO-06~07: 科学诚信报告 + 可复现性验证通过 (**详设完成**: `track-a-evo06/07` design docs, 4 JSON Schemas)
- [ ] EVO-08: 跨实例 idea 同步 + 溯源完整
- [ ] EVO-09: 生成时失败库查询集成 + 重复率下降验证
- [ ] EVO-10: 进化提案 run 完成自动触发 + 去重 + A0 自动处理
- [ ] EVO-11: Bandit 分发策略运行时接入，regret 下降可度量
- [ ] EVO-12: 技能健康报告 + `--auto-safe` 安装路径 + 退役标记
- [ ] EVO-12a: 技能自生成 — agent trace 模式检测 + 技能提案 + scope extension
- [ ] EVO-13: 并行团队执行 (TS) + 持久化 checkpoint + 崩溃恢复
- [ ] EVO-14: 跨 Run 并行调度 + Agent 心跳/超时/重分配
- [ ] EVO-15: Agent-arXiv 存储 + 搜索 + 引用 + 诚信门禁 + 进化仪表板
- [ ] EVO-16: Agent 社区自主研究实验完成至少 1 轮循环
- [ ] EVO-17: REP SDK 独立发布 + 子路径导出 + RDI gate (Track A) (**详设完成**: `track-a-evo17` design doc, 4 JSON Schemas)
- [ ] EVO-18: REP 信号引擎 + 策略选择器 (Track A 研究进化) (**详设完成**: `track-a-evo18` design doc, 1 JSON Schema)
- [ ] EVO-19: GEP/Evolver Track B 集成 + Gene Library + blast_radius + Contract 守卫
- [ ] EVO-20: 跨周期记忆图谱 — 信号频率持久化 + Gene 命中率 + TTL 衰减
- [ ] EVO-21: 主动进化 — optimize/innovate 突变 + 策略参数自适应进化
- [ ] 无 Phase 0-4 回归

---

## 缺陷-Phase 映射总表

| Phase | 缺陷 ID | 数量 |
|---|---|---|
| **0 (止血)** | NEW-05, NEW-05a (Stage 1-2), C-01~C-04, H-08, H-14a, H-20, NEW-R02a, NEW-R03a, NEW-R13, NEW-R15-spec, NEW-R16 | 14 ✅ ALL DONE |
| **1 (统一抽象)** | H-01, H-02, H-03 ✅, H-04 ✅, H-13, H-15a ✅, H-16a ✅, H-18 ✅, H-19, M-01, M-18, M-19, H-11a ✅, M-14a, NEW-01 ✅, NEW-R02, NEW-R03b, NEW-R04, UX-01, UX-05, UX-06, **NEW-CONN-01** | 22 (7 done, ~~NEW-R09 cut~~, H-17 deferred→P2, M-22 deferred→P3) |
| **2 (深度集成 + 运行时 + Pipeline 连通)** | H-05, H-07, H-09, H-10, H-11b, H-12, H-15b, H-16b, H-17, H-21, M-02, M-05, M-06, M-20, M-21, M-23, trace-jsonl, NEW-02~04, NEW-R05~R08, NEW-R10, NEW-R14, NEW-R15-impl, UX-02, UX-07, RT-02, RT-03, NEW-VIZ-01, **NEW-RT-01~04, NEW-CONN-02~04, NEW-IDEA-01, NEW-COMP-01, NEW-WF-01, NEW-05a Stage 3 (start)** | 43 |
| **3 (扩展性 + 计算连通)** | M-03, M-04, M-07~M-10, M-12, M-13, M-15~M-17, M-22, L-08, NEW-06, NEW-R11, NEW-R12, UX-03, UX-04, RT-01, RT-04, **NEW-CONN-05, NEW-COMP-02, NEW-SKILL-01, NEW-RT-05, NEW-05a Stage 3 (complete)** | 24 |
| **4 (长期演进)** | L-01~L-07, NEW-07 | 8 |
| **5 (社区化与端到端闭环)** | EVO-01~EVO-21, EVO-12a | 22 |
| **跨 Phase (伞)** | NEW-R01 | 1 |
| **CUT** | NEW-R09 | 1 |
| **总计** | | **135** (119 原 + 15 新增 + 1 cut) |

> **Note**: v1.8.0 变更: 新增 15 项 (NEW-CONN-01~05, NEW-IDEA-01, NEW-COMP-01/02, NEW-WF-01, NEW-SKILL-01, NEW-RT-01~05)。修改 13 项 (H-01 简化, H-04 冻结, H-15a 冻结, H-17 deferred, M-22 deferred, NEW-R09 cut, NEW-05a re-scoped, UX-02 升级, UX-04 扩展, EVO-01/02/03 依赖追加, NEW-WF-01 entry points, NEW-COMP-01 ingest tool)。来源: 三模型 scope audit 收敛 + 双模型 Pipeline 连通性审计 R4 收敛 + CLI-First Dual-Mode 架构收敛。
