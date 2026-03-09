# Constraint-Tightening Retro（历史文件名保留） — 2026-02-18

时间：2026-02-18  
范围：从早期原型中提炼**可复用的 tightening / numerics / review gate 设计**。  
SSOT tracker：`docs/plans/2026-02-12-implementation-plan-tracker.md`

## 1) 问题不是“某个 solver”，而是 tightening 候选没有进入强制执行队列

早期 bring-up 容易先把：
- repo boundary、
- failure library、
- review / gate / replayability
做成闭环。

这一步是必要的，但副作用是：强 tightening 候选如果只存在于 extraction cards 或 opportunity pool 中，而没有进入强制 gate，就会被“能跑的较弱 formulation”长期挤压。

结论：
- 任何高价值 tightening 候选都不能只是被“记录下来”；
- 要么执行，要么被明确否决并进入 failure library；
- 不能停留在“知道有这条路，但本轮先不做”的非结构化状态。

## 2) 根因分析

### 2.1 候选覆盖缺少显式门禁

如果 islands / opportunities 只是建议层，而不是 gate 输入，那么执行会自然偏向：
- 最稳定的 formulation，
- 最容易调通的 solver，
- 最容易落盘的结果。

这会系统性低估“语义更强、实现稍难”的约束形式。

### 2.2 约束语义没有类型化

把约束仅表达为：
- target + abs tolerance，或
- target + relative tolerance，
会让 reviewer 很难判断“实现是否忠于原约束语义”。

需要把约束语义提升为可审计协议，例如：
- componentwise band
- norm-bounded residual
- PSD / cone / region constraint
- source / rationale / applicability window

### 2.3 数值验收模板不够前置

当 tighter formulation 带来更敏感的数值行为时，如果没有预注册的 acceptance template，团队就容易把精力花在“本轮 solver 为什么不稳”而不是“约束语义是否值得保留、怎么被正确验收”。

需要把：
- residual budget、
- cone margin、
- equality residual、
- cross-solver / cross-scaling consistency
前置为默认门禁，而不是事后补救。

## 3) 建议沉淀到生态圈里的通用改进

### 3.1 `tightening_coverage_gate_v1`

当某个 opportunity / island 被标成 `IN_SCOPE`：
- 要么有对应执行证据，
- 要么有结构化否决记录并进入 failure library。

目的不是强迫每条路线都成功，而是强迫每条高价值路线都被**显式处理**。

### 3.2 约束语义 schema

把“约束类型”从数值参数提升为协议层：
- `mode`
- `source`
- `rationale`
- `weights`
- `validity_window`
- `acceptance_checks`

这样 reviewer 才能审“是否实现了同一种约束”，而不只是审“有没有某个数字带”。

### 3.3 `solver_acceptance_gate_v1`

把数值验收变成固定模板：
- primal / dual gap
- residual summaries
- cone / PSD margin
- norm-based residual checks
- cross-solver or cross-scaling consistency

若不满足，则结果只能降级为 diagnostic，不能晋升为 physics evidence。

### 3.4 Review rubric 必答项

每轮 formal review 必须回答：
- 本轮 tightening 与 source constraint semantics 是否一致？
- opportunity pool 中最强的候选是否已被执行或否决？
- 若没有，为何允许 defer？

这样可以防止 review 只盯着工程表面，而忽略真正重要的 constraint upgrade。
