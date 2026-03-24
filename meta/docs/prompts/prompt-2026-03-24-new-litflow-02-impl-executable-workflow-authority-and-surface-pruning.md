# NEW-LITFLOW-02 — Executable Literature Workflow Authority and Surface Pruning

## Objective

Implement `NEW-LITFLOW-02` as a standalone Phase 3 slice. The goal is to turn checked-in literature workflow governance into executable authority, repoint real checked-in consumers to that authority, and prune workflow-like high-level literature MCP tools from the public surface.

## Non-Goals

- Do not fold this work into `M-25`.
- Do not add any “keep it in full for now” transition layer.
- Do not move generic workflow authority back into `packages/hep-mcp/` or `packages/shared/`.
- Do not treat “fewer tools” as the primary success metric.
- Do not reopen `NEW-DISC-01`, generic orchestrator-wide workflow-engine work, or the atomic narrowing of `inspire_critical_research`.

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` sections for `NEW-DISC-01`, `NEW-WF-01`, `NEW-SKILL-WRITING`, `M-24`, `M-25`, `NEW-LITFLOW-01`
4. `meta/ECOSYSTEM_DEV_CONTRACT.md` rules on generic/provider-neutral authority and skill/workflow boundaries
5. `meta/protocols/session_protocol_v1.md`
6. `meta/schemas/workflow_recipe_v1.schema.json`
7. `meta/recipes/*.json`
8. `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
9. `packages/hep-mcp/tests/research/researchToolSurface.test.ts`
10. `packages/hep-mcp/tool_catalog.standard.json`
11. `packages/hep-mcp/tool_catalog.full.json`
12. `packages/hep-mcp/src/tools/research/discovery/providerDescriptors.ts`
13. `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`
14. `packages/hep-autoresearch/tests/test_literature_gap_cli.py`
15. `packages/skills-market/packages/literature-workflows.json`
16. `packages/skills-market/packages/research-team.json`
17. `skills/research-team/SKILL.md`
18. `skills/research-team/scripts/bin/literature_fetch.py`
19. `README.md`
20. `docs/README_zh.md`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. On a dirty worktree, default to `npx gitnexus analyze --force` instead of plain `analyze`.
3. Before review, rerun `npx gitnexus analyze --force` because this slice adds new files, new symbols, and new executable call chains.
4. Gather post-change `context` / `impact` evidence for the new launcher package plus repointed consumers.

## Canonical Architecture

- Executable literature workflow authority lives in a new leaf workspace package: `packages/literature-workflows/`.
- That package is the only checked-in reader / validator / resolver of literature workflow recipes.
- `packages/hep-autoresearch` and `skills/research-team` are consumers of that launcher authority.
- Provider-specific MCP tools remain bounded atomic operators underneath the workflow layer.

## Required Implementation Scope

1. Add the new leaf workspace package `packages/literature-workflows/`.
   - Load and validate recipe JSON.
   - Resolve provider/capability-compatible steps fail-closed.
   - Expose a stable executable interface for checked-in consumers.
2. Upgrade `workflow_recipe_v1` in place.
   - Literature steps must be expressed by semantic `action`.
   - Support `required_capabilities`, `preferred_providers`, `degrade_mode`, and `consumer_hints`.
   - Literature recipes must stop hardcoding provider tool names as canonical authority.
3. Reuse the existing discovery/provider capability registry.
   - Extend it only with the workflow-only capabilities needed by current literature recipes.
   - Do not create a third parallel provider matrix.
4. Repoint real checked-in consumers.
   - `packages/hep-autoresearch` `literature-gap` must consume the launcher, not direct workflow-like INSPIRE tools.
   - `skills/research-team` must consume the launcher via a checked-in `workflow-plan` path, not parse recipe semantics itself.
5. Prune workflow-like public literature MCP tools from both catalogs.
   - Delete `inspire_discover_papers`, `inspire_field_survey`, `inspire_deep_research` from both `standard` and `full`.
   - Retain `inspire_topic_analysis`, `inspire_network_analysis`, `inspire_find_connections`, `inspire_trace_original_source`, and `inspire_critical_research`.
6. Update user-facing docs and governance docs.
   - README / 中文 README / session protocol / skills-market metadata must point high-level literature entry guidance at the launcher-backed consumers.
   - `NEW-LITFLOW-01` must be restated as governance-only closeout; `NEW-LITFLOW-02` becomes the executable follow-up slice.

## Explicit Out of Scope

- `M-25` atomic split / narrowing of `inspire_critical_research`
- Any demotion of deleted workflow-like tools into `full`
- Any new provider-specific workflow facade
- Any generic orchestrator-wide workflow engine beyond this bounded literature launcher

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/literature-workflows test`
- `pnpm --filter @autoresearch/literature-workflows build`
- `pnpm --filter @autoresearch/hep-mcp build`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/workflowRecipes.test.ts tests/research/researchToolSurface.test.ts tests/discoveryHints.test.ts tests/tools.test.ts`
- `pnpm --filter @autoresearch/hep-mcp catalog`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`
- `python -m pytest packages/hep-autoresearch/tests/test_literature_gap_cli.py -q`
- `python -m pytest skills/research-team/tests/test_literature_workflow_plan.py -q`
- `python3 packages/skills-market/scripts/validate_market.py`
- `python3 meta/scripts/validate_manifest.py`

## Review Packet Scope

- `meta/` authoritative governance files (`tracker`, `REDESIGN_PLAN`, `session_protocol`, schema, recipes, canonical prompt, checklist)
- `packages/literature-workflows/`
- `packages/hep-mcp/` registry, capability descriptors, catalogs, and public-surface tests
- `packages/hep-autoresearch/` launcher consumer path and contract tests
- `skills/research-team/` launcher consumer path and deterministic smoke tests
- top-level `README.md` and `docs/README_zh.md`

Do not reduce review to changed files only, and do not treat the prompt itself as authority.

## Required Review Questions

Reviewer and self-review must explicitly answer:

1. Does a real checked-in executable consumer / launcher now exist?
2. Do literature recipes still hardcode provider-specific tool names as authority?
3. Which public literature tools were retained vs deleted, and does the public catalog match that judgment?
4. Do README / protocol / consumer docs now point to the new front door?
5. Did any old tests lock the deleted public surface in place, and were they updated?
6. Is any structural follow-up still needed, and if so, is it registered in checked-in SSOT?

## Closeout Requirements

1. Formal `review-swarm`: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`
2. Formal self-review after reviewer convergence
3. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, `AGENTS.md`, and user-facing docs to final code facts
4. If this slice establishes stable new architecture invariants, sync `.serena/memories/architecture-decisions.md`
5. Any remaining durable follow-up must land in checked-in SSOT rather than only in chat or review notes
