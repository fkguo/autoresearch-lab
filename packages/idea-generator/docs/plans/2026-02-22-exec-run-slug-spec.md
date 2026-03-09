# Exec Run `run_slug` 命名规范（v1，Nutstore/跨平台友好）

> 目的：避免 `runs/<run_slug>/` 路径过长、云盘同步不稳定、以及“把全部配置塞进目录名”导致的不可维护。
> 本规范只约束 **执行端 run 目录名**；完整参数必须放在 `runs/<run_slug>/config.json` 与 `compute/*.json`（以及 `notes[]`）中作为审计真源。

## 1) 约束（MUST / SHOULD）

- MUST：只用 ASCII 小写字母、数字、短横线 `-`；不得包含空格、冒号、斜杠、反斜杠。
- MUST：以日期开头：`YYYY-MM-DD-...`（便于排序与审计）。
- MUST：包含可审计的**语义化 lane / stage 标识**（例如 `baseline`、`constraint`、`diagnostic`、`repro`），不要把历史 batch id / week id 写进长期命名。
- SHOULD：长度 ≤ 96 字符（经验阈值；给 Nutstore/跨平台路径留下余量）。
- SHOULD：包含“研究主题 + 核心内核 + 变体 id + 网格尺度”四类信息即可；其余参数不要进 slug。
- MUST：避免把所有 flag（`enf30/q2grid9/audit30/eps1e-6/...`）拼入 slug；这些属于 `config.json` 的职责。

## 2) 推荐模板

```
{date}-{lane}-{topic}-{kernel}-v{variant}-g{grid}-n{q2n}
```

字段含义（建议）：
- `topic`：`observable` / `constraint` / `spectrum` / `symmetry`（尽量短）
- `kernel`：`fullpsd` / `socp` / `symbolic`（内核类型）
- `variant`：`v1q` 这种“短版本号”（与 `compute/*_config_v1q_*.json` 对齐）
- `grid`：`g200`（s-grid 点数）
- `q2n`：`n9`（Q² 采样点数；不是最大 Q²）

## 3) 示例（本轮已采用）

- 长名（不推荐）：`2026-02-22-observable-trace-baseline-sdp-fullpsd-v1n-grid80-audit27-eps1e-6-...`
- 短名（推荐）：`2026-02-22-constraint-observable-fullpsd-v1q-g200-n9`

对应审计真源：
- `runs/2026-02-22-constraint-observable-fullpsd-v1q-g200-n9/config.json`
- `compute/observable_trace_fullpsd_config_v1q_*.json`（完整参数 + notes）

## 4) 去重/碰撞策略（当需要时）

- 默认：`run_slug` 必须在项目内唯一；runner 必须 fail-closed（run dir 已存在且非空则报错）。
- 若同一天同版本多次跑（需要并行/重跑）：
  - 方案 A（推荐）：`-r{NN}`（如 `-r02`）
  - 方案 B：`-h{8hex}`（`config.json` 的 sha256 前 8 位）
