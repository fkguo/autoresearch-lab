# M5 测试实例复盘：解耦策略 + 质量门禁硬化（面向 idea-core / hepar / idea-generator）

> 日期：2026-02-15  
> 范围：**工具生态改进**（idea-core / hepar / idea-generator）；这里不保留任何单课题执行史，只保留测试实例暴露出的通用问题。  
> 目标：把测试实例暴露的问题，转化为可执行的 **契约/门禁/目录规范/安全可靠性硬化** 清单；之后在完全解耦的新实例中重测。  
> 非目标：不为了“过门禁”而围绕某个具体课题反向调模型或调实现。

---

## 0. 结论（TL;DR）

这次 M5 测试实例显示：控制平面（review/gate/tracker/board-sync/campaign）流程已经能跑通，但**研究质量门禁没有阻止 method drift**；同时暴露出若干 **安全边界、原子写、超时/退避、ledger 性能与权限事件反应式处理** 等工程缺陷。

因此需要两条主线并行推进：

1) **实例完全解耦（强制）**：把测试/研究实例从工具仓库剥离到独立的 `idea-runs`（monorepo，多项目目录），工具版本用 manifest/lock 固定；工具仓库用 CI/gate 禁止实例目录进入。  
2) **门禁从“存在性”升级为“方法与证据一致性”**：引入 `method_fidelity_contract`、`literature_relevance/coverage`、`numerics_best_practices`、`single_human_doc`、`idea_candidates`、`portability`、`scope` 等契约与 gate 条款，确保“声称的研究方法/质量等级”能被机器与人共同审计。

### 0.1 执行状态更新（2026-02-15）

- `W5-03`：已完成并收敛（Opus + gemini-3-pro-preview 均 `READY`），工具仓库反污染 gate 与 `idea-runs` 解耦结构已落地。  
  证据：`review archive (outside repo)`、`review archive (outside repo)`。
- `W5-04`：已完成并收敛（round-002：Opus=`READY`，gemini-3-pro-preview=`READY`，`fallback_reason=null`），通用质量门禁 schemas + checklist + examples 已提交并验证通过。  
  证据：`review archive (outside repo)`、`review archive (outside repo)`、`review archive (outside repo)`。
- 看板状态已同步：`W5-03=Done`、`W5-04=Done`、`W5-05=In Progress`。  
  证据：`review archive (outside repo)`。
- `W5-05`：已完成并收敛（round-001：Opus=`READY`，gemini-3-pro-preview=`READY`，`fallback_reason=null`），并通过 `make validate && pytest`（`105 passed`）验证。  
  证据：`idea-core review archive (outside repo)`、`idea-core review archive (outside repo)`、`review archive (outside repo)`。
- `W5-05` 代码实现提交：`idea-core` 已提交 `c3f8006`，将路径边界、原子写、timeout/backoff、权限事件反应式处理、replay 并发安全与 `env_whitelist` 一致性固化到运行时实现，并新增回归测试覆盖；复验证据：`idea-core review archive (outside repo)`。
- 推送状态：`idea-core` 与 `idea-generator` 的已完成阶段提交已 push 到 `origin/main`（后续新增提交待你确认是否继续 push）。

---

## 1. 已确认的决策（写死）

### 1.1 实例仓库：`idea-runs`（monorepo，多项目目录）

- **工具仓库**：`idea-generator`（设计/契约/SSOT tracker）、`idea-core`/`hepar`（实现/测试）。  
- **实例仓库**：`idea-runs`（只放项目/测试实例：charter/tracker/pipeline/compute/runs/reports/evidence）。

### 1.2 工具版本固定：manifest/lock（不使用 submodule）

- 每个项目目录下维护 `toolchain/manifest.lock.json`：记录 `idea-core`/`hepar`（以及关键 runner/skill）所用的 **repo URL + commit SHA + 版本号/校验信息**。  
- 任何“重放”必须以该 manifest 作为输入，禁止隐式依赖本机未提交的工具代码。

### 1.3 反污染规则（强制）

- 工具仓库（尤其 `idea-core`）不得出现实例树：`docs/research/**`、`research/**`、`artifacts/runs/**` 这类目录只允许存在于 `idea-runs`。  
- 通过 CI 或 pre-commit gate 强制：发现上述路径立即 fail-fast（避免“测试实例混进工具开发代码”）。

---

## 2. `idea-runs` 项目目录规范（以“人类用户可用”为第一原则）

### 2.1 推荐结构（单项目）

`idea-runs/projects/<project_slug>/`：

- `README.md`：一条命令重放（或最小步骤），以及“证据索引入口”
- `charter.md`：研究目标/边界/成功标准（A0.1）
- `tracker.md`：append-only（阶段状态 + Update Log + evidence index）
- `pipeline/`：hepar 配置（review/gate/board-sync/campaign 等）
- `compute/`：外部 kernel（Julia/Mathematica/…），并明确 I/O contract
- `runs/`：不可变 run 输出（每次运行一个子目录，含 logs + results + provenance）
- `artifacts/`：schema-validated 的结构化产物（可被 gate/audit 读取）
- `reports/`：**单一人类可读文档**（论文式写法、推导不跳步、从 M0.2 起持续更新）
- `evidence/`：证据索引（链接到 runs/artifacts/reports + 外部来源）
- `toolchain/manifest.lock.json`：工具版本固定（repo + commit + checksums）

### 2.2 关键规则（门禁应强制）

- **workspace-root 边界**：所有 path 必须是相对路径并且解析后仍在 project root 下（禁止 `../`、符号链接逃逸等）。  
- **可移植性**：pipeline/runner 不得引用本机绝对路径（例如 `~/.codex/...` 不能作为 SSOT）。  
- **审计可读**：人类入口只有 2 个：`reports/` 与 `evidence/index.md`；其余目录允许为 agent 服务，但必须在 README 指路。

---

## 3. 由测试实例暴露出的“必须新增/升级门禁”（防 method drift）

> 这里把你指出的问题（method drift / toy 相移 / 文献不足 / 文档滞后 / 数值方法不足 / ideas 不可见 / 目录混乱）抽象为 **可执行契约**，避免未来换题目仍复发。

### 3.1 `method_fidelity_contract_v1`（核心：声称的方法必须可审计）

**动机**：测试实例出现“宣称的方法族”和“实际实现 / 证据”不一致的偏移；现有 gate 只检查 artifacts 存在与计数，无法阻止。

**建议产物**：`artifacts/method/method_fidelity_contract_v1.json`

字段建议：
- `claimed_methodology`: `["<method_family_1>", "<method_family_2>", ...]`（来自 charter；例如某些项目会写 `bootstrap`/`dispersive`）
- `implemented_method_classification`: `"unconstrained_sampling" | "constrained_search" | "dispersive_derivation" | "data_fit" | "analytic_derivation" | ...`
- `constraints_enforced[]`: 机器可检查的约束清单（例如 `elastic_unitarity`, `crossing`, `positivity`, …）
- `disallowed_shortcuts_detected[]`: 例如 `toy_phase_model`, `prior_only_bounds`, `no_convergence_check`
- `evidence_pointers[]`: 指向关键推导/代码/日志/对照文献
- `human_signoff`: `{reviewer, verdict, notes}`（可为空，但 gate 要求至少 1 轮 clean-room reviewer 写入）

**gate 条款示例**：
- 若 `claimed_methodology` 非空且 `implemented_method_classification == "unconstrained_sampling"`，则必须同时满足：`constraints_enforced[]` 非空 + 文档显式说明其为何仍可信；否则 gate fail（`scope=="ecosystem_validation"` 可作为 *expected limitation* 放行，但必须进入失败库/局限库，避免误读为研究结论）。

### 3.2 `literature_search_evidence_v2`（从“数量”转为“相关性/覆盖面”）

**动机**：测试实例暴露出“文献门禁被数量指标驱动”的风险：只要凑够若干篇文献就可能过 gate，但这些文献可能与**声称的方法/关键可检验结论**不匹配。这不是某个具体方法族特有的问题，而是所有“质量优先”的研究工作流都必须避免的漂移。

**建议升级**（在现有 `artifacts/literature/search_evidence.json` 基础上扩展）：
- 每条纳入/剔除记录必须携带可审计标签（**不写死到某个物理子领域**）：
  - `evidence_role`: `"method_foundation" | "method_application" | "baseline_constraint" | "comparison_result" | "review" | "background"`
  - `method_family`: 来自 charter/`method_fidelity_contract_v1.claimed_methodology` 的方法族（字符串或枚举均可，但必须可回声）
  - `triage_reason`: 为什么纳入/剔除（可审计、可复查）
  - `quality_note`: 例如“primary source / review / non-peer-reviewed / low-signal”
- `query_plan` + `coverage_report`：把“要覆盖什么”写成结构化计划并回声覆盖率：
  - 至少覆盖：每个 `method_family` 的 `method_foundation`；每个关键 observable 的 `baseline_constraint`/`comparison_result`（若存在）
- `seed_gap_analysis`：哪些子问题/observable/method 缺少 seed 覆盖；缺口必须在进入下一 milestone 前补齐或显式 waiver

**gate 条款示例**：
- 对每个 `method_family`：要求 `method_foundation` 至少 N 篇（N 随 `scope` 配置）；否则禁止在报告/结论中声称“使用了该方法族得出约束/结论”。  
- 对每个 primary observable：要求至少 1 个 `baseline_constraint` 或 `comparison_result`（若公开可得）；否则必须在 `single_human_doc` 中显式标记“缺少外部基线，当前仅为方法/流程验证”。

### 3.3 `numerics_quality_v1`（禁止“偷懒默认最简单实现”）

**动机**：测试实例暴露的主要问题不是“缺少一份收敛报告”本身，而是**在明知存在更合适数值方法时仍默认选择最省事的实现**（例如用最简单的梯形法处理敏感核积分）。对“质量优先”的科研工作流来说，这属于必须被门禁阻止的行为：数值方法的选择与实现质量本身就是研究结论可信度的一部分。

**建议产物（两件套，缺一不可）**：

1) `artifacts/numerics/numerics_method_selection_v1.json`（方法选择审计）
   - `problem_class`: `"quadrature" | "ode" | "optimization" | "sampling" | ..."`
   - `options_considered[]`: 候选方法列表（至少包含“最简单方法”和“推荐方法”各 1）
   - `chosen_method`: 选定方法
   - `rejection_reasons`: 为什么不用更简单/更复杂方案
   - `implementation_plan`: 计划使用的库/实现、关键参数、稳定性风险点
   - `references[]`: 对应的数值方法参考（文献/教材/库文档，允许为空但需说明）

2) `artifacts/numerics/numerics_validation_report_v1.json`（实现与结果验证）
   - `convergence_sweeps[]`: 网格/容差/随机种子等扫描表
   - `cross_checks[]`: 交叉验证（换算法/换实现/解析极限/已知特例）
   - `estimated_error`: 至少一种可解释误差指标
   - `pass_thresholds`: gate 所用阈值回声（避免阈值漂移）

**gate 条款示例**：
- `scope in {"preliminary_physics","publication_ready"}` 时：若 `chosen_method` 属于“已知易失稳/低阶/无误差控制”的类别，则必须：
  1) 在 `numerics_method_selection_v1` 中给出明确理由（例如问题被证明足够光滑、误差严格受控），并  
  2) 在 `numerics_validation_report_v1` 中给出等价性/收敛性证据；否则 gate fail。  
- `scope=="ecosystem_validation"` 时：允许采用最小实现验证流程，但必须在 `scope` 与报告中显式标注为“数值方法未达研究级别”，并要求把该样例纳入失败库或 *expected limitations*（避免误读成研究结论）。

### 3.4 `single_human_doc_gate`（从 M0.2 起必须有“单一人类可读文档”）

**动机**：你指出在明确要求前没有产生“论文式、不跳步”的单文档；这会让人类无法审核，且容易把 toy 结果当结论。

**建议**：
- 在 M0.2 结束时就要求 `reports/draft.md`（或 `paper.zh.md`）存在，并在每个 milestone 更新。
- gate 检查：文档存在、包含 assumptions/notation/derivation/IO-contract/result-summary 的最小结构（可用标题检查 + hash 追踪）。

### 3.5 Idea 产生证据（强制扩展；不允许跳过）

**动机**：你指出“没有看到新的 ideas 在哪里”。此外，即便最初 idea 是人类给出的，系统也应该**强制进行拓展/扩充**（提出变体、替代方法、可检验 observable、失败模式与 kill criteria），否则 `idea-core` 退化为“按配方跑 pipeline”，而非 idea 产生器。

**关键修正（避免“纸面设计被跳过”）**：这里不再引入平行的 `idea_candidates_v1.json`（会和 `idea_candidates_v1.jsonl` SSOT 产物重复）。  
我们只基于现有设计框架的 SSOT 产物与 `extensions` 字段来做强制门禁：

- **Seed 输入**：`idea_seed_pack_v1.json`（人类 seed 可放入 `seed_pack` 或 `extensions.seed_idea`）
- **扩展协议（policy）**：写入 `campaign_charter_v1.extensions.expansion_protocol`（不改变稳定 schema 表面）
- **候选谱系（事实记录）**：`idea_candidates_v1.jsonl`（每行一个 `IdeaNode`，含 parent/branch、operator_trace、eval_info、grounding_audit 等）
- **失败样本（负例库）**：`failed_approach_v1.jsonl`（至少 1 条被否决的扩展/路线）

**扩展协议（建议字段）**：`campaign_charter_v1.extensions.expansion_protocol`
- `min_evaluated_nodes`：最少需要进入评估的候选数量（默认小值；见下方 gate 解释）
- `required_axes[]`：必须覆盖的扩展轴（例如 `method/observable/constraint/failure_mode`）
- `min_distinct_operator_families`：至少使用的 operator family 数量（防止只做单一模板改写）
- `waivers[]`：允许的豁免项及其审批引用（必须可审计）

**关于 “至少 K 个候选（允许全部被否决）” 是否符合科研实践？**
- “允许全部被否决”是符合科研现实的：多数探索路线应当被结构化地否掉（并进入失败库复用）。  
- 但“硬编码 K”不应变成制造垃圾候选的激励，因此这里把 K 变成 **policy 参数**（`min_evaluated_nodes`），并且只统计**进入 `eval.run` 的候选**（即出现在 `idea_scorecards_v1.json.scorecards[]` 且 `status != failed` 的 node）。

**gate 条款示例**：
- 若未满足 `expansion_protocol` 的覆盖要求则 fail（防止“跳过 idea 扩展，直接进入计算/写结论”）。  
- 若 `min_evaluated_nodes` 未达标：必须给出 waiver（带 human approval 引用），否则 fail。  
- 必须存在 `failed_approach_v1.jsonl` 至少 1 条（负例库），否则 fail。

### 3.6 `portability_report_v1`（禁止绝对路径 + runner 可校验）

**动机**：测试实例中 pipeline/runner 可能引用本机绝对路径；这会破坏重放与协作。

**建议产物**：`artifacts/portability/portability_report_v1.json`

检查项建议：
- `absolute_path_hits[]`: 在 `pipeline/*.json`、脚本、tracker 中发现的绝对路径列表
- `runner_checksums[]`: 关键 runner 脚本 hash（或版本号）回声
- `tool_versions`: 来自 `toolchain/manifest.lock.json`

**gate 条款示例**：
- `absolute_path_hits` 非空则 fail（或在 `ecosystem_validation` 下允许但必须显式列出并强制修复）。

### 3.7 `scope`：把“生态验证”与“可引用研究结论”分离

**动机**：测试实例需要允许 toy/不完整实现用于验证流程，但必须防止被误读成研究结论。

**建议**：所有 milestone gate payload 增加：
- `scope: "ecosystem_validation" | "preliminary_physics" | "publication_ready"`
- gate 行为：`scope!="publication_ready"` 时强制在 report 中注入 `NOT_FOR_CITATION` 标记与“不可引用”提示；并禁止使用暗示“研究级/可引用结论”的措辞（例如“rigorous bounds / derived constraints / publication-ready”）。

### 3.8 防跳步门禁：必须真实运行评分与排名（不是只跑“外部计算+写结论”）

**动机**：`idea-generator` 的设计框架明确将“评估→排名→晋升”作为不可或缺的闭环（否则无法保证 exploration/exploitation 的纪律，也无法复用失败样本）。但实际测试实例很容易因为控制平面先跑通而在流程上跳过 core loop（只做外部计算、review、写报告）。

**建议 gate（最低要求）**：当 milestone 声称完成 “idea generation / quality gates / handoff” 时，必须在 evidence index 中提供以下 SSOT 产物引用（都已有 schema 支持）：
- `idea_candidates_v1.jsonl`（候选谱系）
- `idea_scorecards_v1.json`（评分快照；见 `schemas/idea_scorecards_v1.schema.json`）
- `ranking_result_v1.json`（排名结果；见 `schemas/ranking_result_v1.schema.json`）
- `idea_selection_v1.json`（晋升/拒绝决策）
- `idea_handoff_c2_v1.json`（若声称产出 C2-ready handoff）

**可选但强烈建议**：把 `skill_bridge`/ledger 的调用轨迹汇总为 `core_loop_execution_audit_v1.json`（只列方法名+idempotency_key+artifact refs），用于机器检查“`search.step -> eval.run -> rank.compute -> node.promote` 没有被跳过”。

---

## 4. 工程层面待优化点（来自 m5-control-plane-v4 的只读扫描）

> 这些属于工具实现缺陷；应在工具仓库修复并补回归测试。下面列出“问题 → 风险 → 建议改造”。

### 4.1 安全边界（Path traversal / workspace-root 逃逸）

- **Gate/audit 路径越界**：`src/idea_core/hepar/milestone_pipeline.py` 的 `run_gate_check()` 对 `workspace_root/rel` 仅 `resolve()`，未校验解析后仍位于 `workspace_root`；恶意 `../` 可读取任意文件。  
- **Review audit 越界**：`src/idea_core/hepar/review_audit.py` 的 `_safe_resolve()` 同样缺少“必须在 root 下”的约束。  
- **artifact_ref 越界**：`src/idea_core/hepar/skill_bridge.py` 的 `_artifact_ref_to_path()` 支持 `file://` 且对 `netloc` 走 `//netloc/path`，存在将 replay 指向任意位置的风险。

**建议**：统一 `safe_resolve_under(root, rel)`（拒绝绝对路径 + `..` + symlink escape），并对 gate/audit/skill-bridge 全面替换；补单元测试（`../`、符号链接、UNC/netloc）。

### 4.2 正确性/可复现（env_whitelist、manifest 一致性）

- **env_whitelist 实际未生效**：`milestone_pipeline.py/_run_command()` 计算 `_selected_env(env_whitelist)` 但仍把完整 `os.environ.copy()` 传给 subprocess，导致“记录的 env”与“实际执行 env”不一致。  
- **campaign manifest 形状不一致**：`campaign_runner.py` skipped case 不含 `config_path/attempts`，使后续审计逻辑更复杂。

**建议**：env 过滤要么真正执行，要么移除误导字段；manifest schema 统一。

### 4.3 可靠性（超时/退避、原子写、线程清理）

- reviewer subprocess 无 timeout：`milestone_pipeline.py/run_dual_review()` 直接 `subprocess.run()`，可能永久挂起。  
- 收敛循环无 backoff：`run_review_convergence()` failure 时 tight-loop，可能自旋打满 CPU。  
- tracker 追加非原子：`append_tracker_entries()` 直接 `write_text()`，中断会损坏 tracker。  
- SSE producer daemon thread 不 join/取消：`runtime_adapter.py/ingest_sse_events()` 可能泄露线程。

**建议**：为 reviewer/run_external 添加 timeout；failure backoff；文件写入采用 tmp+replace；SSE 线程可取消并 join。

### 4.4 性能（ledger 去重 O(N^2)）

- `control_plane.py/has_ledger_event()` 每次都全量读取 ledger；`runtime_adapter.py/ingest_sse_events()` 对每个事件调用它，形成 O(N^2)。

**建议**：会话内 in-memory set 去重；或维护索引（例如 `(session_id,event_key)`）。

### 4.5 权限事件的“反应式处理”缺失

- `runtime_adapter.py/execute_work_order()` 在 `post_message()` 之后才 ingest SSE；这意味着权限请求无法在同一 turn 内及时响应（只能事后记录事件）。

**建议**：引入反应式 event loop（线程/async）在执行期间持续 ingest，并在遇到 permission_request 时走 gate→post_permission 的闭环。

---

## 5. 映射到 SSOT tracker 的可执行任务（W5.*）

本 RFC 的改造项将以 W5 任务落到 `docs/plans/2026-02-12-implementation-plan-tracker.md`，并要求每项 DONE 都提供：
- schema/接口文档（idea-generator）
- 对应实现与测试证据（idea-core/hepar）
- `idea-runs` 中的可重放样例（至少一个“预期失败”样例进入失败库）

---

## 6. 证据指针（便于审阅追溯）

- M5 工作树（只读扫描、不要合入工具仓库）：`local M5 worktree (not checked in)`  
- 归档的双模型扫描输出（Opus + Gemini）：`review metadata archived outside repo`
- 你提供的原始问题列表：见本对话记录（将作为门禁条款的“动机输入”固化到 SSOT tracker 的 Update Log）。
