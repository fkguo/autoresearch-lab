# Long-running agent harness 设计要点（Anthropic harness / Claude Quickstarts）→ 映射到 idea-generator/hepar

> 日期：2026-02-12  
> 目标：把“长期运行 agent 的 harness 工程纪律”抽取成 **可执行的设计规则**，用于后续 `idea-generator`（idea-core）与 `hepar`（控制平面）的实现与集成。  
> 原则：研究质量优先（audit-first / replayable），不把 prompt 技巧当架构；把“能落到契约/产物/门禁”的内容写清楚。

---

## 1) 一手来源（可复现入口）

- Anthropic Engineering：*Effective harnesses for long-running agents*  
  `https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents`
- `anthropics/claude-quickstarts`：*Autonomous Coding Agent* quickstart（README 明确了 harness 的 SSOT、会话续跑、git checkpoint 与安全模型）  
  `https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding`

> 备注：以上内容偏“工程运行时/流程约束”，其价值在于把 long-running agent 常见失败模式（早停、漂移、无状态、越权、不可回放）变成可编码规则。

---

## 2) 可迁移的“硬机制”（不是观点）

### 2.1 Two-agent pattern：Initializer × Worker（跨 session 持续推进）

- **Initializer（一次性）**：读 spec → 生成结构化任务列表（`feature_list.json`）→ 初始化工程/环境 → 建 git 仓库。
- **Worker（多次迭代）**：每次在 fresh context 下读取 SSOT（feature list + progress notes）→ 只做一个小步 → 自测 → **只更新 SSOT 的“通过/失败状态”** → 提交 checkpoint。

可迁移点：
- 把“发散生成/收敛形式化/审查复核”的角色分离（clean-room），避免把评审与生成混在同一个上下文里。
- 用“初始化阶段的结构化计划”作为长期运行的锚点，避免会话漂移。

### 2.2 SSOT 以结构化文件为核心（feature_list.json）

quickstart 的关键不是 git，而是 **SSOT 是 JSON**：
- 列出大量可验证的 test cases / features
- 每个 iteration 只把少数条目标标为 passing
- 其余状态保持不变（最小可回放增量）

可迁移点：
- 对科学 ideation，SSOT 不应是聊天记录或散文；应该是 schema-validated artifacts（我们已用 `IdeaNode/IdeaCard/SearchStepResult` 做到这一点）。
- 对“进度”同样如此：需要一个结构化、可机读的 checklist 来避免“宣告胜利”。

### 2.3 会话续跑规则（fresh context + 进度文件）

- 每个 session context 都是新的（长期运行必然如此）。
- 续跑靠：`feature_list.json` + `claude-progress.txt` + git history。

可迁移点：
- `campaign.status` + ledger + artifacts 是 `idea-core` 的“续跑锚点”。
- `idempotency_key` 是“同一意图重试”的锚点；`campaign.pause/resume/topup` 是“恢复执行”的锚点。

### 2.4 安全模型：allowlist + 目录约束 + 权限请求（defense-in-depth）

quickstart 明确写了：
- bash allowlist（只允许少量命令）
- filesystem 限制（只能在项目目录）
- 其余一律阻断

可迁移点：
- 这与我们从 OpenClaw/OpenCode 抽取的 `tool_policy` / permission handshake 是同一类工程纪律。
- 对 `Coder/Derivation/Checker` 角色必须默认：sandbox=on、allowlist、写目录白名单、权限事件化并写 ledger。

### 2.5 预检脚本（init.sh）

quickstart 产物里包含 `init.sh`：把“环境能跑起来”变成显式步骤，而不是让 agent 在对话里猜。

可迁移点：
- `idea-generator` 的多工具依赖（MCP/代理/本地 bin）也需要一个 **preflight** 产物或命令（外部于 LLM）：
  - MCP 可用性
  - arXiv 源码抓取能力
  - 预算/令牌限制
  - 存储路径可写/配额

---

## 3) 映射到 idea-generator / hepar 的具体设计结论

### 3.1 把“harness SSOT”落到 CampaignCharter 的 companion artifact（建议）

建议新增（文档级，v0.3+ 再考虑契约化）一个 companion artifact：

- `campaign_checklist_v1.json`（或同类）
  - 每条 checklist item 对应一个可验收目标，例如：
    - `grounded_claim_ratio >= x`
    - `novelty_audit.pass == true`
    - `IdeaCard compile success`
    - `reduction_audit.pass when reduction_report present`
  - 每次 `search.step/eval.run/rank.compute/node.promote` 之后，只允许 **以小增量更新** checklist（类似 feature_list pass flags）。

这样做的价值：
- 让 long-running campaign 的“是否真的进步”可机读、可回放。
- 避免把“改了措辞/补了细节”当成阶段性成果。

### 3.2 把 Two-agent pattern 迁移为 Team/Role 的 stage-gated 模式

- Initializer ≈ `CampaignPlanner`（生成 island/team 拓扑与优先级、预算分配策略、目标 checklist）
- Worker ≈ `Ideator/Formalizer/Coder/Checker/Referee` 等 role 的循环

并把“阶段门禁”写死：
- Stage 1（Exploration）：允许发散，但必须产出 `RationaleDraft` + kill criteria
- Stage 2（Formalization）：必须产出 schema-valid 的 `IdeaCard`
- Stage 3（Audit）：Grounding + Reduction + Referee/Checker clean-room

### 3.3 把“git checkpoint”抽象为 ledger checkpoint + replay

在 hepar/idea-core 生态里，git 不是必需依赖；但“checkpoint 思想”必须存在：
- 每个 tick/epoch 写入 append-only ledger（`distributor_events`、promotion events、audit events）
- 周期性写 `DistributorStateSnapshotV1` 与 `campaign_status` 快照
- 任何 side-effecting RPC 必须 idempotent（已在契约层写死）

### 3.4 把“安全 allowlist”写成可审计的 Role tool_policy

- `RoleSpec.tool_policy` 必须是结构化 allow/deny/ask + pattern rules
- 权限请求必须事件化（permission request → gate → resolve → ledger）

---

## 4) 立即可执行的 next actions（写入 SSOT tracker）

1. 在 `idea-generator` 设计侧把“campaign checklist”作为 v0.3+ 的 companion artifact 写入路线图（不必立刻改 OpenRPC）。
2. 在 hepar 改造备忘录中补充：preflight/health-check 作为 runtime adapter 的必备能力（避免长跑时才发现工具不可用）。
3. 为 Team/Role 的 stage-gated 执行新增一条“最小可回放”要求：role 之间只通过 artifacts 传递，禁止共享草稿。

