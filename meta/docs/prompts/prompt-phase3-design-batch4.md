## 上下文：autoresearch-lab Phase 3 Batch 4 前置设计讨论

### 项目背景
`/Users/fkg/Coding/Agents/autoresearch-lab` 是一个 HEP（高能物理）科研自动化 monorepo。
核心组件 `skills/research-team/` 实现了一个多 provider 独立验证工作流：
- Member A（`run_claude.sh`）和 Member B（`run_gemini.sh` 或其他 provider）各自独立接收
  相同的 "team packet"（推导笔记 + 代码变更 + artifact），输出独立审查报告
- `check_team_convergence.py` 用确定性解析（非 LLM judge）判断是否收敛
- Member C（可选 sidecar）：`system_member_c_numerics.txt`，数值专项审查

### 上次对话已确认的结论（请先阅读参考文件）

**参考文件**：
- `meta/docs/sota-multi-agent-verification-2026.md` — 16 篇 SOTA 文献 + HEP+LLM 发表格局
- `meta/docs/prompts/prompt-phase3-impl-batch4.md` — RT-01/RT-04 当前实施规范
- `skills/research-team/assets/system_member_a.txt` — Member A 当前 system prompt
- `skills/research-team/assets/system_member_b.txt` — Member B 当前 system prompt（与 A 完全相同）
- `skills/research-team/assets/system_member_c_numerics.txt` — Member C sidecar prompt

**已确认的决策（2026-03-02 修订）**：
1. ~~不引入 A2A 通信框架~~ → **拒绝自由辩论（MAD），引入结构化协作（Semi-permeable Clean Room）**
   - 自由辩论有害：[8][9][10][11][18] 充分证明 MAD 导致 sycophancy
   - 结构化协作有益：[17] AIED 2025 证明 peer-to-peer collaboration > debate
   - 实现方式：Information Membrane（信息膜）按内容类型过滤——方法 PASS，结论 BLOCK
   - 架构：在 Skill 内实现（bash 编排 + Python helpers），不引入 AutoGen/LangGraph
   - 详见 `meta/docs/sota-multi-agent-verification-2026.md` §第四部分
   - 实施计划：REDESIGN_PLAN RT-05，在 RT-01 之后的独立 batch 实施
2. `leader` 为 research_team_config 的默认 workflow_mode（跨 provider 异构 ensemble）
3. convergence gate 保持确定性解析，不引入 LLM judge
4. RT-01（三模式工作流）和 RT-04（innovation ↔ idea-generator 桥接）即将在 Batch 4 实现

### 需要在本次对话中深入讨论并决定的设计问题

#### 背景：当前 system prompt 的已知问题

Member A 和 B 的 contract **完全相同**，实际效果不理想：

**问题 1（用户亲身确认）**：两个 member 经常选同一个最容易的 headline number 验证，
且验证内容极 trivial（加减乘除、开根号），几乎必然 match，验证价值极低。

**问题 2（用户亲身遇到）**：数值方法选择从不被系统性审查。
典型案例：trapz（梯形积分）被用于需要高精度的积分，应改用自适应 Gauss-Kronrod，
但两个 member 都没有专门针对"算法选择是否合理"发出挑战。

**问题 3**：packet 里包含 claimed result，member 做的是"对齐检验"（我算的和这个一样吗），
而非真正的独立计算（先独立算出答案再比对）。

#### 待讨论的四个改动方向

**改动 1（零成本，只改 system prompt）**：角色分工
- Member A → 代数/符号专家（深度重推推导，专注符号错误、指标约定、极限合法性）
- Member B → 数值/实现专家（专注代码逻辑、算法选择合理性、收敛性、artifact 可追溯）
- Member C sidecar → 触发条件从手动 `--sidecar` 改为"packet 含数值 artifact 时自动启用"

**改动 2（一行指令，零成本）**：强制验证不同数值
- 在 Member B system prompt 中加：必须验证与"最显而易见的 headline number"不同的量
  （不同公式路径、不同参数点、或中间量的非平凡组合）

**改动 3（中等成本，合并进 RT-01 实现）**：blind numerics
- `build_team_packet.py` 新增 `--blind-numerics` 选项
- Member B 的 packet 中 headline numbers 替换为 `[HIDDEN — compute independently]`
- B 必须先独立计算，再比对，而非"对齐验证"
- 与 RT-01 asymmetric 模式（隐藏 leader 中间结论）是同一机制，可合并实现

**改动 4（需要最多设计，是否纳入 Batch 4 待定）**：独立代码实现 + 静态审查 + 选优后执行

核心思路（用户提出，上次对话初步分析有价值）：
```
Phase 1（并行，不执行代码）：
  Member A：推导 + 写实现 A（标准 canonical 方法，如 scipy.integrate.quad）
  Member B：推导 + 写实现 B（关键数值步骤必须用不同方法，如 Gauss-Kronrod / Vegas）
  约束：B 不看 A 的实现，A 不看 B 的实现

Phase 2（静态互审，不执行）：
  A 审 B 的代码 → 算法正确性、公式对应、边界处理、收敛保证
  B 审 A 的代码 → 同上
  各自给出 static convergence argument

Phase 3（一致性 gate，check_team_convergence.py 扩展）：
  算法层面等价 → 选 A（canonical first-mover），进入执行
  算法层面分歧 → CHALLENGED，记录分歧点 → 人工介入或 leader early stop
  两者均发现公式错误 → 不执行，回到推导

Phase 4（执行 + 可选交叉验证）：
  执行选中实现；可选：同时执行另一实现，比较数值一致性
```

SOTA 支撑：N-version programming + pass@k/select + eff@k（correctness ≠ efficiency）。
与 RT-01 leader 模式的 step-by-step 验证天然对齐：verifier 在每步写独立代码实现
（而非重推代数），algorithm CHALLENGED 触发 early stop。

### 本次对话的目标

1. **深入讨论改动 4 的可行性与边界**：
   - 在 `packet_only` 模式下，member 能否写出有意义的独立实现？
     （他们只能看 packet，看不到项目完整代码库）
   - 独立实现的粒度应该是什么？整个计算模块？还是只有核心数值步骤（如积分、ODE 求解）？
   - "不同方法"的约束如何在 system prompt 中明确表达而不产生歧义？
   - 静态 convergence argument 的格式和 gate 判定标准？

2. **决定改动 1–4 中哪些纳入 Batch 4，哪些延后**

3. **更新 `meta/docs/prompts/prompt-phase3-impl-batch4.md`**（如有必要）

4. **更新 `meta/docs/sota-multi-agent-verification-2026.md`** 中的"改进设计方向"节
   （记录本次讨论结论，作为论文 Methods 节的素材）

执行 Batch 4 的实现本身**不在本次对话范围内**——等设计确定后另开对话实现。
