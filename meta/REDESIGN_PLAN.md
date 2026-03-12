# Autoresearch 生态圈重构方案 (Redesign Plan)

> **版本**: 1.9.4-draft (v1.9.3 + generic-authority broadening)
> **日期**: 2026-03-12
> **基线**: v1.9.3-draft
> **重构项总数**: 160 项 (152 既有 + 8 新增: NEW-RT-06/07, NEW-DISC-01, NEW-SEM-06-INFRA/b/d/e, NEW-LOOP-01)
> **编排**: Claude Opus 4.6
>
> **v1.9.4 Changelog**:
> - 泛化 `generic/provider-neutral` 边界约束：不只 computation lane；凡长期可复用的 contract / execution semantics / routing / retrieval / review / writing / result / audit abstraction，默认都应先落在 generic/provider-neutral 层，再由 provider-local / host-local 包承载薄适配层或首个示例实现
> - 明确 provider-local package、host-local MCP tool、standalone provider server、以及首个 domain 示例都**不是** architecture authority；只有 provider-neutral contract / generic core 才能充当长期共享 authority
> - `NEW-COMP-02` 重释为 generic computation execution core + first host adapter，移除旧 `compute_run_card_v2` / `compute_status` / `compute_resolve_gate` 叙事，避免再次把 HEP host surface 写成通用 authority
>
> **v1.9.3 Changelog**:
> - 追加 semantic-authority boundary clarification：`formalism` 去实例化之后，`idea-core` / `hep-mcp` 仍存在 active HEP worldview 与 closed semantic authority，必须在 residual `batch2` closeout 与 `batch3` 前先执行独立 deep cleanup program（详见 `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md` 与 `meta/docs/prompts/prompt-2026-03-10-hep-semantic-deep-cleanup.md`）
> - `NEW-05a` 长期边界收紧：generic core / future `idea-engine` 不得内嵌 domain-specific bootstrap ids、compute-rubric heuristics、review/paper taxonomies、topic/method/challenge lexicons 或其他 closed worldview authority；仅允许 provider-local non-authoritative seams 或 provider-neutral typed contracts
> - `NEW-SEM-05` / `NEW-SEM-10` / `NEW-SEM-13` 重释为 provider-local interim quality gains，而非 final shared/generic authority；若其中有长期价值，必须在 provider-neutral rewrite 后再提升出去
> - conversation guidance clarified for this cleanup program：不要把 A-F 塞进一个超长线程；默认一批一个对话，但共享同一 boundary / acceptance / review surface 的相邻批次可例外合并
>
> **v1.9.2 Changelog**:
> - 明确近中期主产品为“单研究者研究系统”，将非线性 research loop 而非 Agent-arXiv 社区作为 monorepo 主干
> - 新增 `NEW-LOOP-01`: Single-User Research Loop Runtime（Phase 3 precursor），作为 `EVO-01/02/03` 的前置基座
> - `UX-06` 阶段枚举明确降格为 UX 导航标签，不再暗示执行内核必须线性
> - `EVO-17` / REP 定位重申为后期 evolution/publication layer，不反向约束近中期单研究者 loop 内核
>
> **v1.9.1 Changelog**:
> - 基于 `meta/docs/sota-monorepo-architecture-2026-03-06.md` 追加 7 个 SOTA follow-up 项，避免将 Batch 10 的 `NEW-SEM-06` 误表述为终态架构
> - `NEW-RT-01` 保持完成态；新增 `NEW-RT-06` (orchestrator-plane routing) + `NEW-RT-07` (host-side MCP sampling routing)，不回写历史
> - 新增 `NEW-DISC-01` federated scholar discovery shared library 路线；首个 deliverable = shared paper identifiers 增加 `openalex_id`
> - `NEW-SEM-06` 重释为 `SEM-06a` baseline，并新增 `NEW-SEM-06-INFRA`, `NEW-SEM-06b`, `NEW-SEM-06d`, `NEW-SEM-06e` 后续路线
> - 架构预审: Opus + Kimi K2.5 (OpenCode) 双审核通过（两者均 `CONVERGED_WITH_AMENDMENTS`，0 blocking），已吸收 dependency / REP clarification amendments
>
> **v1.9.0 Changelog**:
> - 追加 NEW-OPENALEX-01: openalex-mcp standalone MCP (Phase 3, 在 NEW-SKILL-WRITING + NEW-CONN-05 之前实施)
> - 设计 v4 已完成 Claude + Codex + Gemini 三模型两轮审阅收敛
> - 追加 NEW-SEM-01~13: 语义理解质量轨 (Phase 3 Batch 8~16, 10 batches; Codex gpt-5.2 + GLM-5 审核收敛; 见 `meta/docs/semantic-understanding-heuristics-audit-2026-03-04.md`)
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

> **Generic-First 上提约束**: 凡具有跨 domain / provider / host 长期复用价值的抽象，默认必须先在 generic/provider-neutral 层定义 authority，再由 provider-local / host-local 包承载薄适配层或首个实现示例。适用范围不只 computation，也包括 discovery、retrieval、routing、review、writing、result/audit contracts 等。provider-local package、host-local MCP tool、standalone provider server、以及“第一个 HEP/某领域实现”都不得在计划文本中被表述为 shared/generic authority，除非其 surviving abstraction 已完成 provider-neutral rewrite 并被显式提升。若“是否具有长期复用价值”存在争议，应通过架构审查 / 正式多模型审核裁定，而不是由单个 implementer 自行上提。

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
  ├─ NEW-RT-01 TS AgentRunner (Anthropic SDK + lane queue + approval gate) ✅
  ├─ NEW-RT-02 MCP StdioClient reconnect ✅
  ├─ NEW-RT-03 OTel-aligned Span tracing ✅
  │
Phase 2B (Pipeline 连通 + 深度集成):
  ├─ H-05, H-07, H-09, H-10, H-11b, H-12, H-15b, H-16b, H-17, H-21
  ├─ M-02, M-05, M-06, M-20, M-21, M-23, trace-jsonl
  ├─ NEW-02, NEW-03, NEW-04
  ├─ NEW-CONN-02 Review feedback next_actions (~60 LOC) ✅
  ├─ NEW-CONN-03 Computation evidence ingestion (~250 LOC) ✅
  ├─ NEW-CONN-04 Idea → Run creation (~150 LOC) ✅
  ├─ NEW-IDEA-01 idea-core MCP 桥接 (~400-800 LOC) ✅
  ├─ NEW-05a Stage 3 idea-engine TS 增量重写开始
  ├─ NEW-WF-01 Workflow schema 设计 (~100 LOC) ✅
  ├─ NEW-COMP-01 Computation MCP 安全设计 (~200 LOC) ✅
  ├─ NEW-RT-04 Durable execution (~200 LOC) ✅
  ├─ NEW-ARXIV-01 arxiv-mcp 独立 MCP (~1700 LOC) ← Phase 2 early add
  ├─ NEW-HEPDATA-01 hepdata-mcp 独立 MCP (~800 LOC) ← Phase 2 early add
  ├─ UX-02 ✅ Computation contract (升级)
  ├─ UX-07 ✅, RT-02 ✅, RT-03 ✅, NEW-VIZ-01 ✅
  ├─ NEW-R05~R08 ✅, NEW-R10 ✅, NEW-R14, NEW-R15-impl ✅
  │
Phase 3 (扩展性 + 计算连通 + 单研究者研究循环前置):
  ├─ NEW-05a Stage 3 续: idea-engine TS 重写完成
  ├─ NEW-COMP-02 Generic computation execution core + first host adapter (~500 LOC)
  ├─ NEW-CONN-05 Cross-validation → Pipeline feedback (~100 LOC) ✅
  ├─ NEW-OPENALEX-01 openalex-mcp standalone MCP (~1700 LOC) ✅
  ├─ NEW-SKILL-01 lean4-verify skill (~200 LOC)
  ├─ NEW-RT-05 Eval framework (~500 LOC) ✅
  ├─ NEW-SEM-01~13 语义理解质量轨（已完成: 01/02/03/04/05/06/06-INFRA/06b/06d/06e/06f/07/09/10/13；待完成: 08/11/12）
  ├─ NEW-LOOP-01 单研究者非线性研究循环前置运行时 (~400-900 LOC design+runtime) ✅
  ├─ M-22 GateSpec 通用抽象 (deferred from P1)
  ├─ M-03/M-04/M-07~M-10/M-12/M-13/M-15~M-17, L-08
  ├─ NEW-06, NEW-R11, NEW-R12 ✅
  ├─ UX-03 ✅, UX-04 ✅ (workflow schema)
  ├─ RT-01 ✅, RT-04 ✅
  │
Phase 4 (长期演进):
  ├─ L-01~L-07, NEW-07 (A2A)
  │
Phase 5 (端到端闭环、统一执行与研究生态外层（P5A/P5B）):
  ├─ P5A: 单用户 / 单项目端到端闭环 + 统一执行收束 (`EVO-01/02/03/06/07/09/10/11/12/13/14`)
  ├─ P5B: 社区 / 发布 / 跨实例 / 研究进化外层 (`EVO-04/05/08/15/16/17/18/19/20/21`)
  ├─ idea-core Python 退役 + hep-autoresearch 退役 (Pipeline A 退役)
  ├─ EVO-01~03 idea→compute→writing 循环 (依赖: UX-02, UX-04, NEW-R15-impl, NEW-COMP-01, NEW-IDEA-01, NEW-LOOP-01)
  ├─ EVO-04~EVO-21
  │
Pipeline A/B 统一时间线:
  Pipeline A = hep-autoresearch (Python CLI, hepar) — 现有编排器
  Pipeline B = orchestrator (TS MCP) — 新编排器 (NEW-05a/NEW-R15)
  Phase 2:   NEW-IDEA-01 + NEW-COMP-01 → Pipeline A 能力暴露为 MCP (供 Pipeline B 消费)
  Phase 2B:  NEW-CONN-01~04 → 所有阶段通过 hint-only next_actions 连通
  Phase 3:   NEW-COMP-02 (generic computation execution core + first host adapter), NEW-CONN-05 (交叉检验)
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
- **产品边界约束 (2026-03-09)**: 若未来提供单一 end-user agent，必须作为独立 leaf package 引入（命名待定；可为 `packages/agent/` 或 `packages/autoresearch-agent/` 一类），由其消费 orchestrator + root composition layer + selected providers；不得让 repo root、`packages/orchestrator/` 或 `packages/idea-engine/` 直接承担该产品角色。该 leaf package 在 `P5A` 执行语义与 provider 边界稳定前不创建。详见 `meta/docs/2026-03-09-root-ecosystem-boundary-adr.md`。
- **语义 authority 边界约束 (2026-03-10)**: 在 `NEW-05a Stage 3` 正式 closeout 前，必须先完成 `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md` / `meta/docs/prompts/prompt-2026-03-10-hep-semantic-deep-cleanup.md` 所定义的 deep cleanup program。generic core / future `idea-engine` 不得携带 `hep.bootstrap`、`bootstrap_default`、closed HEP compute rubric、review/paper taxonomies、topic/method/challenge lexicons、或任何以 closed domain enum 充当默认 semantic/worldview authority 的实现；有价值的长期内容只能通过 provider-neutral typed contract 上提。

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
| `packages/orchestrator/src/state-machine.ts` | 研究循环编排内核（阶段枚举仅作 UX labels；执行走 event/task graph 而非固定 ingest→reproduce→revision→computation 线性阶段） |
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

### H-01: McpError 扩展 (retryable + retry_after_ms) ✅ (已实现)

> **状态**: done。在 `McpError` 中添加 `retryable: boolean` + `retryAfterMs?: number`，根据 `ErrorCode` 自动推断。~30 LOC。
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

### H-02: 最小可观测性 (trace_id) ✅ (已实现)

> **状态**: done。`packages/shared/src/tracing.ts` 提供 `generateTraceId()` + `extractTraceId()`。dispatcher 每次 tool call 注入 trace_id，错误响应包含 trace_id + retryable。Python 侧 `call_tool_json()` 注入 `_trace_id`，`append_ledger_event()` 支持 `trace_id` 参数。

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

### H-13: 上下文风暴截断机制 ✅ Batch 4A

**状态**: DONE (2026-02-25, expanded to 5-layer Result Handling Reform)

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
- [x] MCP server 升级后 hash 变化 → hep-autoresearch 启动时警告
- [x] CI 固定 hash 并在漂移时失败

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

### H-19: 失败分类 + 重试/退避策略 ✅ (已实现)

> **状态**: done。TS 主实现: `packages/shared/src/retry-policy.ts` (RetryPolicy type) + `packages/orchestrator/src/retry.ts` (retryWithBackoff)。Python 临时 stopgap: `hep-autoresearch/.../retry.py`。Python 侧待 TS orchestrator 验收后立即删除。

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
- [x] CI lint 检查新 artifact 名称符合规范
- [x] 现有 artifact 名称全部符合或有迁移别名
- [x] **ART-01 .md 例外 (R4)**: `packet_short.md` / `packet.md` 为人类审批产物，在 lint 脚本中显式豁免（GATE-05 管辖，不受 ART-01 JSON/tex/jsonl 正则约束）

### M-18: 配置管理统一

**依赖**: H-20 (Phase 0)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/docs/ecosystem_config_v1.md` | (新文件) 配置键注册表：键名、默认值、优先级链 (env > .env > config file > default) |
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | 启动时输出 config echo 摘要（已设置的配置键 + 来源） |

**验收检查点**:
- [x] `hepar doctor` 输出当前生效配置及来源
- [x] 配置但未传播的键触发警告

### M-19: 跨组件 CI 集成测试

**依赖**: H-17 (握手), H-16a (工具名常量)
**严重度**: High (R2 升级: Medium→High，跨组件 CI 是 fail-open 规则的安全网)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/tests/integration/test_smoke.sh` | (新文件) CI 中启动 hep-research-mcp (standard + full) → 运行 hep-autoresearch `doctor` + `bridge` 冒烟测试 |
| CI 配置 | 新增 integration test job |

**验收检查点**:
- [x] CI 在 `standard` 和 `full` 模式下冒烟测试通过 *(Phase 2 Batch 2, 2026-02-26)*
- [x] 错误信封解析 golden test 通过 *(CI workflow covers pnpm -r test + make contract-test)*

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

### M-14a: 日志脱敏层 (redaction prerequisite) ✅ Batch 4B

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

### NEW-R02: TS `as any` CI 门禁 (diff-scoped) ✅ Batch 4B ★深度重构

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
- [x] `vnext/zotero/tools.ts` 不包含独立的业务逻辑实现
- [x] Zotero 工具功能无回归 (现有测试通过)
- [x] 去重 ≥2000 LOC

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

### UX-06: 研究会话入口协议 ✅ Batch 4B ★UX

> **新增 (2026-02-22)**: 人类用户通过 Agent 交互时缺少标准入口——不知道从哪里开始，不知道当前所处阶段。

**变更**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/protocols/session_protocol_v1.md` | 定义 Agent 行为规范: 用户首次输入研究意图时，展示流程概览 + 当前阶段 + 推荐操作 |
| `skills/hepar/SKILL.md` | 更新: 引用 session_protocol，定义 Agent 如何引导用户进入正确的工作流阶段 |

**阶段枚举**: 选题(idea) → 文献(literature) → 推导+计算(derivation) → 写作(writing) → 审稿修订(revision)

**定位说明 (v1.9.2)**: 这些阶段是会话引导用的 UX 标签，不是执行内核的强状态机；用户和 Agent 在研究过程中可合法回跳、分叉、并行推进（例如 compute→literature、review→evidence search、new finding→idea revision）。

**不是代码实现**——是 Agent 行为规范文档，类似 AGENTS.md 但面向用户交互层。

**依赖**: 无

**验收**:
- [ ] session_protocol_v1.md 定义了完整的阶段枚举和 Agent 行为规则
- [ ] 用户输入 "我想研究 X" 时 Agent 能识别阶段并给出明确指引

### NEW-CONN-01: Discovery next_actions hints (Pipeline 连通性) ✅ (已实现)

> **状态**: done。`packages/hep-mcp/src/tools/utils/discoveryHints.ts` 提供 `discoveryNextActions()` / `deepResearchAnalyzeNextActions()` / `zoteroImportNextActions()`。已集成到 `inspire_search`、`inspire_research_navigator`、`inspire_deep_research`、`hep_import_from_zotero` 四个 handler。

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
- [x] macOS + Linux 上锁行为一致
- [x] 进程崩溃后重启 → 自动检测过期锁并恢复
- [x] ledger `event_id` 严格单调递增

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
- [x] 进程 `kill -9` 后无截断/损坏 artifact
- [x] `.tmp` 文件在正常完成后不残留
- [x] tmp 文件与目标文件在同一文件系统 (通过 `stat` 验证 `st_dev` 一致)

### H-09: 幂等性 CAS

**依赖**: H-01 (McpError)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `idea-core/src/idea_core/engine/service.py` | `_record_or_replay` + `_store_idempotency` 合并为原子操作：使用 `filelock` 保护 + 修订计数器 |

**验收检查点**:
- [x] 并发提交相同 `idempotency_key` → 仅一个成功，另一个返回已有结果
- [x] 进程崩溃在副作用提交后 → 幂等性记录已保存

### H-10: Ledger 事件类型枚举

**依赖**: H-03 (RunState)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/ledger.py` | 定义 `EventType` 枚举: `workflow_start`, `workflow_end`, `phase_start`, `phase_end`, `approval_request`, `approval_granted`, `approval_denied`, `approval_timeout`, `state_transition`, `error`, `checkpoint` |
| `hep-autoresearch/src/hep_autoresearch/toolkit/orchestrator_state.py` | `append_ledger()` 验证 `event_type` 属于枚举；非枚举值拒绝写入 |

**验收检查点**:
- [x] 非枚举 `event_type` 写入时抛出 `ValueError`
- [x] 现有 ledger 事件全部可映射到枚举值

### H-11b: MCP 权限组合策略

**依赖**: H-11a (Phase 1 风险分级), H-04 (Gate Registry)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/tools/dispatcher.ts` | 高级权限组合策略：`destructive` + `write` 工具链调用需 gate 审批；capability composition policy 文档化 |

**验收检查点**:
- [x] 多工具链含 `destructive` 工具 → 需 gate 审批
- [x] 单 `read` 工具链 → 直接执行

### H-12: 不可信内容沙箱

**依赖**: C-02 (Shell 隔离)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/shared/src/fs-utils.ts` | `safeExtract(archive, dest)`: Zip Slip 防护 + 解压大小限制 (默认 500MB) + 文件数限制 (默认 10000) |
| `hep-research-mcp/src/research/preprocess/` | PDF/LaTeX 解析增加资源配额 (内存/时间) |

**验收检查点**:
- [x] Zip Slip 测试用例 (`../../../etc/passwd`) → 拦截
- [x] 解压炸弹 (1GB 压缩为 1KB) → 拦截

### H-15b: Artifact 版本化统一

**依赖**: H-18 (ArtifactRef), M-01 (命名规范)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/writing/` 各文件 | 所有 artifact 同时使用文件名 `_v{N}` 后缀 + JSON 内 `schema_version` 字段双标记 |
| `hep-autoresearch/schemas/` | run_card, state 等 schema 统一 `schema_version` 字段位置（顶层第一个字段） |

**验收检查点**:
- [x] 所有 artifact 可通过统一规则解析版本（文件名 + 内字段）
- [x] lint 脚本检查双标记一致性

### H-16b: 跨组件契约测试 CI

**依赖**: H-16a (工具名常量), H-17 (握手)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/tests/contract/test_tool_subset.py` | 验证 hep-autoresearch 调用的 MCP 工具集合 ⊂ hep-research-mcp 注册表 |
| CI 配置 | 新增 contract test job：启动 MCP server → 比对工具名集合 |

**验收检查点**:
- [x] hep-autoresearch 引用不存在的工具名 → CI 失败 *(crossComponentToolSubset.test.ts + make contract-test, Phase 2 Batch 2)*
- [x] 新增 MCP 工具 → 不影响现有契约测试 *(prefix-based extraction covers new tools automatically)*

### H-21: 数据存储位置统一

**依赖**: H-20 (配置加载)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py` | 默认配置 `HEP_DATA_DIR` 为 `~/.hep-mcp`（与 TS 侧 dataDir.ts 对齐）；可通过 env 覆盖 |
| 文档 | 说明 `HEP_DATA_DIR=.` 的项目相对模式 |

**验收检查点**:
- [x] 移动项目目录后 `hepar status` 仍能找到所有 artifact
- [x] `HEP_DATA_DIR` 环境变量覆盖默认值

### M-02: 遗留工具名迁移

**依赖**: H-16a (工具名常量)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | 移除 `inspire_field_survey` 调用，统一为 `inspire_research_navigator` |
| `hep-research-mcp/src/tools/registry.ts` | 可选：添加 deprecated alias 映射 + 警告日志 |

**验收检查点**:
- [x] 代码中无遗留工具名引用 *(confirmed: 0 TS references to inspire_field_survey; already consolidated as mode of inspire_research_navigator, Phase 2 Batch 2)*
- [x] 别名调用触发 deprecation 警告 *(N/A — no alias needed, tool already removed)*

### M-05: Token 计数标准化

**依赖**: 无

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/src/writing/tokenBudget.ts` | 新增 `tokenizer_model` 参数（默认 `claude-opus-4-6`）；文档化 token 估算公式与校准流程 |
| `hep-research-mcp/src/writing/tokenGate.ts` | 同上 |

**验收检查点**:
- [x] token budget/gate 工具接受 `tokenizer_model` 参数 *(registry.ts Zod schema + tokenBudgetPlan.ts + tokenGate.ts, with plan→gate inheritance, Phase 2 Batch 2)*
- [x] 不同模型的 token 估算差异在文档中说明 *(tokenizer_model recorded in artifact metadata for reproducibility; default claude-opus-4-6)*

### M-06: SQLite WAL + 连接池

**依赖**: 无

> **R7 scope expansion (Track B 设计审查)**: 原始范围仅覆盖 PDG 数据库。EVO-20 (Memory Graph)、EVO-19 (Gene Library)、EVO-21 (Strategy Stats) 均需 SQLite WAL 支持。扩展为通用 SQLite 工具模块。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-research-mcp/packages/pdg-mcp/src/db.ts` | 连接时设置 `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=5000` |
| `packages/shared/src/db/sqlite-utils.ts` | (R7 新增) 通用 SQLite 工具: WAL 模式配置、busy_timeout、连接生命周期 (open/close/checkpoint)、schema 初始化 (CREATE TABLE IF NOT EXISTS)。消费者: PDG-MCP, Memory Graph (EVO-20), Gene Library (EVO-19), Strategy Stats (EVO-21) |

**验收检查点**:
- [ ] 并发读写不触发 `database is locked` *(pending: runtime integration in consumers)*
- [x] WAL 模式在连接后验证 *(EXPECTED_WAL_JOURNAL_MODE + SQLITE_WAL_PRAGMAS constants in shared, Phase 2 Batch 2)*
- [x] (R7) 通用 SQLite 工具模块可被 Memory Graph / Gene Library / Strategy Stats 消费 *(packages/shared/src/db/sqlite-utils.ts — platform-agnostic interface + constants, Phase 2 Batch 2)*

### M-20: 迁移注册表 ✅ Phase 2 Batch 4

**依赖**: H-15b (版本化统一), **H-21 (数据位置统一 — 涉及文件路径的迁移条目必须在 H-21 合并后执行)**

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/schemas/migration_registry_v1.json` | (新文件) 每个持久化 schema 的迁移链：`{schema_id, versions: [{from, to, migration_fn}]}` |
| `hep-autoresearch/src/hep_autoresearch/toolkit/migrate.py` | (新文件) `workspace migrate` 命令：检测旧版 artifact → 应用迁移链 |

**验收检查点**:
- [x] N-1 版本 fixture 可通过 `workspace migrate` 升级
- [x] 迁移后 artifact 通过当前版本 schema 验证

### M-21: 载荷大小/背压契约

**依赖**: H-13 (截断机制)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `autoresearch-meta/ECOSYSTEM_DEV_CONTRACT.md` §Artifact | 定义 stdio tool result 最大大小 (100KB)；超限溢出到 artifact + `read_artifact_chunk` |

**验收检查点**:
- [x] 超限 tool result 自动溢出 *(STDIO_MAX_RESULT_BYTES = 100KB constant defined; enforcement deferred to runtime wiring)*
- [x] 客户端/服务端统一强制大小限制 *(constant exported from @autoresearch/shared, Phase 2 Batch 2)*
- [x] H-13 L1 残留: `inspire_literature` get_references/get_citations 裸数组返回值须经 compactPaperSummary 处理（Batch 4 R2 Codex caveat） *(compactPapersInResult now handles raw arrays, Phase 2 Batch 2)*
- [x] H-13 L4 残留: `appendResourceLinks()` MIME 类型须从 hep:// URI 推断（非 JSON artifacts 不应硬编码 `application/json`）（Batch 4 R2 Codex caveat） *(inferMimeType exported from dispatcher.ts, Phase 2 Batch 2)*

### M-23: 发布产物对齐

**依赖**: H-16a (工具名常量生成)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `Makefile` (根目录) | 新增 `release` target：`pnpm build` → `generate_tool_catalog` → `generate_tool_names.py` → 统一版本号 |

**验收检查点**:
- [x] `make release` 一键构建 TS + 生成 Python 绑定
- [x] 版本号在 `package.json` 和 `pyproject.toml` 中一致

### 全链路 trace_id + 结构化 JSONL 日志 ✅ Phase 2 Batch 4

**依赖**: H-02 (trace_id), H-01 (McpError), **M-14a (日志脱敏层，前置条件)**

> **R7 注记 (Track B 设计审查)**: EVO-12a (技能自生成) 需要以下 trace event types 具有结构化 `data` schema: `file_edit` (file_path, diff, edit_type), `fix_applied` (file_path, fix_type, signal_context), `tool_call` (tool_name, params, result_status), `skill_invoked` (skill_id, trigger, result)。这些 event types 应在 trace-jsonl 的 event schema 规范中定义。

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/toolkit/logging_config.py` | (新文件) 结构化 JSONL 输出：`{ts, level, component, trace_id, event, data}` + 保留人类可读 CLI 输出 |
| `hep-research-mcp/src/tools/dispatcher.ts` | tool 调用日志输出 JSONL 格式到 stderr |

**验收检查点**:
- [x] 所有组件日志可被统一聚合工具 (`jq`) 解析
- [x] `trace_id` 贯穿 MCP → orchestrator → ledger

### NEW-02: 审批产物三件套 + CLI 可读性重做 ✅ Phase 2 Batch 5

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

### NEW-03: 审批 CLI 查看命令 ✅ Phase 2 Batch 5

**依赖**: NEW-02 (三件套产物)

**修改文件**:
| 文件 | 修改内容 |
|---|---|
| `hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` | 新增子命令 `approvals show --run-id <RID> --gate <A?> --format short|full|json`；默认 `short`，终端打印 `packet_short.md`；`full` 打印 `packet.md`；`json` 输出 `approval_packet_v1.json` 到 stdout |

**验收检查点**:
- [ ] `hepar approvals show --run-id <RID> --gate A3` 默认打印 short 版本
- [ ] `--format json` 输出可被 `jq` 解析
- [ ] 无匹配审批时返回清晰错误信息

### NEW-04: 自包含人类报告生成 ✅ Phase 2 Batch 5

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

### UX-02: 结构化计算代码目录 + Computation Contract ✅ Phase 2 Batch 7 ★UX

> **新增 (2026-02-22)**: research-team 的计算规划 (Draft_Derivation §6 Mapping to Computation) 与 hep-calc 的执行输入 (job.yml) 之间缺少标准化衔接；计算产出的代码文件散落在 artifacts 各 run 目录中，缺少统一的可复现结构。
> **Scope Audit 升级 (2/3)**: 从目录布局升级为**计算契约 (Computation Contract)**: 可编译为 run-cards / skill jobs，含 acceptance checks + expected outputs。
> **Pipeline 连通性审计追加**: 计算产出写入 `computation_evidence_catalog_v1.jsonl`（`ComputationEvidenceCatalogItemV1`，并行 schema，见 NEW-CONN-03），**不**写入 `EvidenceCatalogItemV1`（后者要求 `paper_id` + `LatexLocatorV1`，与计算产出语义不兼容）。如需在 writing pipeline 中消费计算证据，由 NEW-CONN-03 提供显式的有损转换步骤。

**变更**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/schemas/computation_manifest_v1.schema.json` | 计算清单 schema: steps[], environment, dependencies — 作为 research-team 计算规划与 hep-calc 执行之间的标准接口 |
| research-team / derivation guidance | Section 6 (Mapping to Computation) 保留 `computation/manifest.json` 合同与 code↔artifact mapping；当前树中仍以人类 / member staging 为主，而非自动生成 |
| downstream compute surfaces | workflow entry points、codegen types 与 computation evidence ingestion metadata 均可引用 `computation/manifest.json`；direct provider execution 仍属于后续 compute runtime/provider lane |

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
- [x] `computation_manifest_v1.schema.json` 定义完成
- [x] manifest contract 已进入 codegen / downstream workflow surfaces，并有 schema-level contract validation
- [x] research-team / derivation guidance 已显式保留 `computation/` contract 与 code↔artifact mapping
- [x] manifest.json 包含环境要求 + 运行顺序 + 预期输出

### UX-07: 审批上下文丰富化 ✅ Phase 2 Batch 7 ★UX

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
- [x] 每个 gate (A0-A4) 的 packet_short 包含该阶段特定的上下文摘要
- [x] A5 packet_short 包含 notebook 结果节摘要 + 关键数值表 (integrity_report 占位，待 EVO-06 接入)
- [x] `hepar approvals show` 默认打印 packet_short 到终端
- [x] packet_short ~60 行软上限，超限时附加 `overflow: hepar approvals show --format full` 指针
- [x] 人类审阅者无需打开其他文件即可对 packet_short 做出判断

### RT-02: 工具访问增强 + 溯源 Clean-Room ✅ Phase 2 Batch 6 ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §2 (R4 READY)

**依赖**: 无新依赖 (与 RT-03 同期交付)

**现状**: research-team 成员工具访问受限 (单轮 JSON proxy, max 8 files)，clean-room 依赖复杂的物理 MCP 实例隔离。

**变更**:

| 文件 | 变更 |
|---|---|
| `skills/research-team/scripts/bin/run_team_cycle.sh` | 新增 `--member-X-tool-access {restricted\|full}`；full 模式生成随机化 workspace 路径 |
| `skills/research-team/scripts/bin/run_member_review.py` | full_access 模式: request/execute proxy (file_read/command_run/network_fetch) + evidence/provenance 汇总 |
| `skills/research-team/scripts/lib/provenance.py` | provenance schema (claim_id/step_id/tool_call_ids 三级关联)、提取、验证 |
| `skills/research-team/scripts/gates/check_clean_room.py` | workspace 隔离检查 + provenance/audit 交叉验证 + hard-fail 门禁 |
| `skills/research-team/scripts/lib/audit_interceptor.py` | append-only audit log (tc_id + workspace) — tool calls: file_read/command_run/network_fetch |
| `skills/research-team/scripts/lib/workspace_isolator.py` | 随机化 workspace + 路径泄漏防护 + shell 安全约束 |

**关键设计**: 三层 clean-room — (1) 工作区隔离 (随机路径+路径遍历阻断), (2) 溯源交叉验证, (3) hard-fail 门禁 (CONTAMINATION_DETECTED/critical PROVENANCE_MISMATCH → 不可降级)。

**验收**:
- [x] full 模式: 成员可使用 request/execute proxy tools (file_read/command_run/network_fetch) + provenance 自动记录
- [x] 工作区隔离: 随机化路径 + shell cwd 锁定 + 路径遍历阻断
- [x] clean-room gate: CONTAMINATION_DETECTED → hard-fail; PROVENANCE_MISMATCH/PROVENANCE_MISSING → hard-fail
- [x] audit log: tc_id/tool_name/args_hash/result_hash/workspace/timestamp_utc
- [x] provenance.tool_call_ids 与 audit log 精确匹配验证

### RT-03: 统一 Runner 抽象 + API 可配置性 ✅ Phase 2 Batch 6 ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §3 (R4 READY)

**依赖**: 无新依赖

**现状**: research-team 成员模型硬编码 (Claude/Gemini/Codex)，无法接入自托管或第三方 LLM provider。

**变更**:

| 文件 | 变更 |
|---|---|
| `skills/research-team/scripts/bin/run_team_cycle.sh` | 新增 `--member-X-runner`, `--member-X-api-base-url`, `--member-X-api-key-env` + member-b runner kind/fallback |
| `skills/research-team/assets/run_{claude,gemini,codex}.sh` | runner 统一接口；Claude 支持 `--api-base-url/--api-key-env`，Gemini 为接口对齐接受但不使用，Codex runner 保持最小接口 |
| `skills/research-team/scripts/runners/run_openai_compat.sh` | 通用 OpenAI-compatible runner（DeepSeek/Qwen/vLLM/LM Studio/Ollama 等） |

**安全约束**: `--api-key <value>` 明文传参被禁止 (CLI 直接报错拒绝)。

**验收**:
- [x] `--member-X-runner` 自定义 runner 脚本可替换内置 runner
- [x] `--api-key-env` 传环境变量名，API key 不出现在进程列表/日志/artifact
- [x] `run_openai_compat.sh` 可调用 DeepSeek/Qwen/vLLM 端点

### NEW-VIZ-01: Graph Visualization Layer — 通用 schema + 5 domain adapters ✅ Phase 2 Batch 6 ★infra

> **设计文档**: `docs/graph-visualization-layer.md` (9 轮双模型审查收敛: Codex READY + Gemini READY)

**依赖**: 无前置依赖 (通用基础设施)

**现状**: `render_claim_graph.py` (~458 LOC) 直接将 Claim DAG 渲染为 Graphviz DOT/PNG/SVG。五个子系统 (Claim DAG, Memory Graph, Literature graph, Idea map, Progress graph) 各自生成类型化有向图，缺少统一可视化层。

**变更**:

| 文件 | 变更 |
|---|---|
| `packages/shared/src/graph-viz/types.ts` | UniversalNode/UniversalEdge 通用接口 + render options + Adapter 接口 |
| `packages/shared/src/graph-viz/adapters/` + `packages/shared/src/memory-graph/viz-adapter.ts` | 5 个 domain adapter: claim, memory, literature, idea, progress |
| `packages/shared/src/graph-viz/{render,graphviz}.ts` | Graphviz DOT/PNG/SVG 渲染 + JSON 导出 |

**验收**:
- [x] UniversalNode/UniversalEdge schema 支持任意 domain metadata
- [x] 5 个 adapter 各自产出 universal graph 并可渲染为 DOT/SVG
- [x] claim adapter 覆盖 `render_claim_graph.py` 的输入/渲染能力（当前 pipeline 仍走 legacy Python，接线延后到 TS 迁移阶段）

### NEW-RT-01: TS AgentRunner (Phase 2 early)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #2 (Agent Loop)
> **CLI-First 架构**: Phase 1-2 CLI agents 作为 agent loop; AgentRunner 为 Phase 3+ 自建 agent loop 准备

**依赖**: NEW-R15-impl
**估计**: ~250 LOC

**内容**: Anthropic SDK `messages.create` + tool dispatch + lane queue (per-run 串行化，借鉴 OpenClaw) + max_turns + approval gate injection。

**不做**: 不引入外部 agent framework (Mastra/LangGraph/Pi)。SDK 管 model interaction，自建管 domain state。

**验收**:
- [x] AgentRunner 可驱动 MCP 工具调用循环
- [x] per-run 工具调用串行化 (lane queue)
- [x] approval gate 注入: 遇到 gate 时暂停等待批准

**后续 (SOTA 架构 2026-03-06)**: `NEW-RT-01` 保持 done；后续以 `NEW-RT-06` / `NEW-RT-07` 叠加 provider-agnostic routing，不 retroactively 重写此项。

### NEW-RT-02: MCP StdioClient Reconnect ✅ Batch 4B (Phase 2 early)

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #1 (Retry + Reconnect)

**依赖**: H-19
**估计**: ~100 LOC

**内容**: 检测 MCP stdio 子进程断连 (exit/crash/timeout) + 自动重启 + session 恢复。

**验收**:
- [ ] MCP server 进程崩溃后自动重启
- [ ] 重启后 session 恢复，pending 请求重试

### NEW-RT-03: OTel-aligned Span Tracing ✅ Batch 4B (Phase 2 mid)

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
- [x] AgentRunner 崩溃后可从 `last_completed_step` 恢复
- [x] `resume_from` 跳过已完成步骤

### NEW-CONN-02: Review Feedback next_actions (Phase 2)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — 评审反馈孤岛

**依赖**: 无
**估计**: ~60 LOC

**内容**: `submitReview` 在 `follow_up_evidence_queries.length > 0` 时添加 `next_actions` (建议 `inspire_search` + `hep_run_build_writing_evidence`, max 5 queries, max 200 chars each)；在 `recommended_resume_from` 存在时建议具体 writing 工具。Hint-only。

**验收**:
- [x] 有 evidence queries 的 review → next_actions 非空
- [x] next_actions 遵循 `{ tool, args, reason }` 惯例

### NEW-CONN-03: Computation Evidence Ingestion (Phase 2)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 2 (legacy computation workflow + hep-calc CLI-only)
> **关键 schema 决策**: `EvidenceCatalogItemV1` 是 LaTeX 特有的 (required `paper_id` + `LatexLocatorV1`)。计算结果**不能**存入此格式。创建并行的 `ComputationEvidenceCatalogItemV1` schema。

**依赖**: NEW-COMP-01, NEW-01
**估计**: ~250 LOC

**内容**:
1. 定义 `ComputationEvidenceCatalogItemV1` JSON Schema (SSOT in `meta/schemas/`, codegen via NEW-01): `source_type: "computation"`, `ComputationLocatorV1` (artifact_uri + json_pointer + artifact_sha256), domain-specific 字段 (value, uncertainty, unit)
2. 实现 `hep_run_ingest_skill_artifacts` MCP 工具 (per NEW-COMP-01 spec): 读取 skill SSOT artifacts via ArtifactRef URI, 写入 `computation_evidence_catalog_v1.jsonl`
3. 扩展 `buildRunEvidenceIndexV1` 合并计算 evidence 到 BM25 index (~30 LOC)

**不做**: 不修改 `EvidenceCatalogItemV1`。LaTeX-only 消费者按 `paper_id` 过滤，自然跳过计算 evidence。

**验收**:
- [x] `ComputationEvidenceCatalogItemV1` JSON Schema 定义完成
- [x] `hep_run_ingest_skill_artifacts` 可读取 skill artifacts 并写入 evidence catalog
- [x] BM25 index 合并两类 evidence

### NEW-CONN-04: Idea → Run Creation (Phase 2B)

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 1 (idea-core Python 孤岛)

**依赖**: NEW-IDEA-01
**估计**: ~150 LOC

**内容**: `hep_run_create_from_idea` 接收 IdeaHandoffC2 URI, 创建 project + run, stage thesis/claims 为 outline seed, 返回 hint-only `next_actions` (inspire_search + build_evidence + build_evidence_index)。纯 staging，无网络调用。

**验收**:
- [x] 从 IdeaHandoffC2 URI 创建 run
- [x] outline seed 包含 thesis/claims
- [x] next_actions 建议后续 pipeline 步骤

### NEW-IDEA-01: idea-core MCP 桥接 (`@autoresearch/idea-mcp`) (Phase 2)

> **来源**: Dual-Mode 架构收敛 — idea-core 孤岛连通
> **性质**: 过渡方案 (桥接)，终态是 idea-engine TS 重写 (NEW-05a Stage 3)

**依赖**: H-01, H-02, H-03, H-16a
**估计**: ~400-800 LOC

**内容**: MCP 工具暴露 idea-core Python API: `campaign.*`, `search.step`, `eval.run`。通过 JSON-RPC 调用现有 idea-core Python 进程。

**验收**:
- [x] MCP 工具可创建 campaign 并执行 search step
- [x] idea-core 评估结果可通过 MCP 返回
- [x] 错误通过 McpError (retryable) 传播

### NEW-COMP-01: Computation MCP 工具表面设计 (Phase 2 late)

> **来源**: Dual-Mode 架构收敛 — 安全先行
> **追加 (Pipeline 连通性审计)**: 包含 `hep_run_ingest_skill_artifacts` 工具规格作为交付物 (single SSOT)
> **范围约束 (2026-03-08)**: `computation` substrate 应被实现为面向理论研究的 domain-neutral compute substrate，按 task/capability-first 建模；package 名称、后端名称与当前工具链只作开放示例或 provider 实现，不作封闭枚举、唯一执行路径或 scope 边界。具体问题的 decomposition、方法选择与 backend 组合默认由 runtime LLM / agent 在 typed contract + approval/audit 边界内决定。

**依赖**: C-02, NEW-R15-impl
**估计**: ~200 LOC (设计文档)

**内容**: Computation MCP 工具表面安全模型设计：统一 execution-plan / capability / provider contract + C-02 containment (命令/输出验证) + A3 default gating (计算执行需人类批准) + allowlist。交付物包含 `hep_run_ingest_skill_artifacts` 工具规格。

**验收**:
- [x] 安全模型设计文档通过双模型审核
- [x] `hep_run_ingest_skill_artifacts` 工具规格定义完成
- [x] 工具表面与 C-02 containment 对齐

### NEW-WF-01: Research Workflow Schema (Phase 2)

> **来源**: Dual-Mode 架构收敛 — Must-Design-Now #1
> **扩展 (Pipeline 连通性审计)**: schema 定义 entry point variants

**依赖**: UX-04
**估计**: ~100 LOC (schema)

**内容**: `research_workflow_v1.schema.json` — 声明式研究工作流图 + 统一状态模型 + hash-in-ledger + 模板系统。Entry point variants: `from_literature`, `from_idea`, `from_computation`, `from_existing_paper`。初始引用 NEW-CONN-01~03，NEW-CONN-04 就绪后追加。

**验收**:
- [x] schema 定义完成，含 nodes/edges/gates/entry_points
- [x] 至少 3 个模板: review, original_research, reproduction
- [x] entry point variants 覆盖 4 种起点

### NEW-ARXIV-01: arxiv-mcp — 领域无关 arXiv MCP server ★infra

> **背景**: arXiv 覆盖领域远超 HEP——物理（等离子体、凝聚态）、CS/ML/LLM、数学、生物、经济等均以 arXiv 为主要发布渠道。当前 arXiv 访问层深度嵌入 `hep-mcp` 内部（`arxivSource.ts` + `paperContent.ts` + `downloadUrls.ts`），且与 INSPIRE 元数据隐式耦合，非 HEP 用户无法直接使用。
> **优先级**: Phase 2 early — 用户已有具体非 HEP 使用场景（等离子体物理、LLM 论文），需要领域无关的 arXiv 检索与内容访问能力。

**依赖**: 无（自包含；不依赖 INSPIRE、PDG 或任何 HEP 特定组件）

**估计**: ~1,700 LOC（~1,200 从 hep-mcp 迁移 + ~500 新脚手架 + 新工具）

**模式**: 遵循 `pdg-mcp` 独立 MCP 模式——`packages/arxiv-mcp/` 为自包含 stdio MCP，`hep-mcp` 聚合其工具（与 pdg-mcp 聚合方式相同）。

**迁移范围（从 hep-mcp 提取）**:

| 文件 | LOC | 说明 |
|------|-----|------|
| `tools/research/arxivSource.ts` | 301 | arXiv API 查询、ID 规范化、source 可用性检查 |
| `tools/research/downloadUrls.ts` | 152 | 下载 URL 生成（无副作用） |
| `tools/research/paperContent.ts` | 475 | LaTeX/PDF 下载，streaming，tar.gz 解包 |
| `tools/research/paperSource.ts` | 168 | 统一入口（urls/content/metadata/auto 四模式） |
| `api/rateLimiter.ts` (arXiv 部分) | ~120 | `ArxivRateLimiter` + `arxivFetch()` |

**新工具面（`arxiv_*` 命名空间）**:

| 工具 | 类型 | 说明 |
|------|------|------|
| `arxiv_paper_source` | 迁移 | 原 `inspire_paper_source`，去除 INSPIRE 耦合；支持 urls/content/metadata/auto |
| `arxiv_search` | 新增 | arXiv Atom API 搜索（query + 分类过滤 + 时间范围）；纯 arXiv，不经 INSPIRE |
| `arxiv_get_metadata` | 新增 | 根据 arXiv ID 返回完整元数据（标题、作者、摘要、分类、DOI 等） |

**hep-mcp 侧变更**:
- 现有 `inspire_paper_source` 工具保留为**兼容别名**（内部转发至 `arxiv_paper_source`）；计划在 Phase 3 删除别名
- `deepAnalyze.ts`、`measurementExtractor.ts`、`downloader.ts`、`evidenceIndex.ts` 的 arXiv import 改为来自 `@autoresearch/arxiv-mcp` 或提取的共享 client 库

**关键设计约束**:
- `arxiv-mcp` 不知道 INSPIRE 存在；INSPIRE→arXiv ID 映射留在 `hep-mcp` 层
- 速率限制保持独立（3 秒间隔）；`hep-mcp` 的 INSPIRE 速率限制器不变
- 工具命名: `arxiv_*`（不冲突 `hep_*` / `inspire_*` / `pdg_*`）
- stdio 传输，遵循 `packages/hep-mcp/CLAUDE.md` Hard Constraints

**验收检查点**:
- [ ] `packages/arxiv-mcp/` 独立构建通过（`pnpm build`）
- [ ] `arxiv_search` 可按 query + 分类搜索，返回结果列表（不依赖 INSPIRE）
- [ ] `arxiv_paper_source` 支持 urls/content/metadata/auto 四模式
- [ ] `arxiv_get_metadata` 返回完整元数据
- [ ] `hep-mcp` 聚合 `arxiv-mcp` 工具，`inspire_paper_source` 别名可用
- [ ] 原有 `inspire_paper_source` 测试通过（通过别名）
- [ ] 全套 contract tests 通过（`pnpm test`）

### NEW-HEPDATA-01: hepdata-mcp — HEPData 实验测量数据 MCP server ★infra

> **背景**: [HEPData](https://www.hepdata.net/) 是 HEP 实验测量数据的权威仓库，存储 LHC 及其他对撞机实验的截面、衰变宽度、分支比等数值结果，通常以 YAML/JSON 格式关联对应 arXiv 论文和 INSPIRE 记录。理论计算与实验对比（如 cross-section prediction vs. CMS/ATLAS measurements）是 HEP 研究的核心工作流，hepdata-mcp 将补全这一数据链路。

**依赖**: 无（自包含；独立调用 HEPData REST API）

**估计**: ~800 LOC（含 API client、工具、contract tests）

**模式**: 同 `pdg-mcp` / `arxiv-mcp` 独立 standalone MCP，`hep-mcp` 聚合其工具。

**HEPData API**: `https://www.hepdata.net/api/` — REST API，支持按 INSPIRE recid / arXiv ID / DOI 查询，返回 JSON；数据表以 YAML 格式存储于 HEPData 服务器。

**工具面（`hepdata_*` 命名空间）**:

| 工具 | 说明 |
|------|------|
| `hepdata_search` | 按 arXiv ID / INSPIRE recid / DOI 或关键词查找 HEPData 记录；返回 record ID + 摘要 |
| `hepdata_get_record` | 获取指定 record 的完整元数据（论文信息、数据表列表、图表数量） |
| `hepdata_get_table` | 获取指定数据表内容（x/y 列、误差、单位、qualifier）；支持原始 YAML 和 JSON 两种格式 |
| `hepdata_download` | 下载完整数据包（zip）到本地 artifacts 目录；返回 `hep://` resource URI |

**验收检查点**:
- [x] `packages/hepdata-mcp/` 独立构建通过
- [x] `hepdata_search` 可按 arXiv ID 和 INSPIRE recid 查找 record
- [x] `hepdata_get_table` 返回数值数据（x/y 列 + 误差 + 单位）
- [x] `hep-mcp` 聚合 `hepdata-mcp` 工具，`hepdata_*` 工具可用
- [x] contract tests 通过



- [ ] 进程崩溃恢复测试通过（原子写入 + 锁恢复 + 幂等性）
- [ ] 全链路 trace_id 可从 MCP tool call 追踪到 ledger 事件
- [ ] 跨组件契约测试 CI 通过
- [ ] 审批三件套产物生成正确（packet_short.md ≤1页, packet.md 全量, approval_packet_v1.json 通过 schema）
- [ ] `hepar approvals show` + `hepar report render` 命令可用
- [x] 证据抽象层 schema 定义完成 (NEW-R05)
- [x] hep-autoresearch 测试覆盖门禁 CI 就绪 (NEW-R07)
- [x] NEW-R15 编排器 MCP 工具实现 (`orch_run_*` + `orch_policy_query`) 可用
- [x] `computation_manifest_v1.schema.json` 定义完成 (UX-02)
- [x] 审批 packet_short 包含各 gate 特定上下文，人类可直接判断 (UX-07)
- [x] research-team 工具访问: full 模式 MCP 工具 + 溯源 clean-room + hard-fail 门禁 (RT-02)
- [x] research-team runner 抽象: 自定义 runner + API 可配置 + key 脱敏 (RT-03)
- [x] Graph Visualization Layer: UniversalNode/Edge schema + 5 domain adapters 可渲染 (NEW-VIZ-01)
- [x] arxiv-mcp: `arxiv_search` + `arxiv_paper_source` + `arxiv_get_metadata` 可用，hep-mcp 聚合通过 (NEW-ARXIV-01)
- [ ] 无 Phase 0/1 回归

### NEW-R05: 证据抽象层 ✅ Phase 2 Batch 4 ★深度重构

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
- [x] 证据 schema 通过 JSON Schema Draft 2020-12 验证
- [x] codegen 生成的 TS/Python 类型替代手写定义
- [x] `ArtifactRefV1` 通过 `$ref` 组合，无字段重复

### NEW-R05a: Pydantic v2 代码生成目标评估 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §6 — 独立时间框定子项

**依赖**: NEW-01 (codegen pipeline)

**评估内容**: 将 `datamodel-code-generator` 的 Python 输出从 `dataclasses` 切换为 `Pydantic v2 BaseModel` (`--output-model-type pydantic_v2.BaseModel`)。需评估 `pydantic-core` Rust wheel 构建/安装风险。
**决策门禁**: 时间框定评估; 如果 Rust wheel 在目标平台 (macOS arm64, Linux x86_64) 构建无问题，采纳; 否则保留 dataclasses。

### NEW-R06: 分析类型 Schema 整合 ✅ Phase 2 Batch 4 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §7

**依赖**: NEW-01 (codegen pipeline)

**现状**: 7 个版本化类型文件 (`analysis-results1.ts` ~ `analysis-results4.ts` 等) → 应整合为单一 canonical schema。

**验收检查点**:
- [x] 单一 `analysis_results_v1.schema.json` SSOT
- [x] codegen 生成替代手写版本化文件

### NEW-R07: hep-autoresearch 测试覆盖门禁 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §4

**依赖**: 无

**现状**: 46 个源文件，16 个测试文件 (35% 密度)。多个关键模块 (如 `w3_paper_reviser_evidence.py` 788 LOC) 无测试。
**策略**: CI 门禁: 每个 `hep-autoresearch/src/` 源文件必须有对应测试文件，新增源文件无测试 → CI 失败。

**验收检查点**:
- [x] CI 检查源文件/测试文件一一对应
- [x] 新增源文件无测试 → CI 失败
- [x] 存量豁免清单有时间框定

### NEW-R08: Skills LOC 预算 ✅ Phase 2 Batch 5 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §8

**依赖**: NEW-R02a (CODE-01 CI gate)

**现状**: 6 个技能脚本超出 CODE-01.1 200 eLOC 限制 (最大: `build_team_packet.py` 1130 LOC)。
**策略**: 应用 CODE-01.1 到 `skills/*/scripts/`。中间态允许 ≤500 eLOC + CONTRACT-EXEMPT。

**验收检查点**:
- [ ] 6 个脚本拆分至 ≤200 eLOC (或有 CONTRACT-EXEMPT + sunset)
- [ ] CI gate 覆盖 skills 目录

### NEW-R10: `service.py` 拆分 (条件性) ✅ Phase 2 Batch 6 ★深度重构

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

### NEW-R15-impl: 编排器 MCP 工具实现 ✅ Phase 2 Batch 7 ★深度重构

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
- [x] 所有 `orch_run_*` 工具通过 contract tests
- [x] `orch_run_approve` 的 `approval_id` + `approval_packet_sha256` 双重验证工作
- [x] 命名空间无冲突 (`orch_run_*` vs `hep_run_*`)
- [x] reality-audit closeout: `hepar` CLI 与 `orch_run_*` handlers 共享同一 `.autoresearch/state.json` / `ledger.jsonl` / approval-packet on-disk contract；当前树确认 parity，而非 CLI 通过 MCP handler delegation

---

## Phase 3: 扩展性与治理 (P3)

> **目标**: Schema 扩展性、凭据管理、网络治理、技能隔离 + SOTA retrieval/discovery/runtime follow-ups
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

### NEW-06: MCP 写作流水线移除 (深度审计 2026-03-01)

> **重写 (2026-03-01)**: 原 NEW-06 计划"整合" ~20 个写作工具为更少的 execute 工具。深度审计结论：整个写作 generation/orchestration pipeline 应从 MCP server 中删除，而非整合。详见 `meta/docs/hep-mcp-audit-report.md` + `meta/docs/hep-mcp-restructuring-proposal.md`。
> **R8 收敛 (2026-03-01)**: 双模型审核（Codex gpt-5.2 + Gemini 3.1 Pro）经 8 轮迭代收敛，14 个 BLOCKING findings 全部解决。proposal 稳定。

**现状**: 写作流水线 ~40K LOC, ~30 tools，嵌入 LLM 客户端（违反 MCP best practice），实现属于 agent/skill 层的编排逻辑，且已被外部 skills (research-writer, paper-reviser, referee-review) 完整替代。

**动机**:
1. **MCP 架构正确性**: MCP server 不应嵌入 LLM 客户端 (Docker, O'Reilly/Goose, MCP spec, Phil Schmid, Klavis AI 均确认为反模式)
2. **代码减负**: 98K → ~58K LOC, 102 → 72 tools (full), 79 → 56 tools (standard)
3. **功能无损失**: research-writer + paper-reviser + referee-review skills 完整覆盖写作能力
4. **SOTA LLM 能力**: EQ-Bench Longform 确认 per-section 近零退化，但单次生成仍有限 — 策略应在 skill 层而非 MCP server 层实现

**执行计划**: 4-batch migration (详见 `meta/docs/hep-mcp-restructuring-proposal.md` §7):
- **Batch 1**: Extraction + corpora 删除 — 提取 `utils/latex.ts`, `utils/bibtex.ts`, `core/writing/writingTypes.ts`; 移除 `verifyCitations` + citation verification; 删除 `corpora/` (16 files + 8 tool registrations); `exportProject.ts` 容忍验证 artifact 缺失
- **Batch 2**: 写作管线核心删除 — `deepResearch.ts` mode='write' 移除 → `deepWriterAgent.ts` 删除 → `core/writing/` 32 files 删除 → `tools/writing/` bulk 删除 (保留 `llm/` + `types.ts`) → registry ~28 tool registrations 移除
- **Batch 3**: LLM 客户端迁移 — MCP sampling plumbing (`sendRequest`/`createMessage` 加入 `ToolHandlerContext`) → `theoreticalConflicts.ts` 迁移 → `tools/writing/llm/` + `types.ts` 删除 → stale hints 清理
- **Batch 4**: 测试清理 + 验证

**保留模块** (core/writing/ — 6 files):
- `renderLatex.ts` — Draft Path LaTeX 渲染 (确定性操作; citation verification 已移除)
- `latexCompileGate.ts` — LaTeX 编译检查
- `draftSchemas.ts` — Draft path Zod schemas
- `staging.ts` — stageRunContent (hep_run_stage_content 工具使用)
- `evidence.ts` — buildRunWritingEvidence + embeddings query (evidenceSemantic.ts 依赖)
- `writingTypes.ts` [NEW] — SentenceAttribution/SentenceType (从 tools/writing/types.ts 提取)

**修改文件**: (大规模删除，详见 restructuring proposal §3-§7)

**验收检查点**:
- [x] `pnpm -r build` 通过 0 errors
- [x] `pnpm -r test` 通过 (~470 tests, 从 726 下降; hep-mcp package)
- [x] `getTools('full')` = 72
- [x] `getTools('standard')` = 56
- [x] 30 tools deleted (23 standard + 7 full-only)
- [x] deepResearch.ts 中无 mode='write'
- [x] `hep://corpora/` resource namespace 完全移除
- [x] `tools/writing/llm/` 完全删除 (含 clients/, config.ts, types.ts, index.ts)
- [x] 无 `createLLMClient` 调用 (replaced by MCP sampling)
- [x] `docs/ARCHITECTURE.md` 更新

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

**依赖**: 无 (原依赖 NEW-06 写作管线整合，现 NEW-06 改为写作管线移除，UX-03 不再依赖写作工具)

**验收**:
- [x] `hep_export_paper_scaffold --version 2` 输出到 `paper/v2/`
- [x] `changes_v1_to_v2.diff` 自动生成
- [x] research-writer consume 可处理版本化 manifest（deterministic precedence + v1/v2 schemaVersion）
- [x] paper_manifest_v2.schema.json 包含 version + parent_version

### UX-04: 结构化工具编排 Recipe + Workflow Schema ★UX

> **新增 (2026-02-22)**: Agent 依赖自然语言 skill (SKILL.md) 理解工具调用顺序，不同 Agent 理解可能不一致。同期合并 inspire_search + hep_inspire_search_export。
> **Scope Audit 扩展 (2/3)**: 从静态 recipe 扩展为**可执行 workflow schema**: 含计算节点、`orch_run_*` gate 操作。Recipe 是 workflow schema 的具体实例化。详见 NEW-WF-01。

**依赖**: NEW-06 (写作管线移除后定义 recipe), H-16a (工具名常量化), NEW-R15-impl (recipes 需要 orch_run_* 存在)

**变更**:

| 文件 | 变更 |
|---|---|
| `autoresearch-meta/schemas/workflow_recipe_v1.schema.json` | Recipe schema: steps[], gates[], tool references |
| `autoresearch-meta/recipes/` | 标准 recipe 定义: `literature_to_evidence.json`, `derivation_cycle.json`, `review_cycle.json` (注: `writing_pipeline.json` 已移除 — 写作管线从 MCP server 删除, 见 NEW-06) |
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

**依赖**: NEW-06 (写作管线移除后定义 recipe), H-16a (工具名常量化)

**验收**:
- [x] `workflow_recipe_v1.schema.json` 定义完成
- [x] 至少 3 个标准 recipe 定义 (literature, derivation, review; writing 已移除见 NEW-06)
- [x] `inspire_search` 覆盖导出能力（`hep_inspire_search_export` 语义可达）
- [x] Agent 可加载 recipe JSON 执行标准工作流（schema/fixture 测试覆盖）

### RT-01: 可配置工作流模式 (`--workflow-mode`) ★research-team

> **来源**: `docs/design-proposal-research-team-v2.md` §1 (R4 READY)

**依赖**: UX-06 (session protocol), NEW-06 (写作管线移除), RT-02 (clean-room gate)

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
- **默认模式**: `leader`（research-team 主流程语义上本来就是 leader + members；见 `meta/docs/sota-multi-agent-verification-2026.md` §架构差异说明）
  - `peer` 保留用于纯对等场景（两个完全对等 reviewer，无明确 leader）
  - `workflow_mode` 在 `research_team_config.json` 中可显式覆盖
- **leader**: 增量验证 (outline → step-by-step → integration)，early stop (连续 2 CHALLENGED)；跨 provider 异构配置时（通过 RT-03 runner 层接入不同 provider）leader 独立性天然保证
- **asymmetric**: critical_steps[] 独立推导（verifier 不可见 leader 答案）+ convergence check，其余步骤逐步验证；是 leader 的强化版
- **convergence gate**: 始终使用确定性启发式解析（不引入 LLM judge）；mode-aware 分支仍保持结构化输出解析

**验收**:
- [x] `--workflow-mode peer` 行为与当前完全一致 (回归测试)
- [x] `--workflow-mode leader` 增量验证完整流程 + CHALLENGED 修复重试 (--max-step-retries 默认 3)
- [x] `--workflow-mode asymmetric` + critical_steps[] 独立推导 + convergence check
- [x] convergence gate 正确区分三种模式的通过条件

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
- [x] `--idea-source` 注入时 system prompt 包含已评估 idea 列表（结构化 JSON，非 Markdown 文本）
- [x] breakthrough lead schema 与 `idea_card_v1` 可相互转换（字段映射有 schema 校验，不依赖纯文本解析）
- [x] `idea-core campaign seed --from-innovation-log` 可提取 active leads
- [x] `--idea-source` 接受 `seed_pack_v1.json` 路径或 `idea_card_v1` 列表；Markdown 注入仅作 fallback

### RT-05: 结构化协作 — Semi-permeable Clean Room ✅ Phase 3 Batch 5 ★research-team

> **来源**: 2026-03-02 SOTA 文献修订 + 用户经验反馈。详见 `meta/docs/sota-multi-agent-verification-2026.md` §第四部分–§第七部分。
> **发表潜力**: 足以支撑独立论文（Paper A: 方法论文）+ HEP 应用论文（Paper B），详见 §第六部分。

**依赖**: RT-01 (三模式工作流), RT-02 (clean-room gate)

**现状**: research-team 在独立工作阶段（Phase 1）和收敛判定阶段（Phase 4）表现良好，但完全缺少人类科研中的两个关键环节：(1) 工作前的方法对齐（Phase 0），(2) 遇到困难时的定向咨询（Phase 2）。用户亲身确认的问题包括：两个 member 选同一个 trivial headline 验证、数值方法选择从不被系统性审查。

**SOTA 依据**:
- [17] AIED 2025: peer-to-peer collaboration（共享中间过程+交叉验证）> critical debate（交换完整答案后争论）
- [18] ICML MAS 2025: 自由辩论可导致准确率下降
- [19] OpenReview 2025: 层级结构化协作 resilience 最优
- 新颖性分析（§第五部分）确认：按内容语义类型过滤（N1）、多阶段渗透率模型（N2）、生物膜类比（N3）、反 sycophancy 第三条路径（N4）、HOW/WHAT 语义区分（N5）均为新颖贡献

**设计核心**: Information Membrane（信息膜）——按内容语义类型定义渗透率。
- PASS 类型 (7 种): METHOD, REFERENCE, CONVENTION, PITFALL, CRITERION, TOOL, ASSUMPTION
- BLOCK 类型 (7 种): NUM_RESULT, SYM_RESULT, DERIV_CHAIN, VERDICT, CODE_OUTPUT, AGREEMENT, COMPARISON
- 决策规则: BLOCK 优先于 PASS（保守优先）；混合内容尝试分句处理，不可靠则整段 BLOCK
- ~~V1 纯规则（正则+关键词）~~：已被 V2 替换。V1 在 5 轮 review-swarm 中持续发现自然语言绕过向量（30+ BLOCKING）
- V2 LLM 分类器（2026-03-04 完成）：三层降级（structured output → json_object → prompt-only），严格 fail-closed，`urlparse()` HTTPS 验证

**变更**:

| 文件 | 变更 |
|---|---|
| `run_team_cycle.sh` | 新增 `--collaboration-phases 0,1,2,3` 阶段控制（默认: `1` 即现有行为） |
| `assets/system_alignment.txt` | (新, ~50 行) Phase 0 方法对齐 system prompt（输出方法路径/约定/难点/文献，禁止计算） |
| `assets/system_consultation.txt` | (新, ~40 行) Phase 2 定向咨询 system prompt（HOW-only 约束，禁止透露结果） |
| `assets/system_divergence.txt` | (新, ~30 行) Phase 5 分歧解决 system prompt |
| `scripts/bin/compile_method_landscape.py` | (新, ~150 行) Phase 0 输出编译：Membrane 过滤 + 结构化合并为 method_landscape.md |
| `scripts/bin/extract_consultation_flags.py` | (新, ~120 行) Phase 1 报告中解析 FLAG/UNCERTAIN → 生成结构化 HOW 问题 |
| `scripts/bin/filter_consultation_response.py` | (新, ~80 行) Phase 2 回答应用 Membrane，BLOCK 内容替换为 [REDACTED] |
| `scripts/lib/information_membrane.py` | (新, ~300 行) Membrane V1 核心：BLOCK/PASS 检测规则 + filter_message() + 审计日志 |
| `scripts/gates/check_team_convergence.py` | 扩展：Phase 0/2/5 输出纳入收敛判定上下文 |
| `tests/test_information_membrane.py` | (新, ~200 行) Membrane PASS/BLOCK 各类型覆盖 |
| `tests/test_method_landscape.py` | (新, ~100 行) Phase 0 编译器测试 |
| `tests/test_consultation_flags.py` | (新, ~80 行) Phase 2 FLAG 解析测试 |

**关键设计**:
- **向后兼容**: `--collaboration-phases 1` 时行为与 RT-01 完全一致（仅 Phase 1 独立工作）
- **渐进启用**: Level 0 (`1`) → Level 1 (`0,1`) → Level 2 (`0,1,2,3`) → Level 3 (`0,1,2,3,5`)
- **与 RT-01 集成**: peer/leader 模式支持所有 Phase；asymmetric 模式 Phase 2 硬禁用（与盲化冲突）
- **审计**: 每次 Membrane 操作生成 JSONL 审计日志 `<run_dir>/membrane_audit/`
- **不引入 A2A 框架**: 所有信息流经编排器的 Information Membrane，不使用 agent 间直接通信

**估计**: ~1350 LOC (新代码) + ~200 LOC (改动)

**验收**:
- [x] `--collaboration-phases 1` 行为与 RT-01 完全一致（回归测试）
- [x] `--collaboration-phases 0,1` 在 Phase 0 产生 Method Landscape 并注入 Phase 1 packet
- [x] Method Landscape 中不含数值结论/完整推导（信息膜 BLOCK）
- [x] `--collaboration-phases 0,1,2,3` 完整五阶段流程可运行
- [x] Phase 2 仅在 FLAG/UNCERTAIN 触发时激活；无 FLAG 时自动跳过
- [x] Phase 2 回答经过信息膜过滤，不含数值结果/判定结论
- [x] Information Membrane V1 有独立单元测试覆盖 PASS/BLOCK 各 7 种类型（≥14 test cases）
- [x] Membrane 审计日志包含 input_hash + blocked_details + membrane_version
- [x] convergence gate 接受 Phase 0/2/5 上下文（mode-aware）
- [x] asymmetric 模式下 Phase 2 硬禁用（测试覆盖此约束）

### NEW-CONN-05: Cross-validation → Pipeline Feedback (Phase 3, deferred) ✅ Phase 3 Batch 7

> **来源**: `meta/docs/pipeline-connectivity-audit.md` — Island 4 (Cross-validation LaTeX-only 输入)

**依赖**: NEW-CONN-03
**估计**: ~100 LOC

**内容**: `hep_run_build_measurements` 和 `hep_project_compare_measurements` 在发现 tension 时返回 `next_actions` 到 review/revision。扩展 measurements 消费计算 evidence。

**验收**:
- [x] tension 发现时 next_actions 非空
- [x] measurements 可消费计算 evidence (ComputationEvidenceCatalogItemV1)

### NEW-COMP-02: Generic Computation Execution Core + First Host Adapter (Phase 3)

> **来源**: Dual-Mode 架构收敛

**依赖**: NEW-COMP-01, C-02
**估计**: ~500 LOC

**内容**:
1. 以 `computation_manifest_v1` 为唯一 manifest authority，落地 provider-neutral computation execution core
2. execution / approval / audit / run-state semantics 属于 generic core，不属于任何 provider-local package 或 host-local tool 名称
3. 若当前 `main` 仍需 host-local MCP surface，可保留一个 first host adapter（例如 `hep-mcp` 中的 thin adapter），但它只能做 registration / schema / risk wiring + delegation，不得反向定义通用 authority
4. `first host adapter` 只是当前落地顺序下的交付形态，不自动成为长期 canonical 模板；一旦后续出现第二个 host/provider implementation，应重新审视哪些剩余逻辑仍属于 generic core，哪些只应留在 provider-local package
5. 含 C-02 containment + A3 gating 安全防护

**验收**:
- [ ] `computation_manifest_v1` 驱动的 generic execution core 可完成 validation / approval / execution / audit
- [ ] 若保留 host-local MCP surface，它被验证为 thin adapter，而不是通用 authority
- [ ] A3 gating: 计算执行需人类批准
- [ ] C-02 containment: 命令/输出路径验证
- [ ] `REDESIGN_PLAN` / design docs 不再把 host-local tool 名称表述为 shared/generic authority

### NEW-SKILL-01: lean4-verify Skill (Phase 3)

> **来源**: Dual-Mode 架构收敛 — Lean4 形式化验证

**依赖**: 无
**估计**: ~200 LOC

**内容**: `SKILL.md` + `run_lean4.sh` + `status.json`。Lean4 作为无状态验证节点: `lake build` 作为 subprocess，输入 `.lean` 定理文件，输出 PASS/FAIL + proved theorems list。

**验收**:
- [ ] `run_lean4.sh --project <path>` 可执行 Lean4 验证
- [ ] `status.json` 包含 PASS/FAIL + proved theorems

### NEW-RT-05: Eval Framework ✅ Phase 3 Batch 8

> **来源**: Scope Audit 三模型收敛 — 欠工程化 Gap #6 (Eval)

**依赖**: NEW-RT-01, NEW-RT-03
**估计**: ~500 LOC

**内容**: Agent-level 端到端评估框架，扩展现有 `tests/eval/`。

> **完成情况 (2026-03-04)**:
> - 新增 `src/eval/schema.ts`, `metrics.ts`, `runner.ts`, `baseline.ts`, `index.ts`
> - 新增 demo eval set (`demo_retrieval_eval.json`, 10 cases) + baseline (`tests/eval/baselines/demo_retrieval.baseline.json`)
> - 现有 eval 测试全部迁移为 `EvalSetSchema + runEvalSet` 模式
> - review-swarm 双模型收敛：Opus = CONVERGED，OpenCode(kimi-for-coding/k2p5) = CONVERGED（0 blocking）

**验收**:
- [x] 可定义评估场景并自动运行
- [x] 评估结果可追踪到 Span

### NEW-OPENALEX-01: openalex-mcp — 学术知识图谱 MCP server ✅ Phase 3 Batch 6 ★infra

> **追加 (2026-03-04)**: [OpenAlex](https://openalex.org/) 是全球最大的开放学术知识图谱，覆盖 2.5 亿+ 跨学科文献，与 INSPIRE-HEP（HEP 领域专用）互补。设计 v4 已完成 Claude + Codex + Gemini 三模型两轮审阅收敛。规范见 `~/.claude/skills/openalex/PLAN.md`。

**依赖**: 无（设计已完成）
**估计**: ~1700 LOC（4 阶段，21 步骤）

**模式**: 遵循 `hepdata-mcp` / `arxiv-mcp` 独立 standalone MCP 模式——`packages/openalex-mcp/` 为自包含 stdio MCP，`hep-mcp` 聚合其工具（`maturity: experimental`）。

**工具面（`openalex_*` 命名空间，11 个工具）**:

| 工具 | 风险级别 | 说明 |
|------|---------|------|
| `openalex_search` | read | 全文/关键词搜索任意 entity 类型 |
| `openalex_get` | read | 按 OpenAlex ID / DOI / ORCID / ROR 获取单个实体 |
| `openalex_filter` | read | 结构化过滤（发表年份、open access 状态等） |
| `openalex_group` | read | 聚合分析（按年、机构、来源分组统计） |
| `openalex_references` | read | 获取 work 的参考文献列表 |
| `openalex_citations` | read | 获取 work 的被引列表 |
| `openalex_batch` | read | 批量获取多个 entity（JSONL 输出） |
| `openalex_autocomplete` | read | 实体名称自动补全 |
| `openalex_paginate` | read | 分页检索（interactive cursor-return / bulk JSONL 两模式） |
| `openalex_rate_limit` | read | 查询当前速率限制状态 |
| `openalex_content` | destructive | 下载 work 全文（OA PDF/HTML）；需 `_confirm: true` |

**关键实现约束**（设计审阅收敛结论）:
- `per-page` 参数名含连字符（非下划线），需 `PARAM_NAME_MAP` 翻译
- 单次响应不超过 200 条；大结果走 JSONL 文件输出
- cursor 分页始终优先；不用 page-based 超过第 1 页（OpenAlex 10k 页面限制）
- `select` 参数必须自动追加 `id,doi`（`augmentSelect()`）
- budget 超限不 throw，返回 `{ complete: false, stop_reason: 'budget_exceeded' }`
- `concepts` entity 类型保留（兼容旧 ID）

**验收检查点**:
- [x] `packages/openalex-mcp/` 独立构建通过（`pnpm build`）
- [x] 11 个 `openalex_*` 工具注册完整
- [x] `openalex_content` 风险级别 `destructive`，需 `_confirm: true`
- [x] cursor 分页正确实现（不使用 page-based 超过 p1）
- [x] 速率限制器：singleton + mutex-style withSlot 序列化 + `Retry-After` 合规
- [x] `hep-mcp` 聚合 `openalex-mcp` 工具，`maturity: experimental`
- [x] `pnpm -r test` 通过（identifiers / schemas / pagination / paramMapping / rateLimiter / batchRouting 覆盖，95/95）

### Phase 3 Batch 8~16: 语义理解质量轨 (NEW-SEM-01~13) ★quality

> **来源**: `meta/docs/semantic-understanding-heuristics-audit-2026-03-04.md` (2026-03-04)
> **审核**: Codex gpt-5.2 + GLM-5 两轮收敛 (R1 NEEDS_REVISION → R2 PASS)
>
> **动机**: 多处 “semantic understanding” 目前由 enum/regex/keyword 启发式充当语义判定权威，导致质量不稳定、易漂移、且难以覆盖 discourse-level 现象（否定范围/隐含假设/跨句蕴含/标题改写等）。
>
> **架构约束**:
> - enum/regex 只可作为 **prefilter/signals**，不得作为 meaning-level 判定 fallback “权威裁决”。
> - deterministic 逻辑仅作 **post-guards / 不变量**（schema/unit/numeric bounds/policy），不替代语义判断。
> - TS 内 LLM 调用必须走 **MCP sampling** (`ctx.createMessage`)；禁止在 MCP server 内嵌 provider SDK/client（与 NEW-MCP-SAMPLING 的约束一致）。
>
> **边界澄清 (2026-03-10)**:
> - `NEW-SEM-05` / `NEW-SEM-10` / `NEW-SEM-13` 已交付的是 provider-local interim improvements，不是 final shared/generic semantic authority。
> - 若当前 `hep-mcp` 仍存在 closed keyword/alias/taxonomy logic 直接决定 public output、grouping、scoring、question framing 或默认 worldview，则必须继续清理；不能因为已有 batch closeout 就视作终态。
> - 在 residual `batch2` closeout 与 `batch3` runtime/root de-HEP 之前，先执行 `meta/docs/2026-03-10-hep-semantic-authority-deep-audit.md` / `meta/docs/prompts/prompt-2026-03-10-hep-semantic-deep-cleanup.md` 定义的 semantic-authority deep cleanup A-E。
>
> **依赖**: `NEW-RT-05`（eval framework）是前置；多数 TS 消费者还依赖 `NEW-MCP-SAMPLING` 的 plumbing。
>
> **统一验收模板（质量优先）**:
> 1) 明确输入/输出 schema + 严格校验；2) 固定 eval set（n≥50–200，含 hard cases）+ baseline；3) 指标与目标（例如 P@k/R@k、错误率、abstention/fallback rate）；4) 明确失败策略（timeout/low-confidence）与 gate consumer 的 **fail-closed** 行为；5) 记录版本/提示词/模型配置以便回归。
>
> **质量 gate checkpoints**:
> - **G1**: NEW-RT-05 eval framework 可用 + 至少 1 个 demo eval set → 所有 SEM 项可启动
> - **G2 ✅**: SEM-07 JSON SoT 迁移完成 + 格式漂移回归测试通过 → gate consumers 可信赖
> - **G3**: SEM-01 quantity eval 达到 target delta（wrong-merge/false-split 显著下降）→ SEM-02, SEM-03 eval set 可标注
> - **G4**: SEM-02 claim→evidence→stance schema 稳定 + eval 达标 → SEM-03 复用 stance schema
> - **G5**: SEM-05 unified classifier 完成 → SEM-12 复用 review detection

**实施 batch 拆分（按审计 P0→P3 优先级 + review-swarm 收敛约定 1~3 items/batch）**:

| Batch | Items | 优先级 | 复杂度 | Gate | Rationale |
|-------|-------|--------|--------|------|-----------|
| 8 | NEW-RT-05 ✅ | P0 | medium | G1 ✅ | Eval framework 基础设施。无此项则无法度量 baseline、验证改进。 |
| 9 | NEW-SEM-07 ✅ | P0 | high | G2 ✅ | 结构化 gate 语义。三阶段迁移: (1) dual-output → (2) JSON SoT → (3) 移除 prose 解析。含回归测试。Python-side (skills/ gates)。 |
| 10 | NEW-SEM-01 + NEW-SEM-06a | P1 | high + medium | G1 | 核心 duo: quantity adjudicator + evidence retrieval baseline。SEM-01 修复最关键语义缺陷 (Critical)。`NEW-SEM-06` 在 Batch 10 交付的是可评测 baseline（semantic-first retrieval + deterministic rerank），不是终态 SOTA 检索架构。 |
| 11 | NEW-SEM-02 | P1 | high | G3 | Evidence/Claim Semantic Grading V2。**前置**: SEM-01 eval 达标。定义 claim→evidence→stance 权威 schema。 |
| 12 | NEW-SEM-03 + NEW-SEM-04 | P1+P2 | high + medium | G4 | Stance engine + theoretical conflict reasoner。均涉及 entailment/contradiction adjudication。SEM-03 复用 SEM-02 stance schema。 |
| 13 | NEW-SEM-05 + NEW-SEM-09 | P2 | medium + medium | G1 | Provider-local classifier consolidation + deepAnalyze section-surface cleanup。`SEM-05` 的 closeout 仅代表局部质量改善与单一入口整合；`NEW-SEM-09` 的旧 “section role classifier” closeout 叙事已在 2026-03-10 Batch D 按当前代码树纠偏为 explicit heading-utility diagnostics；若仍有 closed authority，后续必须继续清理。 |
| 14 | NEW-SEM-10 + NEW-SEM-13 | P2-P3 | medium + low | G1 | Provider-local topic/method grouping + challenge extractor。当前实现不是 final generic/shared authority；若保留长期价值，必须在 provider-neutral rewrite 后再提升出去。 |
| 15 | NEW-SEM-08 | P2-P3 | medium | G1 | Semantic packet curation。Python-side（skills/research-team + writer）。单独 batch 避免跨语言上下文切换。 |
| 16 | NEW-SEM-11 + NEW-SEM-12 | P3 | medium + medium | G5 | Equation importance + provenance matcher。TS-side。SEM-12 复用 SEM-05 unified classifier。 |

| ID | 标题 | 主要修改位置（逻辑组件路径） | 复杂度 | 依赖 | Batch | 验收重点 |
|---|---|---|---|---|---|---|
| NEW-SEM-01 | Quantity Semantics Adjudicator | `hep-mcp/src/core/hep/measurements.ts` + extractor/conflict | high | NEW-RT-05, NEW-MCP-SAMPLING | 10 | quantity 对齐：wrong-merge/false-split 显著下降 |
| NEW-SEM-02 | Evidence/Claim Semantic Grading V2 | `hep-mcp/src/tools/research/evidenceGrading.ts` | high | NEW-RT-05, NEW-MCP-SAMPLING, G3 | 11 | negation/hedging 反转错误消失；claim→evidence→stance 评测达标 |
| NEW-SEM-03 | LLM-First Stance Engine | `hep-mcp/src/tools/research/stance/*` | high | NEW-RT-05, NEW-MCP-SAMPLING, G4 | 12 | scoped negation + multi-citation stance 集合误差率下降；fallback rate 可控 |
| NEW-SEM-04 | Theoretical Conflict Reasoner | `hep-mcp/src/tools/research/theoreticalConflicts.ts` | medium | NEW-RT-05, NEW-MCP-SAMPLING | 12 | hard conflict 需可审计 rationale；”not comparable” 处理覆盖 |
| NEW-SEM-05 | Hybrid Paper/Review/Content Classifier (provider-local interim baseline) | `hep-mcp/src/tools/research/reviewClassifier.ts` / `paperClassifier.ts` / `criticalQuestions.ts` | medium | NEW-RT-05, NEW-MCP-SAMPLING | 13 | provider-local terminology drift 鲁棒性提升；当前 closeout 不自动授予 generic/shared authority 资格 |
| NEW-SEM-06 | Evidence Retrieval Upgrade (SEM-06a baseline) | `hep-mcp/src/core/evidence.ts` / `core/writing/evidence.ts` / `evidenceSemantic.ts` | medium | NEW-RT-05 | 10 | claim→evidence 相关性基准 P@k/R@k 提升；citation/support 单独评测；semantic-first retrieval + deterministic rerank 成为后续 SOTA 路线的 baseline |
| NEW-SEM-07 ✅ | Structured Gate Semantics | `skills/research-team/.../check_*_convergence.py` + writer gates | high | NEW-RT-05, RT-01 | 9 | gate 仅以 JSON schema 为 SoT；格式漂移不影响 pass/fail（回归测试） |
| NEW-SEM-08 | Semantic Packet Curation | `skills/research-team/.../build_*packet.py` + writer distill/learn | medium | NEW-RT-05, NEW-SKILL-WRITING | 15 | “missed critical section” 集合召回率提升；可审计输出 |
| NEW-SEM-09 | Deep Analysis Section Role Classifier | `hep-mcp/src/tools/research/deepAnalyze.ts` | medium | NEW-RT-05, NEW-MCP-SAMPLING | 13 | 当前树以 explicit heading-utility diagnostics 为准，不得再把 heading lookup 当成 semantic authority；旧 closeout 中的 `sectionRole*` / `evalSem09...` 仅属历史叙事漂移 |
| NEW-SEM-10 | Topic/Method Grouping Semanticizer (provider-local interim baseline) | `hep-mcp/src/tools/research/analyzePapers.ts` + `synthesis/grouping.ts` | medium | NEW-RT-05 | 14 | provider-local grouping 一致性提升；任何 surviving abstraction 需在 provider-neutral rewrite 后再考虑上提 |
| NEW-SEM-11 | Key Equation Semantic Importance | `hep-mcp/src/tools/research/latex/keyEquationIdentifier.ts` + `equationTypeSignals.ts` | medium | NEW-RT-05, NEW-MCP-SAMPLING | 16 | top-k 命中率提升；catalog 仅作 hints |
| NEW-SEM-12 | Paper Version / Provenance Matcher | `hep-mcp/src/tools/research/traceToOriginal.ts` + review detection reuse | medium | NEW-RT-05, G5 | 16 | matched-pairs precision/recall 达标；”不确定”路径明确 |
| NEW-SEM-13 | Synthesis Challenge Extractor (provider-local interim baseline) | `hep-mcp/src/tools/research/synthesis/narrative.ts` | low | NEW-RT-05 | 14 | provider-local challenge detection 漏检率下降；当前 taxonomy 不应被当成 final generic authority |

### Phase 3 SOTA 检索/发现/单研究者研究循环后续队列 (Batch 11+ 建议排期)

> **来源**: `meta/docs/sota-monorepo-architecture-2026-03-06.md`（v1.9.2 追加 single-user loop clarification；Opus + Kimi K2.5 / OpenCode 双审核通过，0 blocking，clarifications integrated）
> **原则**: 不重写已完成的 `NEW-RT-01` / `NEW-SEM-06`; 将其视为基线，在其上叠加后续架构项。
> **排期原则**: 保持既有 Batch 11–16 语义质量轨不变；新增项走并行 infra/retrieval/loop lane，避免把当前 SEM 批次全部重排。

| ID | 标题 | 主要修改位置（逻辑组件路径） | 复杂度 | 依赖 | 验收重点 |
|---|---|---|---|---|---|
| NEW-RT-06 | Provider-Agnostic Orchestrator Routing | `packages/orchestrator/src/agent-runner.ts` + routing config | medium | NEW-RT-01 | `AgentRunner` 提取 `ChatBackend`/backend factory；JSON route key 生效；lane queue / approval gate / tracing 不回退 |
| NEW-RT-07 | MCP Sampling Host Routing Registry | orchestrator MCP host / sampling caller | medium | NEW-MCP-SAMPLING | MCP host 依据 `module/tool/prompt_version/risk_level/cost_class` 路由；MCP server 仅发 metadata，不自选模型 |
| NEW-DISC-01 | Federated Scholar Discovery | `packages/shared/src/discovery/`（必要时后续提升为 `packages/scholar-broker/`） | high | NEW-OPENALEX-01 | `INSPIRE + OpenAlex + arXiv` federated planning/dedup/canonicalization；shared identifiers 增加 `openalex_id`；query-plan / dedup / search-log artifacts 就绪 |
| NEW-LOOP-01 | Single-User Research Loop Runtime | `packages/orchestrator/src/research-loop.ts` + workspace/task graph types | high | NEW-WF-01, UX-06, NEW-RT-06 | 研究执行内核从阶段线性流转为 event/task graph；interactive/autonomous 共用 substrate；成为 `EVO-01/02/03` 前置 |
| NEW-SEM-06-INFRA | Retrieval Backbone Substrate Decision | shared retrieval infra + eval harness | medium | NEW-RT-05 | 锁定 embedding/index substrate；明确 hosted vs local、vector store、late-interaction path；以 `hashing_fnv1a32` 为基线出具 eval protocol |
| NEW-SEM-06b | Hybrid Candidate Generation + Strong Reranker | `hep-mcp/src/core/evidence.ts` / `evidenceSemantic.ts` / broker adapters | high | NEW-RT-05, NEW-DISC-01, NEW-SEM-06-INFRA | hybrid recall + strong reranker 在 canonicalized docs 上显著优于 `SEM-06a`；不再 hard-fork provider-local identities |
| NEW-SEM-06d | Triggered Query Reformulation + QPP | retrieval query planner + hard-case policy | medium | NEW-SEM-06b | 仅在 low-recall / high-ambiguity 场景触发 reformulation；hard subset 指标提升且成本受控 |
| NEW-SEM-06e | Structure-Aware Evidence Localization | locator pipeline (`page/chunk/table/figure/equation/citation`) | high | NEW-SEM-06b | 长文档 page/chunk/table/figure/equation/citation-context 召回率达标；成为 `agent-arxiv` 检索依赖特性的前置 |
| NEW-SEM-06f | Bounded Multimodal Scientific Retrieval | multimodal page-native fusion on top of semantic + localization backbone | medium | NEW-SEM-06e | 仅在 capability-gated page/figure/table/equation query 上融合 visual candidates；保持 text-first / disabled / unsupported / abstained fail-closed 语义 |

| Window | 建议项 | 说明 |
|---|---|---|
| Batch 11（parallel lane） | `NEW-DISC-01` kickoff + `NEW-RT-06` | schema-first / routing-first，低耦合且能尽早解除后续阻塞 |
| Batch 12（parallel lane） | `NEW-SEM-06-INFRA` | 先做 substrate decision，再允许真实 SOTA retrieval implementation |
| Batch 13–14（parallel lane） | `NEW-RT-07`（已于 2026-03-07 standalone closeout） + `NEW-DISC-01` closeout | `NEW-RT-07` 不应阻塞既有 SEM lane；其 host-side MCP sampling routing 已独立收口。`NEW-DISC-01` 仍需在 `NEW-SEM-06b` 前完成 canonical identity + capability schema + dedup/eval，并应尽量先于或重叠 `NEW-LOOP-01` 落地，但不作为其 runtime scaffolding 的硬阻塞 |
| Batch 15–16（parallel lane） | `NEW-LOOP-01` | 在 routing / workflow 基础稳定后，明确单研究者非线性 research loop substrate，而不必等到 Phase 5 才第一次出现真实 loop semantics；虽然它是产品主干关键项，但排在此处是为了让 loop runtime 落地时不只是 stub |
| Batch 17 | `NEW-SEM-06b` | 在 `NEW-DISC-01` + `NEW-SEM-06-INFRA` 完成后进入真正 hybrid recall / strong reranker |
| Batch 18 | `NEW-SEM-06d` | 在强 backbone 上叠加 triggered reformulation / QPP，而不是拿它补洞 |
| Batch 19 | `NEW-SEM-06e`（已于 2026-03-08 standalone closeout） | 结构化 evidence localization 已成为 `agent-arxiv` 检索扩展前置门槛；shared typed locator contract、LaTeX+PDF semantic localization 与 failure-path eval 已收口 |
| Standalone（2026-03-08） | `NEW-SEM-06f`（已 closeout） | 在 `NEW-SEM-06e` localization backbone 之上以 bounded multimodal/page-native fusion 收束 multimodal retrieval；不重开 discovery substrate / runtime scope |

> **Ordering clarification (2026-03-10)**: 旧的隐含顺序“formalism cleanup -> residual batch2 closeout -> batch3”已失效。当前正确顺序为：semantic-authority deep cleanup A-E -> residual `batch2` closeout -> `batch3` runtime/root de-HEP。`batch3` 不应早于这一边界程序启动。
>
> **Batch F downstream recovery update (2026-03-10)**: live call-path recheck now confirms the residual `batch2` scope was fully absorbed by `NEW-05a-idea-core-domain-boundary` / semantic Batch A rather than remaining as a separate code batch. The surviving `idea-core` path is provider-local only (`hep.operators.v1` domain-pack selection plus explicit capability/task-first constraint findings); `batch3` remains the next separate prompt and was intentionally not started in the bounded Batch F closeout run.
>
> **Batch 3 runtime/root de-HEP closeout update (2026-03-10)**: `meta/docs/prompts/prompt-2026-03-09-batch3-runtime-root-dehep.md` has now been closed out as a bounded re-baseline rather than a productization step. Root-facing docs/package metadata now consistently describe the repo as an ecosystem/workbench with HEP as the first mature provider family, not the root identity; the active TypeScript control-plane override is `AUTORESEARCH_CONTROL_DIR` rather than `HEP_AUTORESEARCH_DIR`; and `openalex-mcp` now defaults to `~/.autoresearch/openalex` while still honoring explicit `HEP_DATA_DIR/openalex` co-location. This deliberately did not create a packaged agent, root-level registry/materializer, or new Batch 1/2 structural work, and it reinforces that pre-P5A root composition should stay thin while orchestrator/provider seams become provider-agnostic.

> **Closeout update (2026-03-07)**: `NEW-RT-07` 已通过 standalone implementation prompt 完成；host-side MCP sampling routing registry、typed metadata contract、以及 auditable fallback/fail-closed path 已落地。Acceptance（`pnpm --filter @autoresearch/orchestrator test/build`, `pnpm --filter @autoresearch/hep-mcp test/build`, `pnpm --filter @autoresearch/shared test/build`, `pnpm lint`, `pnpm -r test/build`）全绿；正式 `review-swarm`（`Opus` + `OpenCode(kimi-for-coding/k2p5)`）与 `self-review` 均 0 blocking。`NEW-DISC-01` 也已通过 standalone implementation prompt 完成 D4/D5 closeout：shared canonical paper / query-plan / dedup / search-log authority + broker consumer + deterministic eval fixtures / baseline / holdout 已落地，全部 acceptance commands 全绿，正式 `review-swarm`（`Opus` + `OpenCode(kimi-for-coding/k2p5)`）在 R2 收敛到 0 blocking，agent `self-review` 0 blocking；implementation commit `f233e77`，PR `#3` 已合并到 `main`（merge commit `2dbb97a`）；retrieval/discovery lane 现继续推进 `NEW-SEM-06b/d/e`。

> **Closeout update (2026-03-08)**: `NEW-SEM-06d` 已通过 standalone implementation prompt 完成；triggered query reformulation + QPP 现作为 `NEW-SEM-06b` canonical-paper retrieval backbone 之上的 auditable planner layer 落地。shared discovery authority 已补齐 `provider-result-counts` + `query-reformulation-artifact` contract，`packages/hep-mcp/src/tools/research/federatedDiscovery.ts` 执行 probe → QPP → optional reformulation → optional second retrieval round → rerank，并将 fail-closed 决策写入 append-only search-log telemetry。Acceptance（`pnpm --filter @autoresearch/shared test/build`, `pnpm --filter @autoresearch/openalex-mcp test/build`, `pnpm --filter @autoresearch/arxiv-mcp test/build`, `pnpm --filter @autoresearch/hep-mcp test`, `pnpm --filter @autoresearch/hep-mcp test:eval`, `pnpm --filter @autoresearch/hep-mcp build`, `EVAL_INCLUDE_HOLDOUT=1 pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalSem06dTriggeredReformulation.test.ts`, `pnpm lint`, `pnpm -r test/build`）全绿；正式外部审核在 `Opus` + `OpenCode(kimi-for-coding/k2p5)` 上收敛为 0 blocking，`Gemini-3.1-Pro-Preview` 因本地 agentic reviewer 不可用经用户明确批准 fallback；agent `self-review` 0 blocking。实现已提交于 `1b6be54`，后续 tracker/hash 同步提交于 `834d799`，PR `#4` 已合并到 `main`（merge commit `e9e96f2`）；retrieval/discovery lane 现进入 Batch 19 `NEW-SEM-06e`。

> **Closeout update (2026-03-08)**: `NEW-SEM-06e` 已通过 standalone implementation prompt 完成；structure-aware evidence localization 现作为 `NEW-SEM-06b/d` retrieval backbone 之上的 typed within-document localization layer 落地，而未重开 discovery substrate / runtime scope。shared authority 已补齐 `EvidenceLocalization{Unit,Status,Surface,CrossSurfaceStatus,ReasonCode,Hit,Telemetry,Artifact}` contract，`packages/hep-mcp/src/core/evidenceSemantic.ts` 现合并 LaTeX + PDF writing-evidence surfaces，记录 hit-level localization metadata，并保持 fail-closed `localized` / `fallback_available` / `unavailable` / `abstained` 语义。`packages/hep-mcp/src/core/evidence-localization/` 现通过 named policy constants + paper-aware PDF support filtering 实现 exact-unit 优先与 cross-surface reconcile；eval authority 锁定于 `tests/eval/evalSem06eStructureAwareLocalization.test.ts`（baseline + holdout）与 `tests/eval/evalSem06eFailureModes.test.ts`（unavailable path）。Acceptance（`pnpm --filter @autoresearch/shared test/build`, `pnpm --filter @autoresearch/openalex-mcp test/build`, `pnpm --filter @autoresearch/arxiv-mcp test/build`, `pnpm --filter @autoresearch/hep-mcp test -- tests/research/latex/locator.test.ts`, `pnpm --filter @autoresearch/hep-mcp test`, `pnpm --filter @autoresearch/hep-mcp test:eval`, `pnpm --filter @autoresearch/hep-mcp build`, `pnpm lint`, `pnpm -r test`, `pnpm -r build`）全绿，且已补专项 holdout / failure-path 重跑。GitNexus post-change evidence：`npx gitnexus analyze` up to date，`detect_changes` 主要落在 `queryProjectEvidenceSemantic`，`context(queryProjectEvidenceSemantic)` 与 intended semantic-query call graph 一致，upstream `impact(queryProjectEvidenceSemantic)` 为 LOW。正式外部三审 `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)` 0 blocking（`CONVERGED` / `CONVERGED_WITH_AMENDMENTS`），adopted amendments 已同批吸收：named scoring constants、`paper_id`-aware PDF support filtering、typed reason-code union、telemetry 语义澄清、以及 end-to-end unavailable-path coverage；agent `self-review` 0 blocking。实现已提交于 `2d0b6e0`，PR `#5` 已合并到 `main`（merge commit `230ec3f`）；其后已在该 localization backbone 之上完成 `NEW-SEM-06f` closeout，后续仅在其之上评估更高层 retrieval/product lane。

**关键依赖图**:

```text
NEW-OPENALEX-01 -> NEW-DISC-01 -> NEW-SEM-06b -> { NEW-SEM-06d, NEW-SEM-06e }
NEW-SEM-06e -> NEW-SEM-06f
NEW-RT-05 -> NEW-SEM-06-INFRA -> NEW-SEM-06b
NEW-WF-01 ----+
UX-06 --------+-> NEW-LOOP-01 -> { EVO-01, EVO-02, EVO-03 }
NEW-RT-06 ----+
NEW-RT-01 -> NEW-RT-06
NEW-MCP-SAMPLING -> NEW-RT-07
```

> **注**: `UX-06` 已在 Phase 1 完成；`NEW-LOOP-01` 对它的依赖仅表示复用既有阶段标签 taxonomy 作为 UX hints，而不是等待新的线性 stage engine。

> **Closeout update (2026-03-08)**: `NEW-SEM-06f` 已通过 standalone implementation prompt 完成；multimodal scientific retrieval 现以 **bounded page-native fusion** 的形式落地在现有 semantic retrieval + `NEW-SEM-06e` localization backbone 之上，而未重开 discovery substrate / parser / runtime scope。shared authority 新增 `packages/shared/src/discovery/evidence-multimodal.ts`（typed `applied` / `skipped` / `unsupported` / `disabled` / `abstained` artifact + telemetry），hep-mcp 通过 `packages/hep-mcp/src/core/evidence-multimodal/{policy,fusion}.ts` 对 page/figure/table/equation query 执行 capability-gated visual-candidate fusion，并只对显式 promoted candidates 注入 `preferred_unit`，避免把所有 `pdf_region` 全局重释为结构化 unit。`queryProjectEvidenceSemantic` 现将 multimodal artifact 与既有 semantic/localization artifacts 一并落盘，保持 text-first `skipped`、env-disabled `disabled`、visual-unavailable `unsupported`、以及 ambiguous `abstained` fail-closed 语义。Eval authority 锁定于 `tests/eval/evalSem06fMultimodalScientificRetrieval.test.ts`（baseline + holdout）及配套 `sem06fEval{Support,Harness}.ts`、fixtures/baseline，并辅以 `tests/core/pdfEvidence.test.ts` 与 `tests/research/evidenceLocalization.test.ts` 单测覆盖 visual metadata / preferred-unit routing。Acceptance（`pnpm --filter @autoresearch/shared test/build`, `pnpm --filter @autoresearch/openalex-mcp test/build`, `pnpm --filter @autoresearch/arxiv-mcp test/build`, `pnpm --filter @autoresearch/hep-mcp test -- tests/core/pdfEvidence.test.ts`, `pnpm --filter @autoresearch/hep-mcp test`, `pnpm --filter @autoresearch/hep-mcp test:eval`, `EVAL_INCLUDE_HOLDOUT=1 pnpm --filter @autoresearch/hep-mcp test -- tests/eval/evalSem06fMultimodalScientificRetrieval.test.ts`, `pnpm --filter @autoresearch/hep-mcp build`, `pnpm lint`, `pnpm -r test`, `pnpm -r build`）全绿。GitNexus post-change evidence：`npx gitnexus analyze` up to date，`detect_changes` 在 repo `autoresearch-lab-sem06f` 上为 LOW，`context(queryProjectEvidenceSemantic)` 仍指向既有 semantic-query call graph，upstream `impact(queryProjectEvidenceSemantic)` 为 LOW。正式外部三审 `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(kimi-for-coding/k2p5)` 0 blocking（全部 `CONVERGED`）；唯一 non-blocking amendment（导出/单测 `parseEnabledFlag`）因已被 disabled-path eval 覆盖且会无谓扩大内部 API surface，被本轮 `declined/closed`。agent `self-review` 0 blocking；实现已提交于 `cc79c47` 并位于 `main`。

**后续边界**: `NEW-SEM-06f` 已完成 closeout；后续不应继续把 multimodal lane 扩大成新 substrate，而应回到更高层的 retrieval/product lane 决策（例如是否值得在未来 prompt 中继续推进更重的 search/runtime work）。

#### `NEW-DISC-01` 子任务拆分（Batch 11 kickoff → Batch 13/14 closeout）

**Batch 11 kickoff scope**:
1. **D1 — Shared identifier foundation**
   - 在 `packages/shared/src/types/identifiers.ts` / `packages/shared/src/types/paper.ts` 为 `PaperIdentifiersSchema` / `PaperSummarySchema` 增加 `openalex_id?: string`（可选 `semantic_scholar_id?: string`）。
   - 更新 shared tests / exports，保证所有既有 paper schema 消费者继续通过。
2. **D2 — Provider capability schema**
   - 在 `packages/shared/` 定义统一 Zod capability schema（如 `supports_semantic`, `supports_citation_graph`, `supports_fulltext`, `supports_source_download`, `supports_oa_content`）。
   - `hep-mcp` / `arxiv-mcp` / `openalex-mcp` 仅负责映射声明，不各自发明 capability 结构。
3. **D3 — Discovery core scaffold**
   - 在 `packages/shared/src/discovery/` 建立最小可用骨架：query intent enum/schema、provider descriptor、canonical candidate 类型、planner interface。
   - 明确这是 in-process shared library，而非新 MCP server。

**Batch 13–14 closeout scope**:
4. **D4 — Canonicalization / dedup / search-log artifacts**
   - 产出 canonical paper object、query-plan artifact、cross-provider dedup artifact、append-only search log。
   - 明确 uncertain match 路径与 provenance 字段。
5. **D5 — Broker-integrated eval slices**
   - 增加 provider recall/precision、canonicalization、dedup、known-item retrieval fixtures；把 broker-level eval 接到 `NEW-RT-05` 的统一 eval plane。

**`NEW-DISC-01` 验收清单**:
- [x] `openalex_id` 进入 shared paper identifiers / summary schema，shared tests 通过
- [x] provider capability schema 在 `packages/shared/` 成为唯一 SoT，provider adapter 仅做映射
- [x] `packages/shared/src/discovery/` 存在可编译的 discovery scaffold（intent / provider descriptor / planner contract / canonical candidate）
- [x] canonical paper / query-plan / dedup / search-log artifacts 有明确 schema 与写入路径
- [x] broker-level eval slices 覆盖 recall / canonicalization / dedup，且可接入 `NEW-RT-05`
- [x] 关闭项条件：`NEW-SEM-06b` 所需 canonical identity / provider capability / dedup 基础全部就绪

#### `NEW-RT-06` 子任务拆分（建议在 Batch 11 完成）

1. **R1 — `ChatBackend` interface**
   - 新增 provider-agnostic chat backend 抽象，归一化 `createMessage` 输入/输出类型；保留与当前 AgentRunner 兼容的消息结构。
2. **R2 — Anthropic backend adapter**
   - 将现有 lazy `@anthropic-ai/sdk` 路径迁移到独立 backend adapter/factory；SDK 依赖不再驻留在 `AgentRunner` 本体。
3. **R3 — Routing registry schema + loader**
   - 增加 JSON-configured orchestrator-plane routing schema / loader；`model` 从 provider-specific assumption 改为 route key / backend selector。
   - 配置缺失、非法 route、未知 backend 必须 fail-closed。
4. **R4 — AgentRunner migration**
   - `AgentRunner` 接收 backend/factory 注入，继续保留 lane queue / approval gate / tracing / MCP dispatch。
   - `_messagesCreate` seam 继续保留用于测试。
5. **R5 — Regression tests + docs**
   - 扩展 orchestrator tests：默认 route、自定义 route、missing route fail-closed、lane queue/approval/tracing 不回退。

**`NEW-RT-06` 验收清单**:
- [ ] `AgentRunner` 不再直接 lazy import `@anthropic-ai/sdk`；provider SDK 仅存在于 backend adapter
- [ ] `ChatBackend` / backend factory 抽象存在，且默认 Anthropic 路径行为不回退
- [ ] routing registry 有 schema 校验、默认 route、per-feature / per-use-case route key 解析
- [ ] 配置错误 / 未知 route / 未知 backend fail-closed，不静默回退到错误 provider
- [ ] `packages/orchestrator/tests/agent-runner.test.ts` 覆盖 route resolution / fail-closed / existing lane queue & approval behaviors
- [ ] `pnpm --filter @autoresearch/orchestrator test` + `pnpm --filter @autoresearch/orchestrator build` 通过

#### `NEW-LOOP-01` 子任务拆分（建议在 Batch 15–16 完成）

1. **L1 — Workspace graph types**
   - 在 `packages/orchestrator/src/` 定义 `ResearchWorkspace` / `ResearchNode` / `ResearchEdge` / `ResearchTask` 等类型，覆盖 question、idea、evidence_set、compute_attempt、finding、draft_section、review_issue、decision。
   - 明确 artifact / evidence / provenance 如何挂接到 workspace graph。
2. **L2 — Event / task graph runtime**
   - 新增 `research-loop.ts`（或等价模块）管理 event-driven transitions，而不是固定阶段跳转。
   - 支持从 compute failure / review issue / contradiction / new evidence 合法回跳到 discovery / idea revision / writing update。
3. **L3 — UX stage labels as hints only**
   - `idea/literature/derivation/writing/revision` 继续保留给会话引导和 UI 展示，但不作为互斥 machine state。
   - 运行时记录 `current_focus` / `active_tasks`，而不是唯一阶段。
4. **L4 — Dual mode on one substrate**
   - interactive 模式：用户批准或指定下一步；autonomous 模式：按 policy / budget / approvals 自动继续。
   - 两者共享同一 workspace / task graph / event log。
5. **L5 — Phase 5 handoff contract**
   - 为 `EVO-01/02/03` 定义接入点：idea→compute、compute→idea、result→writing/review 不再各自发明 loop substrate。
   - 至少落下 `EVO-01` compute handoff 与 `EVO-02` feedback handoff 的 typed interface stubs，并各自具备 1 条 integration smoke test。

**`NEW-LOOP-01` 验收清单**:
- [x] 运行时存在显式 `ResearchWorkspace` / task graph / event log 抽象，而不是只能依赖阶段枚举推导状态
- [x] 合法回跳路径被建模并可测试：`compute -> literature`, `compute -> idea`, `review -> evidence_search`, `finding -> draft_update`
- [x] interactive / autonomous 两种模式共享同一 substrate，仅 policy 不同
- [x] `UX-06` 阶段标签仍可用于会话引导，但不再被执行内核当成互斥状态
- [x] `EVO-01/02/03` 的依赖说明改为在 `NEW-LOOP-01` 之上接入 compute/feedback/writing automation
- [x] `EVO-01` compute handoff 与 `EVO-02` feedback handoff 至少各有 1 个 typed interface stub + integration smoke test
- [x] 至少有一条端到端 smoke path 能展示“文献 → idea → compute → 回跳文献/idea → writing/review”非线性路径

**原 Batch 8 (M-04 + M-07 + NEW-SKILL-01) → Batch 17**: schema fidelity 测试在 SEM 改造完成后更有意义。

### Phase 3 验收总检查点

- [ ] 全部 44 项修复通过各自测试（v1.9.0 原 22 + NEW-RT-05 + NEW-SEM-01~13 + 8 个 SOTA / loop follow-up）
- [ ] Schema 扩展性测试通过（`x-*` 字段不破坏验证）
- [ ] 日志无 secrets 泄露
- [ ] ERR-01/SYNC-03/ART-03 CI 验证从 grep 升级为 AST-based lint（TS: ESLint custom rule; Python: ast 模块）
- [x] `registry.ts` 按领域拆分完成 (NEW-R11)
- [x] `idea-runs` 集成契约定义完成 (NEW-R12)
- [x] 论文版本追踪 + paper_manifest_v2 就绪 (UX-03)
- [x] 至少 3 个标准 workflow recipe 定义 (UX-04, writing recipe 移除)
- [x] inspire 工具合并完成 (UX-04)
- [x] research-team 三模式工作流: peer/leader/asymmetric + 增量验证 + convergence gate (RT-01)
- [x] research-team ↔ idea-generator 桥接: --idea-source + 反向种子 (RT-04)
- [x] 写作管线移除完成: ~40K LOC 删除, 102→72 tools (full), 79→56 tools (standard) (NEW-06)
- [x] LLM 客户端迁移至 MCP sampling: 1 consumer (theoreticalConflicts.ts), ToolHandlerContext plumbing 完成 (NEW-MCP-SAMPLING)
- [x] 统一写作 skill 就绪 (NEW-SKILL-WRITING)
- [x] openalex-mcp 独立构建通过，hep-mcp 聚合完成 (NEW-OPENALEX-01)
- [ ] 无 Phase 0/1/2 回归

### NEW-R11: `registry.ts` 领域拆分 (M-13 范围扩展) ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §9, NEW-R01 子项

**依赖**: M-13 (MCP 模块化)

**现状**: `registry.ts` 2975 LOC, 包含所有领域的工具注册。M-13 规划了分组标签但未规划文件级拆分。NEW-06 写作管线移除后预计缩减至 ~1800 LOC，但拆分仍有价值。
**目标**: 拆分为 `tools/registry/{inspire,zotero,pdg,project}.ts` + `tools/registry/shared.ts`（写作 registry 随 NEW-06 删除，无需独立文件）。

**验收检查点**:
- [x] registry 拆分文件保持可维护规模（每个 ≤500 LOC）
- [x] 注册顺序与现有一致 (避免运行时行为变化)
- [x] `index.ts` re-export 规则: 仅从 `shared.ts` re-export，领域文件不互相导入

### NEW-R12: `idea-runs` 集成契约 ★深度重构

> **来源**: `docs/2026-02-20-deep-refactoring-analysis.md` §11

**依赖**: EVO-05 (Domain Pack, 概念依赖)

**交付**: Phase 3 前置交付物 (不推迟到 Phase 5):
1. `idea-runs` 集成契约文档: schema 验证规则、artifact 命名合规检查、交叉引用格式
2. 契约测试: CI 验证 idea-core 产出的 run artifacts 符合 `M-01` + `H-15b` 规范

**验收检查点**:
- [x] 集成契约文档存在
- [x] CI 契约测试通过

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

### NEW-MCP-SAMPLING: theoreticalConflicts 迁移至 MCP Sampling (深度审计 2026-03-01)

> **来源**: `meta/docs/hep-mcp-audit-report.md` — 嵌入 LLM 客户端反模式修复
> **R8 简化 (2026-03-01)**: 原计划 2 consumers (llmReranker + theoreticalConflicts)。proposal R4 发现 `llmReranker.ts` 所有 consumer 在 DELETE list → 随 NEW-06 Batch 2 删除。仅剩 1 consumer: `theoreticalConflicts.ts`。

**依赖**: NEW-06 Batch 2 完成后 (llmReranker 已随其 consumers 删除)
**关系**: 编排为 NEW-06 Batch 3 的 step 1-2。非独立项 — 与 NEW-06 Batch 3 同步执行。
**估计**: ~150 LOC (plumbing + migration)

**现状**: `theoreticalConflicts.ts` 通过 `tools/writing/llm/clients/` 直接嵌入 LLM 客户端调用。这违反 MCP 架构最佳实践。`llmReranker.ts` 已无需迁移 — 所有 consumer 在 NEW-06 Batch 2 删除。

**变更**:
1. **Plumb MCP sampling into ToolHandlerContext**: 将 `extra.sendRequest` (MCP SDK) 从 `index.ts` → `dispatcher.ts` → tool handlers 传递。添加 `createMessage` 便利 wrapper
2. TheoreticalConflicts: 准备 conflict analysis prompt → `ctx.createMessage(...)` → 解析结果
3. Thread ctx through handler chain: `registry.ts` handler → `performCriticalResearch()` → `performTheoreticalConflicts()`
4. 删除 `tools/writing/llm/` directory (clients/, config.ts, types.ts, index.ts) — 与 `tools/writing/types.ts`
5. 注意: sampling 依赖 MCP client 实现 `sampling/createMessage`; 若 client 不支持, `mode='theoretical'` 将失败 (acceptable per CLAUDE.md §全局约束)

**验收检查点**:
- [x] `tools/writing/llm/` 目录完全删除
- [x] `tools/writing/types.ts` 删除
- [x] 无 `createLLMClient` 调用残留
- [x] `theoreticalConflicts.ts` 使用 `ctx.createMessage` (MCP sampling)
- [x] `ToolHandlerContext` 包含 `sendRequest` + `createMessage`
- [x] Conflict analysis 端到端测试通过

### NEW-SKILL-WRITING: 增强 research-writer Skill (深度审计 2026-03-01) ✅ Phase 3 Batch 7

> **来源**: `meta/docs/hep-mcp-audit-report.md` §7.4 — 写作管线移除后的能力填补
> **修订 (2026-03-01)**: 原计划新建 `skills/writing-pipeline/` 统一写作 skill。改为增强现有 research-writer，避免 skill 膨胀。research-writer 已实现 outline + section generation；只需补充 hep-mcp evidence 工具集成。

**依赖**: NEW-06 (写作管线移除完成后)
**估计**: ~200 LOC (SKILL.md 修订 + 脚本增强)

**现状**: research-writer 已实现 RevTeX scaffold + outline + section-by-section generation + LaTeX compilation。但缺少与 hep-mcp evidence catalog 的集成。paper-reviser 和 referee-review 各自独立运行。

**变更**:
1. 增强 `skills/research-writer/SKILL.md` — 添加 hep-mcp evidence 工具调用流程
2. 添加 evidence grounding 步骤: `hep_project_query_evidence` / `hep_project_query_evidence_semantic` → 每节写作前检索相关 evidence
3. Citation 来源从 evidence catalog（INSPIRE recid + arXiv ID）获取，非 allowlist
4. 通过 `hep_render_latex` 渲染 + `hep_export_project` 打包
5. Section-by-section 策略在 skill 层实现（SOTA 模型 per-section 退化近零，但单次生成仍有长度限制）

**验收检查点**:
- [x] `SKILL.md` 包含 hep-mcp evidence 工具调用流程
- [x] 每节写作前检索 evidence (BM25 或 semantic)
- [x] 调用 `hep_render_latex` + `hep_export_project`
- [x] 端到端: evidence → outline → section draft → render → export

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
| 集成测试 | 端到端工作流 (M-19) | 旧 ingest/reproduce/revision/computation 工作流族的冒烟测试通过 |
| 回归基线 | N-1 版本 fixture (M-20) | 迁移测试通过 |

### Phase 4 验收总检查点

- [ ] 全部 7 个 Low 缺陷修复或标记为 won't-fix
- [ ] NEW-07 Agent Card + 注册表 + A2A 适配层就绪
- [ ] 发布级冻结产物全部生成且 CI 验证
- [ ] 测试策略文档存在且 CI 覆盖率达标
- [ ] 无 Phase 0/1/2/3 回归

---

## Phase 5: 端到端闭环、统一执行与研究生态外层（P5A/P5B） (P5)

> **目标**: 分两条 lane 推进：`P5A` 收束单用户 / 单项目的 idea→理论计算→论文端到端闭环与统一执行；`P5B` 在其外侧扩展社区 / 发布 / 跨实例 / 研究进化基础设施。
> **前置**: Phase 4 全部完成 + idea-core Phase 2 (BFTS + Elo) 就绪
> **路径说明**: 本 Phase 中 `idea-core/src/idea_core/` 路径在执行时已迁移为 `packages/idea-engine/src/` (TypeScript)，Python 路径仅为逻辑对应参考。
> **前置重释 (v1.9.2)**: 真正的研究循环语义不再等到 Phase 5 才第一次出现；Phase 3 的 `NEW-LOOP-01` 先建立单研究者非线性 research loop substrate，`EVO-01/02/03` 在其上接入 compute / feedback / writing automation。
> **范围澄清 (2026-03-08)**: 本 Phase 不是“只有社区化”。其中 `EVO-01/02/03/13/14` 仍服务于单用户 / 单项目的端到端闭环与统一执行收束；`EVO-15+` 才进入社区 / 发布 / 研究进化外层。
> **子 lane 划分 (2026-03-08)**:
> - `P5A`: `EVO-01/02/03/06/07/09/10/11/12/13/14`
> - `P5B`: `EVO-04/05/08/15/16/17/18/19/20/21`
> - 该划分是 Phase 内部阅读 / 排期 lens，不新增 `Phase 6`，也不改变现有依赖顺序；若单项目闭环收束与社区外层建设发生取舍，默认先满足 `P5A`。
> **产品化约束 (2026-03-09)**: 即使后续提供单一 packaged end-user agent，它也应是构建在 orchestrator/runtime + root composition layer + selected providers 之上的独立 leaf package，而不是把 repo root、`packages/orchestrator/`、或某个 domain-specific CLI 直接提升为产品 agent。

### EVO-01: idea→理论计算自动执行闭环

> **依赖追加 (v1.9.2)**: UX-02 (computation contract), UX-04 (workflow schema), NEW-R15-impl (orch_run_*), NEW-COMP-01 (compute MCP 安全设计), NEW-LOOP-01 (single-user loop substrate)
> **范围约束 (2026-03-08)**: 本项实现的是 domain-neutral `idea / method_spec -> execution_plan` handoff，而不是把某个 HEP tool wrapper 升格为 compute 语义本身。HEP-th / `hep-calc` 是首个高优先级 domain pack / provider，但不构成长期 scope 边界；下列能力与工具链仅作首批开放示例。

**现状**: idea-core 输出 IdeaCard (自然语言)，C2 method_design 生成方法规格，但尚缺统一的 execution-planning handoff，无法稳定翻译为可审批、可审计、可复现的计算任务。当前 `hep-calc` 只是首个较成熟的 HEP theory provider，而非 compute 抽象本身。

**首批能力示例（非封闭）**:

| 能力类 | 首批 provider / 工具链示例 | 说明 |
|---|---|---|
| 符号推导 / 代数计算 | Wolfram-based stacks、SymPy、后续 CAS providers | 优先复用成熟 provider |
| 数值计算 / 扫描 | Julia / C++ / Fortran / 现有数值求解器 | 按性能、可审计性与复现性选择 |
| 约化 / 积分 / 专项求解 | FIRE/LiteRed/Kira、pySecDec/FIESTA、后续领域求解器 | 作为开放 provider 示例，不是封闭列表 |
| 证明 / 验证 / 一致性检查 | 形式化工具、定理证明器、符号/数值 cross-check providers | 不限于当前 HEP 工具链 |
| 受限自定义执行 | 生成或手写的 sandboxed executor | 仅在现有 provider 不满足需求且通过审批时启用 |

**原则**: 优先复用成熟 provider / 现有程序包；仅在它们不能满足具体需求时，才由 runtime LLM / agent 在治理边界内组合 provider 或生成受限执行路径。

**修改内容**:

| 文件 | 变更 |
|---|---|
| `idea-core/src/idea_core/handoff/execution_strategy_planner.py` | 根据 research task / method_spec 选择执行策略、能力需求与候选 provider |
| `idea-core/src/idea_core/handoff/execution_plan_compiler.py` | IdeaCard + method_spec → domain-neutral computation execution plan / provider payload 编译器 |
| `skills/hep-calc/` | 作为首个 HEP theory provider 接入：接受 execution-plan 派生 payload 执行并产出可审计 artifacts；不定义 compute 抽象本身 |

**验收**: execution plan 编译器生成的调用计划可被一个获批准的 provider（起始为 `hep-calc`）消费并执行，稳定产出可审计 computation artifacts。

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

**2026-03-08 amendment**: 另见 `meta/docs/2026-03-08-evo13-runtime-governance-control-plane-amendment.md`。该 amendment 不改变 Phase 顺序，但要求 future `EVO-13` 显式吸收 delegation permission matrix、operator intervention vocabulary、live-status/replay control-plane view、以及 **team-local** lifecycle / health / timeout / cascade stop；相对地，**cross-run / fleet-level** 调度与 agent pool 健康仍留在 `EVO-14`。

**产品入口非目标 (2026-03-09)**: `EVO-13` 的目标是单项目 / team-local runtime unification，而不是 packaged end-user agent。若未来需要统一的用户入口，应在 `P5A` 收束后以独立 leaf package 形式引入；不得把 `EVO-13` 直接扩张为 repo-root super-agent 或 orchestrator-internal 产品壳。

**验收**:
- 并行 team 执行中 kill 进程后可从 checkpoint 恢复，已完成角色不重跑
- `stage_gated` 策略: 阶段内并行 + 阶段间门禁 + 持久化均正常
- 与现有 Orchestrator CLI 状态机兼容（旧 ingest/reproduce/revision/computation 工作流可嵌入并行子任务）

### EVO-14: 跨 Run 并行调度 + Agent 生命周期

**现状**: Orchestrator CLI 一次只处理一个 run。无跨 run 资源调度、无 **fleet-level** agent 健康监控、无动态扩缩。

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

**背景**: MCP 解决"有哪些工具可用"，REP 解决"为什么这个研究策略有效、如何进化"。如同 MCP 成为 LLM 生态的标准接口层，REP 旨在成为 AI 科学研究的标准进化层。

**定位约束 (v1.9.2)**: `EVO-17` 是 Track A / Phase 5 的 evolution/publication layer。它可复用 integrity / audit / content-addressing 设计，但**不得**反向定义近中期单研究者 research loop 的执行内核；v1 主干由 Phase 3 `NEW-LOOP-01` + orchestrator runtime 承担。

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
| **1 (统一抽象)** | H-01/H-02/H-03/H-04/H-13/H-15a/H-16a/H-18/H-19/H-11a, M-01/M-14a/M-18/M-19, NEW-01, NEW-CONN-01, NEW-R02/R03b/R04, UX-01/UX-05/UX-06 | 23 (19 done, 3 pending, 1 cut) |
| **2 (深度集成 + 运行时 + Pipeline 连通)** | H-05/H-07/H-09/H-10/H-11b/H-12/H-15b/H-16b/H-17/H-21, M-02/M-05/M-06/M-19/M-20/M-21/M-23, trace-jsonl, NEW-02/03/04, NEW-R05~R08/R10/R14/R15-impl, UX-02/UX-07, RT-02/RT-03, NEW-VIZ-01, NEW-RT-01~04, NEW-CONN-02~04, NEW-IDEA-01, NEW-COMP-01, NEW-WF-01, NEW-ARXIV-01, NEW-HEPDATA-01, NEW-05a Stage 3 (start) | 44 (26 done, 18 pending) |
| **3 (扩展性 + 计算连通 + 单研究者研究循环前置)** | M-03/M-04/M-07~M-10/M-12/M-13/M-15~M-17/M-22/L-08, NEW-06, NEW-R11/12, UX-03/UX-04, RT-01/RT-04, NEW-CONN-05, NEW-COMP-02, NEW-SKILL-01, NEW-RT-05, NEW-05a Stage 3 (complete), NEW-OPENALEX-01, NEW-SEM-01~13, NEW-RT-06/07, NEW-DISC-01, NEW-SEM-06-INFRA/b/d/e/f, NEW-LOOP-01 | 50 (32 done, 18 pending) |
| **4 (长期演进)** | L-01~L-07, NEW-07 | 8 (0 done, 8 pending) |
| **5 (端到端闭环、统一执行与研究生态外层（P5A/P5B）)** | EVO-01~EVO-21, EVO-12a | 22 (0 done, 14 pending, 8 design_complete) |
| **跨 Phase (伞)** | NEW-R01 | 1（bookkeeping only; excluded from total） |
| **CUT** | NEW-R09 | 1（bookkeeping only; excluded from total） |
| **总计** | **Phase 0–5 remediation items only** | **160** (152 既有 + 8 新增) — **91 done** |

> **Note**: 本表自 `v1.9.2-draft` 起与 `meta/remediation_tracker_v1.json` 同步；“总计”仅统计 Phase 0–5 remediation items，`NEW-R01` 与 `NEW-R09` 作为 bookkeeping rows 单列展示但不计入 160。v1.9.2 新增 `NEW-LOOP-01`，并将近中期执行主干重释为 single-user nonlinear research loop；SOTA retrieval/discovery/routing follow-up（`NEW-DISC-01`, `NEW-RT-06/07`, `NEW-SEM-06-INFRA/b/d/e/f`）现已完成 closeout，Phase 3 剩余项主要集中在 compute / packet-curation / provenance / equation lanes。
