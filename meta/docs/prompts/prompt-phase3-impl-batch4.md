# Phase 3 — Implementation Batch 4

> **作用**: 本文件是 Phase 3 Batch 4 的实施提示词。Batch 3（UX-03 + UX-04）已收敛并落地，
> 本批次转向 Phase 3 剩余高优先项：RT-01（research-team 三模式工作流）与 RT-04（Innovation ↔ idea-generator 桥接），
> 并集成经用户实测确认的 system prompt 改进（角色分工、验证去重、blind numerics、sidecar 自动触发）。
>
> **SOTA 参考**: `meta/docs/sota-multi-agent-verification-2026.md`（2026-03-02 写入，含 §第五-七部分详细设计）
>
> **前置设计讨论**: `meta/docs/prompts/prompt-phase3-design-batch4.md`（改动 1-4 分析与范围决策）

## 启动前同步

在开始实现前，先对齐当前状态（以仓库现状为准）：

- 确认 `meta/REDESIGN_PLAN.md` 中 UX-03 / UX-04 已标记为 `[x]`
- 确认 `meta/remediation_tracker_v1.json` 中 UX-03 / UX-04 状态为 `done`
- 不回退 NEW-06 / NEW-R11 / NEW-R12 / NEW-MCP-SAMPLING 的完成状态

---

## 范围决策（2026-03-02 设计讨论结果）

本批次除 RT-01 和 RT-04 两个核心项外，还集成 4 个 system prompt 改进方向中已确定纳入的部分：

| 改动 | 纳入/延后 | 成本 | 理由 |
|------|----------|------|------|
| **改动 1**: 角色分工（A=代数/符号, B=数值/实现） | **Batch 4** | 零（仅 prompt） | 自然集成到 RT-01 新建的 mode-specific system prompts |
| **改动 2**: 强制验证不同量 | **Batch 4** | 零（一行指令） | 所有 Member B prompts 统一加入 |
| **改动 3**: Blind numerics | **Batch 4** | 中（合并 asymmetric） | 已是 asymmetric 模式 redaction 的超集 |
| **改动 4**: 独立代码实现 + 静态审查 + 选优执行 | **延后** | 高 | 需要多阶段执行基础设施；在 RT-01 之上分层添加（Batch 5+ 或 RT-06） |
| **Member C 自动触发** | **Batch 4** | 低 | probe 脚本已存在，增加 artifact 自动检测 |

**已知问题（用户实测确认）**：
1. 两个 member 常选同一最简 headline number 验证，验证价值极低
2. 数值方法选择（如 trapz vs Gauss-Kronrod）不被系统性审查
3. packet 含 claimed result 时 member 做"对齐验证"而非独立计算

改动 1-3 直接针对上述问题。改动 4（N-version programming）是更强的解，但成本高且需额外基础设施，延后。

---

## Batch 4 实施内容

本批次包含 **1 个前置修复 + 2 个核心项 + 3 个集成改进**：

| 项目 | 路径 | LOC 估计 | 依赖 |
|------|------|---------|------|
| Item 0 (convergence gate 修复 + 测试) | `skills/research-team/scripts/gates/` + `tests/` | ~150-200 | 无（前置） |
| RT-01 | `skills/research-team/` | ~500-700 | Item 0, UX-06, NEW-06, RT-02 |
| RT-04 | `skills/research-team/` + `packages/idea-generator/` | ~200-350 | NEW-R12 |
| 改动 1+2 | RT-01 system prompts 内嵌 | 0 额外（含在 RT-01 中） | — |
| 改动 3 | RT-01 asymmetric + `--blind-numerics` shorthand | ~50 额外 | RT-01 |
| C 自动触发 | `team_cycle_sidecar_probe.py` | ~30 | — |

---

## Item 0: Convergence Gate Bug Fixes + Test Coverage（前置于 RT-01）

> **优先级**: 必须在 RT-01 mode-aware 重构之前完成。当前 `check_team_convergence.py` 存在
> 一个真实 bug 和若干边界缺陷，且**零测试覆盖**（无单元测试、无 golden fixture、仓库中无实际 member 报告样本）。
> 在此基础上叠加 mode-aware 分支是不安全的——先修 bug、补测试、再扩展。

### 0.1 Bug 修复：mismatch 子串冲突

**文件**: `scripts/gates/check_team_convergence.py` → `_parse_comparison()`

**现状**（line 76-84）：
```python
has_match = "match" in value        # "mismatch" 也包含 "match"！
has_mismatch = "mismatch" in value
if has_match and has_mismatch:      # → 任何含 "mismatch" 的都进这里
    return "unknown"                # ← BUG: 应返回 "fail"
```

**修复**：`mismatch` 必须优先于 `match`（更具体的模式优先）：
```python
def _parse_comparison(section_text: str) -> str:
    m = re.search(r"^\s*Comparison:\s*([^\n]+)$", section_text, flags=re.IGNORECASE | re.MULTILINE)
    if not m:
        return "unknown"
    value = m.group(1).strip().lower()
    if "mismatch" in value:
        return "fail"
    if "match" in value:
        return "pass"
    return "unknown"
```

### 0.2 Bug 修复：Verdict 全文 fallback 误报

**现状**（line 90-91）：
```python
verdict_sec = _extract_section(text, "Verdict")
haystack = verdict_sec if verdict_sec else text  # ← 回退到全文搜索
```

当 `## Verdict` heading 缺失（LLM 拼写变体如 `## Final Verdict`、`## 结论`）时，在全文中搜
`needs revision`。但 system prompt 本身含 `"choose needs revision"` 指令文本，如被 LLM 回显
则永远匹配 `needs_revision` → 永远不 converge。

**修复**：无 Verdict section 时返回 `unknown`（而非搜全文），并新增宽松 heading 匹配：
```python
def _extract_section(text: str, heading: str) -> str:
    # 精确匹配
    pat = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.MULTILINE | re.IGNORECASE)
    m = pat.search(text)
    if not m:
        return ""
    ...

def _parse_verdict(text: str, ready_tokens, needs_tokens) -> str:
    # 尝试多个 heading 变体
    for h in ("Verdict", "Final Verdict", "结论", "总结"):
        verdict_sec = _extract_section(text, h)
        if verdict_sec:
            break
    if not verdict_sec:
        return "unknown"  # ← 不再 fallback 到全文
    ...
```

### 0.3 设计修复：sweep_semantics unknown 阻塞 theory milestone

**现状**：`_is_converged()` 要求 `sweep_semantics == "pass"`。当报告缺少
`## Sweep Semantics / Parameter Dependence` section（纯理论推导无参数扫描）时，
sweep_semantics = "unknown" → convergence 永远失败。

**修复**：引入 `require_sweep` 参数，由 cycle_state 或 milestone kind 决定：
```python
def _is_converged(status: ReportStatus, *, require_sweep: bool = True) -> bool:
    base = (status.derivation == "pass"
            and status.computation == "pass"
            and status.verdict == "ready")
    if require_sweep:
        return base and status.sweep_semantics == "pass"
    # theory milestones: unknown sweep 不阻塞，但 explicit fail 仍阻塞
    return base and status.sweep_semantics != "fail"
```

`require_sweep` 逻辑：
- CLI `--require-sweep` 显式控制
- 或从 cycle_state.json 读取 milestone kind → `theory` / `theory-only` → `require_sweep=False`
- 默认 `True`（向后兼容）

### 0.4 Golden Fixture 测试

**文件**: 新建 `skills/research-team/tests/test_convergence_gate.py`

使用合成 member 报告 fixtures 覆盖以下场景（每个场景是一个 `.md` 字符串常量或 fixture 文件）：

| # | Fixture | 预期结果 | 测试的解析路径 |
|---|---------|---------|--------------|
| 1 | 双 pass（表格 + Comparison match + verdict ready + sweep pass） | exit 0 | 正常收敛 |
| 2 | A pass, B fail（表格 Computation fail） | exit 1 | 表格解析 |
| 3 | Comparison: mismatch（无表格） | exit 1 | **mismatch bug 回归测试** |
| 4 | Comparison: match within tolerance（含 "match" 子串） | exit 0 | match 子串 |
| 5 | 无 `## Verdict` heading（变体 `## Final Verdict`） | exit 0（如内容为 ready） | heading 变体容错 |
| 6 | 无 `## Verdict` heading（无任何变体） | exit 1（unknown → 不 converge） | **全文 fallback 消除回归** |
| 7 | 中文报告（通过/失败/合格/不合格/就绪/需修改） | exit 0 或 1 | 双语 token |
| 8 | Markdown 装饰（`**pass**`, `` `fail` ``） | 正确解析 | 格式容错 |
| 9 | sweep_semantics 缺失 + require_sweep=False | exit 0 | theory milestone 豁免 |
| 10 | sweep_semantics 缺失 + require_sweep=True | exit 1 | 默认严格模式 |
| 11 | 占位符报告（`pass/fail` 未替换） | exit 1（unknown） | both pass+fail → unknown |
| 12 | `Comparison: mismatch — sign error` 含说明文字 | exit 1 | mismatch 带尾部文字 |

测试框架：`pytest`，直接 import `_parse_report` / `_parse_comparison` / `_parse_verdict` / `_is_converged` 等函数进行单元测试。
可用 `tmp_path` fixture 生成临时 `.md` 文件。

**目标**：在 RT-01 mode-aware 扩展之前，确保现有 peer 模式解析逻辑被 12 个以上测试用例覆盖。

### 0.5 验收标准

- [ ] `_parse_comparison("Comparison: mismatch — sign error")` 返回 `"fail"`（非 `"unknown"`）
- [ ] 无 `## Verdict` heading 且无变体时，`_parse_verdict()` 返回 `"unknown"`（不搜全文）
- [ ] `## Final Verdict` 和 `## 结论` 等变体被正确识别
- [ ] `require_sweep=False` 时 sweep unknown 不阻塞 convergence
- [ ] `require_sweep=True`（默认）时 sweep unknown 阻塞 convergence（向后兼容）
- [ ] `test_convergence_gate.py` 至少 12 个测试用例全部通过
- [ ] 现有 `run_team_cycle.sh` 调用 convergence gate 的行为不变（`--require-sweep` 默认 True）

---

## Item 1: RT-01 — research-team 三模式工作流

### 背景与 SOTA 约束

REDESIGN_PLAN RT-01 要求支持 `peer | leader | asymmetric` 三种工作流模式。

**SOTA 结论**（详见 `meta/docs/sota-multi-agent-verification-2026.md`）：
- **`leader` 为默认**：research-team 的实际使用模式是跨 provider 异构 ensemble（gpt-5.2 leader + opus/gemini members），`leader` 模式在语义上与实际用法一致；SOTA 文献的"peer 优"结论针对同质 provider 内 agent，不适用于本项目（见 §架构差异说明）
- `peer` 保留用于纯对等场景（两个完全对等 reviewer，无 leader 角色）
- `asymmetric` 是 leader 的强化版，用于需要 blind 独立验证的关键步骤
- convergence gate **必须**使用确定性解析，不引入 LLM judge

### 实施要点

#### 1.1 `run_team_cycle.sh` — 新增 CLI 参数

```bash
# 新增 CLI 参数
--workflow-mode peer|leader|asymmetric   # 默认: leader（或 config 中的 workflow_mode）
--max-step-retries N                     # leader 模式每步最多重试次数（默认 3）
--critical-steps "step1,step2"           # asymmetric 模式指定需独立推导的步骤
--blind-numerics                         # shorthand: 等价于 --workflow-mode asymmetric + 所有 headline numbers 作为 critical_steps
```

配置优先级：`--workflow-mode` CLI > `research_team_config.json` `workflow_mode` 字段 > `leader`（hardcoded default）

注：`peer` 仍可通过显式 `--workflow-mode peer` 启用，用于纯对等场景。

`--blind-numerics` 是便捷 flag，语义为：
1. 自动设置 `--workflow-mode asymmetric`（如果未显式指定）
2. 在 packet 中 redact **所有** headline numbers（而非仅 `--critical-steps` 指定的步骤结论）
3. Member B 必须先独立计算，再比对

#### 1.2 system prompt — 模式感知 + 角色分工

**Peer 模式**（改动 1 集成）：

现有 `system_member_a.txt` / `system_member_b.txt` 需要分化：

- `assets/system_member_a.txt`（peer A，代数/符号专家）：
  - 保留全部现有 contract（12 项 deliverables）
  - **追加专业化指令**：优先投入推导深度——符号错误、指标约定、极限合法性、维数检查
  - 计算验证部分降为辅助：确认公式-代码对应，但详细数值验证让 B 承担
  - **Nontriviality**: 见下方 §1.2.1 统一定义（共享基础 + 角色示例 + fallback），不在此处重复

- `assets/system_member_b.txt`（peer B，数值/实现专家）：
  - 保留全部现有 contract（12 项 deliverables）
  - **追加专业化指令**：优先投入代码逻辑、算法选择合理性、收敛性、artifact 可追溯
  - **改动 2 集成**：追加指令——"MUST verify a quantity DIFFERENT from the most obvious headline number. Choose: a different formula path, a different parameter point, an intermediate quantity with nontrivial sensitivity, or a cross-method consistency check. If you verify the same quantity as the most prominent claimed result, your Computation Replication verdict is automatically TRIVIAL."
  - 推导验证部分降为辅助：确认关键步骤逻辑，但深度重推让 A 承担
  - **Nontriviality**: 见下方 §1.2.1 统一定义

**Leader 模式**：

- Member A（leader）：新建 `assets/system_leader_main.txt`
  - 按步骤输出（`## Step N: <title>`），每步以 `Step verdict: CONFIRMED|CHALLENGED|UNVERIFIABLE` 结尾
  - **角色**：全能 leader，但 derivation 深度优先（与 peer A 一致）
  - **Nontriviality**: §1.2.1 统一定义 + A 示例

- Member B（verifier）：新建 `assets/system_leader_verifier.txt`
  - 验证每步，以 `CONFIRMED/CHALLENGED/UNVERIFIABLE` + 理由回应
  - **角色**：numerics-first verifier（与 peer B 一致的专业化方向）
  - **改动 2 集成**：同 peer B 的强制不同量验证指令
  - **Method selection challenge（改动 1 强化）**：增加专项指令——"For every numerical method in the packet (integration, ODE solver, optimizer, interpolation), you MUST state whether the method choice is appropriate for the precision/convergence requirements. If a low-order or brute-force method is used where an adaptive/higher-order method is standard, this is a CHALLENGED verdict for the step containing that computation."
  - **Nontriviality**: §1.2.1 统一定义 + B 示例

**Asymmetric 模式**：

- Member A（leader）：同 leader 模式 system prompt
- Member B（verifier）：新建 `assets/system_asymmetric_verifier.txt`
  - 继承 leader verifier 的全部内容
  - **追加 blind 指令**："Critical steps in the packet are REDACTED. You MUST derive the result independently BEFORE seeing the comparison. Your independent result goes in `## Independent Derivation` section. Only after that section is complete do you write `## Comparison with Leader`."
  - **改动 3 集成**：当 `--blind-numerics` 启用时，verifier 不看到任何 headline numbers，必须独立计算出数值后再比对

#### 1.2.1 统一 Nontriviality 定义（所有 member prompts 共享）

> **设计决策**（gpt-5.2 + gemini-3.1-pro 双模型审核共识，2026-03-03）：
> 不使用有限枚举 (a)(b)(c)(d)——闭合列表无法覆盖 HEP 研究的多样性（纯 group theory、
> lattice QCD、collider MC、astro-particle 等），且会导致 LLM 做 "checkbox compliance"
> 而非真正有价值的验证。改用 **falsifiability principle + 负面定义 + 开放示例 + 结构化审计**。

以下定义**替换**现有 system prompt lines 46-49 的 TRIVIAL/NONTRIVIAL 定义，在所有 member
prompts（peer A/B、leader main/verifier、asymmetric verifier）中统一使用：

```text
VERIFICATION PRINCIPLE: FALSIFIABILITY AND INDEPENDENCE

Your primary goal is to perform a check that possesses the power to FALSIFY
the authors' claims through an INDEPENDENT pathway. A check has value only if
it could reasonably have produced a different result and thereby changed the
conclusion or flagged a major gap.

1. What is strictly TRIVIAL (forbidden as sole verification):
   - Direct arithmetic confirmation of a headline result or final numerical value.
   - Plugging the authors' exact numbers into the authors' exact final formula.
   - Re-running the exact same code/script and confirming outputs match.
   - Basic bookkeeping (matrix dimensions, unit labels) without deeper analysis.
   - Any check whose outcome was guaranteed to match before you performed it.

2. What is NONTRIVIAL (open standard — examples include but are NOT limited to):
   [FOR MEMBER A / SYMBOLIC EXPERT]:
   - Re-deriving a key intermediate step from first principles via a different route
   - Cross-checking convention/scheme/normalization consistency that could flip signs/factors
   - Verifying limit exchange, approximation, or power-counting validity
   - Testing gauge invariance / Ward identity / anomaly cancellation / unitarity
   - Reduction to a known special case with literature citation

   [FOR MEMBER B / NUMERICS EXPERT]:
   - Independent computational path (different formula, algorithm, or library)
   - Quantitative stability/convergence probe (tolerance, step-size, order;
     or variance/sample-size/seed for stochastic; or autocorrelation/ESS for MCMC)
   - Numerical sensitivity hotspot analysis (singular integrands, cancellations, stiffness)
   - Explicit error budget tied to required precision
   - Method-independence test (swap integration/ODE/optimizer and compare)

   CAUTION on parameter variation: vary ONLY unphysical scales (mu_F, mu_R,
   cutoff, regularization) or phenomenological nuisance parameters. NEVER vary
   fundamental physical constants (particle masses, coupling constants at fixed
   scale) — that produces unphysical nonsense, not a sensitivity check.

3. FALLBACK MODE (when your specialty content is absent):
   - Member A with no symbolic derivations → pivot to verifying theoretical validity
     of assumed models, statistical methodology, or systematic uncertainty handling
   - Member B with no numerics/code → pivot to invariants, dimensional analysis,
     limits, or independent logic checks on the theoretical arguments
   - State explicitly WHY you pivoted and what domain you are checking instead.

4. OUTPUT REQUIREMENT (machine-parsable, mandatory):
   Before your Triviality classification tag, you MUST write:

   Falsification pathway: <one sentence: how your check differs from the authors' direct path>
   Failure mode targeted: <one sentence: what specific error your check could have caught>
   Evidence pointer: <equation label / code file:line / artifact path>
   Triviality classification: NONTRIVIAL
   Nontriviality reason: <one of: INDEPENDENT_PATH | STABILITY_CONVERGENCE |
     ERROR_BUDGET | INVARIANT_LIMIT | SCHEME_CONVENTION | STATISTICAL_STABILITY |
     ALT_TOOLCHAIN | OTHER: <describe>>

   If Triviality classification is TRIVIAL, only the classification line is needed.
```

**Gate 扩展（Item 0 / §1.4 联动）**：`check_team_convergence.py` 的 triviality 解析需扩展为：
- 解析 `Triviality classification: NONTRIVIAL|TRIVIAL` tag（现有）
- **新增**：当 tag 为 NONTRIVIAL 时，验证 `Falsification pathway:` 和 `Failure mode targeted:` 和 `Nontriviality reason:` 三行均存在且非空
- 缺失任一字段 → 降级为 TRIVIAL（gate 不信任无理由的 NONTRIVIAL 自报）
- `Nontriviality reason:` 值解析为受控词表 `{INDEPENDENT_PATH, STABILITY_CONVERGENCE, ERROR_BUDGET, INVARIANT_LIMIT, SCHEME_CONVENTION, STATISTICAL_STABILITY, ALT_TOOLCHAIN}` 或 `OTHER:*`；无法解析 → warning（不阻塞，但记入 cycle_state）

#### 1.3 `build_team_packet.py` — 模式感知 packet 构建

- `peer`：不变
- `leader`：packet 中增加 `## Step-by-step Derivation Plan` section，列出推导步骤（从 notebook 或 PREWORK.md 提取，或 CLI 提供 `--steps`）
- `asymmetric`：packet 构建时对 `critical_steps` 的已知结论做 redaction（替换为 `[REDACTED — verifier must derive independently]`）
- `asymmetric` + `--blind-numerics`：**额外 redact 所有 headline numbers**：
  - 正则匹配：`=\s*[\d.]+(?:\s*[±××]\s*[\d.e+-]+)?` 模式的数值结论
  - Reproducibility Capsule 中的 `headline_numbers` 部分整段替换为 `[HIDDEN — compute independently]`
  - 保留公式、代码指针、artifact 路径——verifier 需要这些信息来独立计算

#### 1.4 `check_team_convergence.py` — mode-aware 分支

> **前置**: Item 0 的 bug 修复和测试必须先完成。mode-aware 扩展在修复后的代码基础上进行。

当前 convergence gate 是对称的（member_a + member_b 均通过）。扩展 `ReportStatus` 和分派逻辑：

```python
@dataclass(frozen=True)
class ReportStatus:
    path: Path
    derivation: str           # pass/fail/unknown（现有）
    computation: str          # pass/fail/unknown（现有）
    verdict: str              # ready/needs_revision/unknown（现有）
    sweep_semantics: str      # pass/fail/unknown（现有）
    # --- RT-01 新增 ---
    step_verdicts: list[tuple[str, str]]  # [(step_name, "CONFIRMED"|"CHALLENGED"|"UNVERIFIABLE")]
    has_independent_derivation: bool       # asymmetric: ## Independent Derivation section 非空

# Mode dispatch
def check_convergence(a: ReportStatus, b: ReportStatus, mode: str, require_sweep: bool) -> int:
    if mode == "peer":
        return _check_peer(a, b, require_sweep)      # 0 or 1（现有逻辑 + Item 0 修复）
    elif mode == "leader":
        return _check_leader(a, b, require_sweep)     # 0, 1, or 3
    elif mode == "asymmetric":
        return _check_asymmetric(a, b, require_sweep) # 0 or 1
    else:
        return _check_peer(a, b, require_sweep)       # 未知 mode fallback to peer
```

**leader 模式**：
- member_a (leader): 每步 `Step verdict: CONFIRMED` 全部满足 → pass
- member_b (verifier): step_verdicts 中 `CHALLENGED` 计数；连续 2 个 CHALLENGED → exit 3 (early stop)
- 两者整体 verdict 都为 ready → exit 0

**asymmetric 模式**：
- member_b 报告中须包含 `## Independent Derivation` section 且非空 (`has_independent_derivation=True`)
- critical_steps 中 member_b 的 step verdict 需独立计算（packet 已 redact，gate 验证 section 存在）
- 两者整体 verdict ready + independent derivation 存在 → exit 0

**step_verdicts 解析**：
```python
# 正则匹配 "Step verdict: CONFIRMED|CHALLENGED|UNVERIFIABLE" 或
# "## Step N: <title>" ... "Step verdict: XXX"
_STEP_VERDICT_RE = re.compile(
    r"^##\s+Step\s+(\d+):\s*(.+?)$.*?Step\s+verdict:\s*(CONFIRMED|CHALLENGED|UNVERIFIABLE)",
    re.MULTILINE | re.DOTALL | re.IGNORECASE,
)
```

exit codes 扩展：
- `0`：converged
- `1`：not converged（现有）
- `3`：leader early stop (CHALLENGED × 2)（新增，调用方据此触发修复重试）

**CLI 扩展**：
```bash
# 新增参数
--workflow-mode peer|leader|asymmetric   # 从 cycle_state.json 读取，或 CLI 显式传入
--require-sweep                          # 默认 True；theory milestone 可传 --no-require-sweep
```

#### 1.5 `cycle_state.json` — 记录 workflow_mode

在 `cycle_state_update` 初始化时写入 `workflow_mode`，供 gate 和 sidecar 读取。

#### 1.6 Member C sidecar 自动触发

当前 sidecar 需 `--sidecar` 手动启用或 config `sidecar_review.enabled: true`。改为：

- `team_cycle_sidecar_probe.py` 新增自动检测逻辑：
  - 读取 packet 内容，检查是否含数值 artifact（`.npy`, `.h5`, `.csv`, `.json` 数值文件指针）
  - 或检查 Reproducibility Capsule 中 `Milestone kind` 为 `computational`
  - 或检查 `headline_numbers` section 非空
  - 任一条件满足 → 自动启用 sidecar（等效 `--sidecar`）
- `--no-sidecar` 仍可强制禁用（用户显式选择优先）
- 配置优先级：`--no-sidecar` CLI > auto-detection > `--sidecar` CLI > config `enabled`

实现：在 `team_cycle_sidecar_probe.py` 的 `enabled` 判断中增加 `auto_detect_numerics(notes_path)` 分支。

### 验收标准

- [ ] **Item 0 前置修复全部完成并有独立 commit**
- [ ] `--workflow-mode peer` 行为与当前完全一致（回归：`pnpm -r test` + smoke test 通过）
- [ ] `--workflow-mode leader` 为默认（无 `--workflow-mode` 且 config 无该字段时）
- [ ] `--workflow-mode leader` 可完成增量验证路径（有 step-level CONFIRMED/CHALLENGED 记录）
- [ ] `--workflow-mode leader` 连续 2 CHALLENGED → `check_team_convergence.py` 返回 exit 3
- [ ] `run_team_cycle.sh` 正确处理 exit 3（提示 early stop + 修复重试，而非 generic "not converged"）
- [ ] `--workflow-mode asymmetric` critical_steps 在 member_b packet 中被 redact
- [ ] `--blind-numerics` 在 member_b packet 中 redact 所有 headline numbers
- [ ] convergence gate mode-aware 分支使用确定性解析，无 LLM judge
- [ ] `research_team_config.json` 支持 `workflow_mode` 字段（配置驱动）
- [ ] `peer` 可通过显式 `--workflow-mode peer` 启用（纯对等场景回归通过）
- [ ] peer A prompt 追加代数/符号专业化指令
- [ ] peer B / leader verifier / asymmetric verifier prompt 追加"强制验证不同量"指令
- [ ] leader verifier / asymmetric verifier prompt 追加"method selection challenge"指令
- [ ] sidecar 在 packet 含数值 artifact 时自动启用（`--no-sidecar` 可禁用）
- [ ] leader/asymmetric mode 的 step_verdicts 解析有对应的 golden fixture 测试
- [ ] 所有 member prompts 使用 §1.2.1 统一 nontriviality 定义（falsifiability principle + 开放示例 + fallback mode）
- [ ] gate 解析 NONTRIVIAL 时验证 `Falsification pathway` / `Failure mode targeted` / `Nontriviality reason` 三字段存在；缺失则降级为 TRIVIAL
- [ ] `Nontriviality reason` 受控词表可解析（`INDEPENDENT_PATH` 等 7 项 + `OTHER:*`）

---

## Item 2: RT-04 — Innovation ↔ idea-generator 桥接

### 背景与 SOTA 约束

**SOTA 结论**（详见 `meta/docs/sota-multi-agent-verification-2026.md` §RT-04）：
- 纯文本 INNOVATION_LOG 注入不足以支撑 idea-generator 去重逻辑
- breakthrough lead 必须映射到 `idea_card_v1` 结构化字段
- `--idea-source` 应接受 JSON 结构（`seed_pack_v1` 或 `idea_card_v1` 列表），Markdown 注入仅作 fallback

### 实施要点

#### 2.1 `run_team_cycle.sh` — 新增 `--idea-source`

```bash
--idea-source PATH    # 本地 seed_pack_v1.json 或 idea_card_v1 列表 JSON 文件路径
                      # 支持格式：{ "ideas": [idea_card_v1, ...] } 或 seed_pack_v1 schema
```

#### 2.2 `build_team_packet.py` — External Seeds 注入

当 `--idea-source` 提供时，在 packet 的 `## 0.3) External Idea Seeds (from idea-generator)` section 中注入：

```markdown
## 0.3) External Idea Seeds (from idea-generator)

以下 idea 已由 idea-generator 评估（避免重复探索）：

| thesis | claims count | status | falsifiable |
|--------|-------------|--------|-------------|
| ... | ... | active/killed | yes/no |

Member MUST NOT re-propose ideas already listed with status=killed.
```

注入逻辑：
1. 读取 `--idea-source` JSON 文件，按 `idea_card_v1` schema 验证
2. 提取 `thesis_statement`、`claims` 数量、`verification_status`、kill criteria（从 INNOVATION_LOG 额外字段读取，optional）
3. 写入 packet section，格式见上

#### 2.3 INNOVATION_LOG lead → `idea_card_v1` 映射

在 `build_team_packet.py` 中增加 `--export-leads-to PATH` 选项：将 `INNOVATION_LOG.md` 中的 active breakthrough leads 导出为 `idea_card_v1` JSON 列表，可直接被 idea-generator 消费。

字段映射（basis: `idea_card_v1.schema.json`）：
```
INNOVATION_LOG.lead.title        → idea_card_v1.thesis_statement
INNOVATION_LOG.lead.claims[]     → idea_card_v1.claims[].claim_text
INNOVATION_LOG.lead.hypothesis   → idea_card_v1.testable_hypotheses[0]
INNOVATION_LOG.lead.kill_criteria → idea_card_v1.claims[].verification_plan
```

导出时对映射字段做 schema 校验（`jsonschema` 或等效库），不合规字段 fail-fast。

#### 2.4 契约测试

在 `skills/research-team/tests/` 中增加：
- `test_idea_source_injection.py`：验证 `--idea-source` JSON 被正确注入 packet section
- `test_lead_export.py`：验证 INNOVATION_LOG lead 到 `idea_card_v1` 的字段映射完整性

### 验收标准

- [ ] `--idea-source` 注入生效，packet 中可见结构化 idea 列表（JSON 驱动，非 Markdown 手写）
- [ ] `--idea-source` 接受 `seed_pack_v1.json` 或 `{ "ideas": [...] }` 格式
- [ ] innovation lead 到 `idea_card_v1` 映射经过 schema 校验（`thesis_statement` / `claims` / `testable_hypotheses` 字段必填）
- [ ] 映射缺失必填字段时 fail-fast，不静默跳过
- [ ] 至少 1 组端到端测试（注入成功 + 字段映射完整 + 错误输入 fail-fast）

---

## 延后项记录

### 改动 4: 独立代码实现 + 静态审查 + 选优执行

**延后原因**: 需要多阶段执行基础设施（Phase 1 并行写代码 → Phase 2 静态互审 → Phase 3 一致性 gate → Phase 4 执行）。
在 `packet_only` 模式下 member 只能写代码片段但无法测试，价值有限。

**前置依赖**:
- RT-01 三模式工作流（本批次）
- 代码执行沙箱或 `full_access` 模式的成熟度
- RT-05 Information Membrane（为独立代码实现提供方法对齐而非结论泄露）

**目标时间**: Batch 5+ 或作为 REDESIGN_PLAN RT-06 独立项。

**设计草案**: 见 `meta/docs/prompts/prompt-phase3-design-batch4.md` 改动 4 详细分析。

---

## 实施规范

- 遵循 `CLAUDE.md`：无向后兼容负担、禁止临时性命名、commit 不加 Co-Authored-By
- 优先最小改动达成目标，不做额外重构
- 所有新增 Python 脚本保持与现有脚本风格一致（argparse, Path, sys.exit）
- `peer` 行为在无 `--workflow-mode` 时完全不变（零影响路径）
- System prompt 改动遵循增量原则：现有 12 项 deliverables 全部保留，只追加专业化指令

### 实施顺序（硬性）

```
Item 0 (convergence gate 修复 + 测试)     ← 第一步，独立 commit
  ↓
Item 1 (RT-01 三模式工作流)               ← 在 Item 0 修复后的代码上开发
  ↓
Item 2 (RT-04 桥接)                       ← 可与 RT-01 并行或之后
```

**理由**: Item 0 修复了一个真实 bug（mismatch → unknown）和若干边界缺陷。在有 bug 的代码上
叠加 mode-aware 分支会继承缺陷并放大测试盲区。先修后扩。

## 新建文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `tests/test_convergence_gate.py` | test | **Item 0**: convergence gate 12+ golden fixture 测试 |
| `assets/system_leader_main.txt` | prompt | leader/asymmetric A 的 system prompt |
| `assets/system_leader_verifier.txt` | prompt | leader B 的 system prompt（numerics-first + method challenge） |
| `assets/system_asymmetric_verifier.txt` | prompt | asymmetric B 的 system prompt（blind derivation + blind numerics） |
| `tests/test_idea_source_injection.py` | test | RT-04 idea-source 注入测试 |
| `tests/test_lead_export.py` | test | RT-04 innovation lead 导出测试 |

## 修改文件清单

| 文件 | 改动范围 |
|------|---------|
| `scripts/gates/check_team_convergence.py` | **Item 0**: mismatch bug 修复 + verdict 全文 fallback 修复 + sweep 豁免 + mode-aware 重构 |
| `assets/system_member_a.txt` | 追加代数/符号专业化指令（~15 行） |
| `assets/system_member_b.txt` | 追加数值/实现专业化 + 强制不同量验证（~25 行） |
| `assets/system_member_c_numerics.txt` | 无修改（已含 method selection check） |
| `scripts/bin/run_team_cycle.sh` | `--workflow-mode`, `--blind-numerics`, `--idea-source` 参数解析 + mode dispatch + exit code 3 处理 |
| `scripts/bin/build_team_packet.py` | mode-aware packet 构建 + redaction + idea-source 注入 + export-leads |
| `scripts/bin/team_cycle_sidecar_probe.py` | 自动触发逻辑 |
| `assets/research_team_config_template.json` | `workflow_mode` 字段 |

## 测试与验证

每轮提交前至少执行：

```bash
pnpm --filter @autoresearch/hep-mcp test -- tests/toolContracts.test.ts
pnpm --filter @autoresearch/hep-mcp test
pnpm -r build
pnpm -r test
bash skills/research-writer/scripts/dev/run_all_smoke_tests.sh
```

Python 测试（若新增）：
```bash
python3 -m pytest skills/research-team/tests/ -v
```

## 多模型收敛要求

按 `CLAUDE.md` 双模型收敛规则执行 `review-swarm`，并满足：

- 全模型 0 BLOCKING 才可视为收敛
- 收敛轮必须是完整 packet（非 delta-only）
- 每轮需处理所有模型的全部 BLOCKING finding

## 收敛后操作

1. commit
2. push
3. 更新 `meta/REDESIGN_PLAN.md` 对应 checkboxes
4. 生成下一批 prompt：`meta/docs/prompts/prompt-phase3-impl-batch5.md`
