# 2026-04-08 Front-Door Drift Blind-Spot Lane Plan

## Objective

给主协调线程一个最小可执行的 lane 排程，用来补齐 front-door/doc drift 的剩余盲点；本批是 guardrail/documentation closeout，不是业务重构。

## Minimal sequence

1. **Lane B — orchestrator MCP spec narrative invariant lock**
2. **Lane C — URI registry + fixture legacy-banner lock**
3. **Lane A — `autoresearch --help` lock hardening**（可与 B/C 并行，但必须在 D 前完成）
4. **Lane D — plan/tracker tiny digest sync**（最终收口 lane）

## Per-lane acceptance gates

### Lane B
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- Gate: `meta/docs/orchestrator-mcp-tools-spec.md` 的 narrative invariants 有 fail-closed lock，不只锁 `orch_*` 名字表。

### Lane C
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- Gate: `docs/URI_REGISTRY.md` boundary truth 与 fixture docs（`schrodinger_ho` / `C1_literature_gap`）legacy banner 均被共享 drift fixture 覆盖。

### Lane A
- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/package-boundary.test.ts`
- Gate: `autoresearch --help` 保持“`doctor` / `bridge` / `literature-gap` 已删除 + retired-public helper” truth，并拒绝旧 wording 回流。

### Lane D
- `python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null`
- `rg -n "help|orchestrator-mcp-tools-spec|URI_REGISTRY|schrodinger_ho|C1_literature_gap|drift" meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json`
- Gate: plan/tracker tiny digest 已对齐 A/B/C 的实际合并结果，不留 chat-only 状态。

## Report-back template (for each lane)

- `lane_id`:
- `files_changed`:
- `acceptance_commands` + exit codes:
- `formal_review_verdict`:
- `self_review_blocking_issues`:
- `deferred_or_declined_items` (with SSOT target):
- `ready_for_merge`: `yes|no`
