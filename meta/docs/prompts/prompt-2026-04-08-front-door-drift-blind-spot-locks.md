# Prompt: 2026-04-08 Front-Door / Drift Blind-Spot Locks

## Why this lane exists

现有 front-door anti-drift 已覆盖大量 public wording，但仍有一批 **blind-spot** 尚未 fail-closed：

1. `autoresearch --help` 对已删除 parser support commands 的叙事目前主要靠单点断言，缺少更系统的 anti-drift 锁。
2. `meta/docs/orchestrator-mcp-tools-spec.md` 已有 exact `orch_*` inventory 锁，但 narrative invariants（generic front door / run-infra vs strategy / URI ownership）尚未被专门测试锁定。
3. `docs/URI_REGISTRY.md` 是 live cross-scheme authority doc，但目前缺少专门 drift guard。
4. 两个 fixture docs（`packages/hep-autoresearch/examples/schrodinger_ho/README.md`、`packages/hep-autoresearch/workflows/C1_literature_gap.md`）虽有 legacy语义，但尚未进入 shared front-door wording lock。
5. plan/tracker 缺少一个面向本批 drift-lock closure 的 tiny digest，容易让主线状态在后续并行 lane 中失焦。

本批目标是 **guardrail-only**：补齐 front-door/doc drift 防线，不做业务逻辑改造。

## Scope

只做 docs/tests/guardrail 级别实现，不改 runtime 行为：

- 可改：docs、drift fixtures、anti-drift tests/checkers、plan/tracker digest 文案。
- 不可改：业务执行路径、workflow semantics、provider runtime 行为、legacy fallback 恢复。
- 不把任何 legacy surface 重新上提为 authority。

## Source-grounded preflight (must read first)

- `packages/orchestrator/src/cli-help.ts`
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `meta/docs/orchestrator-mcp-tools-spec.md`
- `docs/URI_REGISTRY.md`
- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `packages/hep-autoresearch/examples/schrodinger_ho/README.md`
- `packages/hep-autoresearch/workflows/C1_literature_gap.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

## Lane split (minimal, execution-ready)

### Lane A — `autoresearch --help` follow-up lock hardening

**Goal**
- 把 `--help` 的 front-door residue 叙事做成 fail-closed lock，避免后续 wording drift 把已删除/已退役命令写回 live truth。

**Suggested touch set**
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `scripts/lib/front-door-authority-map.mjs` (or nearby shared fixture module for help narrative constants)
- Optional: `packages/orchestrator/src/cli-help.ts` only if wording must be normalized for lock stability.

**Required checks**
- `pnpm --filter @autoresearch/orchestrator test -- tests/autoresearch-cli.test.ts`
- `pnpm --filter @autoresearch/orchestrator test -- tests/package-boundary.test.ts`
- `git diff --check`

**Acceptance target**
- Help text must keep:
  - parser support commands `doctor` / `bridge` / `literature-gap` as deleted, not residual
  - `method-design` / `run-card` / `branch` as retired-public internal full-parser helpers
- Help text must reject old wording that reintroduces any parser support residue claim.

### Lane B — Orchestrator MCP spec narrative invariant drift lock

**Goal**
- 除 exact `orch_*` tool list 外，新增 narrative invariant locks，防止文档“语义漂移但工具名没漂移”。

**Suggested touch set**
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `meta/docs/orchestrator-mcp-tools-spec.md` (only if current wording must be normalized)
- Optional shared snippet fixture near `scripts/lib/front-door-boundary-authority.mjs`.

**Narrative invariants to lock**
- `autoresearch` is generic front door; `orch_*` is MCP/operator counterpart, not competing product identity.
- `orch_*` owns lifecycle/approval/fleet control-plane semantics.
- Domain tools (`hep_*` etc.) do not own lifecycle state authority.
- `hep://` and `orch://` remain separate owned namespaces.

**Required checks**
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `git diff --check`

### Lane C — `docs/URI_REGISTRY.md` drift guard + fixture legacy-banner lock

**Goal**
- 把 URI ownership truth 和 fixture legacy banner 一起纳入 shared drift guard，填补当前 blind-spot。

**Suggested touch set**
- `docs/URI_REGISTRY.md`
- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs` (if checker wiring needs extension)
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `packages/hep-autoresearch/examples/schrodinger_ho/README.md`
- `packages/hep-autoresearch/workflows/C1_literature_gap.md`

**Specific locks to add**
- URI registry:
  - live schemes exactly `hep://`, `pdg://`, `orch://`
  - explicit boundary: no implicit cross-scheme alias/resolver between `hep://` and `orch://`
  - stale non-live URI examples remain forbidden as live truth
- Fixture docs:
  - explicit legacy banner: canonical front door is `autoresearch` (generic lifecycle/workflow-plan/computation)
  - fixture commands are maintainer/eval/regression compatibility examples only
  - no wording that re-promotes installable legacy shell as default entrypoint

**Required checks**
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `git diff --check`

### Lane D — Plan/Tracker tiny digest closeout sync

**Goal**
- 在完成 A/B/C 后，以最小文本增量同步 plan/tracker，留下 machine-readable tiny digest，避免并行 lane 覆盖时丢失 blind-spot closeout truth。

**Suggested touch set**
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

**Digest minimum content**
- `autoresearch --help` residue lock status
- `orchestrator-mcp-tools-spec.md` narrative invariant lock status
- `docs/URI_REGISTRY.md` drift lock status
- fixture legacy banner lock status (`schrodinger_ho` + `C1_literature_gap`)
- next immediate queue statement (remaining closure, no fallback revival)

**Required checks**
- `python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null`
- `rg -n "help|orchestrator-mcp-tools-spec|URI_REGISTRY|schrodinger_ho|C1_literature_gap|drift" meta/REDESIGN_PLAN.md meta/remediation_tracker_v1.json`
- `git diff --check`

## Minimal lane order

1. Lane B (spec narrative lock)  
2. Lane C (URI + fixture locks)  
3. Lane A (help lock hardening)  
4. Lane D (plan/tracker tiny digest sync, only after A/B/C merged)

`A` can run in parallel with `B/C` if team capacity allows; `D` must be final.

## Non-goals (hard)

- 不新增任何向后兼容 fallback 设计。
- 不把 Python/legacy surface 重新定义为 primary authority。
- 不做 runtime/业务逻辑改造，不改 orchestration semantics。
- 不在本批重开大规模 Pipeline A delete 实现（这里只做 lock + digest）。

## Formal review packet requirements

Formal review packet must include all touched guard surfaces:

- `packages/orchestrator/src/cli-help.ts`
- `packages/orchestrator/tests/autoresearch-cli.test.ts`
- `meta/docs/orchestrator-mcp-tools-spec.md`
- `docs/URI_REGISTRY.md`
- `scripts/lib/front-door-boundary-authority.mjs`
- `scripts/check-shell-boundary-anti-drift.mjs`
- `packages/hep-mcp/tests/docs/docToolDrift.test.ts`
- `packages/hep-autoresearch/examples/schrodinger_ho/README.md`
- `packages/hep-autoresearch/workflows/C1_literature_gap.md`
- `meta/REDESIGN_PLAN.md`
- `meta/remediation_tracker_v1.json`

Reviewers must explicitly challenge:

- Did we lock narrative invariants, or only literal tool-name lists?
- Did any fixture wording accidentally re-promote legacy shell authority?
- Does plan/tracker digest reflect actual merged guardrail truth (not intent-only text)?

## Self-review checklist

Before closeout, self-review must confirm:

1. `docToolDrift` + shell boundary checks fail closed on the newly added blind-spot snippets.
2. `autoresearch --help` narrative lock includes both positive and forbidden-stale assertions.
3. `URI_REGISTRY` authority claims are locked and consistent with `orchestrator-mcp-tools-spec`.
4. `schrodinger_ho` and `C1_literature_gap` fixture docs are explicitly tagged legacy/maintainer-only in locked wording.
5. `meta/REDESIGN_PLAN.md` and `meta/remediation_tracker_v1.json` contain a tiny digest that matches merged code/doc facts.
