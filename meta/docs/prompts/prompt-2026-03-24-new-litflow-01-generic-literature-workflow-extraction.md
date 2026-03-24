# NEW-LITFLOW-01 — Generic Literature Workflow Extraction

## Objective

Create a new standalone Phase 3 slice `NEW-LITFLOW-01` and keep it separate from `M-25`. The goal is to move generic literature workflow authority into checked-in workflow-pack / recipe / skill-consumer surfaces, while leaving provider/source MCP tools as atomic building blocks.

## Non-Goals

- Do not fold this work into `M-25`.
- Do not put generic workflow authority back into a provider-specific MCP facade.
- Do not use “reduce tool count” as the primary success metric.
- Do not invent a new literature workflow schema; reuse `workflow_recipe_v1` and `meta/recipes/`.
- Do not move `inspire_critical_research` wholesale into workflow authority.

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md` sections for `NEW-DISC-01`, `NEW-WF-01`, `NEW-SKILL-WRITING`, `M-24`, and `M-25`
4. `meta/ECOSYSTEM_DEV_CONTRACT.md` rules on generic/provider-neutral authority plus skill/workflow boundaries
5. `meta/protocols/session_protocol_v1.md`
6. `meta/recipes/*.json`
7. `packages/hep-mcp/src/tools/registry/inspireResearch.ts`
8. `packages/hep-mcp/src/tools/research/discovery/providerExecutors.ts`
9. `skills/research-team/SKILL.md`
10. `skills/research-team/scripts/bin/literature_fetch.py`
11. `packages/skills-market/packages/*.json`
12. `packages/skills-market/schemas/market-package.schema.json`

## GitNexus Gates

1. Before edits, read `gitnexus://repo/autoresearch-lab/context`.
2. If the index is stale, run `npx gitnexus analyze` (or `--force` on a dirty worktree).
3. Before formal review, rerun `npx gitnexus analyze --force` if symbols, manifests, or authoritative call chains changed, then gather `detect_changes` evidence.

## Authority Matrix

- Workflow-pack / recipe authority:
  - topic-to-reading-list / survey / landscape mapping
  - literature-gap discover/analyze flows
  - deep analyze -> synthesize chains over a paper set
  - multi-provider orchestration across `INSPIRE`, `OpenAlex`, `arXiv`, `Crossref`, `DataCite`, `Zotero`, and `GitHub`
- MCP atomic authority to retain:
  - provider/source access: `inspire_search`, `inspire_search_next`, `inspire_literature`, `inspire_resolve_citekey`, `inspire_paper_source`, `inspire_parse_latex`, plus provider-local `openalex_*`, `arxiv_*`, `zotero_*`, `hepdata_*`
  - bounded analysis operators: `inspire_topic_analysis`, `inspire_network_analysis`, `inspire_find_connections`, `inspire_trace_original_source`
  - `inspire_critical_research` stays atomic and remains a separate cleanup target
  - `NEW-DISC-01` shared planner/canonicalization/dedup remains the generic atomic substrate
- Provider-local / source-adapter boundaries:
  - `INSPIRE-HEP`: best current source for survey/network/provenance-heavy flows and arXiv-linked source download entry
  - `arXiv`: known-item lookup, keyword intake, source download; not citation-graph or semantic-search authority
  - `Crossref`: DOI discovery, metadata completion, BibTeX enrichment; not graph/fulltext/source-download authority
  - `DataCite`: dataset/software DOI enrichment; not canonical paper-discovery authority
  - `Zotero`: local seed corpus / curation source; not global discovery authority
  - `GitHub`: companion-code discovery only; not literature discovery authority
  - DOI resolver: utility edge only

## Required SSOT Sync

1. `meta/remediation_tracker_v1.json`
   - add `NEW-LITFLOW-01` as a pending Phase 3 slice
   - narrow `M-25` so it depends on `NEW-LITFLOW-01` and only tracks atomic `inspire_critical_research` cleanup
2. `meta/REDESIGN_PLAN.md`
   - add a standalone `NEW-LITFLOW-01` subsection
   - add a Phase 3 queue row
   - record that this is governance-first extraction via existing `workflow_recipe_v1`
3. `meta/protocols/session_protocol_v1.md`
   - stop treating `inspire_field_survey` / `inspire_deep_research` as canonical high-level entrypoints
   - reference workflow recipes / skill entry plus retained atomic MCP steps
4. `meta/recipes/`
   - add or extend literature-specific recipes under the existing schema
5. `packages/skills-market/` plus `meta/compatibility-matrix/ecosystem-manifest.json`
   - register workflow-pack `literature-workflows`
   - keep `research-team` as a consumer, not an owner of generic authority
6. `skills/research-team/`
   - document the authority boundary
   - keep `literature_fetch.py` positioned as a source-adapter helper

## Implementation Scope

1. Add the new pending tracker item `NEW-LITFLOW-01`.
2. Repoint `M-25` so it depends on `NEW-LITFLOW-01` and only covers the remaining atomic `inspire_critical_research` cleanup.
3. Add checked-in literature workflow recipes using current atomic tools, without inventing a new schema.
4. Register workflow-pack metadata `literature-workflows` and wire consumer metadata (`research-team`) to depend on it.
5. Update session protocol and consumer docs so high-level literature workflow truth lives in the workflow-pack layer.

## Explicit Out of Scope

- Implementing the actual `M-25` atomic split/narrowing of `inspire_critical_research`
- Rebuilding the generic discovery substrate from `NEW-DISC-01`
- Promoting `Crossref`, `DataCite`, `GitHub`, or `Zotero` into new MCP authorities in this slice
- Backward-compatibility shims unless a same-batch consumer requires an immediate repoint

## Acceptance Commands

- `git diff --check`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/core/workflowRecipes.test.ts`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/research/researchToolSurface.test.ts tests/tools.test.ts tests/docs/docToolDrift.test.ts tests/contracts/nextActionsExposure.test.ts`
- `pnpm --filter @autoresearch/shared build`
- `pnpm --filter @autoresearch/hep-mcp build`
- `python3 packages/skills-market/scripts/validate_market.py`
- `python3 meta/scripts/validate_manifest.py`
- `python -m pytest packages/hep-autoresearch/tests/test_literature_gap_cli.py -q`

If actual tool surface/catalog artifacts change, also run:
- `pnpm --filter @autoresearch/hep-mcp catalog`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:sync`
- `pnpm --filter @autoresearch/hep-mcp docs:tool-counts:check`

## Review Packet Scope

- `meta/` authoritative governance files (`tracker`, `REDESIGN_PLAN`, `session_protocol`, recipes, canonical prompt)
- `packages/skills-market/` metadata
- `skills/research-team/` consumer authority docs
- any touched `packages/hep-mcp` validation/tests

Do not reduce the packet to changed files only, and do not treat the prompt itself as authority.

## Closeout Requirements

1. Formal three-reviewer review-swarm: `Opus` + `Gemini-3.1-Pro-Preview` + `OpenCode(zhipuai-coding-plan/glm-5)`
2. Formal self-review after reviewer convergence
3. Sync `meta/remediation_tracker_v1.json`, `meta/REDESIGN_PLAN.md`, `AGENTS.md`, and user-facing authority docs to final code facts
4. If any further durable follow-up remains, register it in checked-in SSOT rather than leaving it only in chat or review notes
