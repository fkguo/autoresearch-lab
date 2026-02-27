# Phase 2 Batch 8 — TS AgentRunner + Durable Execution + W_compute MCP Design

## 前置状态

- Phase 0: ALL DONE (14/14)
- Phase 1: 18/22 done (remaining: NEW-R03b/UX-01/UX-05/M-19 deferred)
- Phase 2: 35/43 done
  - Batch 1 ✅: H-07, H-11b, H-12, H-15b, H-17 (reliability + safety)
  - Phase 2A ✅: NEW-RT-02, NEW-RT-03 (reconnect, span tracing)
  - Phase 2B ✅: NEW-CONN-02 (review feedback)
  - Batch 2 ✅: M-19, H-16b, M-21, M-05, M-02, M-06 (contracts + observability + payload)
  - Batch 3 ✅: H-05, H-09, H-10, H-21, M-23, NEW-R07 (data paths + file lock + CAS + event enum)
  - Batch 4 ✅: M-20, trace-jsonl, NEW-R06, NEW-R05 (migration registry + JSONL logging + schema consolidation + evidence SSOT)
  - Batch 5 ✅: NEW-02, NEW-03, NEW-04, NEW-R08 (approval infrastructure + skills LOC budget)
  - Batch 6 ✅: RT-03, RT-02, NEW-R10, NEW-VIZ-01 (runner API + clean-room + coordinator split + graph viz)
  - Batch 7 ✅: NEW-R15-impl, UX-07, UX-02 (orchestrator MCP tools + approval context + computation contract schema)
- REDESIGN_PLAN: v1.8.0-draft
- **总进度**: 67/135
- **Last commit**: `4a79d2b` (Batch 7)

## 本批目标

Phase 2 第八层——TS AgentRunner 实现 + Durable Execution + W_compute MCP 工具表面设计。Batch 7 完成了 NEW-R15-impl (orchestrator MCP tools)，现在实现依赖它的 AgentRunner。

**本批 3 项** (全部 TS/TypeScript + 设计文档):

| # | ID | 标题 | 估计 LOC | 依赖 | 解锁 |
|---|-----|------|---------|------|------|
| 1 | NEW-RT-01 | TS AgentRunner | ~250 | NEW-R15-impl ✅ | NEW-RT-04, EVO-01~03 |
| 2 | NEW-RT-04 | Durable Execution | ~200 | NEW-RT-01 (本批完成) | EVO pipeline |
| 3 | NEW-COMP-01 | W_compute MCP 工具表面设计 | ~200 (设计文档) | C-02 ✅, NEW-R15-impl ✅ | NEW-CONN-03 |

**总估计**: ~650 LOC (前两项 TS 代码，第三项设计文档)

完成后 Phase 2 进度: 38/43 done (从 35 升至 38)。
下一步: NEW-IDEA-01 (idea-core MCP 桥接) + NEW-CONN-03 (Computation Evidence Ingestion) 可作为 Batch 9 重点。

---

## 执行前必读

1. `serena:read_memory` → `architecture-decisions.md` 和 `codebase-gotchas.md`
2. Claude Code auto memory → `memory/MEMORY.md` 和 `memory/batch-workflow.md`
3. 读 `meta/REDESIGN_PLAN.md` 中各项详细规格（搜索 NEW-RT-01, NEW-RT-04, NEW-COMP-01）
4. 读 `packages/orchestrator/src/` — 当前 orchestrator 结构 (McpClient, ApprovalGate, retry.ts, tracing.ts)
5. 读 `packages/orchestrator/src/approval-gate.ts` — ApprovalGate 接口（AgentRunner 需要集成）
6. 读 `packages/orchestrator/src/mcp-client.ts` — McpClient 接口（AgentRunner 调用工具通过它）
7. 读 `packages/orchestrator/package.json` — 当前依赖（需添加 `@anthropic-ai/sdk`）
8. 读 `meta/schemas/computation_manifest_v1.schema.json` — UX-02 已定义的计算契约 schema

---

## Item 1: NEW-RT-01 — TS AgentRunner

**REDESIGN_PLAN 行号**: 搜索 `NEW-RT-01`

**范围**: 实现基于 Anthropic SDK 的 AgentRunner，支持 MCP tool dispatch、per-run 串行化 (lane queue)、max_turns 限制、approval gate 注入。

**实现**:

1. 在 `packages/orchestrator/src/agent-runner.ts` 创建 `AgentRunner` 类:
   - 依赖 `@anthropic-ai/sdk` (`messages.create`) 发送 LLM 消息
   - 集成现有 `McpClient` 进行 MCP 工具调用
   - 集成现有 `ApprovalGate` 检测审批门禁
   - 集成现有 `SpanCollector` (tracing.ts) 记录每轮 span

2. `AgentRunner` 核心接口:
   ```typescript
   interface AgentRunnerOptions {
     model: string;            // e.g. 'claude-opus-4-6'
     maxTurns: number;         // default 50
     runId: string;            // for lane queue key
     mcpClient: McpClient;
     approvalGate: ApprovalGate;
     spanCollector?: SpanCollector;
   }

   class AgentRunner {
     constructor(options: AgentRunnerOptions);
     run(messages: MessageParam[], tools: Tool[]): AsyncGenerator<AgentEvent>;
   }
   ```

3. **Lane queue** (per-run 串行化):
   - 全局 `Map<runId, Promise>` — 同一 run 的 agent calls 串行化
   - 不同 run 间并行 (不同 runId 互不阻塞)
   - lane queue 应是模块级单例 (可被测试替换)

4. **Approval gate injection**:
   - tool call 结果包含 `requires_approval: true` 时，AgentRunner 暂停
   - 暂停时写入 `AgentEvent { type: 'approval_required', approvalId, packetPath }`
   - 恢复由外部 caller 调用 `runner.resume(approvalId)` 触发

5. **AgentEvent stream** (AsyncGenerator):
   ```typescript
   type AgentEvent =
     | { type: 'text'; text: string }
     | { type: 'tool_call'; name: string; input: unknown; result: unknown }
     | { type: 'approval_required'; approvalId: string; packetPath: string }
     | { type: 'done'; stopReason: string; turnCount: number }
     | { type: 'error'; error: McpError }
   ```

6. 将 `AgentRunner` 加入 `packages/orchestrator/src/index.ts` 导出

7. **package.json**: 添加 `@anthropic-ai/sdk` 到 `dependencies`

**不做**:
- 不引入 Mastra/LangGraph 等外部 agent framework
- 不实现完整的 resume/checkpoint (那是 NEW-RT-04 的范围)
- 不实现 Python 侧等价物（AgentRunner 是纯 TS）

**安全约束**:
- `maxTurns` 必须强制执行，超限时 `AgentEvent { type: 'done', stopReason: 'max_turns' }`
- tool call 错误通过 `AgentEvent { type: 'error' }` 传播，不抛出异常

**验收检查点**:
- [ ] `AgentRunner` 可驱动单轮 + 多轮 MCP 工具调用循环 (vitest 测试，mock `messages.create`)
- [ ] per-run lane queue 串行化: 同一 runId 两个并发调用按顺序执行 (测试覆盖)
- [ ] `maxTurns` 强制执行: 超限时 done event (测试覆盖)
- [ ] approval gate 注入: 遇到 `requires_approval: true` 时产出 `approval_required` event (测试覆盖)
- [ ] `pnpm -r build` + `pnpm -r test` 全通过

---

## Item 2: NEW-RT-04 — Durable Execution

**REDESIGN_PLAN 行号**: 搜索 `NEW-RT-04`

**范围**: 在 AgentRunner 基础上增加 checkpoint 机制，支持从 `last_completed_step` 恢复。

**实现**:

1. 在 `packages/orchestrator/src/run-manifest.ts` 定义 `RunManifest` 接口:
   ```typescript
   interface StepCheckpoint {
     step_id: string;
     completed_at: string;  // ISO UTC
     result_summary?: string;
   }

   interface RunManifest {
     run_id: string;
     created_at: string;
     last_completed_step?: string;  // step_id
     resume_from?: string;           // step_id to resume from
     checkpoints: StepCheckpoint[];
   }
   ```

2. 在 `StateManager` 或独立的 `RunManifestManager` 中:
   - `saveCheckpoint(runId, stepId, resultSummary?)` — 原子写入到 `.autoresearch/runs/<runId>/manifest.json`
   - `loadManifest(runId)` — 读取 manifest
   - `shouldSkipStep(manifest, stepId)` — 返回 `true` 如果 stepId 在 `last_completed_step` 之前

3. `AgentRunner.run()` 接受可选 `manifest?: RunManifest`:
   - 若 `manifest.resume_from` 设置，跳过已完成步骤 (检查 checkpoint 列表)
   - 每个 tool call 完成后调用 `saveCheckpoint`

4. 将 `RunManifest`, `RunManifestManager` 加入 `index.ts` 导出

**验收检查点**:
- [ ] `saveCheckpoint` + `loadManifest` 原子读写 (vitest 测试，临时目录)
- [ ] `shouldSkipStep` 逻辑正确 (测试: 步骤已完成 → skip; 未完成 → 执行)
- [ ] AgentRunner 崩溃后可从 `last_completed_step` 恢复 (模拟崩溃: 中途停止，重建 AgentRunner 从 manifest 恢复，验证已完成步骤不重复执行)
- [ ] `pnpm -r build` + `pnpm -r test` 全通过

---

## Item 3: NEW-COMP-01 — W_compute MCP 工具表面设计

**REDESIGN_PLAN 行号**: 搜索 `NEW-COMP-01`

**范围**: 设计 W_compute MCP 工具表面安全模型 + 定义 `hep_run_ingest_skill_artifacts` 工具规格。这是设计文档交付物，为 NEW-COMP-02 (Phase 3 完整实现) 和 NEW-CONN-03 (Computation Evidence Ingestion) 奠定基础。

**实现**:

1. 创建 `meta/docs/wcompute-mcp-design.md` — W_compute MCP 工具表面安全模型:
   - 工具清单 (建议工具名 + 参数规格 + 风险分级)
   - C-02 containment 对齐: 路径白名单 + 命令黑名单 + sandbox 约束
   - A3 default gating: 执行前需人类审批 (gate A3, approval packet 包含执行参数)
   - 计算产出写入 `computation_evidence_catalog_v1.jsonl` (并行 schema, 不写入 EvidenceCatalogItemV1)

2. 在文档中定义 `hep_run_ingest_skill_artifacts` 工具规格:
   ```typescript
   // 规格 (Zod-style 伪代码, 供 NEW-COMP-02 实现时参考)
   {
     name: 'hep_run_ingest_skill_artifacts',
     description: '将 hep-calc skill 产出文件摄取为计算证据',
     inputSchema: z.object({
       run_id: z.string(),
       skill_artifacts_dir: z.string(),  // 绝对路径, 必须在 run_dir 内
       manifest_path: z.string().optional(),  // computation_manifest_v1.schema.json 路径
       tags: z.array(z.string()).optional(),  // 分类标签
     }),
     riskLevel: 'destructive',  // 写入证据目录
     requiresApproval: false,   // 摄取无需人类批准, 但路径须通过 C-02 白名单
   }
   ```

3. 在 `meta/schemas/` 中创建 `computation_evidence_catalog_item_v1.schema.json`:
   - `run_id`, `step_id`, `skill_id` (来源标识)
   - `artifacts`: 文件路径数组 + SHA-256 校验和
   - `manifest_sha256`: 指向 `computation_manifest_v1.json` 的 SHA-256
   - `ingested_at`: ISO UTC 时间戳
   - `tags`: 可选分类标签
   - 注意: **不含** `paper_id` / `LatexLocatorV1` (与 EvidenceCatalogItemV1 语义不同)

**验收检查点**:
- [ ] `meta/docs/wcompute-mcp-design.md` 包含工具清单 + C-02 对齐 + A3 gating 策略
- [ ] `hep_run_ingest_skill_artifacts` 规格完整 (name, description, inputSchema, riskLevel)
- [ ] `computation_evidence_catalog_item_v1.schema.json` 定义完成，通过 JSON Schema 格式验证
- [ ] schema 明确不含 `paper_id` / `LatexLocatorV1` (注释说明与 EvidenceCatalogItemV1 的区别)
- [ ] 双模型审核通过 (设计文档类, 集成到本批整体 review 中)

---

## 验收命令

```bash
# TS 构建 + 测试
pnpm -r build
pnpm -r test                        # 包括 orchestrator + hep-mcp + shared

# Python 回归 (不变)
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests/ -q
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests -q

# MCP smoke test
make smoke

# 确认 orchestrator 测试数增加
pnpm --filter @autoresearch/orchestrator test
```

---

## 双模型审核

收敛后执行 review-swarm (Codex + Gemini):

```bash
python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/phase2-batch8-r1-review \
  --system ~/.autoresearch-lab-dev/batch-reviews/batch8-review-system.md \
  --prompt ~/.autoresearch-lab-dev/batch-reviews/phase2-batch8-review-r1.md \
  --fallback-mode auto
```

Review 产物存放: `~/.autoresearch-lab-dev/batch-reviews/`
Review packet: `~/.autoresearch-lab-dev/batch-reviews/phase2-batch8-review-r1.md`
System prompt: `~/.autoresearch-lab-dev/batch-reviews/batch8-review-system.md`
