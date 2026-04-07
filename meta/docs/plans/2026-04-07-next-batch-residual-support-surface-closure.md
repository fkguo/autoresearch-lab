# 2026-04-07 Residual Support Surface Closure Plan

## Context

`M-22A` already pushed the generic lifecycle mutations back onto `autoresearch`, and `M-22B` removed the `research_workflow_v1` / `workflow-templates` schema residue. This leaves several support surfaces (`run` residual non-computation workflows, `doctor`, `bridge`, `literature-gap`, and internal lifecycle helpers such as `start` / `checkpoint` / `request-approval` / `reject`) living inside [`packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py`](/Users/fkg/Coding/Agents/autoresearch-lab/packages/hep-autoresearch/src/hep_autoresearch/orchestrator_cli.py) and related docs. These surfaces may remain only as provider-local compatibility helpers, diagnostics, or maintainer/eval tooling, never as a second generic front door.

## Objective

Source-ground and constrain the remaining Pipeline A support surface so that:
- commands/comments clearly classify each entry as either `delete`, `repoint`, or `keep-internal`
- the installable public shell never regains generic lifecycle/control-plane authority
- docs/tests reflect the same authority taxonomy rather than relying on unstated assumptions

## Current source-grounded split

The current residual surface is no longer one undifferentiated “legacy CLI” blob. It now breaks into three concrete implementation slices:

1. **public residual non-computation `run`**
   - still the highest-risk leftover because it remains a real Python workflow orchestrator rather than a thin compatibility wrapper
2. **internal diagnostics / bridge truth**
   - `doctor`, `bridge`, and `literature-gap` are already internal-only on the installable shell, but normative contract and package-local docs still need rebaseline
3. **adjacent authoring / support residue**
   - `run-card`, `method-design`, and nearby action docs still project Python-side authoring paths more strongly than they should

## Recommended implementation split

### Slice 1: public residual non-computation `run`

Scope:

- the public `run --workflow-id` survivors that still live on installable `hepar`
- exact workflow inventory, direct CLI coverage, and package-doc authority wording

Goal:

- shrink `run` from “real Python workflow authority” into either a smaller compatibility wrapper or an internal-only surface
- if any public workflow survives, each survivor must have direct CLI contract coverage rather than only eval anchors or implied doc wording

Suggested acceptance:

- `python3 -m pytest packages/hep-autoresearch/tests/test_public_cli_surface.py packages/hep-autoresearch/tests/test_paper_reviser_workflow.py packages/hep-autoresearch/tests/test_adapter_gate_resolution_cli.py -q`
- `pnpm --filter @autoresearch/hep-mcp test -- tests/docs/docToolDrift.test.ts`
- `node scripts/check-shell-boundary-anti-drift.mjs`

### Slice 2: internal diagnostics / bridge truth rebaseline

Scope:

- `doctor`
- `bridge`
- `literature-gap`
- normative contract and maintainer-facing docs that still talk about these surfaces as if they were public default behavior

Goal:

- keep code/tests where useful for maintainer/eval coverage
- make the only valid public truth “internal full parser / maintainer-only compatibility surface”
- stop `meta/ECOSYSTEM_DEV_CONTRACT.md` and adjacent docs from re-promoting them into public contract authority

Suggested acceptance:

- `python3 -m pytest packages/hep-autoresearch/tests/test_doctor_entrypoints_cli.py packages/hep-autoresearch/tests/test_mcp_doctor_and_bridge_cli.py packages/hep-autoresearch/tests/test_literature_gap_cli.py packages/hep-autoresearch/tests/test_public_cli_surface.py -q`

### Slice 3: adjacent authoring / support cleanup

Scope:

- `run-card validate|render`
- `method-design`
- package-local docs that still present legacy Python authoring/run paths as default operations

Goal:

- keep only bounded support surfaces that still earn their existence
- ensure docs frame them as package-local compatibility tooling rather than current front-door behavior
- add direct CLI coverage wherever a support command remains public

Suggested acceptance:

- `python3 -m pytest packages/hep-autoresearch/tests/test_method_design_cli.py packages/hep-autoresearch/tests/test_orchestrator_computation_cli.py packages/hep-autoresearch/tests/test_migrate.py -q`
- `node scripts/check-shell-boundary-anti-drift.mjs`
- `git diff --check`

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
   - Record the recommended sequence explicitly as `run residue -> diagnostics/bridge truth rebaseline -> adjacent authoring/support cleanup`.
   - Capture which surfaces are expected to survive as bounded compatibility helpers and which should be deleted or repointed.
   - Capture acceptance commands + review requirements so downstream implementation lanes can build from this plan without re-deriving the scope.

## Deliverables

- A checked-in command/surface inventory or classification table for the residual support surfaces
- A downstream implementation prompt that can be handed to an implementation lane without redoing the census
- A front-door/projection-only review checklist that points reviewers at the exact files/tests to challenge
- A stable slice order that prevents `run` / contract drift / authoring docs from being mixed into one oversized cleanup

## Acceptance shape

- The plan produces a checked-in inventory of residual support surfaces with a classification for each command/tool.
- Front-door docs and test suites can depend directly on that inventory (for example `scripts/check-shell-boundary-anti-drift.mjs` reading it and `docToolDrift.test.ts` validating it).
- Acceptance commands for the eventual implementation lane should be selected per slice from the sets above rather than treated as one monolithic retirement gate.

## Dependencies & constraints

- Lane A (command taxonomy) must publish the baseline inventory before this plan's implementation lane begins, so classifications stay consistent.
- Existing guard scripts (`front-door-boundary-authority`, `check-shell-boundary-anti-drift`) already enforce parts of this boundary and should be referenced rather than duplicated.
- This file is a planning artifact only. Implementation lanes will convert it into concrete code/test changes later.
