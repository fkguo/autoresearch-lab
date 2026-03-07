# Phase 3 — Implementation Batch 5

> **作用**: 本文件是 Phase 3 Batch 5 的实施提示词。Batch 4（RT-01 三模式工作流 + RT-04 idea 桥接）
> 已通过 5 轮 review-swarm 收敛并落地，本批次聚焦 Phase 3 最高价值剩余项：
> RT-05（Semi-permeable Clean Room / Information Membrane）。
>
> **SOTA 参考**: `meta/docs/sota-multi-agent-verification-2026.md` §第四–第七部分（Information Membrane 详细设计）
>
> **Batch 4 收敛记录**: R1-R5 共修复 19 BLOCKING findings（Codex 全程参与，Gemini R1-R2 有效、R3-R5 因速率限制缺席）

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。


## 启动前同步

在开始实现前，先对齐当前状态（以仓库现状为准）：

- 确认 `meta/REDESIGN_PLAN.md` 中 RT-01 / RT-04 已标记为 `[x]`（各自验收检查点全部通过）
- 在 Phase 3 验收总检查点（约 line 2094-2095）将 RT-01 和 RT-04 对应行也标记为 `[x]`
- 确认 `meta/remediation_tracker_v1.json` 中 RT-01 / RT-04 状态为 `done`
- 不回退 UX-03 / UX-04 / NEW-06 / NEW-MCP-SAMPLING / NEW-R11 / NEW-R12 的完成状态

---

## Batch 5 范围与依赖

本批次仅包含 **1 个大型核心项**（RT-05），估计 ~1550 LOC（~1350 新代码 + ~200 改动）。

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| RT-05 | `skills/research-team/` | ~1550 | RT-01 ✅, RT-02 ✅ |

**依赖全部已满足**:
- RT-01 (三模式工作流) — Batch 4 ✅
- RT-02 (clean-room gate) — Phase 2 Batch 6 ✅

---

## RT-05: Semi-permeable Clean Room (Information Membrane)

### 背景

research-team 在独立工作阶段（Phase 1）和收敛判定阶段（Phase 4）表现良好，但缺少两个
人类科研中的关键环节：
1. **工作前的方法对齐**（Phase 0）— 两个 member 可能选同一最简路径验证，验证价值极低
2. **遇到困难时的定向咨询**（Phase 2）— 数值方法选择、约定确认等无渠道

用户实测确认的问题：
- 两个 member 常选同一 trivial headline number 验证
- 数值方法选择（如 trapz vs Gauss-Kronrod）不被系统性审查
- 完全隔离导致无谓的约定分歧（如 $\overline{MS}$ vs $MS$-bar 记法）

### 设计核心: Information Membrane

按**内容语义类型**定义渗透率（非按角色或时间）。

**PASS 类型**（可透过 membrane 共享的 7 种）:
| 类型 | 说明 | 示例 |
|------|------|------|
| METHOD | 方法/算法选择 | "Use Gauss-Kronrod for the integral" |
| REFERENCE | 文献引用 | "See Eq.(3.12) in hep-ph/0601234" |
| CONVENTION | 记法/约定 | "$\overline{MS}$ scheme, $\mu = m_Z$" |
| PITFALL | 已知陷阱/注意事项 | "Divergent for $q^2 > 4m^2$" |
| CRITERION | 收敛/精度判据 | "Require $\Delta < 0.1\%$" |
| TOOL | 工具/库建议 | "Use LoopTools for PV reduction" |
| ASSUMPTION | 前提假设 | "Assume $m_u = m_d = 0$" |

**BLOCK 类型**（必须阻止的 7 种）:
| 类型 | 说明 | 示例 |
|------|------|------|
| NUM_RESULT | 数值结果 | "The mass is 125.3 GeV" |
| SYM_RESULT | 符号/解析结果 | "The amplitude is $ig^2 C_F/(16\pi^2)$" |
| DERIV_CHAIN | 推导链/中间步骤 | Multi-line derivation |
| VERDICT | 判定结论 | "Derivation is correct" / "Computation matches" |
| CODE_OUTPUT | 代码输出/数据 | Numerical table, plot data |
| AGREEMENT | 同意/确认 | "I agree with Member A's result" |
| COMPARISON | 对比结论 | "Our results differ by 2%" |

**决策规则**: BLOCK 优先于 PASS（保守优先）；混合内容尝试分句处理，不可靠则整段 BLOCK。

### 协作阶段模型

```
Phase 0 (方法对齐)  ──→  Phase 1 (独立工作)  ──→  Phase 2 (定向咨询)  ──→  Phase 3 (收敛)  ──→  [Phase 5 (分歧解决)]
     ▲                         ▲                        ▲                       ▲
     │                         │                        │                       │
  method_landscape.md     existing behavior      FLAG/UNCERTAIN 触发         convergence gate
  (Membrane-filtered)     (no change)            HOW-only constraint         (existing + context)
```

- `--collaboration-phases 1` — 默认，行为与当前 RT-01 完全一致（仅 Phase 1）
- `--collaboration-phases 0,1` — 增加 Phase 0 方法对齐
- `--collaboration-phases 0,1,2,3` — 完整四阶段协作
- `--collaboration-phases 0,1,2,3,5` — 含分歧解决（Phase 5）

### 新增文件

| 文件 | 估计 LOC | 说明 |
|------|---------|------|
| `scripts/lib/information_membrane.py` | ~300 | Membrane V1 核心：BLOCK/PASS 检测规则 + `filter_message()` + 审计日志 |
| `scripts/bin/compile_method_landscape.py` | ~150 | Phase 0 输出编译：Membrane 过滤 + 结构化合并为 `method_landscape.md` |
| `scripts/bin/extract_consultation_flags.py` | ~120 | Phase 1 报告解析 FLAG/UNCERTAIN → 结构化 HOW 问题 |
| `scripts/bin/filter_consultation_response.py` | ~80 | Phase 2 回答经 Membrane 过滤，BLOCK 内容替换为 `[REDACTED]` |
| `assets/system_alignment.txt` | ~50 | Phase 0 方法对齐 system prompt（禁止计算结果） |
| `assets/system_consultation.txt` | ~40 | Phase 2 定向咨询 system prompt（HOW-only 约束） |
| `assets/system_divergence.txt` | ~30 | Phase 5 分歧解决 system prompt |
| `tests/test_information_membrane.py` | ~200 | PASS/BLOCK 各类型覆盖（≥14 test cases） |
| `tests/test_method_landscape.py` | ~100 | Phase 0 编译器测试 |
| `tests/test_consultation_flags.py` | ~80 | FLAG 解析 + 过滤测试 |

### 修改文件

| 文件 | 变更说明 |
|------|---------|
| `scripts/bin/run_team_cycle.sh` | 新增 `--collaboration-phases` 参数；Phase 0/2/5 编排逻辑 |
| `scripts/gates/check_team_convergence.py` | Phase 0/2/5 上下文纳入收敛判定（mode-aware） |
| `scripts/bin/build_team_packet.py` | Phase 0 method_landscape 注入 packet；Phase 2 咨询内容注入 |

### 实施要点

#### 1. Information Membrane V1 (`information_membrane.py`)

- **纯规则（正则 + 关键词）**, 确定性可审计，不引入 LLM 分类器（V2 后续）
- `filter_message(text: str) -> FilterResult`：返回 `(filtered_text, audit_entries)`
- 每个 BLOCK/PASS 类型有独立检测函数，可单独测试
- 分句处理：尝试按句子/bullet 拆分，逐句分类，仅 BLOCK 匹配的句子
- 不可靠时（句子边界不清晰）整段 BLOCK（保守优先）
- 审计日志格式：JSONL，每条含 `input_hash`, `blocked_type`, `blocked_snippet`, `membrane_version`

#### 2. Phase 0: 方法对齐 (`compile_method_landscape.py`)

- 两个 member 分别运行 Phase 0（使用 `system_alignment.txt`），各自输出方法路径、约定、难点、文献
- `compile_method_landscape.py` 合并两份输出，经 Membrane 过滤后生成 `method_landscape.md`
- `method_landscape.md` 注入 Phase 1 的 team packet（`build_team_packet.py`）
- Phase 0 system prompt 明确禁止：数值计算、推导、代码执行

#### 3. Phase 2: 定向咨询 (`extract_consultation_flags.py` + `filter_consultation_response.py`)

- `extract_consultation_flags.py` 从 Phase 1 报告中解析 `FLAG:` 或 `UNCERTAIN:` 标记
- 无 FLAG 时自动跳过 Phase 2（不浪费 token）
- FLAG 转换为结构化 HOW 问题（"HOW to handle X" 而非 "WHAT is the result"）
- 被咨询方回答经 `filter_consultation_response.py` 过滤：Membrane 阻止结果/判定泄露
- Phase 2 system prompt 强制 HOW-only 约束

#### 4. `run_team_cycle.sh` 编排

- `--collaboration-phases` 解析为阶段列表（逗号分隔的数字）
- Phase 0 在 Phase 1 之前执行；Phase 2 在 Phase 1 之后、Phase 3（收敛检查）之前
- Phase 5（分歧解决）仅在 Phase 3 判定不收敛且非 early-stop 时触发
- **asymmetric 模式下 Phase 2 硬禁用**（与盲化冲突）— 需要明确检查和跳过
- `--collaboration-phases 1` 时行为与当前完全一致（回归安全）

#### 5. 收敛 gate 扩展

- Phase 0/2/5 的输出作为上下文传入 `check_team_convergence.py`，但**不改变核心收敛逻辑**
- 可选新增 `--phase0-landscape` / `--phase2-responses` 参数，用于在输出中展示附加上下文
- 收敛标准仍由 derivation/computation/verdict/sweep 四维决定（不变）

#### 6. Membrane 审计日志

- 写入 `<run_dir>/membrane_audit/` 目录
- 每次 Membrane 操作一条 JSONL 记录
- 包含：`timestamp`, `phase`, `input_hash` (SHA256), `blocked_count`, `blocked_details[]`, `membrane_version`

### 关键设计约束

1. **向后兼容**: `--collaboration-phases 1` 完全等同于不传此参数（现有行为不变）
2. **渐进启用**: 用户可逐步开启 Phase 0 → Phase 2 → Phase 5
3. **与 RT-01 集成**: peer/leader 模式支持所有 Phase；asymmetric 模式 Phase 2 硬禁用
4. **不引入 A2A 框架**: 所有信息流经编排器的 Membrane，不使用 agent 间直接通信
5. **不引入 LLM 分类器**: V1 纯规则（确定性），V2（后续）可选 LLM 辅助
6. **保守优先**: BLOCK 优先于 PASS；宁可过度 BLOCK 也不泄露结论

### 验收标准

直接对应 REDESIGN_PLAN RT-05 验收检查点：

- [ ] `--collaboration-phases 1` 行为与 RT-01 完全一致（回归测试）
- [ ] `--collaboration-phases 0,1` 在 Phase 0 产生 Method Landscape 并注入 Phase 1 packet
- [ ] Method Landscape 中不含数值结论/完整推导（信息膜 BLOCK）
- [ ] `--collaboration-phases 0,1,2,3` 完整四阶段流程可运行
- [ ] Phase 2 仅在 FLAG/UNCERTAIN 触发时激活；无 FLAG 时自动跳过
- [ ] Phase 2 回答经过信息膜过滤，不含数值结果/判定结论
- [ ] Information Membrane V1 有独立单元测试覆盖 PASS/BLOCK 各 7 种类型（≥14 test cases）
- [ ] Membrane 审计日志包含 input_hash + blocked_details + membrane_version
- [ ] convergence gate 接受 Phase 0/2/5 上下文（mode-aware）
- [ ] asymmetric 模式下 Phase 2 硬禁用（测试覆盖此约束）

---

## 后续批次预览（Batch 6+）

Batch 5 完成后，Phase 3 剩余项分三类：

**中等复杂度（可组合为 1-2 个 batch）**:
- NEW-COMP-02 (W_compute MCP 实现, ~500 LOC) — unblocked
- NEW-RT-05 (Eval framework, ~500 LOC) — unblocked
- M-12 (凭据管理) — unblocked
- M-22 (GateSpec 抽象) — unblocked

**低复杂度（可打包为 1 个 batch）**:
- M-03, M-04, M-07, M-08, M-09, M-10, M-13, M-15, M-16, M-17, L-08

**低优先级/独立**:
- NEW-CONN-05 (cross-validation feedback, ~100 LOC)
- NEW-SKILL-01 (lean4-verify, ~200 LOC)

---

## 交付与 Review 流程

1. 实现完成后运行 `pytest -q skills/research-team/tests/` 确认全部测试通过
2. 提交至 `main` 并推送
3. 创建 review packet 并执行 `review-swarm`（Codex + Gemini 双模型）
4. 按 CLAUDE.md §多模型收敛检查 迭代至收敛（最多 5 轮）
5. 更新 REDESIGN_PLAN RT-05 验收检查点
6. 更新 `meta/remediation_tracker_v1.json` 中 RT-05 状态
7. 生成 `prompt-phase3-impl-batch6.md`
