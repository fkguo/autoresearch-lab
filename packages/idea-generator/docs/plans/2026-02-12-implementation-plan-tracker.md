# Idea-Generator 实施路线图 + 进度追踪（SSOT）

> 日期：2026-02-12  
> 最近整理：2026-03-09  
> 目标：把 `idea-generator` 保持为**通用设计 / 契约 / 规划工作区**，只保留对 `idea-core` / `hepar` / 后续 `idea-engine` 有长期复用价值的实现状态。  
> 原则：evidence-first、contract-first、HEP-first 但不 HEP-locked；实例级科研执行历史一律留在 repo 外归档。  
> SSOT：本文件只记录**包级设计与实现进度**；不得写入 run-level 科学进展、board-sync 回执或实例化长日志。

---

## 0. 范围与边界（写死，避免再污染）

### 0.1 本 repo 要保留什么

- `idea-generator` 的架构规格、契约设计、examples、validator 与实施路线。
- 对 `idea-core` / `hepar` / 后续 TS `idea-engine` 仍有复用价值的稳定结论。
- 通用质量门禁、目录边界、artifact/evidence/provenance 规则。

### 0.2 本 repo 不保留什么

- 实例 repo 的 run history、科研阶段日志、board-sync 快照、review transcript、local reviewer packets。
- 从 `idea-runs` 或任何 past campaign 直接拷回来的 examples / reports / evidence notes。
- 依赖单一课题、单一 observable、单一粒子体系才能理解的 checked-in SSOT。

### 0.3 进度记录纪律

- `DONE` 只表示**包级交付**完成，必须对应到 schema / spec / validator / implementation / tests 之一。
- 实例级科研执行状态必须写到外部运行仓或本地归档，不得写进本 tracker。
- 若某项历史上由测试实例推动完成，只记录其**通用产出**，不记录实例细节。

---

## 1. 当前状态快照

- **Last updated**：2026-03-09
- **Design spec**：READY（见 `docs/plans/2026-02-12-idea-generator-architecture-spec.md`）
- **Contracts**：READY（OpenRPC + JSON Schemas 为当前 checked-in authority）
- **External implementation state**：
  - `M1` 契约工具链：已落地到 `packages/idea-core`
  - `M2` 最小闭环：已落地到 `packages/idea-core`
  - `M3` HEP pack MVP：已完成最小可用闭环，但后续扩展必须保持 domain pack 边界
  - `M4` `hepar` / runtime adapter 集成：已完成最小落地
  - `M5` 实例解耦与质量门禁：已形成通用规则与 examples
- **Top next**：
  1) `W3-02`：补齐 operator families 的通用设计与验收口径
  2) `W5-06`：把 clean-room 多评审 / debate trigger 收敛为通用 gate
  3) 为 TS `idea-engine` 迁移提炼稳定契约与 planning seams（不带实例细节）

---

## 2. 里程碑摘要（只保留通用含义）

- **M0 — 设计冻结**：架构 spec、OpenRPC、核心 schemas、双评审收敛。
- **M1 — 契约工具链**：schema validate / bundle / drift guard / CI 骨架。
- **M2 — idea-core 最小闭环**：seed → search → eval → rank → promote 的可审计最小实现。
- **M3 — HEP DomainPack MVP**：HEP-first 的最小 pack，但不把 HEP 假设固化进 core。
- **M4 — hepar / runtime 集成**：artifact、ledger、runtime adapter、team/role 编排。
- **M5 — 质量门禁与实例解耦**：method fidelity、failure library、portability、repo boundary。
- **M6 — 多 Agent 研究团队演进**：只保留接口与治理设计，不在此 repo 写社区级运行史。

---

## 3. 工作流拆分（包级 SSOT）

状态枚举：`TODO | IN_PROGRESS | BLOCKED | DONE`

| ID | Workstream | Task | Deliverable | Status | Depends | Notes |
|---|---|---|---|---|---|---|
| W0-01 | Research | IdeaSearch / OpenClaw 证据补强 | 深读文档 + 可迁移机制清单 | DONE | M0 | 见 `docs/plans/2026-02-12-ideasearch-openclaw-deep-dive.md` |
| W0-03 | Research | OpenCode server / permission 映射 | runtime adapter 端点族清单 | DONE | M0 | 见 `docs/plans/2026-02-12-opencode-hepar-compatibility.md` |
| W0-04 | Research | 科学发现 → 可执行算子库 | operator families 文档 | DONE | M0 | 见 `docs/plans/2026-02-12-executable-discovery-operators.md` |
| W0-06 | Research | Distributor 策略设计 | allocator / audit 建议 | DONE | M0 | 见 `docs/plans/2026-02-12-statphys-distributor-policies.md` |
| W0-07 | Research | Bandit / allocator alternatives | allocator 方案比较 | DONE | M0 | 见 `docs/plans/2026-02-12-bandit-distributor-alternatives.md` |
| W1-00 | Contracts | 契约补丁与冻结 | schemas + OpenRPC 更新 | DONE | M0 | Authority 仍在 `schemas/` |
| W1-01 | Contracts | Schema/OpenRPC 校验命令 | validate script / CI hook | DONE | M1 | 落地于 `packages/idea-core` |
| W1-02 | Contracts | OpenRPC 打包 / 解引用 | bundled OpenRPC | DONE | W1-01 | 落地于 `packages/idea-core` |
| W1-03 | Contracts | Reduction / distributor 契约补丁 | schemas + spec 更新 | DONE | M0 | Authority 仍在 `schemas/` |
| W1-04 | Contracts | non-blocking contract amendments | schemas + spec 更新 | DONE | M0 | 已吸收入当前 authority |
| W2-01 | Core | IdeaStore + 索引/分页 | store + tests | DONE | M2.1 | 落地于 `packages/idea-core` |
| W2-02 | Core | JSON-RPC server（stdio） | rpc server + tests | DONE | M2.3 | 落地于 `packages/idea-core` |
| W2-03 | Core | Budget circuit breaker | budget module + tests | DONE | M2.4 | 落地于 `packages/idea-core` |
| W2-04 | Core | Multi-Island loop | island loop + tests | DONE | M2.5 | 落地于 `packages/idea-core` |
| W2-05 | Core | Eval pipeline（MVP） | scorecards + writeback | DONE | M2.9 | 落地于 `packages/idea-core` |
| W2-06 | Core | Ranking（Pareto/Elo） | ranking artifact | DONE | M2.10 | 落地于 `packages/idea-core` |
| W2-07 | Core | Promote（handoff） | handoff artifact | DONE | M2.11 | 落地于 `packages/idea-core` |
| W2-08 | Core | Operator MVP | operator loop + auditable traces | DONE | M2.6 | 落地于 `packages/idea-core` |
| W2-09 | Core | 可回放 demo campaign | replay runner + manifest + isomorphism checks | DONE | M2.12 | 落地于 `packages/idea-core` |
| W2-10 | Core | Explain-Then-Formalize | deterministic formalization path | DONE | M2.7 | 落地于 `packages/idea-core` |
| W3-00 | HEP Pack | DomainPack 包装与按需加载 | index + lazy loading | DONE | M3.0 | HEP-first, not HEP-locked |
| W3-01 | HEP Pack | formalism registry MVP | registry artifact | DONE | M3.1 | DomainPack 边界已明确 |
| W3-02 | HEP Pack | Operators x3 family completion | operator implementations + acceptance | TODO | W3-01 | 必须保持 pack-level 假设，不回流到 core |
| W3-03 | HEP Pack | retrieval recipes | query templates | DONE | W3-02 | 落地于 `packages/idea-core` |
| W3-03A | HEP Pack | novelty delta discipline | schema-validated scorecards | DONE | W3-03 | 落地于 `packages/idea-core` |
| W3-04 | HEP Pack | constraints / validators | validator outputs | DONE | W3-03 | 落地于 `packages/idea-core` |
| W3-05 | HEP Pack | compute plan rubric | resource rubric | DONE | W3-04 | 落地于 `packages/idea-core` |
| W4-01 | Integration | WorkOrder / WorkResult / TeamPlan | artifacts + ledger | DONE | M4 | 落地于 `packages/idea-core` |
| W4-02 | Integration | runtime adapter | API client + policy | DONE | W4-01 | 落地于 `packages/idea-core` |
| W4-03 | Integration | hepar command bridge | translation + replay artifacts | DONE | W4-02 | 落地于 `packages/idea-core` |
| W4-04 | Integration | Team/Role staged orchestration | parallel review merge-back | DONE | W4-03 | 落地于 `packages/idea-core` |
| W5-01 | Quality | A0 gates + external pilot boundary | generic gate docs + external-instance rule | DONE | W5-04 | 见 `docs/plans/2026-02-15-m5-test-instance-retro-and-hardening.md` |
| W5-02 | Quality | failure library | negative-results store + examples | DONE | W5-01 | Examples must stay generic |
| W5-03 | Quality | test-instance decouple policy | `idea-runs` boundary + anti-pollution gate | DONE | M5 | 见 `docs/plans/2026-02-15-m5-test-instance-retro-and-hardening.md` |
| W5-04 | Quality | method / literature / numerics / doc / scope / portability gates | schemas + checklist | DONE | W5-03 | 见 `docs/plans/2026-02-15-w5-04-quality-gates-checklist-v1.md` |
| W5-05 | Quality | control-plane hardening backlog | security + reliability + perf patch plan | DONE | W5-03 | 通用工程结论已外溢到实现仓 |
| W5-06 | Quality | clean-room 多评审 + debate trigger | gate contract + checklist | TODO | W5-04 | 仅保留通用 gate，不保留具体评审回合日志 |

---

## 4. Update Log（只记录包级里程碑）

### 2026-02-12

- 完成架构 spec、OpenRPC 与核心 schemas 的冻结与评审收敛。
- 补齐 IdeaSearch / OpenClaw / OpenCode / distributor / operator-family 深读与可执行映射。
- 明确 `idea-generator` 作为设计与契约工作区，而非运行实例目录。

### 2026-02-13

- `M1` 契约工具链落地到 `packages/idea-core`。
- `M2` 最小闭环（search / eval / rank / promote / replay demo）落地到 `packages/idea-core`。
- `M2.12` replayable demo 形成 checked-in golden trace。

### 2026-02-14 ~ 2026-02-15

- `M3` HEP DomainPack MVP 与 `M4` hepar/runtime integration 完成最小实现闭环。
- `M5` 的实例解耦、failure library、quality gates、portability / boundary hardening 收敛为通用规则。

### 2026-03-09

- 从 checked-in tracker 中移除实例级 W6/pilot 运行史、board-sync 日志与 scientific diary。
- 保留对后续 `idea-engine` / orchestrator 仍有复用价值的稳定设计、契约与 gate 结论。
