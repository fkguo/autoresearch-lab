# Phase 2 Batch 7 — Orchestrator MCP Tools + Approval Context + Computation Contract

## 前置状态

- Phase 0: ALL DONE (14/14)
- Phase 1: 18/22 done (remaining: NEW-R03b/UX-01/UX-05/M-19 deferred)
- Phase 2: 32/43 done
  - Batch 1 ✅: H-07, H-11b, H-12, H-15b, H-17 (reliability + safety)
  - Phase 2A ✅: NEW-RT-02, NEW-RT-03 (reconnect, span tracing)
  - Phase 2B ✅: NEW-CONN-02 (review feedback)
  - Batch 2 ✅: M-19, H-16b, M-21, M-05, M-02, M-06 (contracts + observability + payload)
  - Batch 3 ✅: H-05, H-09, H-10, H-21, M-23, NEW-R07 (data paths + file lock + CAS + event enum + coverage gate)
  - Batch 4 ✅: M-20, trace-jsonl, NEW-R06, NEW-R05 (migration registry + JSONL logging + schema consolidation + evidence SSOT)
  - Batch 5 ✅: NEW-02, NEW-03, NEW-04, NEW-R08 (approval infrastructure + skills LOC budget)
  - Batch 6 ✅: RT-03, RT-02, NEW-R10, NEW-VIZ-01 (runner API + clean-room + coordinator split + graph viz)
- REDESIGN_PLAN: v1.8.0-draft
- **总进度**: 64/135
- **Last commit**: `436ccb8` (Batch 6 tracker update)

## 本批目标

Phase 2 第七层——编排器 MCP 工具实现 + 审批上下文丰富化 + 计算契约 schema。Batch 6 完成了 RT-02/RT-03 clean-room 和可视化基础设施，现在实现 NEW-02 已解锁的核心 MCP 工具层。

**本批 3 项** (Python + TS + JSON Schema):

| # | ID | 标题 | 估计 LOC | 依赖 | 解锁 |
|---|-----|------|---------|------|------|
| 1 | NEW-R15-impl | 编排器 MCP 工具实现 | ~500 | NEW-02 ✅, H-03 ✅, H-07 ✅ | NEW-RT-01, NEW-COMP-01 |
| 2 | UX-07 | 审批上下文丰富化 | ~200 | NEW-02 ✅ | 人类审批质量 |
| 3 | UX-02 | 计算契约 schema | ~100 | 无 | NEW-CONN-03 |

**总估计**: ~800 LOC

完成后 Phase 2 进度: 35/43 done (从 32 升至 35)。
下一步: NEW-RT-01 (TS AgentRunner, 依赖 NEW-R15-impl) 可作为 Batch 8 重点。

---

## 执行前必读

1. `serena:read_memory` → `architecture-decisions.md` 和 `codebase-gotchas.md`
2. Claude Code auto memory → `memory/MEMORY.md` 和 `memory/batch-workflow.md`
3. 读 `meta/REDESIGN_PLAN.md` 中各项详细规格（搜索 NEW-R15-impl, UX-07, UX-02）
4. 读 `packages/hep-autoresearch/src/hep_autoresearch/` — 编排器现有结构
5. 读 `packages/hep-mcp/src/` — MCP server 现有工具实现模式 (Zod + tool handler)
6. 读 `packages/hep-autoresearch/src/hep_autoresearch/approval/approval_packet.py` — NEW-02 审批基础设施
7. 读 `meta/REDESIGN_PLAN.md` §NEW-R15-spec — 了解 `orch_run_*` 工具规格的现有设计文档

---

## Item 1: NEW-R15-impl — 编排器 MCP 工具实现

**REDESIGN_PLAN 行号**: 搜索 `NEW-R15-impl`

**范围**: 实现 `orch_run_*` MCP 工具集，通过 MCP 暴露 hepar 编排器操作。

**实现**:

1. 在 `packages/hep-mcp/src/` 创建或扩展 orchestrator 工具模块:
   - `orch_run_create` — 幂等创建 run (含 `idempotency_key`)
   - `orch_run_status` — 只读 run 状态查询
   - `orch_run_list` — 只读 run 列表 (含 filter/pagination)
   - `orch_run_approve` — `destructive` 审批: 需 `_confirm: true` + `approval_id` + `approval_packet_sha256` 三重验证
   - `orch_run_reject` — `destructive` 不可逆拒绝
   - `orch_run_export` — 条件性 `destructive` 导出
   - `orch_run_pause` / `orch_run_resume`
   - `orch_run_approvals_list` — 只读 pending 审批列表
   - `orch_policy_query` — 只读，Agent 可查询 "此操作是否需要审批?" + 历史先例

2. 工具实现模式:
   - 遵循 `packages/hep-mcp/CLAUDE.md` 的 Zod SSOT 规则
   - 所有工具通过 `packages/hep-mcp/src/tools/` 注册
   - 工具名常量化 (参见 H-16a 模式: `TOOL_NAMES` 对象)
   - `_confirm` 防护模式参考现有 `destructive` 工具实现

3. URI scheme: `orch://runs/<run_id>` (与现有 `hep://` 不冲突)

**安全约束**:
- `orch_run_approve` 必须验证 `approval_packet_sha256` 与磁盘文件哈希匹配
- `_confirm: true` 是所有 `destructive` 操作的硬性门禁

**验收检查点**:
- [ ] 所有 `orch_run_*` 工具在 MCP server 中可调用
- [ ] `orch_run_approve` 的 `approval_id` + `approval_packet_sha256` 双重验证通过 contract tests
- [ ] 命名空间无冲突 (`orch_run_*` vs `hep_run_*`)
- [ ] `hepar approve/status/run` CLI 通过 `orch_run_*` MCP 工具可操作
- [ ] 新增工具通过 `pnpm test` (hep-mcp + shared)

---

## Item 2: UX-07 — 审批上下文丰富化

**REDESIGN_PLAN 行号**: 搜索 `UX-07`

**范围**: 丰富审批 packet 的上下文，使人类可以直接从 packet_short 做出有效判断。

**实现**:

1. 重构 `packages/hep-autoresearch/src/hep_autoresearch/approval/approval_packet.py`:
   - 为每个 gate (A0-A5) 添加对应的 context assembler
   - A0: IdeaCard 摘要 (thesis + hypotheses + compute_plan 难度评估) + 文献覆盖度
   - A1: 检索策略说明 + 命中文献数 + 覆盖度摘要 + 遗漏风险提示
   - A2: 变更文件列表 + diff 统计 + 测试覆盖状态
   - A3: 参数选择的物理理由 + 计算预算 + 预期精度
   - A4: 修改摘要 + 引用变更 + evidence 覆盖率
   - A5: 核心结果数值表 + 交叉验证摘要

2. 扩展 `autoresearch-meta/schemas/approval_packet_v2.schema.json`:
   - 在 v1 基础上增加 `context_summary`, `key_results`, `integrity_flags`, `recommendation` 字段
   - 保持 v1 向后兼容: 新字段为 optional

3. 更新 hepar CLI: `hepar approvals show` 默认打印 packet_short 到终端 (含上下文摘要)

4. `packet_short.md` 模板约束: ~60 行软上限，终端友好；超限时附加 overflow 指针

**验收检查点**:
- [ ] `approval_packet_v2.schema.json` 定义完成，通过 JSON Schema 验证
- [ ] 每个 gate 类别 (A0-A5) 有对应的 context assembler
- [ ] `hepar approvals show` 默认显示 packet_short 内容
- [ ] Python 回归测试: `python -m pytest packages/hep-autoresearch/tests/ -q`

---

## Item 3: UX-02 — 计算契约 schema

**REDESIGN_PLAN 行号**: 搜索 `UX-02`

**范围**: 定义 `computation_manifest_v1.schema.json`，标准化 research-team 计算规划与 hep-calc 执行之间的接口。

**实现**:

1. 创建 `autoresearch-meta/schemas/computation_manifest_v1.schema.json`:
   - `steps[]`: 执行步骤 (tool, script, args, expected_outputs)
   - `environment`: 运行环境要求 (mathematica_version, julia_version, python_version 等)
   - `dependencies`: 外部依赖 (LoopTools, FeynCalc 等)
   - `computation_budget`: 预估运行时间 + 内存上限
   - `entry_point`: 主入口脚本 + 参数

2. 目录结构约定 (research-team 输出规范):
   ```
   computation/
   ├── manifest.json    ← 符合 computation_manifest_v1.schema.json
   ├── mathematica/     ← .wl 脚本
   ├── python/          ← .py 脚本
   ├── julia/           ← .jl 脚本
   └── configs/         ← 参数配置 (.json/.yaml)
   ```

3. 可选: 在 hep-calc skill 的 README 中说明如何消费 manifest.json

**验收检查点**:
- [ ] `computation_manifest_v1.schema.json` 定义完成，可通过 JSON Schema 校验
- [ ] schema 包含 `steps`, `environment`, `dependencies`, `computation_budget`, `entry_point`
- [ ] 至少 1 个示例 manifest.json 通过 schema 验证
- [ ] NEW-CONN-03 可引用此 schema 作为计算产出标准

---

## 验收命令

```bash
# TS 构建 + 测试
pnpm -r build
pnpm -r test                        # 包括 hep-mcp + shared

# Python 回归
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests -q
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests/ -q  # 若有
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest skills/research-team/scripts/bin/test_allowed_command_denylist.py -q

# MCP smoke test
make smoke

# Schema 验证 (若有 schema 校验脚本)
make codegen-check 2>/dev/null || true
```

---

## 双模型审核

收敛后执行 review-swarm (Codex + Gemini):

```bash
python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/phase2-batch7-r1-review \
  --system ~/.autoresearch-lab-dev/batch-reviews/phase2-batch7-review-system.md \
  --prompt ~/.autoresearch-lab-dev/batch-reviews/phase2-batch7-review-r1.md \
  --fallback-mode auto
```

Review 产物存放: `~/.autoresearch-lab-dev/batch-reviews/`
Review packet: `~/.autoresearch-lab-dev/batch-reviews/phase2-batch7-review-r1.md`
System prompt: `~/.autoresearch-lab-dev/batch-reviews/phase2-batch7-review-system.md`
