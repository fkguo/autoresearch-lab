# Phase 3 Implementation Batch 9: NEW-SEM-07 — Structured Gate Semantics

> **前置条件**: Phase 3 Batch 8 (`NEW-RT-05`) 已完成，G1 gate 已满足（eval framework + demo eval set）。
> **目标 gate**: **G2**（SEM-07 JSON SoT 迁移完成 + 格式漂移回归测试通过）。
>
> **SOTA 原则（必需）**: 实施前必须联网调研当前多-agent 评审 gate 的结构化输出最佳实践（JSON schema contract、fail-closed parsing、format drift hardening、adjudication pipeline）。结论写入实现记录。

> **通用硬门禁继承**: 本 prompt 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`；若本文件与 checklist 同时覆盖同一主题，以更严格者为准。


## 范围

本批次实现 1 个 Phase 3 item：

1. **NEW-SEM-07**: Structured Gate Semantics（高优先级，Python-side）

---

## 背景问题

当前收敛 gate（`check_team_convergence.py` / `check_draft_convergence.py`）仍依赖 Markdown prose + regex 解析，存在结构漂移风险：

- 模型输出格式轻微变化会导致解析脆弱（heading/label 漂移）
- 字段语义与文本展示耦合，难以稳定演进
- gate consumer 无统一 machine-readable SoT

**目标方向**: gate 判定只依赖结构化 JSON；prose 仅作为展示层，不参与 pass/fail 判定。

---

## 关键文件（预计）

### Convergence gate scripts
- `skills/research-team/scripts/gates/check_team_convergence.py`
- `skills/research-team/scripts/gates/check_draft_convergence.py`

### Gate tests
- `skills/research-team/tests/test_convergence_gate.py`
- （按需新增）`skills/research-team/tests/test_draft_convergence_gate.py`

### 可能影响（调用点）
- `skills/research-team/scripts/run_team_cycle.py`
- `skills/research-team/scripts/run_review_cycle.py`
- `skills/research-team/scripts/run_draft_cycle.py`

### 契约/Schema（新增）
- 建议新增：`meta/schemas/convergence_gate_result_v1.schema.json`
- 建议新增：`skills/research-team/scripts/gates/convergence_schema.py`（或同等位置）

---

## 三阶段迁移策略（必须按顺序）

### Phase A — Dual-output（兼容过渡）

1. gate 脚本输出 JSON 对象（stdout），包含最小必需字段：
   - `status`: `converged | not_converged | parse_error | early_stop`
   - `exit_code`: `0 | 1 | 2 | 3`
   - `reasons`: string[]
   - `report_status`: per-member structured summary
   - `meta`: `{ gate_id, generated_at, parser_version }`
2. 临时保留 Markdown 日志产物（人类阅读），但 machine 判定只看 JSON。
3. 为 JSON 输出定义并强校验 schema（fail-closed）。

### Phase B — JSON SoT

1. 所有 consumer 改为读取 JSON 字段，不再读取 prose。
2. 将原 regex/heading parse 限定在“报告→结构化对象”的边界层。
3. 任何关键字段缺失/不合法 → `parse_error`（exit=2），不得默默降级为 pass。

### Phase C — 移除 prose 判定路径

1. 删除 gate 逻辑中“从 prose 直接决定 pass/fail”的旧分支。
2. 保留 Markdown 仅用于日志与审阅展示，不作为判定输入。
3. 新增回归测试覆盖格式漂移（heading 改名、markdown decoration、中英混排、bullet 变化）。

---

## 实施细化

### Step 1: 结构化结果 schema

定义 convergence gate 统一结果结构（JSON Schema + Python dataclass/typed dict）。

最低字段建议：

```json
{
  "status": "converged",
  "exit_code": 0,
  "reasons": [],
  "report_status": {
    "member_a": {"verdict": "ready", "blocking_count": 0, "parse_ok": true},
    "member_b": {"verdict": "ready", "blocking_count": 0, "parse_ok": true},
    "member_c": {"verdict": "ready", "blocking_count": 0, "parse_ok": true}
  },
  "meta": {
    "gate_id": "team_convergence",
    "generated_at": "2026-03-04T00:00:00Z",
    "parser_version": "sem07-v1"
  }
}
```

### Step 2: `check_team_convergence.py` 迁移

- 现有 `_parse_*` 系列函数保留（边界层）
- 在 `main()` 末尾统一构造结构化结果对象
- `print(json.dumps(result, ensure_ascii=False))`
- exit code 与 JSON `exit_code` 必须一致

### Step 3: `check_draft_convergence.py` 迁移

- 对齐与 team gate 相同输出结构（字段可有 gate-specific 扩展）
- 日志文件生成保留，但从判定路径解耦

### Step 4: Consumer 切换

- 检查调用点只读 JSON 字段做控制流
- 删除/禁用基于 prose 关键词的后备逻辑

### Step 5: 回归测试（G2 核心）

新增/扩展 tests 覆盖：

1. **正常路径**：A/B(/C) ready + blocking=0 → converged
2. **needs revision**：任一报告 non-ready → not_converged
3. **parse drift**：heading 漂移/label 漂移 → parse_error（fail-closed）
4. **markdown decoration**：`**pass**` / `` `fail` `` / 中文 token 仍可解析到结构化层
5. **early stop**：leader mode 下 `>=2 CHALLENGED` → exit=3 + status=early_stop
6. **consumer contract**：consumer 仅依赖 JSON 字段，不依赖 prose

---

## 不做的事情

- 不在本 batch 引入 LLM-as-judge（仅做结构语义迁移）
- 不重写所有 gate 脚本（仅收敛相关 gate）
- 不改动非收敛 gate 的业务语义

---

## 验收检查点

- [ ] `check_team_convergence.py` 输出 schema-validated JSON 结果
- [ ] `check_draft_convergence.py` 输出 schema-validated JSON 结果
- [ ] consumer 仅使用 JSON SoT 判定（去除 prose 判定依赖）
- [ ] 回归测试覆盖格式漂移与 fail-closed 行为
- [ ] `skills/research-team/tests/*convergence*.py` 全部通过
- [ ] `pnpm -r build` 通过
- [ ] `pnpm -r test`（若失败需明确是否为既有无关失败）
- [ ] G2 gate 满足：JSON SoT + drift regression pass

---

## Review-Swarm 审核（本轮约定）

> 按本次会话约定，双模型为 **Opus + OpenCode(kimi-for-coding/k2p5)**。

```bash
python3 skills/review-swarm/scripts/bin/run_multi_task.py \
  --out-dir ~/.autoresearch-lab-dev/batch-reviews/phase3-batch9-r1-review \
  --system ~/.autoresearch-lab-dev/batch-reviews/phase3-batch9-review-system.md \
  --prompt ~/.autoresearch-lab-dev/batch-reviews/phase3-batch9-review-r1.md \
  --models claude/opus,kimi-for-coding/k2p5 \
  --check-review-contract
```

审核重点：
1. JSON SoT 是否真正成为唯一判定来源
2. parse error 是否 fail-closed（无静默降级）
3. drift regression 测试是否能防回归
4. 旧 prose 路径是否彻底从判定逻辑中移除

---

## 交付

1. NEW-SEM-07 实现代码
2. 测试通过证据（含 drift regression）
3. review-swarm 收敛（0 blocking）
4. 更新 `meta/remediation_tracker_v1.json`（NEW-SEM-07 → done）
5. 更新 `meta/REDESIGN_PLAN.md`（Batch 9 完成标记）
