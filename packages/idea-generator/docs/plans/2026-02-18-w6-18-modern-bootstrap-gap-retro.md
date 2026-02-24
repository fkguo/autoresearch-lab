# W6-18 复盘：为何前期没有优先做“现代 bootstrap tightening”，以及生态圈工具改进建议（SSOT 见 tracker）

时间：2026-02-18  
范围：pion-only（no coupled-channel）GFF bootstrap campaign（实例在 `idea-runs`）  
SSOT tracker：`docs/plans/2026-02-12-implementation-plan-tracker.md`（本文件不作为 tracker，只做复盘/设计输入）

## 1) 这次“没做到/做晚了”的具体点（可审计）

在 arXiv:2403.10772 中，SVZ/FESR moment 约束不是“每个 moment 各自一个误差带”，而是**对误差向量的范数约束**（Eq. `SRerr` 形如 $\\|w\\|\\le\\epsilon$）。  
我们在早期阶段（W6-01~W6-17）只实现了：
- 相对容差的 componentwise band（较松），以及
- 绝对容差的 componentwise band（吸收了 SRerr 的数量级，但仍弱于向量范数约束）。

直到 W6-18 才把 **SRerr 的向量 $L_2$ 范数约束**作为 SOC（SOCP）tightening 接入 joint SOCP 主线，并在 $Q^*$ 单点上量化其 tightening（见实例 repo 的 `evidence/neg_results/2026-02-18-srerr-moment-l2-socp-qstar-v1.txt`）。

结论（事实层面）：这是一个“现代 bootstrap 意义下更忠实的高能输入实现”，但 tightening 幅度在当前离散化/其他主导约束下较小；更重要的是，它本应更早进入主线对比集合。

## 2) 为什么会发生（根因：流程/工具，而不是“某个 solver”）

### 2.1 产物驱动偏置：工程门禁把注意力吸走了

W5/W6 早期我们优先把：
- decoupled pilot + failure library + gates + islands/opportunity pool 的 machine-checkable 链路
做成“能跑、能审计、能回放”。这在质量上是必要的，但副作用是：
- **tightening 候选**（来自 extraction cards / opportunity pool）没有被强制“进入下一步执行队列”，导致主线更多在“能解的 formulation + solver 稳定性”上迭代，而不是在“更强的物理/数学输入”上迭代。

### 2.2 缺少“现代 bootstrap tightening checklist gate”（可机器检查的优先级门禁）

我们没有一个 gate 去强制回答：
- 这轮主线 tightening 是否已经覆盖了 extraction cards 中的高影响约束形式？  
  例如：向量范数、PSD minors/Gram PSD、OPE/UV 输入、低能匹配的向量误差预算等。

结果就是：即使 extraction card 里出现了 `SRerr` 这类“形状很明确、实现又是凸约束”的 tightening，我们也可能因为“已有 componentwise band 能跑”而推迟实现。

### 2.3 缺少“约束语义 SSOT”：moment_spec 的语义没有被显式类型化/标准化

当前 moment 约束在配置里表现为：
- `targets + absolute_tolerance` 或 `targets + relative_tolerance`

但缺少一种强约束语义层的 SSOT（例如 `tolerance_mode=l2_norm`, `weights`, `epsilon_source`），导致：
- reviewer 不容易一眼发现“这里和 paper 的约束形式不一致”，
- 也不容易形成“先实现约束语义，再调 discretization/solver”的执行顺序。

### 2.4 数值可复现门禁缺失：缺少“缩放不变性/残差预算”验收模板

本轮 W6-18 实现 SRerr L2 时，Clarabel 出现 `NUMERICAL_ERROR` regression；这暴露了一个更通用的问题：
- 我们缺少一个**预注册的 acceptance criterion**，去判断“这次 solver tuning/缩放改变是否引入 objective bias 或误差”。

即使 tightening 本身是凸且语义正确，如果没有“残差预算 + 缩放不变性”的验收模板，就容易在 solver 层反复纠缠，掩盖真正要做的 tightening。

## 3) 对生态圈工具/流程的改进建议（可执行、可测试）

> 这些建议不在本轮强制实现范围内，但必须记录，供后续对话/迭代落地。

### 3.1 新 gate：`tightening_coverage_gate_v1`（面向 islands/opportunity）

当 `artifacts/opportunities/` 中存在 `IN_SCOPE` 机会卡时：
- 要么（A）在 island progress stream 里有对应的 `ARTIFACT_ADDED` 事件（表示已执行/已证伪），  
- 要么（B）写入 `failed_approach_v1`（明确 why not）并可被 failure-library query 命中。

这样可以把“现代 bootstrap tightening”从“可选项”提升为“必须显式处理”的对象。

### 3.2 约束语义 schema：把 moment 约束从“数值参数”升级为“类型化协议”

建议把 moment 约束定义升级为类似：
- `moment_spec: { mode: componentwise|l2_norm, epsilon: ..., weights: ..., source: {paper, eq_label, rationale} }`

并在 validator 中强制：
- `l2_norm` 必须给出 `l2_epsilon`，以及（可选）`l2_weights` 的长度一致；
- `componentwise` 必须给出 abs/rel tolerance，且对相对容差给出 target 非零检查（避免隐式奇点）。

### 3.3 新 gate：`solver_acceptance_gate_v1`（残差预算 + 缩放不变性）

在 “promote 任何数值结果为 physics evidence” 之前，要求落盘：
- primal/dual gap（或 dual recompute）、
- cone margins（SOC / modulus / positivity kernel）、
- equality residuals（sum rules）、
- **moment residual norms（componentwise 与 L2）**，
并用一个统一阈值模板判定 PASS/FAIL。

加分项：同一 config 在不同缩放（或不同 solver）下的 objective 必须在阈值内一致，否则自动降级为 diagnostic。

### 3.4 Board sync 工具硬化（已发现缺陷）

我们在 `/tmp` 辅助脚本里看到过 board-sync summary 脚本存在明显 bug（未定义变量/字符串键引用错误）。  
建议把 board sync（snapshot + mutation + summary）收敛到 repo 内可测试脚本，并在 `make validate` 中提供最小 dry-run（不需要真实 mutation）。

### 3.5 review-swarm review rubric 加一个必答项：现代 bootstrap 对齐

每阶段双评审必须回答：
- “本阶段 tightening 是否与 seed paper 的约束形式一致？若不一致，差异是什么，为什么允许？”
- “机会池中最强的 tightening 候选有哪些？本阶段选择了哪一个/为什么没选？”

避免 reviewer 只聚焦 solver/工程而忽略物理 tightening。

## 4) W6-18 之后的直接执行建议（不是 tracker）

如果目标是把 pion GFF bound 像 $\\pi\\pi$ 振幅 bootstrap 一样显著收紧，下一步更可能来自：
- 增加/改进 UV 输入（更多 moments / OPE / trace-anomaly 输入；机会卡 `2212.09417`），
- 引入 1–2 个低能条件（例如 slope/radius 的区间约束）并做灵敏度岛屿扫描，
- 改善 positivity kernel 家族（优化 kernel / 更强 PSD 结构，超越最小 Gram cross5）。

这些需要在 tracker 中按阶段门禁推进，并每步落盘 runs+报告+评审收敛证据。

## 5) 证据指针（便于回放）

- SRerr L2 tightening 证据（实例 repo）：`idea-runs/.../evidence/neg_results/2026-02-18-srerr-moment-l2-socp-qstar-v1.txt`
- 相关 runs：`idea-runs/.../runs/2026-02-18-a-bochner-k0-socp-v31-*`、`v32-*`、`v35-*`
- 本文件应在 tracker Update Log 中被引用（W6-18 条目）

