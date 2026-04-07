# 2026-04-07 Residual Support Surface Closure Plan

## Context

`M-22A` already pushed the generic lifecycle mutations back onto `autoresearch`, and `M-22B` removed the `research_workflow_v1` / `workflow-templates` schema residue. This leaves several support surfaces (`run` residual non-computation workflows, `doctor`, `bridge`, `literature-gap`, and internal lifecycle helpers such as `start` / `checkpoint` / `request-approval` / `reject`) living inside [`packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`](/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py) and related docs. These surfaces may remain only as provider-local compatibility helpers, diagnostics, or maintainer/eval tooling, never as a second generic front door.

## Objective

Source-ground and constrain the remaining Pipeline A support surface so that:
- commands/comments clearly classify each entry as either `delete`, `repoint`, or `keep-internal`
- the installable public shell never regains generic lifecycle/control-plane authority
- docs/tests reflect the same authority taxonomy rather than relying on unstated assumptions

## Tasks

1. **Census current support surfaces**
   - Enumerate the commands still exported from `packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py` that do not appear on the public `hepar` parser (`start`, `checkpoint`, `request-approval`, `reject`, `doctor`, `bridge`, `literature-gap`, and any residual non-computation `run` helpers).
   - Identify hierarchical dependencies inside the CLI and docs that continue to refer to these commands (e.g., README sections, `ORCHESTRATOR_INTERACTION` guides, `meta/docs/orchestrator-mcp-tools-spec.md`, `scripts/lib/front-door-boundary-authority.mjs`).

2. **Categorize each surface**
   - Mark each command/tool as `delete`, `repoint`, or `keep-internal`.
   - Document the canonical rebound (TS surface, diagnostics-only path, or deletion date) and trace back to the relevant tests/docs that enforce that classification.
   - For surfaces marked `keep-internal`, specify the projection/diagnostic-only guard (e.g., `doctor` remains available only through maintainer help, not the public CLI).

3. **Align docs/tests**
   - Update relevant docs to mention the classification (internal-only vs compatibility) and to point readers at the proper authority (e.g., link to `autoresearch` for lifecycle verbs, note `hepar doctor` is maintainer-only).
   - Add or adjust tests (public CLI help, doc drift guards) to assert the new classification and to fail if a command reappears on the public surface.
   - Make sure front-door scripts (`scripts/check-shell-boundary-anti-drift.mjs`, `scripts/lib/front-door-boundary-authority.mjs`) read the same inventory so they can fail closed when doc/test drift occurs.

4. **Document follow-up decisions**
   - Record in this plan a simple timeline for the remaining steps: e.g., `doctor`/`bridge` internal-only guard, `literature-gap` retirement path, and the eventual deletion/repoint of the non-computation `run` workflows.
   - Capture acceptance commands + review requirements so downstream implementation lanes can build from this plan without re-deriving the scope.

## Deliverables

- A checked-in command/surface inventory or classification table for the residual support surfaces
- A downstream implementation prompt that can be handed to an implementation lane without redoing the census
- A front-door/projection-only review checklist that points reviewers at the exact files/tests to challenge

## Acceptance shape

- The plan produces a checked-in inventory of residual support surfaces with a classification for each command/tool.
- Front-door docs and test suites can depend directly on that inventory (for example `scripts/check-shell-boundary-anti-drift.mjs` reading it and `docToolDrift.test.ts` validating it).
- Acceptance commands for the eventual implementation lane include:
  - `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py -q`
  - `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts tests/toolContracts.test.ts tests/contracts/crossComponentToolSubset.test.ts`
  - `node scripts/check-shell-boundary-anti-drift.mjs`
  - `git diff --check`

## Dependencies & constraints

- Lane A (command taxonomy) must publish the baseline inventory before this plan's implementation lane begins, so classifications stay consistent.
- Existing guard scripts (`front-door-boundary-authority`, `check-shell-boundary-anti-drift`) already enforce parts of this boundary and should be referenced rather than duplicated.
- This file is a planning artifact only. Implementation lanes will convert it into concrete code/test changes later.
