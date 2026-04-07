# Prompt: 2026-04-08 Legacy Residue Audit

## Why this lane exists

`Pipeline A` public-shell support wrappers are gone, but a handful of internal full-parser residues still contain live authority and reality-check tests (`doctor`, `bridge`, `literature-gap`, `paper_reviser`, `method-design`, `run-card`, `branch`). Before the next delete-first slice, we need a source-grounded audit that traces each of those commands through the parser, implementation, tests, and docs, then publishes a concrete follow-up plan so the deletion / rebaseline work can proceed in the right order.

## Scope

- Workflow/bridge commands: `doctor` (MCP diagnostics), `bridge` (MCP bridge helpers), `literature-gap` (Phase C observation), `paper_reviser` (legacy workflow runner).
- Support authoring helpers: `method-design`, `run-card` (validate/render), `branch` (list/add/switch).
- Goal: document whether these residues should stay for maintainer/eval coverage, be contracted further, or be deleted; then capture that plan in a committed prompt and tracker update.

## Evidence snapshot (current worktree)

### `doctor` / `bridge`

- CLI: `cmd_doctor` / `cmd_bridge` in `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` (lines ~3600/3730) register `doctor`/`bridge` with network health/config probing; arguments map to `_doctor_entrypoint_discovery()` + `_bridge_check_request()`.
- Tests: `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py` drives these commands via stub MCP servers, covering missing config warnings, discovery-only mode, and version gating.
- Docs: `packages/hep-autoresearch/docs/WORKFLOWS.md` and `docs/ORCHESTRATOR_INTERACTION.*` describe them as internal-only legacy support.
- Maintenance note: they still appear in `meta/front_door_authority_map_v1.json` under `internal_support_commands` and feed `test_public_cli_surface.py` assertions for `invalid choice`.
- Recommendation: Phase 1 should rebaseline this pair (test coverage, docs, authority map) before cutting them, then either retire them or replace them with more direct TS helpers once the new generic orchestrator read-model owns diagnostics.

### `literature-gap` / `paper_reviser`

- `cmd_literature_gap` (Phase C) and `cmd_paper_reviser` still exist inside `orchestrator_cli.py` around the run workflow sections; they write artifacts/runs subpaths (`literature_gap`, `paper_reviser`) for future inspection.
- Tests: `packages/hep-autoresearch/tests/test_paper_reviser_workflow.py` (exit statuses, resume semantics) plus `test_public_cli_surface.py` ensures `paper_reviser` workflow is internal-only.
- Docs: `docs/WORKFLOWS(.zh).md` and `docs/BEGINNER_TUTORIAL(.zh).md` list them as maintainer/reserved workflows; `docs/HEP-Autoresearch-Audit-Findings.md` flags them as Phase C coverage gaps needing new eval cases.
- Recommendation: Phase 1 should also capture their runtime artifacts, document which manual steps still depend on them, and decide if they can be reimplemented inside the new orchestrator workflow or retired entirely.

### `method-design` / `run-card` / `branch`

- The support subgroup is registered under `if not public_surface` near the bottom of `orchestrator_cli.py`, with `run-card validate/render` and `branch list/add/switch`.
- Tests: `test_public_cli_surface.py` asserts the CLI rejects them on the public shell; no direct unit tests, but `docs/COMPUTATION(.zh).md` and `docs/EXAMPLES(.zh).md` only reference them as internal authoring helpers.
- Docs describe their role endorsing run-card-based configuration and branching guardrails (`docs/ORCHESTRATOR_STATE(.zh).md`, `docs/AGENT_LITERATURE_INTEGRATION.zh.md`).
- Recommendation: Phase 2 should audit what downstream time saves these commands still deliver, locate any existing example fixtures that consume them, then decide whether the next lane should rehome run-card validation into shared tooling or remove `method-design`/`branch` entirely after bridging to better automation.

## Phase plan

1. **Phase 1: Workflow integrity audit**
   - Trace every user/test path that executes `doctor`, `bridge`, `literature-gap`, or `paper_reviser`.
   - Confirm whether their MCP-side infrastructure is still reachable (e.g., `packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py` reruns, `artifacts/runs/*/{literature_gap,paper_reviser}` entries exist, `docs/WORKFLOWS*.md` still describe them accurately).
   - Acceptance: rerun `python3 -m pytest packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py packages/hep-autoresearch/tests/test_paper_reviser_workflow.py` + `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py`.
   - Outcome: if these commands remain useful, document the exact artifacts/observability they provide; otherwise, prepare to withdraw them in a later lane.

2. **Phase 2: Support-authoring rebaseline**
   - Evaluate `method-design`, `run-card`, and `branch` for removable redundancy; locate any docs/examples referencing them (e.g., `docs/COMPUTATION*`, `docs/AGENT_LITERATURE_INTEGRATION.zh.md`, `docs/ORCHESTRATOR_STATE*`).
   - Update tests/docs to reference shared `run-card` helpers (e.g., `scripts/orchestrator.py run-card validate/render` glimpsed in `docs/EXAMPLES*`).
   - Acceptance: rerun `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py` plus `node scripts/check-shell-boundary-anti-drift.mjs` and `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`.
   - Outcome: either retire these commands (with doc/authority cleanup) or capture the minimal rehome (maybe move validation into standalone script) before final deletion.

## Proposed acceptance checklist for the lane

- `python3 -m pytest packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py packages/hep-autoresearch/tests/test_paper_reviser_workflow.py`
- `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`

## Governance

- Record this lane in `meta/REDESIGN_PLAN.md` (see next section) and keep `meta/remediation_tracker_v1.json` in sync by adding a placeholder note once downstream decisions for each command are settled.
