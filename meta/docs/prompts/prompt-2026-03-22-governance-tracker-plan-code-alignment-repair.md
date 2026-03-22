# Governance Repair Batch — Tracker JSON Legality + Tracker/Plan/Code Alignment

## Scope

只实现本轮最小治理修复：

- 恢复 `meta/remediation_tracker_v1.json` 的 JSON 合法性
- 保留既有 closeout / evidence / review telemetry 信息
- 在 tracker 恢复可 parse 后，复检 tracker / `meta/REDESIGN_PLAN.md` / 当前代码现实是否一致
- 明确确认最近写入的 tracker-plan-code hard gate 未被本轮修复削弱

明确禁止：

- `EVO-14 Batch 7`
- `EVO-15`
- takeover / reassignment / daemonized scheduling
- 新的 scheduler / fleet / lifecycle 语义
- tracker 结构重写
- note 拆分工程
- 第二套 tracker authority

## Required Reads

1. `AGENTS.md`
2. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
3. `meta/REDESIGN_PLAN.md`
4. `meta/remediation_tracker_v1.json`
5. 当前 `EVO-14` 相关源码与 schema surface

## Preflight

1. 执行 `npx gitnexus analyze --force`
2. 重新读取 `gitnexus://repo/autoresearch-lab/context`
3. 确认当前任务仍是 governance repair，而不是新功能 batch
4. 若 `analyze --force` 触发根 `AGENTS.md` / `CLAUDE.md` generated appendix drift，仅按 tool-generated context 对待，不把它当作治理改动 authority

## Repair Strategy

- 只保留一条主修复路径：修现有 tracker
- 仅修掉导致 JSON 不合法的未转义内嵌 JSON / reviewer-failure 片段
- 不重写 tracker schema，不重建 note，不丢弃历史 closeout 叙事
- tracker 首次恢复可 parse 后，再扫描同类未转义片段
- 只有当 tracker / `meta/REDESIGN_PLAN.md` / 当前代码现实存在真实 drift 时，才更新 `meta/REDESIGN_PLAN.md`
- `AGENTS.md` 与 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md` 默认只读核对，不做人工治理内容改写

## Affected Files

- `meta/docs/prompts/prompt-2026-03-22-governance-tracker-plan-code-alignment-repair.md`
- `meta/remediation_tracker_v1.json`
- `meta/REDESIGN_PLAN.md`（仅在真实 drift 时）

## Acceptance

1. `npx gitnexus analyze --force`
2. reread `gitnexus://repo/autoresearch-lab/context`
3. `node -e "JSON.parse(require('fs').readFileSync('meta/remediation_tracker_v1.json','utf8')); console.log('tracker json ok')"`
4. `rg -n 'Review health telemetry: \\{\"|Reviewer failures: \\[\\{\"' meta/remediation_tracker_v1.json`
5. `git diff --check`
6. `rg -n '对齐代码事实|必需 SSOT 已同步并对齐当前代码/测试事实|已检查，tracker / REDESIGN_PLAN 与代码事实一致' AGENTS.md meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
7. `sed -n '2843,2895p' meta/REDESIGN_PLAN.md`
8. `rg -n 'orch_fleet_status|orch_fleet_enqueue|orch_fleet_claim|orch_fleet_release|orch_fleet_worker_poll|orch_fleet_worker_heartbeat|orch_fleet_adjudicate_stale_claim' packages/shared/src/tool-names.ts packages/orchestrator/src/orch-tools packages/hep-mcp/src`
9. `rg -n 'lease_duration_seconds|lease_expires_at' meta/schemas/fleet_queue_v1.schema.json packages/orchestrator/src/orch-tools/fleet-lease.ts`

## Closeout Requirements

- 明确记录本轮只修 governance authority
- 不宣称可以继续 `EVO-14 Batch 7` 或 `EVO-15`
- 若 `meta/REDESIGN_PLAN.md` 无需更新，必须明确写出“已检查，tracker / REDESIGN_PLAN / 代码事实一致，无需进一步更新”
