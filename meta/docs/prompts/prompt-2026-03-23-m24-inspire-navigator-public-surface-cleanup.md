# M-24 — INSPIRE Navigator Public Surface Cleanup

## Goal

Remove `inspire_research_navigator` and replace it with dedicated first-class MCP tools whose public schemas directly match their workflow semantics. This is a bounded cleanup / implementation slice, not a compatibility patch.

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` sections that still describe `inspire_research_navigator` as the active public surface
4. `meta/ECOSYSTEM_DEV_CONTRACT.md` rules relevant to tool catalogs, schema drift, and standard/full exposure
5. `packages/hep-mcp/src/tools/research/researchNavigator.ts`
6. `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
7. `packages/hep-mcp/tests/research/researchNavigator.test.ts`
8. `packages/hep-mcp/tests/smoke-no-toplevel-union.test.ts`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. If the worktree is dirty, run `npx gitnexus analyze --force`.
3. Before formal review, rerun `npx gitnexus analyze --force` if symbols or call chains changed, then collect `detect_changes` evidence.

## Scope

- Delete public tool `inspire_research_navigator`.
- Add dedicated public tools:
  - `inspire_discover_papers`
  - `inspire_field_survey`
  - `inspire_topic_analysis`
  - `inspire_network_analysis`
  - `inspire_find_connections`
  - `inspire_trace_original_source`
- All six new tools are `standard` exposure.
- Delete public `experts` and `analyze` navigator modes; do not keep aliases, shims, or deprecated fallback behavior.
- Keep gateway compatibility: do not introduce top-level `oneOf` / `anyOf` / `allOf`.

## Canonical Schema Shape

- `inspire_discover_papers`: `mode`, `topic`, `seed_recids`, `limit`, `options`
- `inspire_field_survey`: `topic`, `seed_recid`, `iterations`, `max_papers`, `focus`, `prefer_journal`
- `inspire_topic_analysis`: `mode`, `topic`, `time_range`, `limit`, `options`
- `inspire_network_analysis`: `mode`, `seed`, `limit`, `options`
- `inspire_find_connections`: `recids`, `include_external`, `max_external_depth`
- `inspire_trace_original_source`: `recid`, `max_depth`, `max_refs_per_level`, `cross_validate`

## Implementation Requirements

1. Add checked-in tool constants and remove `INSPIRE_RESEARCH_NAVIGATOR`.
2. Replace facade registration with six dedicated `ToolSpec`s in `packages/hep-mcp/src/tools/registry/inspireResearch.ts`.
3. Delete `packages/hep-mcp/src/tools/research/researchNavigator.ts`.
4. Promote dedicated `*_legacy` schemas in `packages/hep-mcp/src/tools/research/schemas.ts` to canonical names; remove `_legacy` naming.
5. Delete dead `experts` / `analyze` public surfaces and remove their implementations if they become unreferenced.
6. Update adjacent tool names in dispatcher, `next_actions`, sampling metadata, stub server, contract tests, docs, and tool catalogs so no public/documented path still points at `inspire_research_navigator`.
7. Update `packages/hep-autoresearch` consumer code to call dedicated tools directly; no compatibility fallback logic.
8. Rebuild and sync tool catalogs and tool counts.

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/research tests/tools.test.ts tests/toolContracts.test.ts tests/docs/docToolDrift.test.ts tests/contracts/nextActionsExposure.test.ts tests/smoke-no-toplevel-union.test.ts`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp catalog`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
- `uv run --project packages/hep-autoresearch pytest packages/hep-autoresearch/tests/test_literature_gap_cli.py -q`

## Review Packet Scope

- `packages/hep-mcp`
- `packages/shared`
- `packages/hep-autoresearch`
- touched authoritative docs and tool catalogs

Do not reduce the packet to changed files only, and do not inflate it to the whole monorepo without evidence.

## Closeout Requirements

1. Formal three-reviewer review-swarm: Opus + Gemini-3.1-Pro-Preview + OpenCode(zhipuai-coding-plan/glm-5)
2. Formal self-review after reviewer convergence
3. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, and authoritative user-facing docs to the final code facts
4. Update `AGENTS.md` current progress summary if the tracker totals change
5. If `inspire_critical_research` remains a structurally similar public-surface problem after this slice, register a checked-in follow-up cleanup item rather than leaving it only in chat or review notes
