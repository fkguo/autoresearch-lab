# 实例边界与质量门禁硬化说明

> 日期：2026-02-15  
> 范围：`idea-generator` 设计面、`idea-core` / `hepar` 实现面，以及外部运行仓集成边界。  
> 目标：只保留对长期架构仍稳定有效的边界规则、门禁抽象与工程硬化结论。

---

## 0. 核心结论

- `idea-generator` 只承担设计、契约、validator 与稳定规划职责，不承载运行实例、研究日记或本地评审流程。
- 运行实例必须放在外部运行仓；当前生态中的已知 consumer 是 `idea-runs`，但这里固定的是**边界契约**，不是某个单一项目的目录快照。
- 质量门禁不能只检查“artifact 是否存在”，而必须检查**方法声明、证据覆盖、数值验证、可移植性与 scope 标记**是否一致。
- checked-in 文档只保留通用不变量；回合日志、看板回执、review transcript、本地路径与 push 记录都应移出仓库。

---

## 1. Repo 角色分离

### 1.1 设计仓

`idea-generator` 保留：

- schema / OpenRPC / validator / fixture
- 设计说明、实施路线、长期规则
- 对下游实现仓仍有复用价值的稳定结论

不得保留：

- `artifacts/runs/**` 一类运行输出
- 科学进展长日志、实例级 tracker、board/mutation 回执
- 从外部运行仓直接拷回的项目快照、报告或证据索引

### 1.2 实现仓

`idea-core` / `hepar` 保留：

- 运行时实现
- 针对边界与 gate 的回归测试
- 可重放的最小实现验证

### 1.3 外部运行仓

外部运行仓负责：

- project charter / tracker / runs / reports / evidence
- backend 选择、任务分解、参数化与执行日志
- 研究课题相关的实例化目录结构

这里固定的是**运行仓必须满足的边界和 artifact 契约**，而不是某个特定仓库的历史流程。

---

## 2. 运行仓的最低边界要求

外部运行仓至少应具备以下稳定约束：

- 所有 pipeline / artifact path 必须相对 project root，并在解析后仍位于 root 内。
- 运行重放依赖显式 toolchain manifest / lock，禁止依赖本机未提交状态。
- 人类审计入口必须明确，一般至少包括 `reports/` 与 evidence index。
- 任何绝对路径、本地 cache、临时 reviewer 输出，都不得进入 checked-in SSOT。

---

## 3. 必须保留的质量门禁抽象

以下产物/门禁是长期稳定不变量，应该保留为 schema + validator + fixture：

### 3.1 方法一致性

- `method_fidelity_contract_v1`
- 用于检查声明的方法族、实际实现分类、约束执行情况与 shortcut 检测结果是否一致

### 3.2 文献覆盖

- `literature_search_evidence_v2`
- 用于检查 seed intake、扩展检索、纳入/剔除理由与 coverage report 是否完整

### 3.3 数值方法质量

- `numerics_method_selection_v1`
- `numerics_validation_report_v1`
- 用于区分“最小可运行实现”和“足以支撑研究结论的数值质量”

### 3.4 单一人类可读文档

- gate 应要求存在持续更新的人类可读主文档
- 其职责是把 assumptions、notation、derivation、I/O contract 与结论状态放在同一审计面

### 3.5 idea 扩展闭环

- 运行仓不得绕过 search → eval → rank → promote 的核心闭环
- 失败样本必须进入 failure library，避免系统退化为“只跑既定 pipeline”

### 3.6 可移植性与 scope

- `portability_report_v1`
- `scope_classification_v1`
- 用于明确当前结果是 `ecosystem_validation`、`preliminary_physics` 还是 `publication_ready`

---

## 4. 实现仓需要吸收的工程硬化项

这些问题是运行时/实现层面的长期要求，不应再以实例复盘日志的形式留存：

- path traversal / workspace-root 逃逸防护
- 原子写入与并发幂等
- timeout / backoff / capability probe
- 事件日志与 ledger 的 append-only / 审计一致性
- 对外部 reviewer / backend 的 fail-closed 包装

它们应通过实现仓测试与契约收口，而不是继续在设计仓保留执行回合记录。

---

## 5. checked-in 文档保留规则

在 `idea-generator` 中，只保留以下两类材料：

- **dated design notes**：说明一个稳定设计决策为何成立
- **stable fixtures**：为 schema / validator 提供最小、通用、可复用的 machine-checkable 示例

不再保留：

- 执行计划脚本化 runbook
- 本地 reviewer packet 与收敛回合记录
- board / issue mutation 细节
- push 状态、绝对路径与本机环境说明

---

## 6. 对后续 TS `idea-engine` 的含义

这份说明保留的不是某次历史实例，而是未来迁移仍应继承的边界：

- 设计面与运行面分离
- 契约先于实现
- 运行时内容由 LLM / agent 在治理边界内决定
- checked-in SSOT 只固定长期稳定不变量
